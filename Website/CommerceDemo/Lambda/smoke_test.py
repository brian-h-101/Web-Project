"""Explicitly approved live smoke test: at most three temporary logical orders."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import secrets
import sys
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from uuid import uuid4


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--live", action="store_true", required=True)
    args = parser.parse_args()
    site = json.loads((Path(__file__).resolve().parents[2] / "Infrastructure/config/site.json").read_text())
    domain = site["domainName"]
    phrase = f"SMOKE {domain}"
    if not sys.stdin.isatty() or input(f"Creates up to three sample orders in AWS; charges may apply. Type {phrase}: ").strip() != phrase:
        raise SystemExit("Live smoke test was not approved.")
    token = secrets.token_hex(32)
    payload = {"customer_email": "smoke@example.com", "items": [{"product_sku": "PRODUCT-001", "quantity": 2}], "simulate_failure": False}

    def request(method, path, body=None, key=None, session=token):
        headers = {"Content-Type": "application/json", "X-Demo-Session": session}
        if key:
            headers["Idempotency-Key"] = key
        for attempt in range(5):
            req = Request(f"https://{domain}{path}", data=json.dumps(body).encode() if body is not None else None, headers=headers, method=method)
            try:
                with urlopen(req, timeout=15) as response:
                    return response.status, json.load(response)
            except HTTPError as error:
                if error.code in {429, 503} and attempt < 4:
                    time.sleep(1 + attempt)
                    continue
                return error.code, json.load(error)
        raise AssertionError("API remained throttled.")

    assert request("GET", "/api/health")[1]["status"] == "ok"
    key = str(uuid4())
    status, order = request("POST", "/api/orders", payload, key)
    assert status == 201 and order["status"] == "CONFIRMED" and order["total_amount"] == "25.00"
    assert request("POST", "/api/orders", payload, key) == (200, order)
    assert request("POST", "/api/orders", {**payload, "simulate_failure": True}, key)[0] == 409
    assert request("POST", "/api/orders", {**payload, "customer_email": "private@gmail.com"}, str(uuid4()))[0] == 400
    assert request("GET", f"/api/orders/{order['order_id']}")[1] == order
    assert request("GET", f"/api/orders/{order['order_id']}", session=secrets.token_hex(32))[0] == 404
    assert request("POST", f"/api/orders/{order['order_id']}/cancel")[1]["status"] == "CANCELLED"
    assert request("POST", "/api/orders", payload, key)[1]["status"] == "CANCELLED"
    status, failed = request("POST", "/api/orders", {**payload, "simulate_failure": True}, str(uuid4()))
    assert status == 201 and failed["status"] == "FAILED"
    race_key = str(uuid4())
    with ThreadPoolExecutor(max_workers=2) as workers:
        results = list(workers.map(lambda unused: request("POST", "/api/orders", payload, race_key), range(2)))
    assert sorted(status for status, unused in results) == [200, 201]
    assert len({result["order_id"] for unused, result in results}) == 1
    assert request("GET", "/api/orders")[0] == 200
    print("Approved live sample-order smoke checks passed. Sample records were retained for TTL expiration; no existing data was deleted.")


if __name__ == "__main__":
    main()
