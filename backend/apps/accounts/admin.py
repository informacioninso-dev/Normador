from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import User

admin.site.unregister(User)


@admin.register(User)
class PreservedUserAdmin(UserAdmin):
    def has_delete_permission(self, request, obj=None):
        return False
