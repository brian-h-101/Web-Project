"""Local integration preview only: Moto replaces DynamoDB; never a Lambda entry point."""
import argparse
import json
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import urlsplit


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--offline-preview", action="store_true", required=True)
    parser.add_argument("--port", type=int, default=5180)
    parser.add_argument("--clock-file", type=Path, help="Owned local test clock containing UTC epoch seconds; no production transport.")
    parser.add_argument("--fixture-info", type=Path, help="Write only the owned local private-fixture UUID.")
    args = parser.parse_args()
    os.environ.update(AWS_ACCESS_KEY_ID="testing", AWS_SECRET_ACCESS_KEY="testing", AWS_SESSION_TOKEN="testing", AWS_DEFAULT_REGION="us-east-2", AWS_EC2_METADATA_DISABLED="true")
    import boto3
    from moto import mock_aws
    from botocore.httpsession import URLLib3Session
    import handler as application
    from repositories import DynamoDBRepository
    from services.public_order_service import PublicOrderService
    from models import build_order
    from repositories.dynamodb_repository import encode
    from uuid import uuid4
    import time
    root = Path(__file__).resolve().parents[2] / "Frontend" / "dist"
    if not (root / "demos/commerce-ordering-platform/index.html").is_file():
        raise SystemExit("Run npm run build before starting the integrated preview.")
    with mock_aws():
        # Moto intercepts requests before transport. Any accidental real SDK
        # request must fail rather than touching an account during preview.
        def blocked(*unused, **kwargs):
            raise RuntimeError("Network AWS calls are prohibited in offline preview.")
        URLLib3Session.send = blocked
        client = boto3.client("dynamodb", region_name="us-east-2")
        client.create_table(TableName="OfflineCommerceDemo", BillingMode="PAY_PER_REQUEST", KeySchema=[{"AttributeName": "PK", "KeyType": "HASH"}, {"AttributeName": "SK", "KeyType": "RANGE"}], AttributeDefinitions=[{"AttributeName": name, "AttributeType": "S"} for name in ["PK", "SK", "GSI1PK", "GSI1SK"]], GlobalSecondaryIndexes=[{"IndexName": "SessionHistory", "KeySchema": [{"AttributeName": "GSI1PK", "KeyType": "HASH"}, {"AttributeName": "GSI1SK", "KeyType": "RANGE"}], "Projection": {"ProjectionType": "ALL"}}])
        clock = (lambda: float(args.clock_file.read_text())) if args.clock_file else time.time
        repository = DynamoDBRepository(client, "OfflineCommerceDemo")
        application._service = PublicOrderService(repository, clock=clock)
        os.environ['ORDER_CONTRACT'] = 'public-orders-v1'
        # This legacy row exists only in Moto memory. It must stay inaccessible.
        old = build_order({'customer_email':'legacy@example.com','items':[{'product_sku':'PRODUCT-001','quantity':1}],'simulate_failure':False},str(uuid4()),'a'*64,clock())
        client.put_item(TableName='OfflineCommerceDemo',Item=encode(old))
        if args.fixture_info:
            args.fixture_info.write_text(json.dumps({'offline_only':True,'legacy_order_id':old['order_id'],'pid':os.getpid()}))

        class Preview(SimpleHTTPRequestHandler):
            def __init__(self, *values, **kwargs):
                super().__init__(*values, directory=str(root), **kwargs)

            def log_message(self, *unused):
                pass

            def end_headers(self):
                self.send_header("X-Frame-Options", "SAMEORIGIN")
                self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-src 'self'; frame-ancestors 'self'; connect-src 'self'; object-src 'none'")
                super().end_headers()

            def api(self):
                parsed = urlsplit(self.path)
                length = int(self.headers.get("Content-Length", "0"))
                if length > application.MAX_BODY_BYTES:
                    result = application.response(413, {"error": {"code": "payload_too_large", "message": "Request body exceeds 64 KiB.", "details": []}})
                else:
                    body = self.rfile.read(length).decode("utf-8") if length else None
                    result = application.handler({"version": "2.0", "rawPath": parsed.path, "rawQueryString": parsed.query, "requestContext": {"http": {"method": self.command}}, "headers": dict(self.headers.items()), "body": body, "isBase64Encoded": False}, SimpleNamespace(aws_request_id="offline-preview"))
                self.send_response(result["statusCode"])
                for name, value in result["headers"].items():
                    self.send_header(name, value)
                encoded = result["body"].encode()
                self.send_header("Content-Length", str(len(encoded)))
                self.end_headers()
                self.wfile.write(encoded)

            def do_GET(self):
                parsed = urlsplit(self.path)
                if parsed.path.startswith("/api/"):
                    return self.api()
                if parsed.path.startswith("/projects/") and "." not in parsed.path.rsplit("/", 1)[-1]:
                    self.path = "/index.html"
                super().do_GET()

            def do_POST(self):
                self.api()

        print(f"OFFLINE MOCK PREVIEW (no AWS): http://127.0.0.1:{args.port}", flush=True)
        ThreadingHTTPServer(("127.0.0.1", args.port), Preview).serve_forever()


if __name__ == "__main__":
    main()
