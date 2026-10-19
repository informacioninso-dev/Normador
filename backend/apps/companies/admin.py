from django.contrib import admin

from apps.companies.models import Company, CompanyMembership


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ("name", "ruc", "industry", "is_active", "created_at")
    search_fields = ("name", "ruc", "industry")

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(CompanyMembership)
class CompanyMembershipAdmin(admin.ModelAdmin):
    list_display = ("company", "user", "role", "is_active")
    list_filter = ("role", "is_active")
    search_fields = ("company__name", "user__username")
