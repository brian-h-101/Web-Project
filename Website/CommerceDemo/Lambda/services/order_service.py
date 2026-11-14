import hashlib
import json
import time
from errors import ConditionalCancellation, ConcurrentTransaction, DuplicateSubmission, OrderError
from models import build_order, public_order
from models.order import timestamp
from services.order_processor import OrderProcessor
from validators import OrderValidator, parse_uuid
from catalog_provider import provider
from Shared.catalog_repository import LegacyCatalog, CatalogChanged


class OrderService:
    def __init__(self, repository, clock=time.time, sleep=time.sleep, processor=None, catalog=None):
        self.repository = repository
        self.clock = clock
        self.sleep = sleep
        self.processor = processor or OrderProcessor()
        self.validator = OrderValidator()
        self.catalog = catalog or provider(repository)
        # The request hash excludes mutable catalog state so old markers replay.
        self.validator.catalog = None

    def owned(self, identifier, owner):
        order = self.repository.order(parse_uuid(identifier, "order_id"))
        if not order or order.get("session_hash") != owner or order.get("expires_at", 0) <= self.clock():
            raise OrderError("Order not found.", 404, "not_found")
        return order

    def replay(self, marker, owner, request_hash):
        if marker.get("expires_at", 0) <= self.clock():
            raise OrderError("This demonstration request key has expired. Start a new order with a fresh key.", 409, "idempotency_expired")
        if marker.get("session_hash") != owner or marker.get("request_hash") != request_hash:
            raise OrderError("This idempotency key was already used for a different order request.", 409, "idempotency_conflict")
        return public_order(self.owned(marker["order_id"], owner)), 200

    def create(self, payload, key, owner):
        key = parse_uuid(key, "Idempotency-Key")
        request = self.validator.validate(payload)
        request_hash = hashlib.sha256(json.dumps(request, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("utf-8")).hexdigest()
        existing = self.repository.marker(owner, key)
        if existing:
            return self.replay(existing, owner, request_hash)
        try:
            products = self.catalog.resolve(item["product_sku"] for item in request["items"])
        except KeyError:
            if isinstance(self.catalog, LegacyCatalog):
                raise OrderError("Select a product from the demo catalog.") from None
            raise OrderError("A selected product is unavailable. Refresh the catalog.", 409, "product_unavailable") from None
        except CatalogChanged:
            raise OrderError('The catalog changed while reading. Refresh and review before submitting.',409,'catalog_changed') from None
        now = self.clock()
        if any('catalog_revision' in item and item['catalog_revision'] != products[item['product_sku']].get('revision') for item in request['items']):
            raise OrderError('A selected product changed. Refresh and review the catalog before submitting.', 409, 'catalog_changed')
        order = build_order(request, key, owner, now, products)
        self.processor.process(order, request["simulate_failure"])
        marker = {"PK": f"IDEMPOTENCY#{owner}#{key}", "SK": "META", "request_hash": request_hash, "order_id": order["order_id"], "session_hash": owner, "expires_at": order["expires_at"]}
        for attempt in range(3):
            try:
                checks = self.catalog.checks(products)
                if checks:
                    self.repository.create_atomic(order, marker, checks)
                else:
                    self.repository.create_atomic(order, marker)
                return public_order(order), 201
            except (DuplicateSubmission, ConcurrentTransaction) as conflict:
                for retry in range(3):
                    existing = self.repository.marker(owner, key)
                    if existing:
                        return self.replay(existing, owner, request_hash)
                    self.sleep(0.01 * (retry + 1))
                if isinstance(conflict, DuplicateSubmission):
                    break
                if attempt < 2:
                    self.sleep(0.02 * (attempt + 1))
        raise OrderError("This request is still being resolved. Retry the original request shortly.", 503, "request_pending")

    def get(self, identifier, owner):
        return public_order(self.owned(identifier, owner))

    def recent(self, owner, limit=20):
        if type(limit) is not int or not 1 <= limit <= 100:
            raise OrderError("limit must be between 1 and 100.")
        return [public_order(order) for order in self.repository.history(owner, limit, self.clock())]

    def cancel(self, identifier, owner):
        order = self.owned(identifier, owner)
        if order["status"] == "CANCELLED":
            return public_order(order)
        if order["status"] != "CONFIRMED":
            raise OrderError(f"Cannot change an order from {order['status']} to CANCELLED.", 409, "invalid_transition")
        now = self.clock()
        try:
            return public_order(self.repository.cancel(order["order_id"], owner, now, timestamp(now)))
        except ConditionalCancellation:
            current = self.owned(identifier, owner)
            if current["status"] == "CANCELLED":
                return public_order(current)
            raise OrderError("The order changed before cancellation. Retrieve it again.", 409, "invalid_transition") from None
