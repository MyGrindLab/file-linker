import aioboto3
from botocore.config import Config as BotoCoreConfig

from src.core.exceptions import FileNotFound
from src.core.settings import settings
from src.domain.schemas.file import FileData


class AsyncStorageClient:
    def __init__(self) -> None:
        self._session = aioboto3.Session()

    @property
    def _params(self) -> dict:
        return {
            "service_name": "s3",
            "endpoint_url": settings.STORAGE_PATH,
            "aws_access_key_id": settings.STORAGE_USER,
            "aws_secret_access_key": settings.STORAGE_PASS,
            "config": BotoCoreConfig(
                signature_version="s3v4",
                connect_timeout=10,
                read_timeout=10,
                retries={"max_attempts": 3},
            ),
        }

    async def upload(
        self,
        filename: str,
        body: bytes,
        content_type: str = "application/octet-stream",
        bucket: str = settings.STORAGE_BUCKET,
    ) -> str:
        async with self._session.resource(**self._params) as s3:
            s3_object = await s3.Object(bucket, filename)
            await s3_object.put(Body=body, ContentType=content_type)

        return filename

    async def retrieve(
        self, filename: str, bucket: str = settings.STORAGE_BUCKET
    ) -> FileData:
        async with self._session.client(**self._params) as s3:  # type:ignore
            try:
                response = await s3.get_object(Bucket=bucket, Key=filename)
            except Exception:  # TODO:
                raise FileNotFound

            content = await response["Body"].read()

        return FileData(
            filename=filename,
            content=content,
            content_type=response["ResponseMetadata"]["HTTPHeaders"].get(
                "content-type"
            ),
        )

    async def delete(
        self, filename: str, bucket: str = settings.STORAGE_BUCKET
    ) -> None:
        async with self._session.client(**self._params) as s3:  # type:ignore
            await s3.delete_object(Bucket=bucket, Key=filename)
