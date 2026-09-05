from __future__ import annotations

from django.db import transaction
import secrets
import string

from app.models import DiscountCode, Order, OrderItem, Product, ProductVariant


def _order_number() -> str:
    """کد پیگیری یکتای سفارش — مثال: GS-A3K9M2X7"""
    body = "".join(
        secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8)
    )
    return f"GS-{body}"


class OrderService:
    @classmethod
    @transaction.atomic
    def create_order(
        cls,
        *,
        user,
        items: list[dict],
        full_name: str,
        phone: str,
        address: str,
        email: str = "",
        province: str = "",
        city: str = "",
        postal_code: str = "",
        notes: str = "",
        discount_code: str | None = None,
        shipping_toman: int = 0,
    ) -> tuple[Order | None, str | None]:
        if not items:
            return None, "سبد خرید خالی است"

        order_items = []
        subtotal = 0
        for row in items:
            try:
                product = Product.objects.select_for_update().prefetch_related(
                    "variants", "colors", "sizes"
                ).get(pk=row["product_id"], is_active=True)
            except Product.DoesNotExist:
                return None, f"محصول {row.get('product_id')} یافت نشد"

            qty = int(row.get("quantity") or 1)
            if qty < 1:
                return None, "تعداد نامعتبر است"

            variant = None
            variant_id = row.get("variant_id")
            color_id = row.get("color_id")
            size_id = row.get("size_id")
            price_pending = bool(product.price_on_request) or int(product.price_toman or 0) == 0

            if product.has_options:
                variant = product.resolve_variant(
                    variant_id=variant_id,
                    color_id=color_id,
                    size_id=size_id,
                )
                if not variant:
                    return None, f"تنوع انتخاب‌شده برای «{product.name}» معتبر نیست"
                if variant.stock < qty:
                    return None, f"موجودی «{product.name}» ({variant.label}) کافی نیست"
                unit = 0 if price_pending else product.resolve_price(variant)
            else:
                if product.stock < qty:
                    return None, f"موجودی «{product.name}» کافی نیست"
                unit = 0 if price_pending else product.price_toman

            line = unit * qty
            subtotal += line
            order_items.append((product, variant, qty, unit, line, price_pending))

        discount_obj = None
        discount_amount = 0
        if discount_code:
            try:
                discount_obj = DiscountCode.objects.get(code__iexact=discount_code.strip())
            except DiscountCode.DoesNotExist:
                return None, "کد تخفیف نامعتبر است"
            if not discount_obj.is_valid_now():
                return None, "کد تخفیف منقضی یا غیرفعال است"
            discount_amount = discount_obj.calculate_discount(subtotal)

        total = max(0, subtotal - discount_amount + int(shipping_toman or 0))
        has_pending = any(row[5] for row in order_items)
        order = Order.objects.create(
            user=user if user and user.is_authenticated else None,
            order_number=_order_number(),
            status=Order.Status.AWAITING_PRICE if has_pending else Order.Status.PENDING,
            full_name=full_name,
            phone=phone,
            email=email,
            address=address,
            province=province,
            city=city,
            postal_code=postal_code,
            notes=notes,
            discount_code=discount_obj,
            subtotal_toman=subtotal,
            discount_toman=discount_amount,
            shipping_toman=int(shipping_toman or 0),
            total_toman=total,
        )
        for product, variant, qty, unit, line, price_pending in order_items:
            OrderItem.objects.create(
                order=order,
                product=product,
                variant=variant,
                product_name=product.name,
                variant_label=variant.label if variant else "",
                unit_price_toman=unit,
                quantity=qty,
                line_total_toman=line,
                price_pending=price_pending,
            )
            if variant:
                ProductVariant.objects.filter(pk=variant.pk).update(
                    stock=max(0, variant.stock - qty)
                )
            else:
                Product.objects.filter(pk=product.pk).update(
                    stock=max(0, product.stock - qty)
                )

        if discount_obj:
            DiscountCode.objects.filter(pk=discount_obj.pk).update(
                used_count=discount_obj.used_count + 1
            )
        from app.services.email_dispatch import queue_mail_event

        queue_mail_event("order_created", "order", order.pk)
        return order, None

    @classmethod
    @transaction.atomic
    def set_item_prices(cls, order: Order, items: list[dict]) -> tuple[Order | None, str | None]:
        """Admin: set unit prices for price-pending (or adjustable) lines, then recalculate."""
        if order.status in {
            Order.Status.PAID,
            Order.Status.SHIPPED,
            Order.Status.DELIVERED,
            Order.Status.REFUNDED,
        }:
            return None, "امکان تغییر قیمت این سفارش وجود ندارد"

        by_id = {int(row["id"]): row for row in items if row.get("id") is not None}
        if not by_id:
            return None, "آیتمی برای به‌روزرسانی ارسال نشده است"

        order_items = list(order.items.select_for_update().all())
        found = {item.id for item in order_items}
        missing = set(by_id) - found
        if missing:
            return None, "آیتم سفارش نامعتبر است"

        for item in order_items:
            if item.id not in by_id:
                continue
            raw = by_id[item.id].get("unit_price_toman")
            try:
                unit = int(raw)
            except (TypeError, ValueError):
                return None, f"قیمت نامعتبر برای «{item.product_name}»"
            if unit < 1:
                return None, f"قیمت «{item.product_name}» باید بیشتر از صفر باشد"
            item.unit_price_toman = unit
            item.line_total_toman = unit * item.quantity
            item.price_pending = False
            item.save(
                update_fields=[
                    "unit_price_toman",
                    "line_total_toman",
                    "price_pending",
                ]
            )

        order_items = list(order.items.all())
        subtotal = sum(i.line_total_toman for i in order_items)
        discount_amount = 0
        if order.discount_code_id:
            discount_obj = order.discount_code
            if discount_obj:
                discount_amount = discount_obj.calculate_discount(subtotal)
        total = max(0, subtotal - discount_amount + int(order.shipping_toman or 0))
        still_pending = any(i.price_pending for i in order_items)
        order.subtotal_toman = subtotal
        order.discount_toman = discount_amount
        order.total_toman = total
        if not still_pending and order.status == Order.Status.AWAITING_PRICE:
            order.status = Order.Status.PENDING
        order.save(
            update_fields=[
                "subtotal_toman",
                "discount_toman",
                "total_toman",
                "status",
                "updated_at",
            ]
        )
        return order, None

    @classmethod
    def pending_price_error(cls, order: Order) -> str | None:
        pending = [
            i.product_name
            for i in order.items.all()
            if i.price_pending
        ]
        if not pending:
            return None
        if len(pending) == 1:
            return f"محصول «{pending[0]}» قیمت ندارد"
        return f"این محصولات قیمت ندارند: {'، '.join(pending)}"
