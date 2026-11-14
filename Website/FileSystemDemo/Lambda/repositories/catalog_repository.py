"""Low-level bounded persistence; no scans, implicit fallback or ORM."""
import os
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from Shared.catalog_repository import encode, decode
from errors import AppError


class CatalogRepository:
    def __init__(self, client, catalog, filesystem):
        self.client, self.catalog, self.filesystem = client, catalog, filesystem

    @classmethod
    def from_environment(cls):
        client = boto3.client("dynamodb", config=Config(connect_timeout=1, read_timeout=2, retries={"max_attempts": 1}))
        return cls(client, os.environ["CATALOG_TABLE"], os.environ["FILESYSTEM_TABLE"])

    def get(self, table, pk, sk):
        return decode(self.client.get_item(TableName=table, Key=encode({"PK": pk, "SK": sk}), ConsistentRead=True).get("Item"))

    def query(self, table, pk, limit=100):
        result = self.client.query(TableName=table, KeyConditionExpression="PK = :pk", ExpressionAttributeValues=encode({":pk": pk}), ConsistentRead=True, Limit=limit)
        if not isinstance(result.get("Items"), list):
            raise RuntimeError("Unverified database response")
        return [decode(item) for item in result["Items"]], bool(result.get("LastEvaluatedKey"))

    def control(self):
        item = self.get(self.catalog, "CONTROL", "META")
        return int(item["revision"]) if item else 0

    def control_record(self):
        from Shared.catalog_repository import catalog_control
        return catalog_control(self.client, self.catalog)

    def transaction(self, version, changes, product_revision_fence=0):
        if not changes or len(changes) > 99:
            raise AppError("This operation exceeds the bounded transaction size.", 409, "operation_too_large")
        prior = self.control_record()
        if prior['revision'] != version:
            raise AppError('The workspace changed. Refresh before retrying.', 409, 'revision_conflict')
        control = {**prior, "PK": "CONTROL", "SK": "META", "revision": version + 1,
                   'product_revision_fence': max(int(prior.get('product_revision_fence', 0)), product_revision_fence)}
        condition = "revision = :version" if version else "attribute_not_exists(PK)"
        guard = {"TableName": self.catalog, "Item": encode(control), "ConditionExpression": condition}
        if version:
            guard["ExpressionAttributeValues"] = encode({":version": version})
        try:
            self.client.transact_write_items(TransactItems=[{"Put": guard}, *changes])
        except ClientError as error:
            code = error.response.get("Error", {}).get("Code")
            reasons = [item.get("Code") for item in error.response.get("CancellationReasons", [])]
            if code == "TransactionCanceledException" and any(reason == "ConditionalCheckFailed" for reason in reasons) and all(reason in {"None", "ConditionalCheckFailed"} for reason in reasons):
                raise AppError("Data changed during this operation. Refresh before retrying.", 409, "revision_conflict") from None
            raise

    @staticmethod
    def put(table, pk, sk, item, unique=False):
        value = {"TableName": table, "Item": encode({**item, "PK": pk, "SK": sk})}
        if unique:
            value["ConditionExpression"] = "attribute_not_exists(PK)"
        return {"Put": value}

    @staticmethod
    def delete(table, pk, sk):
        return {"Delete": {"TableName": table, "Key": encode({"PK": pk, "SK": sk})}}
