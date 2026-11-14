import base64
import binascii
import json
import logging
import re
import os
from urllib.parse import parse_qs
from catalog import list_products
from errors import OrderError
from repositories import DynamoDBRepository
from services import OrderService
from validators import session_hash
from Shared.catalog_repository import CatalogUnavailable
from Shared.request_observation import observe, failure

MAX_BODY_BYTES = 65536
_service = None
logger = logging.getLogger(__name__)


def service():
    global _service
    if _service is None:
        if os.environ.get('ORDER_CONTRACT') == 'public-orders-v1':
            from services.public_order_service import PublicOrderService
            _service = PublicOrderService(DynamoDBRepository.from_environment())
        else:
            _service = OrderService(DynamoDBRepository.from_environment())
    return _service


def response(status, body):
    return {"statusCode": status, "headers": {"content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff"}, "isBase64Encoded": False, "body": json.dumps(body, separators=(",", ":"))}


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON field")
        result[key] = value
    return result


def request_body(event):
    raw = event.get("body") or ""
    if not isinstance(raw, str):
        raise OrderError("The body must contain JSON.")
    if len(raw) > (MAX_BODY_BYTES * 4 // 3 + 4 if event.get("isBase64Encoded") else MAX_BODY_BYTES):
        raise OrderError("Request body exceeds 64 KiB.", 413, "payload_too_large")
    try:
        body = base64.b64decode(raw, validate=True) if event.get("isBase64Encoded") else raw.encode("utf-8")
        if len(body) > MAX_BODY_BYTES:
            raise OrderError("Request body exceeds 64 KiB.", 413, "payload_too_large")
        return json.loads(body.decode("utf-8"), object_pairs_hook=unique_object, parse_constant=lambda value: (_ for _ in ()).throw(ValueError("Invalid JSON number")))
    except (ValueError, UnicodeError, binascii.Error):
        raise OrderError("The request body must be valid JSON.") from None


@observe
def handler(event, context):
    try:
        if not isinstance(event, dict) or event.get("version") != "2.0":
            raise OrderError("An API Gateway HTTP API payload-format 2.0 event is required.")
        method = event.get("requestContext", {}).get("http", {}).get("method")
        path = event.get("rawPath")
        headers = {key.lower(): value for key, value in (event.get("headers") or {}).items()}
        public = os.environ.get('ORDER_CONTRACT') == 'public-orders-v1'
        def result(status, value):
            if public:
                from public_orders import public_context
                current = public_context(service().clock())
                if 'order_id' in value and (value.get('business_day') != current['business_day'] or value.get('expires_at') != current['expires_at']):
                    raise OrderError('Order not found.', 404, 'not_found')
                if 'orders' in value and any(row.get('business_day') != current['business_day'] for row in value['orders']):
                    raise OrderError('The public day changed during this read. Refresh history.', 409, 'public_day_changed')
                value = {**value, 'public_context': current}
            return response(status, value)
        if method == "GET" and path == "/api/health":
            return result(200, {"status": "ok", "service": "commerce-demo"})
        if method == "GET" and path == "/api/products":
            products = list_products() if os.environ.get("CATALOG_MODE", "legacy") == "legacy" else service().catalog.list_products()
            return result(200, {"products": products})
        match = re.fullmatch(r"/api/orders(?:/([^/]+)(/cancel)?)?", path or "")
        if not match:
            raise OrderError("API route not found.", 404, "not_found")
        identifier, cancellation = match.groups()
        allowed = ["POST"] if cancellation else ["GET"] if identifier else ["GET", "POST"]
        if method not in allowed:
            raise OrderError("Method not allowed.", 405, "method_not_allowed")
        owner = None if public else session_hash(headers.get("x-demo-session"))
        if method == "POST" and not identifier:
            if not isinstance(headers.get("content-type"), str) or headers["content-type"].split(";", 1)[0].strip().lower() != "application/json":
                raise OrderError("Content-Type must be application/json.")
            values = (request_body(event), headers.get('idempotency-key'))
            order, status = service().create(*values) if public else service().create(*values, owner)
            return result(status, order)
        if method == "GET" and not identifier:
            query = parse_qs(event.get("rawQueryString") or "", keep_blank_values=True)
            if set(query) - {"limit"} or len(query.get("limit", ["20"])) != 1:
                raise OrderError("Only one bounded limit query parameter is supported.")
            limit = query.get("limit", ["20"])[0]
            if not re.fullmatch(r"[0-9]{1,3}", limit):
                raise OrderError("limit must be between 1 and 100.")
            return result(200, {'orders': service().recent(int(limit)) if public else service().recent(owner, int(limit))})
        if public:
            if cancellation:
                body = request_body(event) if event.get('body') else {}
                if not isinstance(body, dict) or set(body) - {'public_context'}: raise OrderError('Only public_context is accepted for cancellation.')
                order = service().cancel(identifier, body.get('public_context'))
            else: order = service().get(identifier)
            return result(200, order)
        return response(200, service().cancel(identifier, owner) if cancellation else service().get(identifier, owner))
    except OrderError as error:
        return response(error.status, {"error": {"code": error.code, "message": str(error), "details": error.details}})
    except CatalogUnavailable as error:
        failure(logger, error, event, context)
        return response(503, {'error': {'code':'catalog_unavailable','message':'The published catalog is temporarily unavailable. Reload the catalog.','details':[]}})
    except Exception as error:
        failure(logger, error, event, context)
        return response(500, {"error": {"code": "internal_error", "message": "The request could not be completed. Retry the original request shortly.", "details": []}})
