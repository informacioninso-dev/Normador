from django.core.management import call_command
from django.test import TestCase

from apps.standards.models import Standard, StandardRequirement


class SeedStandardsCommandTests(TestCase):
    def test_seed_standards_loads_initial_catalog(self):
        call_command("seed_standards")

        self.assertTrue(Standard.objects.filter(code="ISO_9001").exists())
        self.assertTrue(Standard.objects.filter(code="ISO_13485").exists())
        self.assertTrue(Standard.objects.filter(code="BPADT_ARCSA").exists())
        self.assertGreaterEqual(StandardRequirement.objects.count(), 18)
