import base64
import hashlib
import json
from errors import AppError
from validators import identifier, normalize, terms
from .workspace import Snapshot
from models.records import metadata_terms

CANDIDATES = 24


class SearchService:
    def __init__(self, database):
        self.database = database

    def search(self, kind, query, include_unpublished=False):
        if set(query) - {"q", "tagIds", "match", "untagged", "sort", "direction", "limit", "cursor", "parentId"}:
            raise AppError("Unsupported search parameter.")
        q = query.get("q", "")
        if not isinstance(q, str) or len(q) > 160 or len(terms(q)) > 4 or len(set(normalize(q).split())) > 4:
            raise AppError("Use at most four metadata search terms and 160 characters.")
        tags = query.get("tagIds", "").split(",") if query.get("tagIds") else []
        if len(tags) > 4 or len(set(tags)) != len(tags):
            raise AppError("Use at most four distinct tag filters.")
        tags = [identifier(tag) for tag in tags]
        mode = query.get("match", "any")
        sort, direction = query.get("sort", "name"), query.get("direction", "asc")
        if mode not in {"any", "all"} or sort not in {"name", "updated", "tag_name", "tag_count"} or direction not in {"asc", "desc"} or query.get("untagged", "false") not in {"true", "false"}:
            raise AppError("Invalid search/sort option.")
        try:
            limit = int(query.get("limit", "20"))
            if not 1 <= limit <= 25:
                raise ValueError()
        except (ValueError, TypeError):
            raise AppError("limit must be between 1 and 25.") from None
        state = Snapshot(self.database)
        table = self.database.catalog if kind == "PRODUCT" else self.database.filesystem
        records = state.products if kind == "PRODUCT" else state.nodes
        incomplete = False
        candidates = None
        for term in terms(q):
            rows, more = self.database.query(table, state.product_partition(f'SEARCH#{kind}#{term}') if kind == 'PRODUCT' else f'SEARCH#{kind}#{term}', CANDIDATES)
            incomplete |= more
            ids = {row["entity_id"] for row in rows}
            candidates = ids if candidates is None else candidates & ids
        if tags:
            selections = []
            for tag in tags:
                rows, more = self.database.query(table, state.product_partition(f'{kind}_TAG#{tag}') if kind == 'PRODUCT' else f'{kind}_TAG#{tag}', CANDIDATES)
                incomplete |= more
                selections.append({row["entity_id"] for row in rows})
            selected = set.union(*selections) if mode == "any" else set.intersection(*selections)
            candidates = selected if candidates is None else candidates & selected
        # This view flag is applied after authorization; it does not establish
        # identity or grant access. Full-workspace reads use quota-bounded
        # canonical records; published-view reads use bounded postings.
        if candidates is None and not include_unpublished:
            rows, incomplete = self.database.query(table, state.product_partition(f'PUBLISHED_{kind}S') if kind == 'PRODUCT' else f'PUBLISHED_{kind}S', CANDIDATES)
            candidates = {row["entity_id"] for row in rows}
        if include_unpublished:
            candidates = set(records)
        values = []
        for key in candidates or set():
            item = records.get(key)
            if not item or item.get("deleted") or (kind == "DOCUMENT" and item["type"] != "file"):
                continue
            if not include_unpublished and (item["status"] != "PUBLISHED" or (kind == "DOCUMENT" and not state.visible(key))):
                continue
            available_terms = metadata_terms(item, kind)
            if any(term not in available_terms for term in terms(q)):
                continue
            assigned = set(item.get("tag_ids", []))
            if tags and (not (assigned & set(tags)) if mode == "any" else not set(tags).issubset(assigned)):
                continue
            if query.get("untagged") == "true" and assigned:
                continue
            if query.get("parentId") and item.get("parentId") != query["parentId"]:
                continue
            values.append(state.record(item, public=not include_unpublished))
        def order(item):
            tag_names = sorted(tag["normalizedName"] for tag in item["tags"])
            primary = {"name": normalize(item["name"]), "updated": item.get("updated_at", item.get("updatedAt")), "tag_name": tag_names[0] if tag_names else "", "tag_count": len(tag_names)}[sort]
            return primary, normalize(item["name"]), item.get("sku", item.get("id"))
        values.sort(key=order, reverse=direction == "desc")
        if sort == "tag_name":
            values.sort(key=lambda item: not item["tags"])
        fingerprint = hashlib.sha256(json.dumps({key: value for key, value in query.items() if key != "cursor"}, sort_keys=True).encode()).hexdigest()
        offset = 0
        if query.get("cursor"):
            try:
                token = query["cursor"]
                if len(token) > 1024:
                    raise ValueError()
                saved = json.loads(base64.urlsafe_b64decode(token + "=" * (-len(token) % 4)))
                if saved["version"] != state.version or saved["query"] != fingerprint or type(saved["offset"]) is not int or not 0 <= saved["offset"] <= 40:
                    raise ValueError()
                offset = saved["offset"]
            except (ValueError, TypeError, KeyError):
                raise AppError("Search changed or cursor is invalid. Refresh the query.", 409, "invalid_cursor") from None
        page = values[offset:offset + limit]
        next_cursor = None
        if offset + limit < len(values):
            next_cursor = base64.urlsafe_b64encode(json.dumps({"version": state.version, "query": fingerprint, "offset": offset + limit}).encode()).decode().rstrip("=")
        state.verify()
        return {"items": page, "nextCursor": next_cursor, "incomplete": bool(incomplete and not include_unpublished), "candidateLimit": CANDIDATES, "totalWithinCandidates": len(values), "indexScope": "normalized metadata only; no document-body indexing"}
