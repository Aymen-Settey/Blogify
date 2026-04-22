import json
import uuid
from io import BytesIO

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from app.config import get_settings

settings = get_settings()


def get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=f"http{'s' if settings.MINIO_USE_SSL else ''}://{settings.MINIO_ENDPOINT}",
        aws_access_key_id=settings.MINIO_ROOT_USER,
        aws_secret_access_key=settings.MINIO_ROOT_PASSWORD,
        config=Config(signature_version="s3v4"),
        region_name="us-east-1",
    )


_PUBLIC_READ_POLICY = {
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {"AWS": ["*"]},
            "Action": ["s3:GetObject"],
            "Resource": [f"arn:aws:s3:::{settings.MINIO_BUCKET}/*"],
        }
    ],
}


def ensure_bucket_exists():
    client = get_s3_client()
    try:
        client.head_bucket(Bucket=settings.MINIO_BUCKET)
    except ClientError:
        client.create_bucket(Bucket=settings.MINIO_BUCKET)
    # Ensure public-read policy so /media/<key> is directly servable
    try:
        client.put_bucket_policy(
            Bucket=settings.MINIO_BUCKET,
            Policy=json.dumps(_PUBLIC_READ_POLICY),
        )
    except ClientError:
        pass


def upload_file(file_data: bytes, filename: str, content_type: str) -> str:
    """Upload file to MinIO and return public URL path."""
    ensure_bucket_exists()
    client = get_s3_client()

    ext = filename.rsplit(".", 1)[-1] if "." in filename else "bin"
    key = f"{uuid.uuid4().hex}.{ext}"

    client.put_object(
        Bucket=settings.MINIO_BUCKET,
        Key=key,
        Body=BytesIO(file_data),
        ContentType=content_type,
    )

    return f"/media/{key}"


def generate_presigned_url(key: str, expires_in: int = 3600) -> str:
    client = get_s3_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.MINIO_BUCKET, "Key": key},
        ExpiresIn=expires_in,
    )


def fetch_bytes_by_url(url: str) -> bytes | None:
    """Read an object back from MinIO given a public `/media/<key>` URL.

    Returns None if the URL doesn't match the expected scheme or the object
    is missing. Used by the CLIP backfill & async embed task.
    """
    if not url:
        return None
    prefix = "/media/"
    if not url.startswith(prefix):
        return None
    key = url[len(prefix):]
    if not key:
        return None
    client = get_s3_client()
    try:
        obj = client.get_object(Bucket=settings.MINIO_BUCKET, Key=key)
        return obj["Body"].read()
    except ClientError:
        return None
