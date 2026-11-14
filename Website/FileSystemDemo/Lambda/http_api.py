import base64
import json
import logging
import os
import re
from decimal import Decimal
from urllib.parse import parse_qs, quote
from errors import AppError
from repositories.catalog_repository import CatalogRepository
from repositories.document_storage import DocumentStorage
from services.workspace import Snapshot
from services.catalog_service import CatalogService
from services.document_service import DocumentService
from services.file_system_service import FileSystemService
from services.search_service import SearchService
from services.tag_service import TagService
from security.administrator import administrator
from security.public_management import authorize as authorize_management, configuration as management_configuration
from validators import FORMATS, identifier, normalize, sku
from Shared.request_observation import observe, failure

logger = logging.getLogger(__name__)
_database = None
_storage = None
MAX_BODY = 3 * 1024 * 1024


def resources():
    global _database, _storage
    if _database is None:
        _database = CatalogRepository.from_environment()
    if _storage is None:
        _storage = DocumentStorage.from_environment()
    return _database, _storage


def response(status, value, mime=None, name=None):
    headers = {"cache-control": "private, no-store", "x-content-type-options": "nosniff", "content-type": mime or "application/json; charset=utf-8"}
    if name:
        headers["content-disposition"] = "attachment; filename*=UTF-8''" + quote(name, safe="")
    binary = isinstance(value, bytes)
    body = base64.b64encode(value).decode("ascii") if binary else json.dumps(value, default=lambda v: int(v) if isinstance(v, Decimal) else str(v), separators=(",", ":"))
    return {"statusCode": status, "headers": headers, "isBase64Encoded": binary, "body": body}


def body(event):
    headers = {str(k).lower(): v for k, v in (event.get("headers") or {}).items()}
    if str(headers.get("content-type", "")).split(";", 1)[0].strip().lower() != "application/json":
        raise AppError("Content-Type must be application/json.")
    raw = event.get("body") or ""
    if not isinstance(raw, str) or len(raw) > MAX_BODY * 4 // 3 + 4:
        raise AppError("Request body exceeds the supported size.", 413, "payload_too_large")
    try:
        raw = base64.b64decode(raw, validate=True) if event.get("isBase64Encoded") else raw.encode("utf-8")
        if len(raw) > MAX_BODY:
            raise AppError("Request body exceeds the supported size.", 413, "payload_too_large")
        def unique(pairs):
            result = {}
            for key, value in pairs:
                if key in result:
                    raise ValueError()
                result[key] = value
            return result
        value = json.loads(raw.decode("utf-8"), object_pairs_hook=unique, parse_constant=lambda value: (_ for _ in ()).throw(ValueError()))
        if not isinstance(value, dict):
            raise ValueError()
        return value
    except (ValueError, UnicodeError, TypeError):
        raise AppError("The body must be a valid JSON object without duplicate fields.") from None


def parameters(event):
    value = event.get("rawQueryString") or ""
    if len(value) > 4096:
        raise AppError("Query is too long.")
    values = parse_qs(value, keep_blank_values=True)
    if any(len(item) != 1 for item in values.values()):
        raise AppError("Repeated query parameters are unsupported.")
    return {key: item[0] for key, item in values.items()}


def read(path, query, database, storage, include_unpublished=False):
    search = SearchService(database)
    if path in {"/api/catalog/products", "/api/catalog/search"}:
        return search.search("PRODUCT", query, include_unpublished=include_unpublished)
    if path in {"/api/filesystem/documents", "/api/filesystem/search"}:
        return search.search("DOCUMENT", query, include_unpublished=include_unpublished)
    state = Snapshot(database)
    if path != '/api/catalog/tags' and query:
        raise AppError('Unsupported query parameter for this resource.')
    if path == "/api/catalog/tags":
        if set(query) - {"q"} or len(query.get("q", "")) > 80:
            raise AppError("Invalid tag-name query.")
        result = {"tags": [state.record(tag) for tag in sorted(state.tags.values(), key=lambda tag: (tag["normalized_name"], tag["id"])) if normalize(query.get("q", "")) in tag["normalized_name"]]}
    elif path.startswith("/api/catalog/products/"):
        item = state.products.get(sku(path.rsplit("/", 1)[1]))
        if not item or (not include_unpublished and item["status"] != "PUBLISHED"):
            raise AppError("Product not found.", 404, "not_found")
        result = state.record(item, public=not include_unpublished)
    elif path == "/api/filesystem/root":
        result = {"rootId": "root"}
    else:
        match = re.fullmatch(r"/api/filesystem/(nodes|documents)/([^/]+)(/(children|content|download))?", path)
        if not match:
            raise AppError("API route not found.", 404, "not_found")
        domain, key, _, action = match.groups()
        item = state.node(identifier(key), public=not include_unpublished)
        if domain == "documents" and item["type"] != "file":
            raise AppError("Document not found.", 404, "not_found")
        if action == "children":
            if domain != "nodes" or item["type"] != "folder":
                raise AppError("A folder is required.")
            rows, incomplete = database.query(database.filesystem, "CHILDREN#" + key, 41)
            if incomplete or len(rows) > 40:
                raise AppError("Directory exceeds its configured bound.", 503, "workspace_limit")
            children = [state.nodes.get(row["entity_id"]) for row in rows]
            result = {"folderId": key, "children": [state.record(child, public=not include_unpublished) for child in sorted((v for v in children if v and not v.get("deleted")), key=lambda v: (normalize(v["name"]), v["id"])) if include_unpublished or state.visible(child["id"])], "incomplete": False}
        elif action in {"content", "download"}:
            if item["type"] != "file":
                raise AppError("Folders have no downloadable content.")
            content = storage.read(item)
            state.verify()
            if action == "download" or item["format"] == "pdf":
                return response(200, content, FORMATS[item["format"]][1], item["name"])
            result = {"id": key, "content": content.decode("utf-8"), "revision": str(item["revision"])}
        else:
            result = state.record(item, public=not include_unpublished)
    state.verify()
    return result


@observe
def invoke(event, context, protected=False, management=False):
    try:
        if not isinstance(event, dict) or event.get("version") != "2.0":
            raise AppError("An HTTP API payload-format 2.0 event is required.")
        path = event.get("rawPath", "")
        method = event.get("requestContext", {}).get("http", {}).get("method")
        is_admin = "/admin/" in path
        if protected and management or (not management and (protected != is_admin or '/manage/' in path)):
            raise AppError("API route not found.", 404, "not_found")
        normalized_path = authorize_management(path,method) if management else path.replace('/admin/','/',1) if protected else path
        user = administrator(event) if protected else None
        if path in {"/api/catalog/health", "/api/filesystem/health"} and method == "GET":
            return response(200, {"status": "ok", "service": "filesystem-catalog"})
        if path == "/api/catalog/config" and method == "GET":
            return response(200, {"issuer": os.environ.get("COGNITO_ISSUER", ""), "clientId": os.environ.get("COGNITO_CLIENT_ID", ""), "loginDomain": os.environ.get("COGNITO_LOGIN_DOMAIN", ""), "callbackUrl": os.environ.get("COGNITO_CALLBACK", ""), "logoutUrl": os.environ.get("COGNITO_LOGOUT", ""), "scope": "openid catalog/write", "publicManagement":management_configuration()})
        if protected and path == "/api/catalog/admin/session" and method == "GET":
            return response(200, {"user": user})
        if not protected and not management and method != "GET":
            raise AppError("Public endpoints are read-only.", 405, "method_not_allowed")
        database, storage = resources()
        if method == "GET":
            result = read(normalized_path, parameters(event), database, storage, include_unpublished=protected or management)
            return result if isinstance(result, dict) and "statusCode" in result else response(200, result)
        if not protected and not management:
            raise AppError("Public endpoints are read-only.", 405, "method_not_allowed")
        data = body(event)
        path = normalized_path
        catalog, tags = CatalogService(database), TagService(database)
        filesystem, documents = FileSystemService(database, storage), DocumentService(database, storage)
        if path == "/api/catalog/products" and method == "POST":
            return response(201, catalog.create(data))
        match = re.fullmatch(r"/api/catalog/products/([^/]+)", path)
        if match and method == "PATCH":
            return response(200, catalog.update(match[1], data))
        if path == "/api/catalog/tags" and method == "POST":
            return response(201, tags.mutate(data))
        match = re.fullmatch(r"/api/catalog/tags/([^/]+)", path)
        if match and method in {"PATCH", "DELETE"}:
            return response(200, tags.mutate(data, match[1], method == "DELETE"))
        if path == "/api/filesystem/folders" and method == "POST":
            return response(201, filesystem.folder(data))
        if path == "/api/filesystem/documents" and method == "POST":
            return response(201, documents.save(data))
        match = re.fullmatch(r"/api/filesystem/documents/([^/]+)", path)
        if match and method == "PATCH":
            return response(200, documents.save(data, match[1]))
        match = re.fullmatch(r"/api/filesystem/nodes/([^/]+)(/(move|copy))?", path)
        if match and method in {"PATCH", "POST", "DELETE"}:
            key, _, operation = match.groups()
            expected = "POST" if operation else "DELETE" if method == "DELETE" else "PATCH"
            if method != expected:
                raise AppError("Method not allowed.", 405, "method_not_allowed")
            result = filesystem.mutate(key, data, operation or ("delete" if method == "DELETE" else "update"))
            return response(201 if operation == "copy" else 200, result)
        raise AppError("API route not found.", 404, "not_found")
    except AppError as error:
        return response(error.status, {"error": {"code": error.code, "message": str(error)}})
    except Exception as error:
        failure(logger, error, event, context)
        return response(500, {"error": {"code": "internal_error", "message": "The request could not be completed. Refresh before retrying."}})
