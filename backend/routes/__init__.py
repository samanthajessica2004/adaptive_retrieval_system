"""Route module aggregator."""
from fastapi import APIRouter
from .documents import router as documents_router
from .chat import router as chat_router
from .compare import router as compare_router
from .visualize import router as visualize_router
from .export import router as export_router
from .search import router as search_router

api_router = APIRouter(prefix="/api")
api_router.include_router(documents_router)
api_router.include_router(chat_router)
api_router.include_router(compare_router)
api_router.include_router(visualize_router)
api_router.include_router(export_router)
api_router.include_router(search_router)


@api_router.get("/health")
async def health():
    return {"status": "ok"}
