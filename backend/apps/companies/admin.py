from django.contrib import admin

from apps.companies.models import Company


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ("name", "ruc", "industry", "created_at")
    search_fields = ("name", "ruc", "industry")
