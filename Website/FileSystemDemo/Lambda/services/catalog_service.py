from uuid import uuid4
from errors import AppError
from models.records import timestamp
from validators import fields, money, normalize, sku, tag_ids, text
from .workspace import Snapshot, changed, require_revision


class CatalogService:
    def __init__(self, database):
        self.database = database

    def create(self, data):
        fields(data, ("sku", "name", "description", "unit_price"), ("tag_ids",))
        state = Snapshot(self.database)
        key = sku(data["sku"])
        if key in state.products:
            raise AppError("SKU already exists; it cannot be reused.", 409, "duplicate_sku")
        now = timestamp()
        item = {"product_id": str(uuid4()), "sku": key, "name": text(data["name"], 120, "Product name"), "description": text(data["description"], 500, "Description"), "unit_price": money(data["unit_price"]), "currency": "USD", "status": "DRAFT", "revision": state.next_product_revision(), "tag_ids": tag_ids(data.get("tag_ids", [])), "created_at": now, "updated_at": now}
        item["normalized_name"] = normalize(item["name"])
        state.products[key] = item
        state.commit()
        return state.record(item)

    def update(self, key, data):
        fields(data, ("expectedRevision",), ("name", "description", "unit_price", "tag_ids", "status"))
        state = Snapshot(self.database)
        item = state.products.get(sku(key))
        if not item:
            raise AppError("Product not found.", 404, "not_found")
        require_revision(item, data["expectedRevision"])
        if len(data) == 1:
            raise AppError("Provide a product change.")
        if "name" in data:
            item["name"] = text(data["name"], 120, "Product name")
            item["normalized_name"] = normalize(item["name"])
        if "description" in data:
            item["description"] = text(data["description"], 500, "Description")
        if "unit_price" in data:
            item["unit_price"] = money(data["unit_price"])
        if "tag_ids" in data:
            item["tag_ids"] = tag_ids(data["tag_ids"])
        if "status" in data:
            target = data["status"]
            if not isinstance(target, str) or target not in {'DRAFT', 'PUBLISHED', 'RETIRED'}:
                raise AppError('Use DRAFT, PUBLISHED or RETIRED publication state.')
            if target != item["status"] and (item["status"], target) not in {("DRAFT", "PUBLISHED"), ("PUBLISHED", "RETIRED")}:
                raise AppError("Use DRAFT → PUBLISHED → RETIRED.", 409, "invalid_transition")
            item["status"] = target
        changed(item)
        state.commit()
        return state.record(item)
