from fastapi import Depends, Request
from fastapi.routing import APIRouter
from motor.motor_asyncio import AsyncIOMotorDatabase

from src.core.exceptions import BadRequest
from src.core.security import get_current_user
from src.domain.schemas.payment import CheckoutSession
from src.domain.schemas.user import User
from src.domain.services.payment import PaymentService
from src.infrastructure.database.mongo import get_db

payment_router = APIRouter(tags=["Payment"], prefix="/payment")


@payment_router.post("/checkout/", name="Create Stripe checkout session")
async def create_checkout(
    user: User = Depends(get_current_user(limit=5, interval=20)),
    db: AsyncIOMotorDatabase = Depends(get_db),  # type: ignore[type-arg]
) -> CheckoutSession:
    service = PaymentService(db)
    url = await service.create_checkout_session(user.id)
    return CheckoutSession(url=url)


@payment_router.post("/cancel/", name="Cancel subscription", status_code=204)
async def cancel_subscription(
    user: User = Depends(get_current_user(limit=5, interval=20)),
    db: AsyncIOMotorDatabase = Depends(get_db),  # type: ignore[type-arg]
) -> None:
    service = PaymentService(db)
    try:
        await service.cancel_subscription(user.id)
    except ValueError as e:
        raise BadRequest(detail=str(e))


@payment_router.post("/webhook/", name="Stripe webhook", include_in_schema=False)
async def stripe_webhook(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db),  # type: ignore[type-arg]
) -> dict[str, str]:
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    service = PaymentService(db)

    await service.handle_webhook(payload, sig_header)

    return {"status": "ok"}
