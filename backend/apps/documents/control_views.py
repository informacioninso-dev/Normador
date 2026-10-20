from apps.companies.api_access import CompanyScopedViewMixin
from django.db import IntegrityError
from django.db.models import Prefetch
from django.http import FileResponse
from io import BytesIO
from pathlib import Path
import hashlib
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.documents.control import (
    DocumentControlConflict, create_controlled_document, create_new_revision, transition_document,
)
from apps.documents.control_serializers import (
    ControlledDocumentCreateSerializer, ControlledDocumentSerializer,
    DocumentControlTransitionSerializer, NewDocumentRevisionSerializer,
)
from apps.documents.models import ControlledDocument, DocumentControlEvent, DocumentRevision
from apps.documents.generator import render_document


class ControlledDocumentViewSet(CompanyScopedViewMixin,
    mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    serializer_class = ControlledDocumentSerializer

    def get_queryset(self):
        queryset = ControlledDocument.objects.select_related("project__company", "requirement").prefetch_related(
            Prefetch("revisions", queryset=DocumentRevision.objects.select_related("document", "created_by", "approved_by")),
            Prefetch("control_events", queryset=DocumentControlEvent.objects.select_related("user", "revision")),
        )
        for field in ["project", "kind"]:
            value = self.request.query_params.get(field)
            if value:
                queryset = queryset.filter(**{field: value})
        return queryset

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "detail": self.action != "list"}

    def _response(self, controlled, response_status=200):
        refreshed = self.get_queryset().get(pk=controlled.pk)
        return Response(self.get_serializer(refreshed).data, status=response_status)

    def create(self, request, *args, **kwargs):
        serializer = ControlledDocumentCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        try:
            controlled = create_controlled_document(user=request.user, **serializer.validated_data)
        except IntegrityError:
            return Response({"detail": "El codigo ya existe en este proyecto."}, status=409)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)
        return self._response(controlled, status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def new_revision(self, request, pk=None):
        controlled = self.get_object()
        serializer = NewDocumentRevisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        data["upload"] = data.pop("file", None)
        try:
            create_new_revision(controlled, user=request.user, **data)
        except (DocumentControlConflict, IntegrityError):
            return Response({"detail": "La version cambio. Actualiza la pagina."}, status=409)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)
        return self._response(controlled, status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def transition(self, request, pk=None):
        controlled = self.get_object()
        serializer = DocumentControlTransitionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            transition_document(controlled, user=request.user, **serializer.validated_data)
        except PermissionError as exc:
            return Response({"detail": str(exc)}, status=403)
        except (DocumentControlConflict, IntegrityError):
            return Response({"detail": "La version cambio. Actualiza la pagina."}, status=409)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)
        return self._response(controlled)

    @action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        controlled = self.get_object()
        try:
            number = int(request.query_params.get("version", ""))
        except (TypeError, ValueError):
            return Response({"detail": "Indica el numero de version."}, status=400)
        revision = controlled.revisions.filter(number=number).first()
        if revision is None:
            return Response({"detail": "Version no encontrada."}, status=404)
        artifact = revision.released_file or revision.document.file
        format = request.query_params.get("file_format")
        if format and format not in {"pdf", "docx", "xlsx"}:
            return Response({"detail": "Formato no admitido."}, status=400)
        if format and Path(artifact.name).suffix.lower() != f".{format}":
            if revision.source != "PLANTILLA":
                return Response({"detail": "La conversion esta disponible para documentos generados en NORMAN. Descarga el archivo original."}, status=400)
            try:
                filename, payload = render_document(
                    controlled, revision.number, revision.content, created_by=revision.created_by,
                    approved_by=revision.approved_by, effective_date=revision.effective_date,
                    presentation=revision.presentation_snapshot, format=format,
                )
            except ValueError as exc:
                return Response({"detail": str(exc)}, status=400)
            response = FileResponse(BytesIO(payload), as_attachment=True, filename=filename)
            response["Cache-Control"] = "private, no-store"
            response["X-Document-State"] = revision.status
            response["X-Document-SHA256"] = hashlib.sha256(payload).hexdigest()
            return response
        response = FileResponse(artifact.open("rb"), as_attachment=True, filename=artifact.name.rsplit("/", 1)[-1])
        response["Cache-Control"] = "private, no-store"
        response["X-Document-State"] = revision.status
        response["X-Document-SHA256"] = revision.released_hash or revision.content_hash
        return response
