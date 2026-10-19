"""Durable document jobs; business services remain callable without Celery."""

from uuid import uuid4

from celery import shared_task
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from kombu.exceptions import OperationalError

from apps.ai_engine.ollama_client import OllamaAPIError
from apps.common.choices import DocumentProcessingStatus
from apps.documents.models import Document, DocumentProcessingJob as Job
from apps.documents.services import index_document_chunks, process_document


def enqueue_document(
    document, *, user, operation=Job.Operation.INGEST, review_after_processing=False, review_options=None
):
    with transaction.atomic():
        Document.objects.select_for_update().get(pk=document.pk)
        active = document.processing_jobs.filter(
            status__in=[Job.Status.PENDING, Job.Status.RUNNING, Job.Status.RETRY]
        ).first()
        if active:
            return active
        job = Job.objects.create(
            document=document,
            created_by=user,
            operation=operation,
            review_after_processing=review_after_processing,
            review_options=review_options or {},
            task_id=str(uuid4()),
        )

    def publish():
        try:
            process_document_job.apply_async(args=[job.pk], task_id=job.task_id)
        except (OperationalError, OSError):
            Job.objects.filter(pk=job.pk).update(
                status=Job.Status.FAILED,
                error="No se pudo conectar con la cola. Comprueba Redis y vuelve a intentar.",
                finished_at=timezone.now(),
            )

    if settings.CELERY_TASK_ALWAYS_EAGER:
        publish()
    else:
        transaction.on_commit(publish)
    job.refresh_from_db()
    return job


@shared_task(bind=True, max_retries=3, name="documents.process_document")
def process_document_job(self, job_id):
    with transaction.atomic():
        job = (
            Job.objects.select_for_update(of=("self",))
            .select_related("document", "created_by")
            .get(pk=job_id)
        )
        if job.status not in [Job.Status.PENDING, Job.Status.RETRY]:
            return job.result
        job.status = Job.Status.RUNNING
        job.attempts += 1
        job.started_at = job.started_at or timezone.now()
        job.error = ""
        job.save()
    document = job.document
    try:
        if document.status == DocumentProcessingStatus.ARCHIVED:
            raise ValueError("El documento esta archivado.")
        if job.operation == Job.Operation.INGEST:
            process_document(document)
            if document.status != DocumentProcessingStatus.READY:
                raise ValueError(document.processing_error)
        result = {} if job.operation == Job.Operation.REVIEW else index_document_chunks(
            document, overwrite=False, created_by=job.created_by
        )
        if job.review_after_processing or job.operation == Job.Operation.REVIEW:
            from apps.reviews.iso_reviewer import run_document_review

            review = run_document_review(
                document=document,
                review_type=job.review_options.get("review_type", "CUMPLIMIENTO_NORMATIVO"),
                created_by=job.created_by,
                requirement_ids=job.review_options.get("requirements") or ([document.requirement_id] if document.requirement_id else None),
            )
            result["review_id"] = review.pk
    except (OllamaAPIError, ConnectionError, TimeoutError) as exc:
        if self.request.retries < self.max_retries:
            Job.objects.filter(pk=job.pk).update(
                status=Job.Status.RETRY, error=str(exc)
            )
            raise self.retry(exc=exc, countdown=min(60, 5 * 2**self.request.retries))
        _fail(job, exc)
        return {"error": str(exc)}
    except Exception as exc:
        _fail(job, exc)
        return {"error": str(exc)}
    Job.objects.filter(pk=job.pk).update(
        status=Job.Status.SUCCESS, result=result, error="", finished_at=timezone.now()
    )
    return result


def _fail(job, exc):
    Job.objects.filter(pk=job.pk).update(
        status=Job.Status.FAILED, error=str(exc), finished_at=timezone.now()
    )
