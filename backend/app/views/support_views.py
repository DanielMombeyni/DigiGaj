from django.db import transaction
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend

from app.models import SupportTicket, TicketMessage
from app.permissions import HasAdminPage


class TicketMessageSerializer(serializers.ModelSerializer):
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
            if obj.author_id:
                return obj.author.get_username() or "پشتیبانی"
            return "پشتیبانی"
        return obj.ticket.full_name


class SupportTicketListSerializer(serializers.ModelSerializer):
    messages_count = serializers.IntegerField(read_only=True)
    last_message_at = serializers.DateTimeField(read_only=True, allow_null=True)

    class Meta:
        model = SupportTicket
        fields = (
            "id",
            "ticket_number",
            "full_name",
            "email",
            "phone",
            "subject",
            "status",
            "priority",
            "messages_count",
            "last_message_at",
            "created_at",
            "updated_at",
        )


class SupportTicketDetailSerializer(SupportTicketListSerializer):
    messages = TicketMessageSerializer(many=True, read_only=True)

    class Meta(SupportTicketListSerializer.Meta):
        fields = SupportTicketListSerializer.Meta.fields + ("messages",)


class CreateSupportTicketSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=180)
    email = serializers.EmailField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True, max_length=20)
    subject = serializers.CharField(max_length=255)
    message = serializers.CharField(min_length=3)

    def validate(self, attrs):
        if not (attrs.get("email") or "").strip() and not (attrs.get("phone") or "").strip():
            raise serializers.ValidationError("ایمیل یا شماره تماس الزامی است.")
        return attrs


class TicketReplySerializer(serializers.Serializer):
    body = serializers.CharField(min_length=1)
    status = serializers.ChoiceField(
        choices=SupportTicket.Status.choices, required=False
    )


class SupportTicketViewSet(viewsets.ModelViewSet):
    """
    Staff: list/detail/update/delete/reply
    Public create via POST /tickets/ (AllowAny)
    """

    queryset = SupportTicket.objects.all()
    lookup_field = "ticket_number"
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["status", "priority"]
    search_fields = ["ticket_number", "full_name", "email", "phone", "subject"]
    ordering_fields = ["created_at", "updated_at", "priority", "status"]
    required_admin_page = "tickets"

    def get_permissions(self):
        if self.action == "create":
            return [AllowAny()]
        return [HasAdminPage()]

    def get_queryset(self):
        from django.db.models import Count, Max

        qs = SupportTicket.objects.select_related("user").annotate(
            messages_count=Count("messages"),
            last_message_at=Max("messages__created_at"),
        )
        if self.action == "retrieve":
            qs = qs.prefetch_related("messages__author")
        return qs

    def get_serializer_class(self):
        if self.action == "create":
            return CreateSupportTicketSerializer
        if self.action == "retrieve":
            return SupportTicketDetailSerializer
        if self.action == "reply":
            return TicketReplySerializer
        return SupportTicketListSerializer

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        ser = CreateSupportTicketSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        number = SupportTicket.generate_number()
        while SupportTicket.objects.filter(ticket_number=number).exists():
            number = SupportTicket.generate_number()

        user = request.user if request.user.is_authenticated else None
        ticket = SupportTicket.objects.create(
            ticket_number=number,
            user=user,
            full_name=data["full_name"].strip(),
            email=(data.get("email") or "").strip(),
            phone=(data.get("phone") or "").strip(),
            subject=data["subject"].strip(),
            status=SupportTicket.Status.OPEN,
        )
        TicketMessage.objects.create(
            ticket=ticket,
            author=user,
            is_staff_reply=False,
            body=data["message"].strip(),
        )
        from app.services.email_dispatch import queue_mail_event

        queue_mail_event("ticket_created", "ticket", ticket.pk)
        return Response(
            {
                "ticket_number": ticket.ticket_number,
                "detail": "تیکت ثبت شد.",
            },
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        ticket = self.get_object()
        allowed = {}
        if "status" in request.data:
            allowed["status"] = request.data["status"]
        if "priority" in request.data:
            allowed["priority"] = request.data["priority"]
        for k, v in allowed.items():
            setattr(ticket, k, v)
        ticket.save(update_fields=[*allowed.keys(), "updated_at"])
        return Response(SupportTicketDetailSerializer(ticket).data)

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def reply(self, request, ticket_number=None):
        ticket = self.get_object()
        ser = TicketReplySerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        body = ser.validated_data["body"].strip()
        TicketMessage.objects.create(
            ticket=ticket,
            author=request.user,
            is_staff_reply=True,
            body=body,
        )
        new_status = ser.validated_data.get("status") or SupportTicket.Status.ANSWERED
        ticket.status = new_status
        ticket.save(update_fields=["status", "updated_at"])
        from app.services.email_dispatch import queue_mail_event

        queue_mail_event(
            "ticket_replied",
            "ticket",
            ticket.pk,
            {"message": body[:2000]},
        )
        ticket = self.get_queryset().prefetch_related("messages__author").get(pk=ticket.pk)
        return Response(SupportTicketDetailSerializer(ticket).data)
