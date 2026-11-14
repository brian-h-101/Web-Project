import hashlib
import json
from errors import ConcurrentTransaction, ConditionalCancellation, DuplicateSubmission, OrderError
from models import build_order
from services.order_service import OrderService
from validators import parse_uuid
from Shared.catalog_repository import LegacyCatalog, CatalogChanged
from public_orders import CONTRACT, is_public_order, marker_key, partition, public_context, shared_order, validate_intent, utc_timestamp, day_bounds


class PublicOrderService(OrderService):
    """Same domain processor/catalog/transactions; separate explicit public namespace."""
    def context(self):
        return public_context(self.clock())

    def readable(self, identifier):
        row = self.repository.order(parse_uuid(identifier, 'order_id'))
        if not is_public_order(row, self.clock()):
            raise OrderError('Order not found.', 404, 'not_found')
        return row

    def replay_public(self, marker, intent, request_hash):
        validate_intent(intent, self.clock())
        if (marker.get('public_contract') != CONTRACT or marker.get('business_day') != intent['business_day']
                or 'session_hash' in marker or marker.get('expires_at') != day_bounds(intent['business_day'])[1]
                or marker.get('request_hash') != request_hash):
            raise OrderError('This public request key was used for different order details.', 409, 'idempotency_conflict')
        return shared_order(self.readable(marker['order_id'])), 200

    def create(self, payload, key):
        if not isinstance(payload, dict):
            raise OrderError('The request must be a JSON object.')
        intent = validate_intent(payload.get('public_context'), self.clock())
        key = parse_uuid(key, 'Idempotency-Key')
        request = self.validator.validate({k: v for k, v in payload.items() if k != 'public_context'})
        request_hash = hashlib.sha256(json.dumps({'public_context': intent, **request}, sort_keys=True, separators=(',', ':'), ensure_ascii=True).encode()).hexdigest()
        existing = self.repository.public_marker(intent['business_day'], key)
        if existing:
            return self.replay_public(existing, intent, request_hash)
        try:
            products = self.catalog.resolve(item['product_sku'] for item in request['items'])
        except KeyError:
            if isinstance(self.catalog, LegacyCatalog):
                raise OrderError('Select a product from the demo catalog.') from None
            raise OrderError('A selected product is unavailable. Refresh the catalog.', 409, 'product_unavailable') from None
        except CatalogChanged:
            raise OrderError('The catalog changed while reading. Refresh and review before submitting.', 409, 'catalog_changed') from None
        now = self.clock(); validate_intent(intent, now)
        if any('catalog_revision' in item and item['catalog_revision'] != products[item['product_sku']].get('revision') for item in request['items']):
            raise OrderError('A selected product changed. Refresh and review before submitting.', 409, 'catalog_changed')
        order = build_order(request, key, None, now, products)
        for field in ('session_hash', 'idempotency_key'):
            order.pop(field)
        order.update(public_contract=CONTRACT, business_day=intent['business_day'], expires_at=day_bounds(intent['business_day'])[1], GSI1PK=partition(intent['business_day']))
        self.processor.process(order, request['simulate_failure'])
        marker = {'PK': marker_key(intent['business_day'], key), 'SK': 'META', 'public_contract': CONTRACT,
                  'business_day': intent['business_day'], 'request_hash': request_hash, 'order_id': order['order_id'], 'expires_at': order['expires_at']}
        for attempt in range(3):
            validate_intent(intent, self.clock())
            checks = self.catalog.checks(products)
            validate_intent(intent, self.clock())
            try:
                if checks: self.repository.create_atomic(order, marker, checks)
                else: self.repository.create_atomic(order, marker)
                # A delayed/ambiguous boundary commit never makes an expired result
                # visible or renews its original day/TTL. No compensating deletion.
                validate_intent(intent, self.clock())
                return shared_order(order), 201
            except (DuplicateSubmission, ConcurrentTransaction) as conflict:
                for retry in range(3):
                    validate_intent(intent, self.clock())
                    existing = self.repository.public_marker(intent['business_day'], key)
                    if existing: return self.replay_public(existing, intent, request_hash)
                    self.sleep(0.01 * (retry + 1))
                if isinstance(conflict, DuplicateSubmission): break
                if attempt < 2: self.sleep(0.02 * (attempt + 1))
        raise OrderError('This request is still being resolved. Retry the unchanged saved request while its public day is valid.', 503, 'request_pending')

    def get(self, identifier):
        return shared_order(self.readable(identifier))

    def recent(self, limit=20):
        if type(limit) is not int or not 1 <= limit <= 100:
            raise OrderError('limit must be between 1 and 100.')
        context = self.context()
        rows = self.repository.public_history(context['business_day'], limit, self.clock())
        if self.context()['business_day'] != context['business_day']:
            raise OrderError('The public day changed during this read. Refresh history.', 409, 'public_day_changed')
        # If a row expires during processing, it cannot be returned to the client.
        return [shared_order(row) for row in rows if is_public_order(row, self.clock())]

    def cancel(self, identifier, intent=None):
        row = self.readable(identifier)
        validate_intent(intent, self.clock())
        if row['status'] == 'CANCELLED': return shared_order(row)
        if row['status'] != 'CONFIRMED':
            raise OrderError(f"Cannot change an order from {row['status']} to CANCELLED.", 409, 'invalid_transition')
        now = self.clock()
        try:
            changed = self.repository.cancel_public(row['order_id'], row['business_day'], now, utc_timestamp(now))
            if not is_public_order(changed, self.clock()):
                raise OrderError('Order not found.', 404, 'not_found')
            return shared_order(changed)
        except ConditionalCancellation:
            current = self.readable(identifier)
            if current['status'] == 'CANCELLED': return shared_order(current)
            raise OrderError('The order changed before cancellation. Retrieve it again.', 409, 'invalid_transition') from None
