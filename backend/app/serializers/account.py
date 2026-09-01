from django.contrib.auth import get_user_model
from rest_framework import serializers

from app.models import CustomerAddress, PurchaseTransaction, SupportTicket, TicketMessage
from app.models.customer_address import MAX_CUSTOMER_ADDRESSES

User = get_user_model()


class CustomerTicketMessageSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = TicketMessage
        fields = (
            "id",
            "body",
            "is_staff_reply",
            "author",
            "author_name",
            "created_at",
        )
        read_only_fields = fields

    def get_author_name(self, obj):
        if obj.is_staff_reply:
            return "پشتیبانی"
        if obj.author_id:
            name = f"{obj.author.first_name} {obj.author.last_name}".strip()
            return name or obj.author.get_username()
        return obj.ticket.full_name


class CustomerAddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerAddress
        fields = (
            "id",
            "label",
            "full_name",
            "phone",
            "address",
            "province",
            "city",
            "postal_code",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "is_active", "created_at", "updated_at")


class CustomerAddressWriteSerializer(serializers.ModelSerializer):
    province = serializers.CharField(max_length=80, required=True, allow_blank=False, trim_whitespace=True)
    city = serializers.CharField(max_length=80, required=True, allow_blank=False, trim_whitespace=True)
    postal_code = serializers.CharField(max_length=20, required=True, allow_blank=False, trim_whitespace=True)
    address = serializers.CharField(required=True, allow_blank=False, trim_whitespace=True)

    class Meta:
        model = CustomerAddress
        fields = (
            "label",
            "full_name",
            "phone",
            "address",
            "province",
            "city",
            "postal_code",
        )

    def validate_address(self, value):
        text = (value or "").strip()
        if not text:
            raise serializers.ValidationError("آدرس الزامی است.")
        return text

    def validate_full_name(self, value):
        text = (value or "").strip()
        if not text:
            raise serializers.ValidationError("نام گیرنده الزامی است.")
        return text

    def validate_phone(self, value):
        text = (value or "").strip()
        if not text:
            raise serializers.ValidationError("شماره تماس الزامی است.")
        return text

    def validate_province(self, value):
        text = (value or "").strip()
        if not text:
            raise serializers.ValidationError("استان الزامی است.")
        return text

    def validate_city(self, value):
        text = (value or "").strip()
        if not text:
            raise serializers.ValidationError("شهر الزامی است.")
        return text

    def validate_postal_code(self, value):
        text = (value or "").strip()
        if not text:
            raise serializers.ValidationError("کد پستی الزامی است.")
        if not text.isdigit() or len(text) != 10:
            raise serializers.ValidationError("کد پستی باید ۱۰ رقم باشد.")
        return text


class CustomerProfileSerializer(serializers.ModelSerializer):
    phone = serializers.CharField(source="profile.phone", read_only=True)
    first_name = serializers.CharField(required=False, allow_blank=False, trim_whitespace=True)
    last_name = serializers.CharField(required=False, allow_blank=False, trim_whitespace=True)
    email = serializers.EmailField(required=False, allow_blank=False)

    address_count = serializers.SerializerMethodField()
    max_addresses = serializers.SerializerMethodField()
    active_address = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "phone",
            "address_count",
            "max_addresses",
            "active_address",
        )
        read_only_fields = (
            "id",
            "username",
            "phone",
            "address_count",
            "max_addresses",
            "active_address",
        )

    def get_address_count(self, obj):
        return obj.addresses.count()

    def get_max_addresses(self, obj):
        return MAX_CUSTOMER_ADDRESSES

    def get_active_address(self, obj):
        addr = obj.addresses.filter(is_active=True).first()
        if not addr:
            return None
        return CustomerAddressSerializer(addr).data

    def validate(self, attrs):
        instance = self.instance
        first = attrs.get("first_name", instance.first_name if instance else "")
        last = attrs.get("last_name", instance.last_name if instance else "")
        email = attrs.get("email", instance.email if instance else "")

        errors = {}
        if not str(first or "").strip():
            errors["first_name"] = "نام الزامی است."
        if not str(last or "").strip():
            errors["last_name"] = "نام خانوادگی الزامی است."
        if not str(email or "").strip():
            errors["email"] = "ایمیل الزامی است."

        if errors:
            raise serializers.ValidationError(errors)

        attrs["first_name"] = str(first).strip()
        attrs["last_name"] = str(last).strip()
        attrs["email"] = str(email).strip()
        return attrs

    def update(self, instance, validated_data):
        for attr in ("first_name", "last_name", "email"):
            setattr(instance, attr, validated_data[attr])
        instance.save()

        request = self.context.get("request")
        if request and hasattr(instance, "profile"):
            current_phone = (instance.profile.phone or "").strip()
            incoming_phone = (request.data.get("phone") or "").strip()
            if incoming_phone:
                if current_phone and incoming_phone != current_phone:
                    raise serializers.ValidationError(
                        {"phone": "شماره موبایل قابل تغییر نیست."}
                    )
                if not current_phone:
                    instance.profile.phone = incoming_phone
                    instance.profile.save(update_fields=["phone", "updated_at"])
        return instance


class CustomerTransactionSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source="order.order_number", read_only=True, allow_null=True)

    class Meta:
        model = PurchaseTransaction
        fields = (
            "id",
            "tracking_number",
            "order_number",
            "gateway",
            "status",
            "platform",
            "amount",
            "ref_id",
            "created_at",
            "activated_at",
        )


class CustomerTicketListSerializer(serializers.ModelSerializer):
    messages_count = serializers.IntegerField(read_only=True)
    last_message_at = serializers.DateTimeField(read_only=True, allow_null=True)

    class Meta:
        model = SupportTicket
        fields = (
            "id",
            "ticket_number",
            "subject",
            "status",
            "priority",
            "messages_count",
            "last_message_at",
            "created_at",
            "updated_at",
        )


class CustomerTicketDetailSerializer(CustomerTicketListSerializer):
    messages = CustomerTicketMessageSerializer(many=True, read_only=True)

    class Meta(CustomerTicketListSerializer.Meta):
        fields = CustomerTicketListSerializer.Meta.fields + ("messages",)


class CustomerCreateTicketSerializer(serializers.Serializer):
    subject = serializers.CharField(max_length=255)
    message = serializers.CharField(min_length=3)

    def validate_subject(self, value):
        text = (value or "").strip()
        if not text:
            raise serializers.ValidationError("موضوع الزامی است.")
        return text


class CustomerTicketReplySerializer(serializers.Serializer):
    body = serializers.CharField(min_length=1)
