"""
Status endpoint for checking job progress
"""

import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from redis import Redis
from rq.job import Job

from find_api.core.config import settings
from find_api.core.dependencies import get_admin_user, get_required_user
from find_api.core.model_manager import get_model_manager
from find_api.models.user import User

router = APIRouter()

redis_conn = Redis.from_url(settings.REDIS_URL)


@router.get("/status/models")
def get_loaded_models(_admin: Optional[User] = Depends(get_admin_user)):
    """
    Get currently loaded ML models across API/worker processes.

    Exposes deployment internals, so this is admin-only in shared mode
    (no-op restriction in local mode).
    """
    manager = get_model_manager()
    local_status = manager.get_status()
    process_status = {local_status["process"]: local_status}

    for key in redis_conn.scan_iter("find:model_status:*"):
        try:
            raw_status = redis_conn.get(key)
            if not raw_status:
                continue
            status = json.loads(raw_status)
            process_name = status.get("process")
            if process_name:
                process_status[process_name] = status
        except Exception:
            continue

    loaded_models = sorted(
        {
            model_name
            for status in process_status.values()
            for model_name in status.get("loaded_models", [])
        }
    )

    return {
        "loaded_models": loaded_models,
        "processes": process_status,
        "ttl_seconds": settings.ML_MODEL_IDLE_TTL_SECONDS,
    }


@router.get("/status/{job_id}")
def get_job_status(
    job_id: str,
    _user: Optional[User] = Depends(get_required_user),
):
    """
    Check status of a processing job

    Args:
        job_id: RQ job ID

    Returns:
        Job status information with stage tracking
    """
    try:
        job = Job.fetch(job_id, connection=redis_conn)

        status_info = {
            "job_id": job_id,
            "status": job.get_status(),
            "stage": job.meta.get("stage", "queued"),
            "created_at": job.created_at.isoformat() if job.created_at else None,
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "ended_at": job.ended_at.isoformat() if job.ended_at else None,
        }

        if job.is_finished:
            status_info["result"] = job.result

        if job.is_failed:
            status_info["error"] = job.meta.get("error", "Job failed")
            status_info["stage"] = job.meta.get("stage", "failed")

        return status_info

    except Exception:
        raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")
