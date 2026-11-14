"""Adapted name/tag rules from the read-only local simulator."""
import re
import unicodedata
from decimal import Decimal, InvalidOperation
from uuid import UUID
from errors import AppError

MAX_TERMS, MAX_TAGS, MAX_DEPTH, MAX_SUBTREE = 8, 4, 8, 5
MAX_PRODUCTS, MAX_NODES, MAX_TAG_CATALOG = 40, 40, 30
TEXT_LIMIT, PDF_LIMIT = 256 * 1024, 2 * 1024 * 1024
FORMATS = {"markdown": (".md", "text/markdown"), "text": (".txt", "text/plain"), "pdf": (".pdf", "application/pdf")}


def fields(data, required=(), optional=()):
    if not isinstance(data, dict) or set(required) - data.keys() or data.keys() - set(required) - set(optional):
        raise AppError("Missing or unsupported request fields.")
    return data


def text(value, maximum, label="text"):
    if not isinstance(value, str) or not value.strip() or len(value) > maximum or any(unicodedata.category(c).startswith("C") for c in value):
        raise AppError(f"{label} must contain 1–{maximum} printable characters.")
    return value.strip()


def normalize(value):
    return unicodedata.normalize("NFKC", value).casefold().strip()


def tag_name(value):
    display = text(unicodedata.normalize("NFKC", value) if isinstance(value, str) else value, 80, "Tag name")
    if len(normalize(display)) > 80:
        raise AppError("Normalized tag name is too long.")
    return display, normalize(display)


def filename(value):
    name = text(value, 255, "Filename")
    if name != value or name.endswith(".") or re.search(r'[\\/:*?"<>|]', name) or name in (".", "..") or re.fullmatch(r"(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?", name, re.I):
        raise AppError("Use a valid virtual filename, without separators or reserved device names.")
    return name


def identifier(value):
    if value == "root":
        return value
    try:
        if not isinstance(value, str) or str(UUID(value)) != value:
            raise ValueError()
        return value
    except (ValueError, TypeError, AttributeError):
        raise AppError("A canonical UUID is required.") from None


def sku(value):
    if not isinstance(value, str) or not re.fullmatch(r"[A-Z0-9][A-Z0-9-]{1,39}", value):
        raise AppError("SKU must contain 2–40 uppercase letters, digits or hyphens.")
    return value


def revision(value):
    if type(value) is not int or not 1 <= value < 2 ** 53:
        raise AppError("expectedRevision must be a positive integer.")
    return value


def money(value):
    if not isinstance(value, str) or not re.fullmatch(r"(?:0|[1-9][0-9]{0,5})\.[0-9]{2}", value):
        raise AppError("USD price must be a decimal string with two fractional digits.")
    try:
        result = Decimal(value)
        if result <= 0:
            raise InvalidOperation()
        return str(result)
    except InvalidOperation:
        raise AppError("Price must be greater than zero.") from None


def tag_ids(value):
    if not isinstance(value, list) or len(value) > MAX_TAGS or len(value) != len(set(v for v in value if isinstance(v, str))):
        raise AppError(f"Use at most {MAX_TAGS} distinct tag IDs.")
    return sorted(identifier(v) for v in value)


def terms(value):
    return sorted(set(re.findall(r"[^\W_]+", normalize(value), re.UNICODE)))[:MAX_TERMS]


def content_bytes(format, name, value):
    filename(name)
    if format not in FORMATS or not name.lower().endswith(FORMATS[format][0]):
        raise AppError("Filename and supported format must agree.")
    if format == "pdf":
        import base64
        try:
            if not isinstance(value, str) or len(value) > (PDF_LIMIT * 4 // 3 + 4):
                raise ValueError()
            content = base64.b64decode(value, validate=True)
        except ValueError:
            raise AppError("PDF content must be bounded base64.") from None
        # Curated PDFs only; disallow known active-content markers, not a malware guarantee.
        if not content.startswith(b"%PDF-") or b"%%EOF" not in content[-1024:] or any(marker in content for marker in (b"/JavaScript", b"/JS", b"/Launch", b"/EmbeddedFile", b"/OpenAction")):
            raise AppError("Only curated, passive PDF files are supported.")
        limit = PDF_LIMIT
    else:
        if not isinstance(value, str):
            raise AppError("Document content must be text.")
        try:
            content = value.encode("utf-8")
        except UnicodeError:
            raise AppError("Document content must be valid UTF-8.") from None
        if b"\x00" in content:
            raise AppError("Text cannot contain null bytes.")
        limit = TEXT_LIMIT
    if len(content) > limit:
        raise AppError("Document exceeds the supported content size.", 413, "payload_too_large")
    return content
