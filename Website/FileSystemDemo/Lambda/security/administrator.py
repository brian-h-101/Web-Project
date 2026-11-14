"""Authorization of API Gateway-verified access-token claims, never browser roles."""
import json
import os
import time
import math
import re
from errors import AppError

SCOPE = "catalog/write"
PERMISSIONS = ["nodes:read", "nodes:create", "nodes:update", "nodes:delete", "documents:read", "documents:create", "documents:update_any", "documents:tag_any", "documents:delete", "tags:create", "tags:manage", "catalog:write"]


def administrator(event):
    context = event.get("requestContext", {}).get("authorizer", {}).get("jwt", {})
    claims = context.get("claims")
    if not isinstance(claims, dict) or not os.environ.get("COGNITO_ISSUER") or not os.environ.get("COGNITO_CLIENT_ID"):
        raise AppError("A verified administrator access token is required.", 401, "unauthenticated")
    try:
        groups = claims.get("cognito:groups", [])
        if isinstance(groups, str):
            if groups.startswith('['):
                try:
                    groups = json.loads(groups)
                except ValueError:
                    # Some Gateway claim maps stringify a native string list
                    # without JSON quotes. Parse complete entries, never substrings.
                    if not re.fullmatch(r'\[[A-Za-z0-9_+=,.@ -]+\]', groups):
                        raise ValueError()
                    groups = [group.strip() for group in groups[1:-1].split(',')]
            else:
                groups = groups.split(',')
        scopes = claims.get("scope", "").split()
        if not isinstance(groups, list) or not all(isinstance(group, str) for group in groups):
            raise ValueError()
        expiration = float(claims.get('exp', 0))
        valid = (math.isfinite(expiration) and claims.get("token_use") == "access" and claims.get("iss") == os.environ["COGNITO_ISSUER"]
            and claims.get("client_id") == os.environ["COGNITO_CLIENT_ID"] and expiration > time.time()
            and claims.get("sub") and SCOPE in scopes and "CatalogAdmins" in groups)
    except (ValueError, TypeError, AttributeError):
        valid = False
    if not valid:
        raise AppError("This token cannot administer the shared catalog.", 403, "forbidden")
    return {"id": claims["sub"], "username": claims.get("username", "Administrator"), "role": "administrator", "permissions": PERMISSIONS}
