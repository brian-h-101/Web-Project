import hashlib
import re
from uuid import UUID
from catalog import CATALOG
from errors import OrderError


def parse_uuid(value, field):
    try:
        if not isinstance(value, str) or len(value) != 36:
            raise ValueError()
        return str(UUID(value))
    except (ValueError, TypeError, AttributeError):
        raise OrderError(f"{field} must be a valid UUID.", details=[{"field": field, "message": "A UUID is required."}]) from None


def session_hash(token):
    if not isinstance(token, str) or not re.fullmatch(r"[a-f0-9]{64}", token):
        raise OrderError("A valid anonymous demonstration session is required.", code="invalid_session")
    return hashlib.sha256(token.encode("ascii")).hexdigest()


class OrderValidator:
    MAX_LINES = 20
    MAX_QUANTITY = 99

    def __init__(self, catalog=None):
        self.catalog = CATALOG if catalog is None else catalog

    def validate(self, payload):
        if not isinstance(payload, dict):
            raise OrderError("The request must be a JSON object.")
        errors = []

        def error(field, message):
            errors.append({"field": field, "message": message})

        if set(payload) - {"customer_email", "items", "simulate_failure"}:
            error("request", "Only customer_email, items and simulate_failure are accepted.")
        email = payload.get("customer_email")
        email = email.strip().lower() if isinstance(email, str) else ""
        if len(email) > 255 or not re.fullmatch(r"[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@example\.(com|org|net)", email):
            error("customer_email", "Use a sample email at example.com, example.org or example.net (at most 255 characters).")
        simulation = payload.get("simulate_failure", False)
        if not isinstance(simulation, bool):
            error("simulate_failure", "The failure simulation flag must be a boolean.")
        items = payload.get("items")
        quantities = {}
        revisions = {}
        if not isinstance(items, list) or not 1 <= len(items) <= self.MAX_LINES:
            error("items", "Include between 1 and 20 order items.")
        else:
            for index, item in enumerate(items):
                field = f"items.{index}"
                if not isinstance(item, dict):
                    error(field, "Each item must be an object.")
                    continue
                if set(item) - {"product_sku", "quantity", "catalog_revision"}:
                    error(field, "Only product_sku, quantity and catalog_revision are accepted; prices are set by the server.")
                sku = item.get("product_sku")
                sku = sku.strip().upper() if isinstance(sku, str) else ""
                quantity = item.get("quantity")
                if 'catalog_revision' in item:
                    revision = item['catalog_revision']
                    if type(revision) is not int or not 1 <= revision <= 9007199254740991:
                        error(field, 'catalog_revision must be a positive safe integer.')
                    elif sku in revisions and revisions[sku] != revision:
                        error(field, 'Duplicate product revisions must agree.')
                    else:
                        revisions[sku] = revision
                valid_sku = bool(re.fullmatch(r"[A-Z0-9][A-Z0-9-]{1,39}", sku)) and (self.catalog is None or sku in self.catalog)
                if not valid_sku:
                    error(f"{field}.product_sku", "Select a product from the demo catalog.")
                if type(quantity) is not int or not 1 <= quantity <= self.MAX_QUANTITY:
                    error(f"{field}.quantity", "Quantity must be a whole number between 1 and 99.")
                elif valid_sku:
                    quantities[sku] = quantities.get(sku, 0) + quantity
                    if quantities[sku] > self.MAX_QUANTITY:
                        error(f"{field}.quantity", "The combined quantity for each product cannot exceed 99.")
        if errors:
            raise OrderError("Please correct the order details.", details=errors)
        return {"customer_email": email, "items": [{"product_sku": sku, "quantity": quantities[sku], **({'catalog_revision':revisions[sku]} if sku in revisions else {})} for sku in sorted(quantities)], "simulate_failure": simulation}
