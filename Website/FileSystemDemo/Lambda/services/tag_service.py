from uuid import uuid4
from errors import AppError
from models.records import timestamp
from validators import fields, identifier, tag_name
from .workspace import Snapshot, require_revision


class TagService:
    def __init__(self, database):
        self.database = database

    def mutate(self, data, key=None, delete=False):
        fields(data, ("expectedRevision",) if delete else (("name", "expectedRevision") if key else ("name",)))
        state = Snapshot(self.database)
        item = state.tags.get(identifier(key)) if key else None
        if key:
            if not item:
                raise AppError("Tag not found.", 404, "not_found")
            require_revision(item, data["expectedRevision"])
        if delete:
            if any(key in entity.get("tag_ids", []) for entity in [*state.products.values(), *state.nodes.values()] if not entity.get("deleted")):
                raise AppError("Remove all product/document assignments before deleting this tag.", 409, "tag_in_use")
            del state.tags[key]
        else:
            display, normalized = tag_name(data["name"])
            key = key or str(uuid4())
            state.tags[key] = {"id": key, "name": display, "normalized_name": normalized, "revision": int(item["revision"]) + 1 if item else 1, "created_at": item["created_at"] if item else timestamp(), "reference_count": 0}
        state.commit()
        return state.record(state.tags[key]) if not delete else {"id": key}
