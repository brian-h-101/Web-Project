"""A deliberately small workspace: one optimistic revision serializes admin commits.

All canonical records, uniqueness reservations and metadata postings change in one
bounded transaction. Reads are strongly consistent and verify the same revision.
"""
from copy import deepcopy
from errors import AppError
from models.records import projections, public_record, tag_key, timestamp
from validators import MAX_DEPTH, MAX_NODES, MAX_PRODUCTS, MAX_TAG_CATALOG, FORMATS, normalize
from repositories.file_system_repository import FileSystemRepository
from Shared.catalog_repository import product_partition

ROOT = {"id": "root", "parentId": None, "name": "Root", "type": "folder", "status": "PUBLISHED", "revision": 1, "tag_ids": [], "size": 0, "mimeType": None, "createdAt": "2026-10-19T00:00:00Z", "updatedAt": "2026-10-19T00:00:00Z", "deletedAt": None, "deleted": False}


class Snapshot:
    def __init__(self, database):
        self.database, self.control = database, database.control_record()
        self.version = int(self.control['revision'])
        self.products = self.collection(database.catalog, self.product_partition('PRODUCTS'), MAX_PRODUCTS)
        self.tags = self.collection(database.catalog, "TAGS", MAX_TAG_CATALOG)
        self.nodes = FileSystemRepository(database).all_nodes()
        self.before = deepcopy((self.products, self.tags, self.nodes))
        self.nodes.setdefault("root", deepcopy(ROOT))
        self.verify()

    def product_partition(self, pk):
        return product_partition(pk, self.control)

    def next_product_revision(self):
        # Before the first reset, SKUs cannot be deleted/reused and retain the
        # established initial revision. Once generations can remove a SKU, the
        # durable high-water fence prevents its recreation from reusing a token.
        if not self.control.get('product_generation'):
            return 1
        return max([int(self.control.get('product_revision_fence', 0)), self.version,
                    *[int(p['revision']) for p in self.products.values()]]) + 1

    def collection(self, table, pk, limit):
        rows, incomplete = self.database.query(table, pk, limit + 1)
        if incomplete or len(rows) > limit:
            raise AppError("The demonstration workspace exceeds its configured bound.", 503, "workspace_limit")
        return {row["SK"]: row for row in rows}

    def verify(self):
        if self.database.control() != self.version:
            raise AppError("The workspace changed. Refresh the request.", 409, "revision_conflict")

    def node(self, key, public=False):
        node = self.nodes.get(key)
        if not node or node.get("deleted") or (public and not self.visible(key)):
            raise AppError("Node not found.", 404, "not_found")
        return node

    def visible(self, key):
        visited = set()
        for _ in range(MAX_DEPTH + 1):
            node = self.nodes.get(key)
            if not node or key in visited or node.get("deleted") or node["status"] != "PUBLISHED":
                return False
            visited.add(key)
            if node["parentId"] is None:
                return key == "root"
            key = node["parentId"]
        return False

    def record(self, item, public=False):
        result = public_record(item, self.tags)
        if public and item.get('linked_sku') and self.products.get(item['linked_sku'], {}).get('status') != 'PUBLISHED':
            result['linked_sku'] = None
        return result

    def validate(self):
        if len(self.products) > MAX_PRODUCTS or len(self.nodes) > MAX_NODES or len(self.tags) > MAX_TAG_CATALOG:
            raise AppError("The bounded demonstration workspace is full.", 409, "workspace_limit")
        names = set()
        for item in self.tags.values():
            if item["normalized_name"] in names:
                raise AppError("A tag with this normalized name exists.", 409, "duplicate_tag")
            names.add(item["normalized_name"])
        siblings = set()
        for node in self.nodes.values():
            if node["type"] == "file" and not node["name"].lower().endswith(FORMATS[node["format"]][0]):
                raise AppError("Renaming must preserve the supported file extension.")
            if node.get("deleted"):
                continue
            if node["id"] == "root":
                if node["parentId"] is not None or node["status"] != "PUBLISHED":
                    raise AppError("The virtual root is protected.", 409, "root_protected")
                continue
            sibling = (node["parentId"], normalize(node["name"]))
            if sibling in siblings:
                raise AppError("An active sibling already has this name.", 409, "duplicate_name")
            siblings.add(sibling)
            key, visited = node["id"], set()
            for depth in range(MAX_DEPTH + 1):
                current = self.nodes.get(key)
                if not current or current.get("deleted") or key in visited:
                    raise AppError("Invalid parent hierarchy or cycle.", 409, "hierarchy_cycle")
                visited.add(key)
                parent = current["parentId"]
                if parent is None:
                    if key != "root":
                        raise AppError("Only the virtual root can have no parent.")
                    break
                if depth == MAX_DEPTH or self.nodes.get(parent, {}).get("type") != "folder":
                    raise AppError("Choose a folder within the maximum depth of eight.", 409, "hierarchy_limit")
                key = parent
            if node["status"] == "PUBLISHED" and not self.visible(node["id"]):
                raise AppError("Publish the complete parent hierarchy first.", 409, "private_parent")
        counts = {key: 0 for key in self.tags}
        for item in [*self.products.values(), *self.nodes.values()]:
            if item.get("deleted"):
                continue
            for tag in item.get("tag_ids", []):
                if tag not in self.tags:
                    raise AppError("An assigned tag no longer exists.", 409, "invalid_tags")
                counts[tag] += 1
        for key, count in counts.items():
            self.tags[key]["reference_count"] = count

    def commit(self, storage=None, staged=()):
        try:
            self.validate()
            changes = self.changes()
            fence = max([int(self.control.get('product_revision_fence', 0)), *[int(p['revision']) for p in self.products.values()]])
            self.database.transaction(self.version, changes, product_revision_fence=fence)
        except AppError:
            if storage:
                for item in staged:
                    storage.cleanup(item)
            raise
        except Exception:
            # A transport error can have an unknown commit outcome. Never delete
            # an object that a transaction might have committed successfully.
            if storage:
                for item in staged:
                    storage.uncertain(item)
            raise

    def changes(self):
        database, changes = self.database, {}

        def put(table, pk, sk, value, unique=False):
            if table == database.catalog and pk not in ('TAGS',) and not pk.startswith('TAGNAME#'):
                pk = self.product_partition(pk)
            changes[(table, pk, sk)] = database.put(table, pk, sk, value, unique)

        def delete(table, pk, sk):
            if table == database.catalog and pk not in ('TAGS',) and not pk.startswith('TAGNAME#'):
                pk = self.product_partition(pk)
            changes[(table, pk, sk)] = database.delete(table, pk, sk)

        for before, after, table, pk, kind in [
            (self.before[0], self.products, database.catalog, "PRODUCTS", "PRODUCT"),
            (self.before[1], self.tags, database.catalog, "TAGS", None),
            (self.before[2], self.nodes, database.filesystem, "NODES", "DOCUMENT")]:
            for key in sorted(set(before) | set(after)):
                old, new = before.get(key), after.get(key)
                if old == new:
                    continue
                if new:
                    put(table, pk, key, new, unique=old is None)
                else:
                    delete(table, pk, key)
                if kind:
                    old_rows = projections(old, kind) if old and (kind == "PRODUCT" or old["type"] == "file") else {}
                    new_rows = projections(new, kind) if new and (kind == "PRODUCT" or new["type"] == "file") else {}
                    for ref in old_rows.keys() - new_rows.keys():
                        delete(table, *ref)
                    for ref, value in new_rows.items():
                        put(table, *ref, value)
                else:
                    if old and (not new or old["normalized_name"] != new["normalized_name"]):
                        delete(table, tag_key(old["normalized_name"]), "META")
                    if new and (not old or old["normalized_name"] != new["normalized_name"]):
                        put(table, tag_key(new["normalized_name"]), "META", {"canonical_tag_id": key}, unique=True)
                if pk == "NODES":
                    def child(item):
                        return ("CHILDREN#" + item["parentId"], tag_key(normalize(item["name"]))) if item and item["parentId"] and not item.get("deleted") else None
                    old_child, new_child = child(old), child(new)
                    if old_child and old_child != new_child:
                        delete(table, *old_child)
                    if new_child:
                        put(table, *new_child, {"entity_id": key}, unique=old_child != new_child)
        return list(changes.values())


def require_revision(item, value):
    from validators import revision
    if item["revision"] != revision(value):
        raise AppError("This record changed. Reload before saving.", 409, "revision_conflict")


def changed(item):
    item["revision"] += 1
    item["updated_at" if "sku" in item else "updatedAt"] = timestamp()
