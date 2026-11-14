"""Versioned public data boundary and pinned Eastern calendar, not an identity."""
from datetime import date, datetime, time, timedelta, timezone
import hashlib
import json
from pathlib import Path
from zoneinfo import ZoneInfo
from errors import OrderError

CONTRACT = 'public-orders-v1'
PRIVATE_CONTRACT = 'private-session-v1'
TIMEZONE = 'America/New_York'
_data = Path(__file__).resolve().parent / 'timezone_data'
_provenance = json.loads((_data / 'provenance.json').read_text())
_bytes = (_data / 'America_New_York.tzif').read_bytes()
if hashlib.sha256(_bytes).hexdigest() != _provenance['zone_sha256']:
    raise RuntimeError('Pinned public-order timezone data failed integrity validation.')
with (_data / 'America_New_York.tzif').open('rb') as stream:
    EASTERN = ZoneInfo.from_file(stream, key=TIMEZONE)


def utc_timestamp(epoch):
    return datetime.fromtimestamp(epoch, timezone.utc).isoformat(timespec='microseconds').replace('+00:00', 'Z')


def day_bounds(day):
    local = date.fromisoformat(day)
    return (int(datetime.combine(local, time.min, EASTERN).timestamp()),
            int(datetime.combine(local + timedelta(days=1), time.min, EASTERN).timestamp()))


def public_context(now):
    day = datetime.fromtimestamp(now, EASTERN).date().isoformat()
    return {'contract': CONTRACT, 'timezone': TIMEZONE, 'business_day': day,
            'server_now': utc_timestamp(now), 'expires_at': utc_timestamp(day_bounds(day)[1])}


def intent_context(now):
    context = public_context(now)
    return {key: context[key] for key in ('contract', 'business_day', 'expires_at')}


def validate_intent(value, now):
    if not isinstance(value, dict) or set(value) != {'contract', 'business_day', 'expires_at'} or value.get('contract') != CONTRACT:
        raise OrderError('Reload this demonstration to review the shared public order notice before submitting.', 428, 'public_contract_required')
    if value != intent_context(now):
        raise OrderError('This public request belongs to an expired or different Eastern day. Start a new order; the saved request cannot be moved to today.', 409, 'public_context_expired')
    return value


def partition(day):
    return f'PUBLIC#{CONTRACT}#{day}'


def marker_key(day, key):
    return f'IDEMPOTENCY#PUBLIC#{CONTRACT}#{day}#{key}'


def is_public_order(order, now):
    if not isinstance(order, dict) or order.get('public_contract') != CONTRACT or 'session_hash' in order:
        return False
    try:
        day = order['business_day']; start, expiry = day_bounds(day)
        created = datetime.fromisoformat(order['created_at'].replace('Z', '+00:00')).timestamp()
        return (day == public_context(now)['business_day'] and order.get('expires_at') == expiry and expiry > now
                and start <= created < expiry and order.get('PK') == 'ORDER#' + order['order_id']
                and order.get('SK') == 'META' and order.get('GSI1PK') == partition(day)
                and order.get('GSI1SK') == f"CREATED#{order['created_at']}#{order['order_id']}")
    except (KeyError, ValueError, TypeError, OverflowError):
        return False


def shared_order(order):
    # Request/owner/marker fields are deliberately absent from every public view.
    fields = ('order_id', 'customer_email', 'status', 'total_amount', 'currency', 'failure_reason', 'created_at', 'updated_at', 'business_day')
    result = {key: order[key] for key in fields}
    result['public_contract'] = CONTRACT
    result['expires_at'] = utc_timestamp(int(order['expires_at']))
    item_fields = ('product_sku', 'order_item_id', 'product_name', 'unit_price', 'line_total')
    result['items'] = [{**{key: item[key] for key in item_fields}, 'quantity': int(item['quantity'])} for item in order['items']]
    return result
