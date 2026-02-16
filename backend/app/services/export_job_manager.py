"""
SVC-6.3 — Export Job Manager.

Provides:
- Async-style export job queue (using in-process asyncio tasks)
- Job status tracking (pending → running → completed / failed)
- Retrievable export artifacts (PDF / Markdown / JSON bytes)
- Auto-cleanup of old jobs

Usage from a route:
    from app.services.export_job_manager import export_job_manager

    job_id = await export_job_manager.enqueue(
        session_id=...,
        export_format="pdf",
        options={...},
        db_factory=get_db,          # callable that yields a Session
    )

    status = export_job_manager.get_status(job_id)
    data   = export_job_manager.get_result(job_id)
"""
import asyncio
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, Dict, Optional
from uuid import UUID, uuid4

from app.core.logger import get_logger

logger = get_logger(__name__)


class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class _ExportJob:
    __slots__ = (
        "id", "session_id", "export_format", "options",
        "status", "result", "error", "created_at", "completed_at",
    )

    def __init__(
        self,
        job_id: UUID,
        session_id: UUID,
        export_format: str,
        options: Dict[str, Any],
    ):
        self.id = job_id
        self.session_id = session_id
        self.export_format = export_format
        self.options = options
        self.status = JobStatus.PENDING
        self.result: Optional[bytes] = None
        self.error: Optional[str] = None
        self.created_at = datetime.utcnow()
        self.completed_at: Optional[datetime] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "job_id": str(self.id),
            "session_id": str(self.session_id),
            "export_format": self.export_format,
            "status": self.status.value,
            "error": self.error,
            "created_at": self.created_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "result_size": len(self.result) if self.result else 0,
        }


class ExportJobManager:
    """In-process async export job queue with status tracking."""

    def __init__(self, max_jobs: int = 200, ttl_hours: int = 24):
        self._jobs: Dict[UUID, _ExportJob] = {}
        self._max_jobs = max_jobs
        self._ttl = timedelta(hours=ttl_hours)

    # ── Enqueue ──────────────────────────────────────────────────

    async def enqueue(
        self,
        session_id: UUID,
        export_format: str,
        options: Dict[str, Any],
        db_factory: Callable,
    ) -> str:
        """
        Create a new export job and start it in the background.

        Args:
            session_id: Session to export
            export_format: "pdf", "markdown", or "json"
            options: Dict with include_deferred, detail_level, etc.
            db_factory: Callable that returns a DB session (e.g., get_db generator)

        Returns:
            job_id as string
        """
        self._cleanup_old_jobs()

        job_id = uuid4()
        job = _ExportJob(job_id, session_id, export_format, options)
        self._jobs[job_id] = job

        # Fire-and-forget background task
        asyncio.create_task(self._run_job(job, db_factory))

        logger.info(f"Export job {job_id} enqueued ({export_format})")
        return str(job_id)

    # ── Status ───────────────────────────────────────────────────

    def get_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        job = self._jobs.get(UUID(job_id))
        if not job:
            return None
        return job.to_dict()

    # ── Result ───────────────────────────────────────────────────

    def get_result(self, job_id: str) -> Optional[bytes]:
        """Return export bytes if job completed, else None."""
        job = self._jobs.get(UUID(job_id))
        if not job or job.status != JobStatus.COMPLETED:
            return None
        return job.result

    # ── List jobs ────────────────────────────────────────────────

    def list_jobs(
        self,
        session_id: Optional[UUID] = None,
    ) -> list[Dict[str, Any]]:
        jobs = self._jobs.values()
        if session_id:
            jobs = [j for j in jobs if j.session_id == session_id]
        return [j.to_dict() for j in sorted(jobs, key=lambda j: j.created_at, reverse=True)]

    # ── Cancel ───────────────────────────────────────────────────

    def cancel(self, job_id: str) -> bool:
        job = self._jobs.get(UUID(job_id))
        if not job or job.status not in (JobStatus.PENDING, JobStatus.RUNNING):
            return False
        job.status = JobStatus.FAILED
        job.error = "Cancelled by user"
        job.completed_at = datetime.utcnow()
        return True

    # ── Internal runner ──────────────────────────────────────────

    async def _run_job(
        self,
        job: _ExportJob,
        db_factory: Callable,
    ):
        job.status = JobStatus.RUNNING
        try:
            from app.services.export_service import export_service

            # Obtain a database session
            db_gen = db_factory()
            db = next(db_gen)

            try:
                opts = job.options
                fmt = job.export_format.lower()

                if fmt == "pdf":
                    from app.services.pdf_generator import PDFGenerator

                    md = export_service.export_markdown(
                        database=db,
                        session_id=str(job.session_id),
                        include_deferred=opts.get("include_deferred", True),
                        include_change_log=opts.get("include_change_log", False),
                        include_assignments=opts.get("include_assignments", True),
                        include_sources=opts.get("include_sources", True),
                        include_completed=opts.get("include_completed", True),
                        include_conversations=opts.get("include_conversations", False),
                        detail_level=opts.get("detail_level", "standard"),
                    )
                    project_name = "Scope Document"
                    for line in md.split("\n"):
                        if line.startswith("# "):
                            project_name = line[2:].strip()
                            break
                    gen = PDFGenerator()
                    job.result = gen.generate(md, project_name, str(job.session_id))

                elif fmt == "markdown":
                    md = export_service.export_markdown(
                        database=db,
                        session_id=str(job.session_id),
                        include_deferred=opts.get("include_deferred", True),
                        include_change_log=opts.get("include_change_log", False),
                        include_assignments=opts.get("include_assignments", True),
                        include_sources=opts.get("include_sources", True),
                        include_completed=opts.get("include_completed", True),
                        include_conversations=opts.get("include_conversations", False),
                        detail_level=opts.get("detail_level", "standard"),
                    )
                    job.result = md.encode("utf-8")

                elif fmt == "json":
                    import json
                    data = export_service.export_json(
                        database=db,
                        session_id=str(job.session_id),
                        include_deferred=opts.get("include_deferred", True),
                        include_change_log=opts.get("include_change_log", False),
                        include_assignments=opts.get("include_assignments", True),
                        include_sources=opts.get("include_sources", True),
                        include_completed=opts.get("include_completed", True),
                        include_conversations=opts.get("include_conversations", False),
                        detail_level=opts.get("detail_level", "standard"),
                    )
                    job.result = json.dumps(data, indent=2, default=str).encode("utf-8")

                else:
                    raise ValueError(f"Unsupported export format: {fmt}")

                job.status = JobStatus.COMPLETED
                job.completed_at = datetime.utcnow()
                logger.info(
                    f"Export job {job.id} completed "
                    f"({len(job.result)} bytes, {fmt})"
                )
            finally:
                # Close the DB session generator
                try:
                    next(db_gen, None)
                except StopIteration:
                    pass

        except Exception as exc:
            job.status = JobStatus.FAILED
            job.error = str(exc)
            job.completed_at = datetime.utcnow()
            logger.error(f"Export job {job.id} failed: {exc}")

    # ── Cleanup ──────────────────────────────────────────────────

    def _cleanup_old_jobs(self):
        cutoff = datetime.utcnow() - self._ttl
        expired = [
            jid for jid, j in self._jobs.items()
            if j.completed_at and j.completed_at < cutoff
        ]
        for jid in expired:
            del self._jobs[jid]

        # Also cap total count
        if len(self._jobs) > self._max_jobs:
            sorted_jobs = sorted(
                self._jobs.items(),
                key=lambda kv: kv[1].created_at,
            )
            to_remove = len(self._jobs) - self._max_jobs
            for jid, _ in sorted_jobs[:to_remove]:
                del self._jobs[jid]


# Global instance
export_job_manager = ExportJobManager()
