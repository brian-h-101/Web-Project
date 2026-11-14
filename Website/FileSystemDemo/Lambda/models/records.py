import hashlib
from datetime import datetime, timezone
from validators import normalize, terms


def timestamp():
    return datetime.now(timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "Z")


def public_record(item, tags):
    result = {key: value for key, value in item.items() if key not in {"PK", "SK", "object_key", "object_version", "terms", "normalized_name", "seed_signature", "seed_initial_revision"}}
    result["tags"] = [{"id": key, "name": tags[key]["name"], "normalizedName": tags[key]["normalized_name"]} for key in item.get("tag_ids", []) if key in tags]
    if "normalized_name" in item and "sku" not in item:
        result["normalizedName"] = item["normalized_name"]
    return result


def tag_key(normalized):
    return "TAGNAME#" + hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def metadata_terms(item, kind):
    # Preserve SKU/name access before spending the remaining bounded term slots
    # on descriptions. Indexing and canonical rechecks share this exact rule.
    selected = []
    for value in ([item['sku']] if kind == 'PRODUCT' else []) + [item['name'], item.get('description', '')]:
        for term in terms(value):
            if term not in selected and len(selected) < 8:
                selected.append(term)
    return selected


def projections(item, kind):
    """Derived references only. Canonical records are always rechecked on reads."""
    if item.get("status") != "PUBLISHED" or item.get("deleted", False):
        return {}
    identifier = item["sku"] if kind == "PRODUCT" else item["id"]
    name = normalize(item["name"])
    reference = {"entity_id": identifier, "revision": item["revision"]}
    rows = {(f"PUBLISHED_{kind}S", f"NAME#{name}#{identifier}"): reference}
    for term in metadata_terms(item, kind):
        rows[(f"SEARCH#{kind}#{term}", identifier)] = reference
    for tag in item.get("tag_ids", []):
        rows[(f"{kind}_TAG#{tag}", identifier)] = reference
    return rows
