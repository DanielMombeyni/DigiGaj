from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, Max
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from app.permissions import IsCustomerUser
from rest_framework.response import Response

from app.models import CustomerAddress, PurchaseTransaction, SupportTicket, TicketMessage
from app.serializers.account import (
    CustomerAddressSerializer,
    CustomerAddressWriteSerializer,
    CustomerCreateTicketSerializer,
    CustomerProfileSerializer,
    CustomerTicketDetailSerializer,
    CustomerTicketListSerializer,
    CustomerTicketReplySerializer,
    CustomerTransactionSerializer,
)
from app.services.address_service import (
    AddressLimitError,
    AddressValidationError,
    create_customer_address,
    delete_customer_address,
    normalize_address_fields,
    set_active_address,
)

User = get_user_model()


@api_view(["GET", "PATCH"])
@permission_classes([IsCustomerUser])
def customer_profile(request):
    user = User.objects.select_related("profile").prefetch_related("addresses").get(
        pk=request.user.pk
    )
    if request.method == "GET":
        return Response(CustomerProfileSerializer(user).data)
    ser = CustomerProfileSerializer(
        user, data=request.data, partial=True, context={"request": request}
    )
    ser.is_valid(raise_exception=True)
    ser.save()
    user = User.objects.select_related("profile").prefetch_related("addresses").get(
        pk=request.user.pk
    )
    return Response(CustomerProfileSerializer(user).data)


class CustomerAddressViewSet(viewsets.ModelViewSet):
    permission_classes = [IsCustomerUser]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return CustomerAddress.objects.filter(user=self.request.user)

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return CustomerAddressWriteSerializer
        return CustomerAddressSerializer

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        if request.query_params.get("is_active") == "true":
            qs = qs.filter(is_active=True)
        serializer = CustomerAddressSerializer(qs, many=True)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        ser = CustomerAddressWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            addr = create_customer_address(request.user, **ser.validated_data)
        except AddressLimitError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except AddressValidationError as exc:
            body = {"detail": exc.message}
            if exc.field:
                body = {exc.field: exc.message}
            return Response(body, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            CustomerAddressSerializer(addr).data,
            status=status.HTTP_201_CREATED,
        )

    def partial_update(self, request, *args, **kwargs):
        address = self.get_object()
        ser = CustomerAddressWriteSerializer(address, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        try:
            merged = {
                "label": address.label,
                "full_name": address.full_name,
                "phone": address.phone,
                "address": address.address,
                "province": address.province,
                "city": address.city,
                "postal_code": address.postal_code,
            }
            merged.update(ser.validated_data)
            payload = normalize_address_fields(merged, partial=False)
        except AddressValidationError as exc:
            body = {"detail": exc.message}
            if exc.field:
                body = {exc.field: exc.message}
            return Response(body, status=status.HTTP_400_BAD_REQUEST)
        for k, v in payload.items():
            setattr(address, k, v)
        address.save()
        return Response(CustomerAddressSerializer(address).data)

    def destroy(self, request, *args, **kwargs):
        address = self.get_object()
        delete_customer_address(address)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        address = self.get_object()
        set_active_address(address)
        address.refresh_from_db()
        return Response(CustomerAddressSerializer(address).data)


class CustomerTransactionViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsCustomerUser]
    serializer_class = CustomerTransactionSerializer

    def get_queryset(self):
        return (
            PurchaseTransaction.objects.filter(user=self.request.user)
            .select_related("order")
            .order_by("-created_at")
        )


class CustomerTicketViewSet(viewsets.GenericViewSet):
    permission_classes = [IsCustomerUser]
    lookup_field = "ticket_number"

    def get_queryset(self):
        qs = SupportTicket.objects.filter(user=self.request.user).annotate(
            messages_count=Count("messages"),
            last_message_at=Max("messages__created_at"),
        )
        if self.action == "retrieve":
            qs = qs.prefetch_related("messages__author")
        return qs

    def get_serializer_class(self):
        if self.action == "create":
            return CustomerCreateTicketSerializer
        if self.action == "retrieve":
            return CustomerTicketDetailSerializer
        if self.action == "reply":
            return CustomerTicketReplySerializer
        return CustomerTicketListSerializer

    def list(self, request):
        qs = self.get_queryset()
        return Response(CustomerTicketListSerializer(qs, many=True).data)

    def retrieve(self, request, ticket_number=None):
        ticket = self.get_queryset().get(ticket_number=ticket_number)
        return Response(CustomerTicketDetailSerializer(ticket).data)

    @transaction.atomic
    def create(self, request):
        ser = CustomerCreateTicketSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        user = request.user
        profile = getattr(user, "profile", None)
        number = SupportTicket.generate_number()
        while SupportTicket.objects.filter(ticket_number=number).exists():
            number = SupportTicket.generate_number()

        full_name = (
            f"{user.first_name} {user.last_name}".strip()
            or user.get_username()
        )
        ticket = SupportTicket.objects.create(
            ticket_number=number,
            user=user,
            full_name=full_name,
            email=(user.email or "").strip(),
            phone=(profile.phone if profile else "") or "",
            subject=data["subject"],
            status=SupportTicket.Status.OPEN,
        )
        TicketMessage.objects.create(
            ticket=ticket,
            author=user,
            is_staff_reply=False,
            body=data["message"],
        )
        ticket = self.get_queryset().prefetch_related("messages__author").get(pk=ticket.pk)
        return Response(
            CustomerTicketDetailSerializer(ticket).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def reply(self, request, ticket_number=None):
        ticket = self.get_queryset().get(ticket_number=ticket_number)
        ser = CustomerTicketReplySerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        body = ser.validated_data["body"].strip()
        TicketMessage.objects.create(
            ticket=ticket,
            author=request.user,
            is_staff_reply=False,
            body=body,
        )
        if ticket.status == SupportTicket.Status.CLOSED:
            ticket.status = SupportTicket.Status.OPEN
        elif ticket.status == SupportTicket.Status.ANSWERED:
            ticket.status = SupportTicket.Status.IN_PROGRESS
        ticket.save(update_fields=["status", "updated_at"])
        ticket = self.get_queryset().prefetch_related("messages__author").get(pk=ticket.pk)
        return Response(CustomerTicketDetailSerializer(ticket).data)
