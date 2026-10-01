import hashlib
from pathlib import Path

from django.core.files.base import ContentFile
from django.db import transaction
from django.utils import timezone

from apps.common.choices import (
    ControlledDocumentKind, DocumentProcessingStatus, DocumentRevisionStatus, DocumentType,
)
from apps.documents.extractor import extract_document
from apps.documents.generator import initial_content, render_document, validate_content
from apps.documents.models import ControlledDocument, Document, DocumentControlEvent, DocumentRevision
from apps.implementation.services import recalculate_checklist_item_state


KIND_DOCUMENT_TYPES = {
    ControlledDocumentKind.PROCEDURE: DocumentType.PROCEDURE,
    ControlledDocumentKind.MATRIX: DocumentType.MATRIX,
    ControlledDocumentKind.FORM: DocumentType.TEMPLATE,
}


class DocumentControlConflict(ValueError):
    pass


def _event(controlled, revision, action, user, notes=""):
    DocumentControlEvent.objects.create(
        controlled_document=controlled, revision=revision, action=action, user=user, notes=notes,
    )


def _sync_checklist(controlled):
    if controlled.checklist_item_id:
        recalculate_checklist_item_state(controlled.checklist_item)


def _retire_revision(controlled, revision, user, action, notes):
    revision.status = DocumentRevisionStatus.OBSOLETE
    revision.save(update_fields=["status", "updated_at"])
    Document.objects.filter(pk=revision.document_id).update(status=DocumentProcessingStatus.ARCHIVED)
    _event(controlled, revision, action, user, notes)


def _locked_document(controlled, expected_version):
    controlled = ControlledDocument.objects.select_for_update().select_related(
        "project__company", "project__standard", "requirement"
    ).get(pk=controlled.pk)
    if controlled.archived_at:
        raise ValueError("El documento esta archivado.")
    latest = controlled.revisions.select_related("document", "created_by").order_by("-number").first()
    if latest is None or latest.number != expected_version:
        raise DocumentControlConflict("La version cambio. Actualiza la pagina antes de continuar.")
    return controlled, latest


def _create_revision(controlled, *, number, user, change_summary, content=None, upload=None):
    if upload:
        suffix = Path(upload.name).suffix.lower()
        expected = ".docx" if controlled.kind == ControlledDocumentKind.PROCEDURE else ".xlsx"
        if suffix != expected:
            raise ValueError(f"Este tipo de documento requiere un archivo {expected}.")
        if upload.size > 10 * 1024 * 1024:
            raise ValueError("El archivo supera el limite de 10 MB.")
        file_name, payload = f"{controlled.code}_v{number:02d}{suffix}", upload.read()
        content, source = {}, "ARCHIVO"
    else:
        content = validate_content(controlled.kind, content)
        file_name, payload = render_document(controlled, number, content, created_by=user)
        source = "PLANTILLA"
    document = Document(
        project=controlled.project, requirement=controlled.requirement,
        checklist_item=controlled.checklist_item, title=f"{controlled.title} - v{number:02d}",
        document_type=KIND_DOCUMENT_TYPES[controlled.kind], uploaded_by=user,
        status=DocumentProcessingStatus.READY,
    )
    document.file.save(file_name, ContentFile(payload), save=False)
    try:
        try:
            document.extracted_text, document.extracted_metadata = extract_document(Path(document.file.path))
        except Exception as exc:
            raise ValueError("No se pudo leer el archivo. Comprueba que sea un Word o Excel valido.") from exc
        if not document.extracted_text.strip():
            raise ValueError("El archivo no contiene texto legible.")
        document.save()
        revision = DocumentRevision.objects.create(
            controlled_document=controlled, document=document, number=number, content=content,
            source=source, content_hash=hashlib.sha256(payload).hexdigest(),
            change_summary=change_summary, created_by=user,
        )
    except Exception:
        # Only discard the newly written artifact if its revision was never committed.
        document.file.delete(save=False)
        raise
    _event(controlled, revision, "CREACION" if number == 1 else "NUEVA_VERSION", user, change_summary)
    return revision


@transaction.atomic
def create_controlled_document(*, user, project, code, title, kind, process_area="",
                               requirement=None, checklist_item=None, content=None):
    if checklist_item and not requirement:
        requirement = checklist_item.requirement
    if requirement and not checklist_item:
        checklist_item = project.checklist_items.filter(requirement=requirement).first()
    controlled = ControlledDocument.objects.create(
        project=project, code=code, title=title, kind=kind, requirement=requirement,
        checklist_item=checklist_item, process_area=process_area or (
            requirement.process_area if requirement else ""
        ), created_by=user,
    )
    content = content if content is not None else initial_content(kind, project=project, requirement=requirement)
    _create_revision(controlled, number=1, user=user, change_summary="Creacion del borrador", content=content)
    _sync_checklist(controlled)
    return controlled


@transaction.atomic
def create_new_revision(controlled, *, user, expected_version, change_summary, content=None, upload=None):
    controlled, previous = _locked_document(controlled, expected_version)
    if previous.status == DocumentRevisionStatus.IN_REVIEW:
        raise ValueError("Devuelve el documento a borrador antes de modificarlo.")
    if content is None and not upload:
        content = previous.content
    revision = _create_revision(
        controlled, number=previous.number + 1, user=user,
        change_summary=change_summary, content=content, upload=upload,
    )
    if previous.status == DocumentRevisionStatus.DRAFT:
        _retire_revision(controlled, previous, user, "SUSTITUCION_BORRADOR", f"Sustituido por v{revision.number:02d}")
    _sync_checklist(controlled)
    return revision


@transaction.atomic
def transition_document(controlled, *, user, expected_version, action, notes="", confirmed=False):
    controlled, revision = _locked_document(controlled, expected_version)
    if action == "submit":
        if revision.status != DocumentRevisionStatus.DRAFT:
            raise ValueError("Solo un borrador puede enviarse a revision.")
        if revision.source == "PLANTILLA" and controlled.kind == ControlledDocumentKind.PROCEDURE:
            if any(not item["text"].strip() for item in revision.content["sections"]):
                raise ValueError("Completa todas las secciones del POE antes de enviarlo a revision.")
        if "[Pendiente de completar]" in revision.document.extracted_text:
            raise ValueError("El documento todavia contiene secciones pendientes.")
        revision.status = DocumentRevisionStatus.IN_REVIEW
    elif action == "return_to_draft":
        if revision.status != DocumentRevisionStatus.IN_REVIEW:
            raise ValueError("Solo un documento en revision puede devolverse a borrador.")
        revision.status = DocumentRevisionStatus.DRAFT
    elif action == "approve":
        if not user.is_staff:
            raise PermissionError("La aprobacion requiere un usuario administrador.")
        if revision.status != DocumentRevisionStatus.IN_REVIEW:
            raise ValueError("La version debe estar en revision antes de aprobarla.")
        if not confirmed or not notes.strip():
            raise ValueError("Confirma la revision humana e indica las notas de aprobacion.")
        for previous in controlled.revisions.filter(status=DocumentRevisionStatus.CURRENT):
            _retire_revision(controlled, previous, user, "SUSTITUCION_VIGENTE", f"Sustituido por v{revision.number:02d}")
        revision.status = DocumentRevisionStatus.CURRENT
        revision.approved_by, revision.approved_at = user, timezone.now()
        revision.effective_date = timezone.localdate()
        revision.approval_notes = notes
        if revision.source == "PLANTILLA":
            file_name, payload = render_document(
                controlled, revision.number, revision.content, created_by=revision.created_by,
                approved_by=user, effective_date=revision.effective_date,
            )
            revision.released_file.save(file_name, ContentFile(payload), save=False)
            revision.released_hash = hashlib.sha256(payload).hexdigest()
        else:
            revision.released_file.name = revision.document.file.name
            revision.released_hash = revision.content_hash
    elif action == "archive":
        if not notes.strip():
            raise ValueError("Indica el motivo de archivo.")
        controlled.archived_at = timezone.now()
        controlled.save(update_fields=["archived_at", "updated_at"])
        for item in controlled.revisions.all():
            item.status = DocumentRevisionStatus.ARCHIVED
            item.save(update_fields=["status", "updated_at"])
            Document.objects.filter(pk=item.document_id).update(status=DocumentProcessingStatus.ARCHIVED)
            _event(controlled, item, "ARCHIVO", user, notes)
        _sync_checklist(controlled)
        return revision
    else:
        raise ValueError("Transicion no reconocida.")
    revision.save()
    _event(controlled, revision, action.upper(), user, notes)
    _sync_checklist(controlled)
    return revision
