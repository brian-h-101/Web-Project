"""Explicit migration switch. DynamoDB failures never fall back to static prices."""
import os
from catalog import CATALOG
from Shared.catalog_repository import DynamoCatalog, LegacyCatalog


def provider(repository):
    mode = os.environ.get("CATALOG_MODE", "legacy")
    if mode == "legacy":
        return LegacyCatalog(CATALOG)
    if mode == "dynamodb":
        return DynamoCatalog(repository.client, os.environ["CATALOG_TABLE"])
    raise RuntimeError("Unsupported CATALOG_MODE")
