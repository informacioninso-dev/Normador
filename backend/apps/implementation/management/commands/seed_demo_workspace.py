from datetime import date

from django.core.files.base import ContentFile
from django.core.management import BaseCommand, CommandError, call_command

from apps.action_plans.models import ActionPlan, Evidence
from apps.action_plans.services import close_action_plan, validate_evidence_record
from apps.ai_engine.embeddings import MockEmbeddingProvider
from apps.common.choices import DocumentType, EvidenceType, ReviewType
from apps.companies.models import Company
from apps.documents.models import Document
from apps.documents.services import index_document_chunks, process_document
from apps.implementation.models import Project
from apps.reviews.iso_reviewer import MockReviewProvider, run_document_review
from apps.reviews.report_generator import generate_project_progress_report
from apps.standards.models import Standard, StandardRequirement


DEMO_COMPANY_NAME = "Meditech Demo S.A."
DEMO_PROJECT_NAME = "Piloto ISO 13485 Demo"
DEMO_STANDARD_CODE = "ISO_13485"


class Command(BaseCommand):
    help = "Crea un workspace demo reproducible para piloto del MVP."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force-reset",
            action="store_true",
            help="Recrea el proyecto demo eliminando su contenido previo.",
        )

    def handle(self, *args, **options):
        force_reset = options["force_reset"]

        call_command("seed_standards")
        standard = Standard.objects.filter(code=DEMO_STANDARD_CODE).first()
        if standard is None:
            raise CommandError(f"Standard {DEMO_STANDARD_CODE} was not found after seed.")

        company, _ = Company.objects.get_or_create(
            name=DEMO_COMPANY_NAME,
            defaults={
                "ruc": "0999999999050",
                "industry": "Dispositivos medicos",
            },
        )
        project = Project.objects.filter(
            company=company,
            standard=standard,
            name=DEMO_PROJECT_NAME,
        ).first()

        if project and not force_reset:
            report = generate_project_progress_report(project)
            self.stdout.write(
                self.style.WARNING(
                    "El workspace demo ya existe. Usa --force-reset para recrearlo."
                )
            )
            self._print_summary(project, report)
            return

        if project and force_reset:
            project.delete()

        project = Project.objects.create(
            company=company,
            standard=standard,
            name=DEMO_PROJECT_NAME,
            scope=(
                "Piloto controlado para recepcion, control documental y producto no conforme "
                "en entorno local."
            ),
            status="ACTIVE",
            start_date=date.today(),
            target_date=date.today(),
        )

        embedding_provider = MockEmbeddingProvider()
        review_provider = MockReviewProvider()

        requirement_by_clause = {
            requirement.clause: requirement
            for requirement in standard.requirements.all().order_by("sequence", "clause")
        }

        self._seed_document_validated_requirement(
            project=project,
            requirement=requirement_by_clause["4.2"],
            embedding_provider=embedding_provider,
            review_provider=review_provider,
        )
        self._seed_closed_requirement(
            project=project,
            requirement=requirement_by_clause["7.4.3"],
            embedding_provider=embedding_provider,
            review_provider=review_provider,
        )
        self._seed_observed_requirement(
            project=project,
            requirement=requirement_by_clause["8.3"],
            embedding_provider=embedding_provider,
            review_provider=review_provider,
        )

        report = generate_project_progress_report(project)
        self.stdout.write(self.style.SUCCESS("Workspace demo generado correctamente."))
        self._print_summary(project, report)

    def _seed_document_validated_requirement(
        self,
        *,
        project,
        requirement: StandardRequirement,
        embedding_provider,
        review_provider,
    ):
        self._create_reviewed_document(
            project=project,
            requirement=requirement,
            title="Procedimiento control documental demo",
            document_type=DocumentType.PROCEDURE,
            text_content=self._build_compliant_text(
                requirement,
                extra_notes=(
                    "El procedimiento define aprobacion previa, disponibilidad vigente, "
                    "control de cambios y conservacion de registros con listado maestro."
                ),
            ),
            embedding_provider=embedding_provider,
            review_provider=review_provider,
        )

    def _seed_closed_requirement(
        self,
        *,
        project,
        requirement: StandardRequirement,
        embedding_provider,
        review_provider,
    ):
        document = self._create_reviewed_document(
            project=project,
            requirement=requirement,
            title="Procedimiento recepcion lote demo",
            document_type=DocumentType.PROCEDURE,
            text_content=self._build_compliant_text(
                requirement,
                extra_notes=(
                    "Se establece cuarentena, responsable de liberacion, inspeccion de proveedor, "
                    "registro por lote, decision de aceptacion o rechazo y trazabilidad completa."
                ),
            ),
            embedding_provider=embedding_provider,
            review_provider=review_provider,
        )
        action_plan = (
            ActionPlan.objects.filter(project=project, requirement=requirement)
            .exclude(status__in=["CERRADO", "SUPERSEDIDO"])
            .first()
        )
        evidence = Evidence.objects.create(
            project=project,
            action_plan=action_plan,
            finding=action_plan.finding if action_plan else None,
            requirement=requirement,
            checklist_item=action_plan.checklist_item if action_plan else None,
            document=document,
            title="Registro recepcion lote demo",
            description=(
                "Registro diligenciado de recepcion por lote con responsable de liberacion."
            ),
            evidence_type=EvidenceType.RECORD,
        )
        validate_evidence_record(
            evidence,
            validation_notes="Evidencia real validada para piloto.",
        )
        if action_plan:
            close_action_plan(
                action_plan,
                completion_notes="Cierre demo respaldado con evidencia validada.",
            )

    def _seed_observed_requirement(
        self,
        *,
        project,
        requirement: StandardRequirement,
        embedding_provider,
        review_provider,
    ):
        self._create_reviewed_document(
            project=project,
            requirement=requirement,
            title="Nota no conforme incompleta demo",
            document_type=DocumentType.PROCEDURE,
            text_content="nota breve sin segregacion, disposicion ni aprobacion documentada.",
            embedding_provider=embedding_provider,
            review_provider=review_provider,
        )

    def _create_reviewed_document(
        self,
        *,
        project,
        requirement: StandardRequirement,
        title: str,
        document_type: str,
        text_content: str,
        embedding_provider,
        review_provider,
    ) -> Document:
        checklist_item = project.checklist_items.get(requirement=requirement)
        document = Document.objects.create(
            project=project,
            requirement=requirement,
            checklist_item=checklist_item,
            title=title,
            document_type=document_type,
        )
        document.file.save(
            f"{title.lower().replace(' ', '_')}.txt",
            ContentFile(text_content.encode("utf-8")),
            save=True,
        )
        process_document(document)
        index_document_chunks(
            document,
            overwrite=True,
            provider=embedding_provider,
        )
        run_document_review(
            document=document,
            review_type=ReviewType.REGULATORY_COMPLIANCE,
            created_by=None,
            provider=review_provider,
            retrieval_provider=embedding_provider,
        )
        return document

    def _build_compliant_text(
        self,
        requirement: StandardRequirement,
        *,
        extra_notes: str,
    ) -> str:
        return " ".join(
            [
                requirement.title,
                requirement.requirement_text,
                requirement.process_area,
                " ".join(requirement.expected_documents),
                " ".join(requirement.expected_evidence),
                " ".join(requirement.verification_questions),
                extra_notes,
            ]
        )

    def _print_summary(self, project, report: dict):
        summary = report["summary"]
        self.stdout.write(
            f"- Empresa: {project.company.name}\n"
            f"- Proyecto: {project.name}\n"
            f"- Progreso documental: {summary['documentary_progress_percentage']}%\n"
            f"- Progreso implementacion: {summary['implementation_progress_percentage']}%\n"
            f"- Requisitos cerrados: {summary['closed_requirements']}/{summary['total_requirements']}\n"
            f"- Planes abiertos: {summary['open_action_plans_count']}\n"
            f"- Hallazgos abiertos: {summary['open_findings_count']}\n"
            f"- Evidencias validadas: {summary['validated_evidence_count']}"
        )
