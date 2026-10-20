"""Explicit company boundaries shared by APIs and document retrieval."""

from django.db.models import Q
from rest_framework.exceptions import PermissionDenied

from apps.companies.models import Company, CompanyMembership, CompanyRole

WRITE_ROLES = (CompanyRole.MANAGER, CompanyRole.IMPLEMENTER)
VALIDATE_ROLES = (CompanyRole.MANAGER, CompanyRole.AUDITOR)
MANAGE_ROLES = (CompanyRole.MANAGER,)

# Relation from each business model to its owning company. Documents have scoped libraries.
COMPANY_PATHS = {
    "companies.company": "pk",
    "companies.companymembership": "company_id",
    "implementation.project": "company_id",
    "implementation.implementationchecklistitem": "project__company_id",
    "implementation.worklogentry": "project__company_id",
    "implementation.worklogevidence": "worklog__project__company_id",
    "reviews.documentreview": "project__company_id",
    "reviews.requirementevaluation": "document_review__project__company_id",
    "reviews.finding": "project__company_id",
    "action_plans.actionplan": "project__company_id",
    "action_plans.implementationactivity": "project__company_id",
    "action_plans.evidence": "project__company_id",
    "documents.controlleddocument": "project__company_id",
    "documents.documentrevision": "controlled_document__project__company_id",
}


def company_ids(user, roles=None):
    if not user or not user.is_authenticated or not user.is_active:
        return Company.objects.none().values("pk")
    if user.is_staff:
        return Company.objects.values("pk")
    memberships = CompanyMembership.objects.filter(user=user, is_active=True)
    if roles:
        memberships = memberships.filter(role__in=roles)
    return Company.objects.filter(
        Q(created_by=user) | Q(pk__in=memberships.values("company_id"))
    ).values("pk")


def can_access_company(user, company_id, roles=None):
    return company_ids(user, roles).filter(pk=company_id).exists()


def require_company(user, company_id, roles=None):
    if not can_access_company(user, company_id, roles):
        raise PermissionDenied("No tienes permiso para esta empresa o accion.")


def document_scope(user, *, prefix="", roles=None, allow_global=True):
    ids = company_ids(user, roles)
    # All populated scopes must be authorized, even for inconsistent legacy rows.
    scoped = (
        Q(**{prefix + "project__company_id__in": ids})
        | Q(**{prefix + "library_company_id__in": ids})
        | Q(**{prefix + "library_project__company_id__in": ids})
    )
    global_scope = Q(
        **{
            prefix + "is_reference": True,
            prefix + "project__isnull": True,
            prefix + "library_company__isnull": True,
            prefix + "library_project__isnull": True,
        }
    )
    for relation in ("project__company", "library_company", "library_project__company"):
        scoped &= Q(**{prefix + relation + "_id__in": ids}) | Q(
            **{prefix + relation + "__isnull": True}
        )
    return scoped | global_scope if allow_global else scoped


def scope_queryset(queryset, user, roles=None, *, allow_global=True):
    if user and user.is_authenticated and user.is_active and user.is_staff:
        return queryset
    label = queryset.model._meta.label_lower
    if label in {"documents.document", "documents.documentchunk"}:
        prefix = "document__" if label.endswith("documentchunk") else ""
        return queryset.filter(
            document_scope(user, prefix=prefix, roles=roles, allow_global=allow_global)
        ).distinct()
    path = COMPANY_PATHS.get(label)
    if path:
        return queryset.filter(**{path + "__in": company_ids(user, roles)}).distinct()
    return queryset


def roles_for_action(action):
    if action in {"list", "retrieve", "download", "progress_report", "export_report", "semantic_search", "processing_jobs"}:
        return None
    if action in {
        "validate_evidence",
        "reject_evidence",
        "approve",
        "observe",
        "close_plan",
        "confirm_not_applicable",
    }:
        return VALIDATE_ROLES
    if action in {"destroy", "regenerate_checklist"}:
        return MANAGE_ROLES
    return WRITE_ROLES
