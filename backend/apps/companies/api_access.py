from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.decorators import action
from django.http import FileResponse

from apps.companies.access import (
    COMPANY_PATHS,
    MANAGE_ROLES,
    VALIDATE_ROLES,
    can_access_company,
    roles_for_action,
    scope_queryset,
)


class CompanyScopedViewMixin:
    """Scope after view filters too, so list/detail/custom actions share one boundary."""

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        identifiers = {
            "company",
            "project",
            "document",
            "requirement",
            "standard",
            "review",
            "finding",
            "checklist_item",
            "worklog",
            "action_plan",
            "consultant",
            "library_standard",
            "library_company",
            "library_project",
        }
        sources = [request.query_params]
        if request.method in {"POST", "PATCH", "PUT"}:
            sources.append(request.data)
        for source in sources:
            for name in identifiers.intersection(source):
                value = source[name]
                if value is None or value == "":
                    continue
                if (
                    isinstance(value, bool)
                    or not str(value).isdigit()
                    or int(value) < 1
                ):
                    raise serializers.ValidationError(
                        {name: "Usa un identificador entero positivo."}
                    )

    def filter_queryset(self, queryset):
        return scope_queryset(super().filter_queryset(queryset), self.request.user)

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        roles = (
            VALIDATE_ROLES
            if self.action == "transition" and request.data.get("action") == "approve"
            else roles_for_action(self.action)
        )
        if self.action == "transition" and request.data.get("action") == "archive":
            roles = MANAGE_ROLES
        if (
            roles
            and not scope_queryset(
                type(obj).objects.filter(pk=obj.pk),
                request.user,
                roles,
                allow_global=False,
            ).exists()
        ):
            raise PermissionDenied("Tu rol no permite realizar esta accion.")

    def get_serializer(self, *args, **kwargs):
        serializer = super().get_serializer(*args, **kwargs)
        if self.action in {"create", "update", "partial_update"}:
            restrict_relations(
                serializer, self.request.user, roles_for_action(self.action)
            )
        return serializer

    def destroy(self, request, *args, **kwargs):
        self.get_object()
        raise PermissionDenied(
            "Los registros de negocio se conservan. Usa archivo o desactivacion."
        )

    @action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        obj = self.get_object()
        artifact = getattr(obj, "file", None)
        if not artifact:
            from rest_framework.exceptions import NotFound

            raise NotFound("Este registro no tiene un archivo descargable.")
        response = FileResponse(
            artifact.open("rb"),
            as_attachment=True,
            filename=artifact.name.rsplit("/", 1)[-1],
        )
        response["Cache-Control"] = "private, no-store"
        return response


def restrict_relations(serializer, user, roles):
    for field in serializer.fields.values():
        queryset = getattr(field, "queryset", None)
        if queryset is not None:
            field.queryset = scope_queryset(queryset, user, roles, allow_global=False)


class CompanyRelationsMixin:
    """Validate ownership and project consistency, including partial updates."""

    def run_validation(self, data=serializers.empty):
        attrs = super().run_validation(data)
        request = self.context.get("request")
        if not request:
            return attrs
        user = request.user
        view = self.context.get("view")
        roles = roles_for_action(getattr(view, "action", "create"))
        related = {
            name: value for name, value in attrs.items() if hasattr(value, "_meta")
        }
        if self.instance:
            for name in (
                "project",
                "action_plan",
                "checklist_item",
                "finding",
                "worklog",
                "document",
            ):
                if (
                    name not in related
                    and name not in attrs
                    and hasattr(self.instance, name)
                ):
                    value = getattr(self.instance, name)
                    if value is not None:
                        related[name] = value
        projects, companies = set(), set()
        for name, obj in related.items():
            label = obj._meta.label_lower
            if label in COMPANY_PATHS or label in {
                "documents.document",
                "documents.documentchunk",
            }:
                if not scope_queryset(
                    type(obj).objects.filter(pk=obj.pk), user, roles, allow_global=False
                ).exists():
                    raise serializers.ValidationError(
                        {name: "Registro no disponible para tu empresa y rol."}
                    )
            if label == "companies.company":
                companies.add(obj.pk)
            elif label == "implementation.project":
                projects.add(obj.pk)
                companies.add(obj.company_id)
            elif getattr(obj, "project_id", None):
                projects.add(obj.project_id)
                companies.add(obj.project.company_id)
            elif label == "implementation.worklogentry":
                projects.add(obj.project_id)
        if len(projects) > 1 or len(companies) > 1:
            raise serializers.ValidationError(
                "Las relaciones deben pertenecer al mismo proyecto y empresa."
            )
        for name, obj in related.items():
            if obj._meta.model is get_user_model() and companies:
                if not all(
                    can_access_company(obj, company_id) for company_id in companies
                ):
                    raise serializers.ValidationError(
                        {name: "El usuario asignado no pertenece a la empresa."}
                    )
        return attrs


class PrivateFileMixin:
    def to_representation(self, instance):
        data = super().to_representation(instance)
        routes = {
            "documents.document": "documents",
            "action_plans.evidence": "evidences",
            "implementation.worklogevidence": "worklog-evidences",
        }
        if data.get("file") and (route := routes.get(instance._meta.label_lower)):
            data["file"] = f"/api/files/{route}/{instance.pk}"
        return data
