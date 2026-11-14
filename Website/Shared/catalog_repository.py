"""One catalog read contract for the catalog API and Commerce pricing."""
from decimal import Decimal
import re
from boto3.dynamodb.types import TypeDeserializer, TypeSerializer

_encode = TypeSerializer()
_decode = TypeDeserializer()


def encode(item):
    return {key: _encode.serialize(value) for key, value in item.items()}


def decode(item):
    return {key: _decode.deserialize(value) for key, value in item.items()} if item else None


class CatalogUnavailable(Exception):
    pass


class CatalogChanged(CatalogUnavailable):
    pass


def catalog_control(client, table):
    response = client.get_item(TableName=table, Key=encode({'PK': 'CONTROL', 'SK': 'META'}), ConsistentRead=True)
    state = decode(response.get('Item')) or {'revision': 0}
    generation = state.get('product_generation')
    fence = state.get('product_revision_fence', 0)
    if (type(state.get('revision')) not in (int, Decimal) or state['revision'] < 0
            or state['revision'] != int(state['revision'])
            or type(fence) not in (int, Decimal) or fence < 0 or fence != int(fence)
            or ('reset_paused' in state and type(state['reset_paused']) is not bool)
            or ('last_reset_date' in state and (not isinstance(state['last_reset_date'], str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', state['last_reset_date'])))
            or ('reset_blocked_through_date' in state and (not isinstance(state['reset_blocked_through_date'], str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', state['reset_blocked_through_date'])))
            or (generation is not None and (not isinstance(generation, str) or not re.fullmatch(r'[a-f0-9]{32}', generation)))):
        raise CatalogUnavailable('Invalid catalog control')
    return state


def product_partition(pk, control):
    generation = control.get('product_generation')
    return f'GEN#{generation}#{pk}' if generation else pk


def control_condition(control):
    return ({'ConditionExpression': 'revision = :version', 'ExpressionAttributeValues': encode({':version': control['revision']})}
            if control['revision'] else {'ConditionExpression': 'attribute_not_exists(PK)'})


class DynamoCatalog:
    MAX_PRODUCTS = 40

    def __init__(self, client, table_name):
        self.client, self.table_name = client, table_name

    def get(self, sku, control=None):
        control = control if control is not None else catalog_control(self.client, self.table_name)
        response = self.client.get_item(TableName=self.table_name,
            Key=encode({"PK": product_partition('PRODUCTS', control), "SK": sku}), ConsistentRead=True)
        return self.validate(decode(response.get('Item')), sku)

    @staticmethod
    def validate(item, sku):
        if item and (item.get("sku") != sku or item.get("currency") != "USD"
                     or not isinstance(item.get("unit_price"), str) or not re.fullmatch(r'(?:0|[1-9][0-9]{0,5})\.[0-9]{2}', item['unit_price'])
                     or not isinstance(item.get('name'), str) or not item['name'].strip()
                     or item.get('status') not in {'DRAFT', 'PUBLISHED', 'RETIRED'}
                     or type(item.get('revision')) not in (int, Decimal) or item['revision'] < 1
                     or item['revision'] != int(item['revision']) or Decimal(item['unit_price']) <= 0):
            raise CatalogUnavailable("Invalid canonical catalog record")
        return item

    def resolve(self, skus):
        self.read_control = catalog_control(self.client, self.table_name)
        products = {}
        for sku in skus:
            item = self.get(sku, self.read_control)
            if not item or item.get("status") != "PUBLISHED":
                raise KeyError(sku)
            price = Decimal(item["unit_price"])
            if not price.is_finite() or price <= 0:
                raise CatalogUnavailable("Invalid canonical price")
            products[sku] = {**item, "unit_price": price}
        if catalog_control(self.client, self.table_name) != self.read_control:
            raise CatalogChanged('Catalog changed while reading')
        return products

    def list_products(self):
        control = catalog_control(self.client, self.table_name)
        result = self.client.query(TableName=self.table_name,
            KeyConditionExpression="PK = :pk", ExpressionAttributeValues=encode({":pk": product_partition('PRODUCTS', control)}),
            ConsistentRead=True, Limit=self.MAX_PRODUCTS + 1)
        if not isinstance(result.get("Items"), list) or result.get("LastEvaluatedKey") or len(result["Items"]) > self.MAX_PRODUCTS:
            raise CatalogUnavailable("Catalog listing exceeds its verified bound")
        products = []
        for raw in result['Items']:
            item = decode(raw)
            item = self.validate(item, item.get('SK'))
            if item and item['status'] == 'PUBLISHED':
                products.append({**{key: item[key] for key in ('sku', 'name', 'unit_price', 'currency')}, 'revision': int(item['revision'])})
        if catalog_control(self.client, self.table_name) != control:
            raise CatalogUnavailable('Catalog changed while listing')
        return sorted(products, key=lambda item: item['sku'])

    def checks(self, products):
        control = self.read_control
        return [{'ConditionCheck': {'TableName': self.table_name, 'Key': encode({'PK':'CONTROL','SK':'META'}), **control_condition(control)}}, *[{"ConditionCheck": {"TableName": self.table_name,
            "Key": encode({"PK": product_partition('PRODUCTS', control), "SK": sku}),
            "ConditionExpression": "#state = :published AND revision = :revision AND unit_price = :price",
            "ExpressionAttributeNames": {"#state": "status"},
            "ExpressionAttributeValues": encode({":published": "PUBLISHED", ":revision": item["revision"], ":price": str(item["unit_price"])})}}
            for sku, item in sorted(products.items())]]


class LegacyCatalog:
    def __init__(self, products):
        self.products = products

    def resolve(self, skus):
        return {sku: self.products[sku] for sku in skus}

    def list_products(self):
        return [{"sku": sku, "name": item["name"], "unit_price": str(item["unit_price"]), "currency": "USD"}
                for sku, item in self.products.items()]

    def checks(self, products):
        return []
