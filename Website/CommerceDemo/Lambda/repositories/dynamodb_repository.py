import os
import boto3
from boto3.dynamodb.types import TypeDeserializer, TypeSerializer
from botocore.config import Config
from botocore.exceptions import ClientError
from errors import ConditionalCancellation, ConcurrentTransaction, DuplicateSubmission
from errors import OrderError

_serializer = TypeSerializer()
_deserializer = TypeDeserializer()


def encode(item):
    return {key: _serializer.serialize(value) for key, value in item.items()}


def decode(item):
    return {key: _deserializer.deserialize(value) for key, value in item.items()} if item else None


class DynamoDBRepository:
    def __init__(self, client, table_name):
        self.client = client
        self.table_name = table_name

    @classmethod
    def from_environment(cls):
        return cls(boto3.client("dynamodb", config=Config(connect_timeout=1, read_timeout=2, retries={"max_attempts": 1, "mode": "standard"})), os.environ["TABLE_NAME"])

    def get(self, key):
        return decode(self.client.get_item(TableName=self.table_name, Key=encode({"PK": key, "SK": "META"}), ConsistentRead=True).get("Item"))

    def marker(self, owner, key):
        return self.get(f"IDEMPOTENCY#{owner}#{key}")

    def order(self, identifier):
        return self.get(f"ORDER#{identifier}")

    def public_marker(self, day, key):
        from public_orders import marker_key
        return self.get(marker_key(day, key))

    def public_history(self, day, limit, now):
        from public_orders import partition, is_public_order
        orders, start = [], None
        for _ in range(5):
            options = {'TableName': self.table_name, 'IndexName': 'SessionHistory', 'KeyConditionExpression': 'GSI1PK = :day',
                       'ExpressionAttributeValues': encode({':day': partition(day)}), 'ScanIndexForward': False, 'Limit': min(100, limit)}
            if start: options['ExclusiveStartKey'] = start
            page = self.client.query(**options)
            if not isinstance(page, dict) or not isinstance(page.get('Items'), list) or ('LastEvaluatedKey' in page and not isinstance(page['LastEvaluatedKey'], dict)):
                raise OrderError('The public history page could not be verified.', 503, 'history_incomplete')
            for raw in page['Items']:
                row = decode(raw)
                if is_public_order(row, now):
                    orders.append(row)
                    if len(orders) >= limit: return orders
            start = page.get('LastEvaluatedKey')
            if not start: break
        if start:
            raise OrderError('The public history read reached its page bound. Retry a smaller recent-order limit.', 503, 'history_incomplete')
        return orders

    def cancel_public(self, identifier, day, now, updated):
        from public_orders import CONTRACT
        try:
            response = self.client.update_item(TableName=self.table_name, Key=encode({'PK': f'ORDER#{identifier}', 'SK': 'META'}),
                UpdateExpression='SET #status = :cancelled, updated_at = :updated',
                ConditionExpression='attribute_exists(PK) AND public_contract = :contract AND business_day = :day AND attribute_not_exists(session_hash) AND expires_at > :now AND #status = :confirmed',
                ExpressionAttributeNames={'#status': 'status'}, ExpressionAttributeValues=encode({':contract': CONTRACT, ':day': day, ':now': int(now), ':confirmed': 'CONFIRMED', ':cancelled': 'CANCELLED', ':updated': updated}), ReturnValues='ALL_NEW')
            return decode(response['Attributes'])
        except ClientError as error:
            if error.response.get('Error', {}).get('Code') == 'ConditionalCheckFailedException': raise ConditionalCancellation() from None
            raise

    def create_atomic(self, order, marker, catalog_checks=()):
        try:
            self.client.transact_write_items(TransactItems=[*({"Put": {"TableName": self.table_name, "Item": encode(item), "ConditionExpression": "attribute_not_exists(PK)"}} for item in [order, marker]), *catalog_checks])
        except ClientError as error:
            code = error.response.get("Error", {}).get("Code")
            reasons = [reason.get("Code") for reason in error.response.get("CancellationReasons", [])]
            if code == "TransactionCanceledException" and len(reasons) == 2 + len(catalog_checks) and reasons[1] == "ConditionalCheckFailed" and all(reason in {"None", "ConditionalCheckFailed"} for reason in reasons):
                raise DuplicateSubmission() from None
            if code == "TransactionCanceledException" and len(reasons) == 2 + len(catalog_checks) and reasons[:2] == ["None", "None"] and "ConditionalCheckFailed" in reasons[2:] and all(reason in {"None", "ConditionalCheckFailed"} for reason in reasons):
                raise OrderError("A product changed before the order committed. Refresh the catalog and retry.", 409, "catalog_changed") from None
            if code == "TransactionConflictException" or (code == "TransactionCanceledException" and "TransactionConflict" in reasons and all(reason in {"None", "TransactionConflict"} for reason in reasons)):
                raise ConcurrentTransaction() from None
            raise

    def history(self, owner, limit, now):
        orders = []
        start = None
        for _ in range(5):
            options = {"TableName": self.table_name, "IndexName": "SessionHistory", "KeyConditionExpression": "GSI1PK = :owner", "ExpressionAttributeValues": encode({":owner": f"SESSION#{owner}"}), "ScanIndexForward": False, "Limit": min(100, limit)}
            if start:
                options["ExclusiveStartKey"] = start
            response = self.client.query(**options)
            for raw in response.get("Items", []):
                item = decode(raw)
                if item.get("session_hash") == owner and item.get("expires_at", 0) > now:
                    orders.append(item)
                    if len(orders) >= limit:
                        return orders
            start = response.get("LastEvaluatedKey")
            if not start:
                break
        return orders

    def cancel(self, identifier, owner, now, updated):
        try:
            result = self.client.update_item(TableName=self.table_name, Key=encode({"PK": f"ORDER#{identifier}", "SK": "META"}), UpdateExpression="SET #status = :cancelled, updated_at = :updated", ConditionExpression="attribute_exists(PK) AND session_hash = :owner AND expires_at > :now AND #status = :confirmed", ExpressionAttributeNames={"#status": "status"}, ExpressionAttributeValues=encode({":owner": owner, ":now": int(now), ":confirmed": "CONFIRMED", ":cancelled": "CANCELLED", ":updated": updated}), ReturnValues="ALL_NEW")
            return decode(result["Attributes"])
        except ClientError as error:
            if error.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
                raise ConditionalCancellation() from None
            raise
