"""boto3 S3 client configured for the project's local MinIO instance, plus
a streaming reader for zstd-compressed newline-delimited files stored there.
"""

import io
import os
from pathlib import Path

import boto3
import zstandard as zstd
from botocore.client import Config
from botocore.exceptions import ClientError
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[3] / ".env")

RAW_BUCKET = os.environ.get("MINIO_RAW_BUCKET", "chessia-raw")
PROCESSED_BUCKET = os.environ.get("MINIO_PROCESSED_BUCKET", "chessia-processed")


def get_s3_client():
    """Return a boto3 S3 client pointed at the local MinIO instance."""
    endpoint_url = os.environ.get("MINIO_ENDPOINT_URL", "http://localhost:9000")
    access_key = os.environ.get("MINIO_ROOT_USER") or os.environ.get("AWS_ACCESS_KEY_ID")
    secret_key = os.environ.get("MINIO_ROOT_PASSWORD") or os.environ.get("AWS_SECRET_ACCESS_KEY")

    return boto3.client(
        "s3",
        endpoint_url=endpoint_url,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        config=Config(signature_version="s3v4"),
        region_name="us-east-1",
    )


def ensure_bucket(client, bucket: str) -> None:
    """Create the bucket if it doesn't already exist (idempotent)."""
    try:
        client.head_bucket(Bucket=bucket)
    except ClientError:
        client.create_bucket(Bucket=bucket)


def open_s3_zst_reader(client, bucket: str, key: str) -> io.TextIOWrapper:
    """Open a .jsonl.zst object as a streaming, decompressing text reader.

    Mirrors the streaming pattern in api/utils/readFiles.py, but sourced
    from a MinIO object instead of a local file: the object is streamed
    and decompressed on the fly, never downloaded in full first.
    """
    body = client.get_object(Bucket=bucket, Key=key)["Body"]
    reader = zstd.ZstdDecompressor().stream_reader(body)
    return io.TextIOWrapper(reader, encoding="utf-8", errors="replace")


def upload_local_file(client, bucket: str, key: str, local_path: str | Path) -> None:
    """Upload a local file to the given bucket/key."""
    ensure_bucket(client, bucket)
    client.upload_file(str(local_path), bucket, key)
