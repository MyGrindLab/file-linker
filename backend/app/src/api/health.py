from fastapi import APIRouter
from fastapi.responses import JSONResponse

health_router = APIRouter(tags=["Technicaal"], prefix="/health")


@health_router.get("/", name="Health check")
async def health_check() -> JSONResponse:
    return JSONResponse(content={"status": "ok"})
