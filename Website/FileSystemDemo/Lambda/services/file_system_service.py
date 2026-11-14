from copy import deepcopy
from uuid import uuid4
from errors import AppError
from models.records import timestamp
from validators import MAX_SUBTREE, fields, filename, identifier
from .workspace import Snapshot, changed, require_revision


class FileSystemService:
    def __init__(self, database, storage):
        self.database, self.storage = database, storage

    @staticmethod
    def subtree(state, key):
        selected = {key}
        for _ in range(9):
            expanded = selected | {node["id"] for node in state.nodes.values() if node["parentId"] in selected and not node.get("deleted")}
            if expanded == selected:
                break
            selected = expanded
        if len(selected) > MAX_SUBTREE:
            raise AppError("Subtree operations support at most five nodes.", 409, "subtree_limit")
        return selected

    def folder(self, data):
        fields(data, ("parentId", "name"))
        state = Snapshot(self.database)
        parent = state.node(identifier(data["parentId"]))
        if parent["type"] != "folder":
            raise AppError("A folder parent is required.")
        now, key = timestamp(), str(uuid4())
        item = {"id": key, "parentId": parent["id"], "name": filename(data["name"]), "type": "folder", "status": "DRAFT", "revision": 1, "tag_ids": [], "size": 0, "mimeType": None, "createdAt": now, "updatedAt": now, "deletedAt": None, "deleted": False}
        state.nodes[key] = item
        state.commit()
        return state.record(item)

    def mutate(self, key, data, operation="update"):
        optional = {"update": ("name", "status"), "move": ("parentId",), "copy": ("parentId", "name"), "delete": ()}
        fields(data, ("expectedRevision",), optional[operation])
        state = Snapshot(self.database)
        item = state.node(identifier(key))
        if key == "root":
            raise AppError("The virtual root cannot be changed.", 409, "root_protected")
        require_revision(item, data["expectedRevision"])
        staged = []
        if operation == "copy":
            if "parentId" not in data:
                raise AppError("Choose a destination folder.")
            selected = self.subtree(state, key)
            if data["parentId"] in selected:
                raise AppError("A subtree cannot be copied into itself.", 409, "hierarchy_cycle")
            mapping = {old: str(uuid4()) for old in selected}
            try:
                for old in sorted(selected):
                    original = state.nodes[old]
                    copied = deepcopy(original)
                    copied.update(id=mapping[old], parentId=identifier(data["parentId"]) if old == key else mapping[original["parentId"]], status="DRAFT", revision=1, createdAt=timestamp(), updatedAt=timestamp())
                    if old == key:
                        copied["name"] = filename(data.get("name", original["name"]))
                    if copied["type"] == "file":
                        content = self.storage.read(original)
                        reference = self.storage.stage(copied["id"], copied["format"], content)
                        staged.append(reference)
                        copied.update(reference)
                    state.nodes[copied["id"]] = copied
                item = state.nodes[mapping[key]]
            except Exception:
                for reference in staged:
                    self.storage.cleanup(reference)
                raise
        elif operation == "delete" or data.get("status") == "DRAFT":
            for selected in self.subtree(state, key):
                node = state.nodes[selected]
                node["status"] = "DRAFT"
                if operation == "delete":
                    node.update(deleted=True, deletedAt=timestamp())
                changed(node)
            if "name" in data:
                item["name"] = filename(data["name"])
        elif operation == "move":
            if "parentId" not in data:
                raise AppError("Choose a destination folder.")
            self.subtree(state, key)
            item["parentId"] = identifier(data["parentId"])
            changed(item)
        else:
            if "name" in data:
                item["name"] = filename(data["name"])
            if "status" in data:
                if data["status"] != "PUBLISHED":
                    raise AppError("Use DRAFT or PUBLISHED publication state.")
                item["status"] = "PUBLISHED"
            if len(data) == 1:
                raise AppError("Provide a node change.")
            changed(item)
        state.commit(self.storage, staged)
        return state.record(item)
