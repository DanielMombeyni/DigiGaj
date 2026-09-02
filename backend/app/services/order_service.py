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
                unit = product.resolve_price(variant)
            else:
                if product.stock < qty:
                    return None, f"موجودی «{product.name}» کافی نیست"
                unit = product.price_toman

            line = unit * qty
            subtotal += line
            order_items.append((product, variant, qty, unit, line))

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
        order = Order.objects.create(
            user=user if user and user.is_authenticated else None,
            order_number=_order_number(),
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
        for product, variant, qty, unit, line in order_items:
            OrderItem.objects.create(
                order=order,
                product=product,
                variant=variant,
                product_name=product.name,
                variant_label=variant.label if variant else "",
                unit_price_toman=unit,
                quantity=qty,
                line_total_toman=line,
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
