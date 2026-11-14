import logging
import os
from uuid import uuid4
import boto3
from botocore.config import Config
from validators import FORMATS, PDF_LIMIT

logger = logging.getLogger(__name__)


class DocumentStorage:
    def __init__(self, client, bucket):
        self.client, self.bucket = client, bucket

    @classmethod
    def from_environment(cls):
        return cls(boto3.client("s3", config=Config(connect_timeout=1, read_timeout=3, retries={"max_attempts": 1})), os.environ["DOCUMENT_BUCKET"])

    def stage(self, node_id, format, content):
        key = f"documents/{node_id}/{uuid4()}{FORMATS[format][0]}"
        try:
            result = self.client.put_object(Bucket=self.bucket, Key=key, Body=content, ContentType=FORMATS[format][1], ServerSideEncryption="AES256", IfNoneMatch="*")
            if not isinstance(result.get('VersionId'), str) or result['VersionId'] == 'null':
                raise RuntimeError('A verified immutable S3 version is required')
        except Exception:
            logger.warning("Unconfirmed document staging outcome; reconcile key=%s", key)
            raise
        return {"object_key": key, "object_version": result.get("VersionId", "null")}

    def read(self, node):
        result = self.client.get_object(Bucket=self.bucket, Key=node["object_key"], VersionId=node["object_version"])
        try:
            data = result["Body"].read(PDF_LIMIT + 1)
        finally:
            result["Body"].close()
        if len(data) > PDF_LIMIT or len(data) != int(node["size"]):
            raise RuntimeError("Invalid stored content size")
        return data

    def cleanup(self, staged):
        try:
            self.client.delete_object(Bucket=self.bucket, Key=staged["object_key"], VersionId=staged["object_version"])
        except Exception:
            logger.warning("Orphaned staged document; reconcile key=%s version=%s", staged["object_key"], staged["object_version"])

    def uncertain(self, staged):
        logger.warning("Unconfirmed metadata commit; retain staged document for reconciliation key=%s version=%s", staged["object_key"], staged["object_version"])
