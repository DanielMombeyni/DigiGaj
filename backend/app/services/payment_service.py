from __future__ import annotations

import logging
import secrets
import string
from django.db import transaction
from django.utils import timezone

from app.models import (
    AccountingEntry,
    Order,
    PaymentGatewayConfig,
    Product,
    PurchaseTransaction,
)
from app.payment.facade import PaymentFacade
from app.payment.registry import get_driver
from app.payment.utils import callback_url_for, detect_platform

logger = logging.getLogger("app.payment")


def _tracking() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "TX" + "".join(secrets.choice(alphabet) for _ in range(14))


class PaymentService:
    @classmethod
    @transaction.atomic
    def create_purchase(
        cls,
        *,
        request,
        gateway: str,
        order: Order | None = None,
        product: Product | None = None,
        quantity: int = 1,
        platform: str | None = None,
        amount_toman: int | None = None,
        description: str = "",
        mobile: str = "",
        meta: dict | None = None,
    ) -> tuple[dict | None, str | None]:
        platform = platform or detect_platform(request)
        user = request.user if request.user.is_authenticated else None

        if order is not None:
            pending = [
                i.product_name for i in order.items.all() if i.price_pending
            ]
            if pending:
                if len(pending) == 1:
                    return None, f"محصول «{pending[0]}» قیمت ندارد"
                return None, f"این محصولات قیمت ندارند: {'، '.join(pending)}"
            amount = order.total_toman
            order_id = order.order_number
            description = description or f"پرداخت سفارش {order.order_number}"
        elif product is not None:
            if product.price_on_request:
                return None, f"محصول «{product.name}» قیمت ندارد"
            amount = product.price_toman * max(1, quantity)
            order_id = f"PRD-{product.id}"
            description = description or f"خرید {product.name}"
        elif amount_toman is not None:
            amount = int(amount_toman)
            order_id = f"MANUAL-{timezone.now().strftime('%Y%m%d%H%M%S')}"
        else:
            return None, "سفارش یا محصول الزامی است"

        if amount <= 0:
            return None, "مبلغ نامعتبر است"

        tracking = _tracking()
        cb = callback_url_for(gateway, tracking)
        start_data, err = PaymentFacade.start_payment(
            provider=gateway,
            amount_toman=amount,
            callback_url=cb,
            order_id=order_id,
            description=description,
            platform=platform,
            mobile=mobile or (order.phone if order else ""),
            meta={
                **(meta or {}),
                "product_sku": getattr(product, "sku", "") if product else "",
            },
        )
        if err:
            return None, err

        driver = get_driver(gateway)
        tx = PurchaseTransaction.objects.create(
            tracking_number=tracking,
            user=user,
            order=order,
            gateway=gateway,
            status=PurchaseTransaction.Status.PENDING,
            platform=platform,
            amount=amount,
            authority=start_data.get("authority", ""),
            payment_url=start_data.get("payment_url", ""),
            metadata={
                "product_id": product.id if product else None,
                "quantity": quantity,
                "extra": start_data.get("extra") or {},
                "description": description,
            },
        )
        requires_payment = bool(start_data.get("payment_url")) or (
            driver and driver.flow in ("redirect",)
        )
        return (
            {
                "tracking_number": tx.tracking_number,
                "payment_url": tx.payment_url,
                "authority": tx.authority,
                "extra": start_data.get("extra") or {},
                "requires_payment": requires_payment,
                "flow": driver.flow if driver else "redirect",
                "amount": tx.amount,
                "status": tx.status,
            },
            None,
        )

    @classmethod
    @transaction.atomic
    def confirm_payment_by_tracking(
        cls,
        tracking_number: str,
        *,
        callback_data: dict | None = None,
        force_admin: bool = False,
    ) -> tuple[dict | None, str | None]:
        try:
            tx = PurchaseTransaction.objects.select_for_update().get(
                tracking_number=tracking_number
            )
        except PurchaseTransaction.DoesNotExist:
            return None, "تراکنش یافت نشد"

        if tx.status == PurchaseTransaction.Status.SUCCESS:
            return (
                {
                    "tracking_number": tx.tracking_number,
                    "status": tx.status,
                    "ref_id": tx.ref_id,
                    "already_activated": True,
                },
                None,
            )

        driver = get_driver(tx.gateway)
        if not driver:
            return None, "درایور یافت نشد"

        # Card: only admin can confirm
        if driver.flow == "card" and not force_admin:
            return (
                {
                    "tracking_number": tx.tracking_number,
                    "status": tx.status,
                    "message": "در انتظار تأیید کارت‌به‌کارت توسط ادمین",
                    "pending": True,
                },
                None,
            )

        if driver.flow == "native" and not (callback_data or {}).get("purchase_token"):
            return (
                {
                    "tracking_number": tx.tracking_number,
                    "status": tx.status,
                    "pending": True,
                    "message": "purchase_token لازم است",
                },
                None,
            )

        if force_admin and driver.flow == "card":
            result = {"ok": True, "ref_id": f"ADMIN-{tx.authority}", "raw": {"admin": True}}
            err = None
        else:
            authority = (
                (callback_data or {}).get("Authority")
                or (callback_data or {}).get("authority")
                or (callback_data or {}).get("trackId")
                or tx.authority
            )
            result, err = PaymentFacade.verify_payment(
                provider=tx.gateway,
                authority=str(authority),
                amount_toman=tx.amount,
                platform=tx.platform,
                callback_data=callback_data,
            )

        if callback_data:
            tx.callback_payload = callback_data

        if err or not result:
            tx.status = PurchaseTransaction.Status.FAILED
            tx.save(update_fields=["status", "callback_payload", "updated_at"])
            return None, err or "تأیید پرداخت ناموفق"

        tx.status = PurchaseTransaction.Status.SUCCESS
        tx.ref_id = str(result.get("ref_id") or "")
        tx.authority = tx.authority or str(
            (callback_data or {}).get("Authority")
            or (callback_data or {}).get("trackId")
            or ""
        )
        tx.save()

        cls.activate(tx)
        return (
            {
                "tracking_number": tx.tracking_number,
                "status": tx.status,
                "ref_id": tx.ref_id,
                "already_activated": False,
            },
            None,
        )

    @classmethod
    def activate(cls, tx: PurchaseTransaction) -> None:
        if tx.activated_at:
            return
        order = tx.order
        if order and order.status == Order.Status.PENDING:
            order.status = Order.Status.PAID
            order.save(update_fields=["status", "updated_at"])
            from app.services.email_dispatch import queue_mail_event

            queue_mail_event("order_paid", "order", order.pk)
            queue_mail_event(
                "order_status_changed",
                "order",
                order.pk,
                {"previous_status": Order.Status.PENDING},
            )
            # decrease stock
            for item in order.items.select_related("product"):
                product = item.product
                if product.stock >= item.quantity:
                    product.stock -= item.quantity
                    product.save(update_fields=["stock", "updated_at"])

        product_id = (tx.metadata or {}).get("product_id")
        qty = int((tx.metadata or {}).get("quantity") or 1)
        if product_id and not order:
            try:
                product = Product.objects.get(pk=product_id)
                if product.stock >= qty:
                    product.stock -= qty
                    product.save(update_fields=["stock", "updated_at"])
            except Product.DoesNotExist:
                pass

        AccountingEntry.objects.create(
            entry_type=AccountingEntry.EntryType.INCOME,
            title=f"پرداخت {tx.tracking_number}",
            amount_toman=tx.amount,
            description=f"درگاه {tx.gateway} — ref={tx.ref_id}",
            order=order,
            transaction=tx,
            occurred_at=timezone.now(),
            meta={"gateway": tx.gateway, "ref_id": tx.ref_id},
        )
        tx.activated_at = timezone.now()
        tx.save(update_fields=["activated_at", "updated_at"])

    @staticmethod
    def get_status(tracking_number: str) -> dict | None:
        try:
            tx = PurchaseTransaction.objects.get(tracking_number=tracking_number)
        except PurchaseTransaction.DoesNotExist:
            return None
        return {
            "tracking_number": tx.tracking_number,
            "status": tx.status,
            "gateway": tx.gateway,
            "amount": tx.amount,
            "ref_id": tx.ref_id,
            "payment_url": tx.payment_url,
            "extra": (tx.metadata or {}).get("extra") or {},
            "created_at": tx.created_at,
        }
