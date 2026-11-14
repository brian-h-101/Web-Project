from decimal import Decimal
from Shared.catalog_baseline import source_products

CATALOG = {row['sku']: {'name': row['name'], 'unit_price': Decimal(row['unit_price'])} for row in source_products()}


def list_products():
    return [{"sku": sku, "name": product["name"], "unit_price": str(product["unit_price"]), "currency": "USD"} for sku, product in CATALOG.items()]
