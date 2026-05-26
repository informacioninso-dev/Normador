from django.core.management.base import BaseCommand

from apps.standards.models import Standard, StandardRequirement
from apps.standards.seed_data import SEED_STANDARDS


class Command(BaseCommand):
    help = "Carga normas iniciales y requisitos resumidos para el MVP."

    def handle(self, *args, **options):
        standards_created = 0
        requirements_processed = 0

        for standard_payload in SEED_STANDARDS:
            standard_defaults = {
                key: value
                for key, value in standard_payload.items()
                if key != "requirements"
            }
            requirements = standard_payload["requirements"]
            standard, created = Standard.objects.update_or_create(
                code=standard_payload["code"],
                defaults=standard_defaults,
            )
            if created:
                standards_created += 1

            for index, requirement_payload in enumerate(requirements, start=1):
                StandardRequirement.objects.update_or_create(
                    standard=standard,
                    clause=requirement_payload["clause"],
                    title=requirement_payload["title"],
                    defaults={
                        **requirement_payload,
                        "sequence": index,
                    },
                )
                requirements_processed += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Seed completado. Standards creados: {standards_created}. "
                f"Requisitos procesados: {requirements_processed}."
            )
        )
