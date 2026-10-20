from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import transaction

from apps.companies.models import Company, CompanyMembership, CompanyRole


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        user = authenticate(username=data["username"], password=data["password"])
        if not user:
            raise serializers.ValidationError("Credenciales invalidas.")
        if not user.is_active:
            raise serializers.ValidationError("Cuenta desactivada.")
        data["user"] = user
        return data


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "is_staff"]
        read_only_fields = fields


class UserListSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "is_staff", "is_active", "date_joined", "last_login"]
        read_only_fields = fields


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    company = serializers.PrimaryKeyRelatedField(
        queryset=Company.objects.filter(is_active=True), required=False, write_only=True
    )
    role = serializers.ChoiceField(choices=CompanyRole.choices, required=False, write_only=True)

    class Meta:
        model = User
        fields = ["id", "username", "password", "email", "first_name", "last_name", "is_staff", "company", "role"]
        read_only_fields = ["id"]

    @transaction.atomic
    def create(self, validated_data):
        password = validated_data.pop("password")
        company = validated_data.pop("company", None)
        role = validated_data.pop("role", CompanyRole.READER)
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        if company:
            CompanyMembership.objects.create(company=company, user=user, role=role)
        return user

    def validate(self, attrs):
        if attrs.get("role") and not attrs.get("company"):
            raise serializers.ValidationError({"company": "Selecciona la empresa para asignar este rol."})
        if attrs.get("is_staff") and attrs.get("company"):
            raise serializers.ValidationError({"company": "El administrador global ya accede a todas las empresas. No necesita un rol por empresa."})
        try:
            validate_password(attrs["password"], User(**{k: v for k, v in attrs.items() if k not in {"password", "company", "role"}}))
        except ValidationError as exc:
            raise serializers.ValidationError({"password": exc.messages}) from exc
        return attrs


class UserUpdateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ["email", "first_name", "last_name", "is_staff", "is_active", "password"]

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance

    def validate(self, attrs):
        request = self.context.get("request")
        if request and request.user.pk == self.instance.pk and (
            attrs.get("is_staff") is False or attrs.get("is_active") is False
        ):
            raise serializers.ValidationError("No puedes desactivar tu propia cuenta administradora.")
        if attrs.get("password"):
            try:
                validate_password(attrs["password"], self.instance)
            except ValidationError as exc:
                raise serializers.ValidationError({"password": exc.messages}) from exc
        return attrs
