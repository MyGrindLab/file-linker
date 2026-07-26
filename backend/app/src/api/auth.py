import httpx
from fastapi import BackgroundTasks, Depends
from fastapi.responses import RedirectResponse
from fastapi.routing import APIRouter
from motor.motor_asyncio import AsyncIOMotorDatabase

from src.core.security import create_access_token, get_current_user
from src.core.settings import settings
from src.domain.schemas.email import EmailCheck
from src.domain.schemas.user import Token, User, UserCreate, UserLogin
from src.domain.services.auth import AuthService
from src.infrastructure.database.mongo import get_db

auth_router = APIRouter(tags=["Auth"], prefix="/auth")


@auth_router.post("/register/", name="Register", status_code=202)
async def register(
    body: UserCreate,
    bg: BackgroundTasks,
    db: AsyncIOMotorDatabase = Depends(get_db),  # type: ignore[type-arg]
) -> dict[str, str]:
    service = AuthService(db)
    await service.register(body.email, body.password, bg)
    return {"detail": "Verification code sent to your email"}


@auth_router.post("/verify-email/", name="Verify email")
async def verify_email(
    body: EmailCheck,
    db: AsyncIOMotorDatabase = Depends(get_db),  # type: ignore[type-arg]
) -> Token:
    service = AuthService(db)
    user = await service.verify_email(body)
    return Token(access_token=create_access_token(user.id, user.is_paid))


@auth_router.post("/login/", name="Login")
async def login(
    body: UserLogin,
    db: AsyncIOMotorDatabase = Depends(get_db),  # type: ignore[type-arg]
) -> Token:
    service = AuthService(db)
    user = await service.login(body.email, body.password)
    return Token(access_token=create_access_token(user.id, user.is_paid))


@auth_router.get("/google/", name="Google OAuth redirect")
async def google_redirect() -> RedirectResponse:
    redirect_uri = f"{settings.DOMAIN}/api/auth/google/callback/"
    url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={settings.GOOGLE_CLIENT_ID}"
        f"&redirect_uri={redirect_uri}"
        "&response_type=code"
        "&scope=openid+email+profile"
    )
    return RedirectResponse(url)


@auth_router.get("/google/callback/", name="Google OAuth callback")
async def google_callback(
    code: str,
    db: AsyncIOMotorDatabase = Depends(get_db),  # type: ignore[type-arg]
) -> RedirectResponse:
    redirect_uri = f"{settings.DOMAIN}/api/auth/google/callback/"
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        token_response.raise_for_status()
        access_token = token_response.json()["access_token"]

        profile_response = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        profile_response.raise_for_status()
        profile = profile_response.json()

    service = AuthService(db)
    user = await service.find_or_create_oauth_user(
        email=profile["email"],
        provider="google",
        oauth_id=profile["sub"],
    )
    token = create_access_token(user.id, user.is_paid)
    return RedirectResponse(f"{settings.FRONTEND_URL}/auth/callback?token={token}")


@auth_router.get("/github/", name="GitHub OAuth redirect")
async def github_redirect() -> RedirectResponse:
    redirect_uri = f"{settings.DOMAIN}/api/auth/github/callback/"
    url = (
        "https://github.com/login/oauth/authorize"
        f"?client_id={settings.GITHUB_CLIENT_ID}"
        f"&redirect_uri={redirect_uri}"
        "&scope=user:email"
    )
    return RedirectResponse(url)


@auth_router.post("/refresh/", name="Refresh token")
async def refresh(
    user: User = Depends(get_current_user(limit=5, interval=20)),
) -> Token:
    return Token(access_token=create_access_token(user.id, user.is_paid))


@auth_router.get("/github/callback/", name="GitHub OAuth callback")
async def github_callback(
    code: str,
    db: AsyncIOMotorDatabase = Depends(get_db),  # type: ignore[type-arg]
) -> RedirectResponse:
    redirect_uri = f"{settings.DOMAIN}/api/auth/github/callback/"
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://github.com/login/oauth/access_token",
            data={
                "code": code,
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "redirect_uri": redirect_uri,
            },
            headers={"Accept": "application/json"},
        )
        token_response.raise_for_status()
        access_token = token_response.json()["access_token"]

        profile_response = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        profile_response.raise_for_status()
        profile = profile_response.json()

        email = profile.get("email")
        if not email:
            emails_response = await client.get(
                "https://api.github.com/user/emails",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            emails_response.raise_for_status()
            primary = next(
                (e for e in emails_response.json() if e.get("primary")), None
            )
            email = primary["email"] if primary else f"{profile['id']}@github.invalid"

    service = AuthService(db)
    user = await service.find_or_create_oauth_user(
        email=email,
        provider="github",
        oauth_id=str(profile["id"]),
    )
    token = create_access_token(user.id, user.is_paid)
    return RedirectResponse(f"{settings.FRONTEND_URL}/auth/callback?token={token}")
