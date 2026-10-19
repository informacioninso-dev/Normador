from django.contrib import admin


class BusinessRecordAdmin(admin.ModelAdmin):
    """Keep Django admin as an inspection surface; use domain APIs for changes."""

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
