"""Safe request correlation without payloads, headers, identities or raw paths."""
from functools import wraps
import json
import logging
import re

logger = logging.getLogger('portfolio_requests')
logger.setLevel(logging.INFO)


def safe(value):
    return re.sub(r'[^A-Za-z0-9_=+./{} -]', '?', str(value or 'unavailable'))[:160]


def observe(function):
    @wraps(function)
    def wrapped(event, context, *args, **kwargs):
        response = function(event, context, *args, **kwargs)
        request = event.get('requestContext', {}) if isinstance(event, dict) else {}
        gateway_id = safe(request.get('requestId'))
        code = None
        if response.get('statusCode', 500) >= 400:
            try:
                code = json.loads(response.get('body', '{}')).get('error', {}).get('code')
            except (ValueError, TypeError, AttributeError):
                pass
        logger.info('api_request gateway_request_id=%s lambda_request_id=%s route=%s status=%s error_code=%s',
            gateway_id, safe(getattr(context,'aws_request_id',None)), safe(request.get('routeKey')),
            response.get('statusCode'), safe(code))
        response.setdefault('headers', {})['x-request-id'] = gateway_id
        return response
    return wrapped


def failure(logger, error, event, context):
    request = event.get('requestContext', {}) if isinstance(event, dict) else {}
    code = getattr(error, 'response', {}).get('Error', {}).get('Code')
    logger.error('request_failed gateway_request_id=%s lambda_request_id=%s error_type=%s aws_error_code=%s',
        safe(request.get('requestId')),safe(getattr(context,'aws_request_id',None)),safe(type(error).__name__),safe(code))
