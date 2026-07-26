import logging
import random
from uuid import uuid4

from fastapi import BackgroundTasks
from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType
from jinja2 import Environment, FileSystemLoader, Template, TemplateNotFound

from src.core.exceptions import BadRequest, EmailNotSend
from src.core.settings import settings
from src.domain.dataclasses import email as email_data
from src.domain.enums.redis import RedisKey
from src.domain.schemas.email import CheckResult, EmailCheck, EmailMessage
from src.infrastructure.redis.client import RedisClient, RedisKeyValueException

logger = logging.getLogger("EMAIL_SENDER")

env = Environment(loader=FileSystemLoader("/app/src/templates"))


async def _get_full_message_text(message: EmailMessage) -> str:
    try:
        template: Template = env.get_template(message.template_path)
    except TemplateNotFound as e:
        raise EmailNotSend(message=f"Template not found: {e}")

    return template.render(**message.data)


async def _email_schema(message: EmailMessage) -> MessageSchema:
    body: str = await _get_full_message_text(message)

    return MessageSchema(
        subject=message.title,
        recipients=message.to,
        body=body,
        subtype=MessageType.html,
        # attachments=[
        #     {
        #         "file": "/app/src/static/png/logo.png",
        #         "headers": {
        #             "Content-ID": "<logo>",
        #         },
        #         "mime_type": "image",
        #         "mime_subtype": "png",
        #     }
        # ],
    )


def _get_mail_conf() -> ConnectionConfig:
    return ConnectionConfig(
        MAIL_USERNAME=settings.MAIL_USERNAME,
        MAIL_PASSWORD=settings.MAIL_PASSWORD,
        MAIL_FROM=settings.MAIL_FROM,
        MAIL_PORT=settings.MAIL_PORT,
        MAIL_SERVER=settings.MAIL_SERVER,
        MAIL_STARTTLS=settings.MAIL_STARTTLS,
        MAIL_SSL_TLS=settings.MAIL_SSL_TLS,
    )


async def _send_email(data: EmailMessage) -> None:
    message = await _email_schema(data)

    conf = _get_mail_conf()

    fm = FastMail(conf)
    await fm.send_message(message)


async def send_code_to_email(email: str, bg: BackgroundTasks) -> None:
    code: int = random.randint(10000, 99999)

    redis = RedisClient()

    check_key: str = RedisKey.check.format(name=email)
    await redis.set_value(check_key, code, expire=60)

    message = EmailMessage(
        title=email_data.EmailConfirmationContent.title,
        template_path=email_data.EmailConfirmationContent.path,
        data={"code": code},
        to=[email],
    )
    bg.add_task(_send_email, data=message)


async def verify_email_code(data: EmailCheck) -> CheckResult:
    check_key: str = RedisKey.check.format(name=data.email)

    redis = RedisClient()

    try:
        await redis.check_value(check_key, data.code)

        # Delete code after verification to prevent reuse
        await redis.delete_value(check_key)
    except RedisKeyValueException:
        raise BadRequest(detail="Invalid code")

    key = uuid4()
    check_verify_key: str = RedisKey.check_verify.format(_id=key)
    await redis.set_value(check_verify_key, data.email, expire=60)

    return CheckResult(id=key)
