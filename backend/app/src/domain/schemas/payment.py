from pydantic import BaseModel


class CheckoutSession(BaseModel):
    url: str
