from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4
from catalog import CATALOG


def timestamp(epoch):
    return datetime.fromtimestamp(epoch, timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "Z")


def build_order(request, key, owner, now, products=None):
    identifier = str(uuid4())
    items = []
    total = Decimal("0.00")
    for item in request["items"]:
        product = (CATALOG if products is None else products)[item["product_sku"]]
        line_total = product["unit_price"] * item["quantity"]
        total += line_total
        # Revision is transport validation metadata, not an order snapshot field.
        items.append({"product_sku": item['product_sku'], "quantity": item['quantity'], "order_item_id": str(uuid4()), "product_name": product["name"], "unit_price": str(product["unit_price"]), "line_total": str(line_total.quantize(Decimal("0.01")))})
    created = timestamp(now)
    return {"PK": f"ORDER#{identifier}", "SK": "META", "order_id": identifier, "session_hash": owner, "customer_email": request["customer_email"], "idempotency_key": key, "status": "PENDING", "items": items, "total_amount": str(total.quantize(Decimal("0.01"))), "currency": "USD", "failure_reason": None, "created_at": created, "updated_at": created, "expires_at": int(now) + 86400, "GSI1PK": f"SESSION#{owner}", "GSI1SK": f"CREATED#{created}#{identifier}"}


def public_order(order):
    fields = ["order_id", "customer_email", "idempotency_key", "status", "total_amount", "currency", "failure_reason", "created_at", "updated_at"]
    result = {key: order[key] for key in fields}
    item_fields = ('product_sku', 'order_item_id', 'product_name', 'unit_price', 'line_total')
    result["items"] = [{**{key:item[key] for key in item_fields}, "quantity": int(item["quantity"])} for item in order["items"]]
    result["expires_at"] = timestamp(int(order["expires_at"]))
    return result
