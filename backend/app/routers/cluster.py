from fastapi import APIRouter
import logging

from app.core.queue import enqueue_clustering_job

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/cluster/trigger")
async def trigger_clustering():
    """
    Manually trigger the image clustering job
    """
    try:
        result = enqueue_clustering_job(reason="manual-alias")
        return {"status": "success", **result}
    except Exception as e:
        logger.error(f"Failed to trigger clustering: {e}")
        return {"status": "error", "message": str(e)}
