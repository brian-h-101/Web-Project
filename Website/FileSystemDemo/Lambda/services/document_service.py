from uuid import uuid4
from errors import AppError
from models.records import timestamp
from validators import FORMATS, content_bytes, fields, filename, identifier, sku, tag_ids
from .workspace import Snapshot, changed, require_revision


class DocumentService:
    def __init__(self, database, storage):
        self.database, self.storage = database, storage

    def save(self, data, key=None):
        fields(data, ("expectedRevision",) if key else ("parentId", "name", "format", "content"),
               ("name", "content", "tag_ids", "linked_sku") if key else ("tag_ids", "linked_sku"))
        state = Snapshot(self.database)
        if key:
            item = state.node(identifier(key))
            if item["type"] != "file":
                raise AppError("A document is required.")
            require_revision(item, data["expectedRevision"])
            if len(data) == 1:
                raise AppError("Provide a document change.")
        else:
            key, now = str(uuid4()), timestamp()
            item = {"id": key, "parentId": identifier(data["parentId"]), "name": filename(data["name"]), "format": data["format"], "type": "file", "status": "DRAFT", "revision": 1, "tag_ids": [], "linked_sku": None, "createdAt": now, "updatedAt": now, "deletedAt": None, "deleted": False}
            state.nodes[key] = item
        name = filename(data.get("name", item["name"]))
        if not isinstance(item['format'], str) or item["format"] not in FORMATS or not name.lower().endswith(FORMATS[item["format"]][0]):
            raise AppError("Filename extension must preserve document format.")
        item["name"] = name
        if "tag_ids" in data:
            item["tag_ids"] = tag_ids(data["tag_ids"])
        if "linked_sku" in data:
            link = data["linked_sku"]
            if link is not None and sku(link) not in state.products:
                raise AppError("The linked product does not exist.")
            item["linked_sku"] = link
        if key in state.before[2]:
            changed(item)
        # Validate hierarchy, publication and tags before staging private bytes.
        state.validate()
        staged = []
        if "content" in data:
            content = content_bytes(item["format"], item["name"], data["content"])
            reference = self.storage.stage(key, item["format"], content)
            staged.append(reference)
            item.update(reference, size=len(content), mimeType=FORMATS[item["format"]][1])
        state.commit(self.storage, staged)
        return state.record(item)
