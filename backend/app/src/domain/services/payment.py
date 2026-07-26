import logging

import stripe
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from src.core.settings import settings

logger = logging.getLogger(__name__)


class PaymentService:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:  # type: ignore[type-arg]
        self._db = db

    async def create_checkout_session(self, user_id: str) -> str:
        stripe.api_key = settings.STRIPE_SECRET_KEY
        session = await stripe.checkout.Session.create_async(
            payment_method_types=["card"],
            mode="subscription",
            line_items=[
                {
                    "price_data": {
                        "currency": "usd",
                        "product_data": {"name": "File Linker Pro"},
                        "unit_amount": 200,
                        "recurring": {"interval": "month"},
                    },
                    "quantity": 1,
                }
            ],
            metadata={"user_id": user_id},
            success_url=settings.STRIPE_SUCCESS_URL,
            cancel_url=settings.STRIPE_CANCEL_URL,
        )
        return str(session.url)

    async def handle_webhook(self, payload: bytes, sig_header: str) -> None:
        stripe.api_key = settings.STRIPE_SECRET_KEY

        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
            )
        except (ValueError, stripe.error.SignatureVerificationError):  # type: ignore[attr-defined]
            return

        if event["type"] == "checkout.session.completed":
            session = event["data"]["object"]
            user_id = session.get("metadata", {}).get("user_id")
            customer_id = session.get("customer")
            if user_id:
                update: dict[str, object] = {"is_paid": True}
                if customer_id:
                    update["stripe_customer_id"] = customer_id
                await self._db.users.update_one(
                    {"_id": ObjectId(user_id)}, {"$set": update}
                )

        elif event["type"] == "customer.subscription.deleted":
            subscription = event["data"]["object"]
            customer_id = subscription.get("customer")
            if customer_id:
                await self._db.users.update_one(
                    {"stripe_customer_id": customer_id}, {"$set": {"is_paid": False}}
                )

    async def cancel_subscription(self, user_id: str) -> None:
        stripe.api_key = settings.STRIPE_SECRET_KEY

        doc = await self._db.users.find_one({"_id": ObjectId(user_id)})
        if doc is None or not doc.get("stripe_customer_id"):
            raise ValueError("No active subscription found")

        subscriptions = stripe.Subscription.list(
            customer=doc["stripe_customer_id"], status="active", limit=1
        )
        if subscriptions.data:
            stripe.Subscription.cancel(subscriptions.data[0].id)

        await self._db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"is_paid": False, "stripe_customer_id": None}},
        )
