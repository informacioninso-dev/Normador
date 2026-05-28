from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.accounts.views import UserViewSet
from apps.action_plans.views import (
    ActionPlanViewSet,
    EvidenceViewSet,
    ImplementationActivityViewSet,
)
from apps.companies.views import CompanyViewSet
from apps.documents.views import DocumentChunkViewSet, DocumentViewSet
from apps.implementation.views import (
    ImplementationChecklistItemViewSet,
    ProjectViewSet,
    WorkLogEntryViewSet,
)
from apps.reviews.views import DocumentReviewViewSet, FindingViewSet, RequirementEvaluationViewSet
from apps.standards.views import StandardRequirementViewSet, StandardViewSet

router = DefaultRouter()
router.register("users", UserViewSet, basename="user")
router.register("companies", CompanyViewSet, basename="company")
router.register("projects", ProjectViewSet, basename="project")
router.register("worklogs", WorkLogEntryViewSet, basename="worklog")
router.register("standards", StandardViewSet, basename="standard")
router.register("requirements", StandardRequirementViewSet, basename="requirement")
router.register("checklist-items", ImplementationChecklistItemViewSet, basename="checklist-item")
router.register("documents", DocumentViewSet, basename="document")
router.register("document-chunks", DocumentChunkViewSet, basename="document-chunk")
router.register("document-reviews", DocumentReviewViewSet, basename="document-review")
router.register("requirement-evaluations", RequirementEvaluationViewSet, basename="requirement-evaluation")
router.register("findings", FindingViewSet, basename="finding")
router.register("action-plans", ActionPlanViewSet, basename="action-plan")
router.register(
    "implementation-activities",
    ImplementationActivityViewSet,
    basename="implementation-activity",
)
router.register("evidences", EvidenceViewSet, basename="evidence")

urlpatterns = [
    path("auth/", include("apps.accounts.urls")),
] + router.urls
