from rest_framework import serializers

from django.contrib.auth import get_user_model
from apps.companies.models import Company, CompanyMembership, CompanyRole
from apps.companies.access import MANAGE_ROLES, require_company


class CompanySerializer(serializers.ModelSerializer):
    is_active = serializers.BooleanField(default=True)
    my_role = serializers.SerializerMethodField()

    def get_my_role(self, obj):
        request = self.context.get("request")
        if not request:
            return None
        if request.user.is_staff:
            return "ADMINISTRADOR"
        if obj.created_by_id == request.user.pk:
            return CompanyRole.MANAGER
        return obj.memberships.filter(user=request.user, is_active=True).values_list("role", flat=True).first()

    class Meta:
        model = Company
        fields = [
            "id",
            "name",
            "ruc",
            "industry",
            "is_active",
            "my_role",
            "created_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_by", "created_at", "updated_at"]


class CompanyMembershipSerializer(serializers.ModelSerializer):
    is_active = serializers.BooleanField(default=True)
    username = serializers.SlugRelatedField(slug_field="username", source="user", queryset=get_user_model().objects.filter(is_active=True))
    company_name = serializers.CharField(source="company.name", read_only=True)

    class Meta:
        model = CompanyMembership
        fields = ["id", "company", "company_name", "username", "role", "is_active", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]
        validators = []

    def validate(self, attrs):
        company = attrs.get("company", getattr(self.instance, "company", None))
        user = attrs.get("user", getattr(self.instance, "user", None))
        require_company(self.context["request"].user, company.pk, MANAGE_ROLES)
        if self.instance and (company.pk != self.instance.company_id or user.pk != self.instance.user_id):
            raise serializers.ValidationError("La empresa y el usuario de una membresia no se pueden cambiar.")
        if user.pk == company.created_by_id and (
            attrs.get("role", getattr(self.instance, "role", None)) != CompanyRole.MANAGER
            or not attrs.get("is_active", getattr(self.instance, "is_active", True))
        ):
            raise serializers.ValidationError("El propietario conserva el rol responsable.")
        if self.instance is None and CompanyMembership.objects.filter(company=company, user=user).exists():
            raise serializers.ValidationError("La membresia ya existe. Actualiza su rol o estado.")
        return attrs
