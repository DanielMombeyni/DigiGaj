from django.db import transaction

from app.models.customer_address import MAX_CUSTOMER_ADDRESSES, CustomerAddress


class AddressLimitError(Exception):
    pass


class AddressValidationError(Exception):
    def __init__(self, message, field=None):
        super().__init__(message)
        self.field = field
        self.message = message


REQUIRED_ADDRESS_FIELDS = ("full_name", "phone", "address", "province", "city", "postal_code")


def normalize_address_fields(fields: dict, *, partial=False) -> dict:
    """Ensure required address parts are non-empty strings (never NULL)."""
    out = {}
    if "label" in fields:
        out["label"] = (fields.get("label") or "").strip()

    for key in REQUIRED_ADDRESS_FIELDS:
        if key not in fields:
            if partial:
                continue
            raise AddressValidationError(f"فیلد {key} الزامی است.", field=key)
        value = (fields.get(key) or "").strip()
        if not value:
            raise AddressValidationError(f"فیلد {key} الزامی است.", field=key)
        out[key] = value

    postal = out.get("postal_code")
    if postal and (not postal.isdigit() or len(postal) != 10):
        raise AddressValidationError("کد پستی باید ۱۰ رقم باشد.", field="postal_code")

    return out


def user_address_count(user) -> int:
    return CustomerAddress.objects.filter(user=user).count()


def ensure_can_add_address(user) -> None:
    if user_address_count(user) >= MAX_CUSTOMER_ADDRESSES:
        raise AddressLimitError(
            "حداکثر ۵ آدرس می‌توانید ذخیره کنید. برای افزودن آدرس جدید، یکی از آدرس‌های قبلی را حذف کنید."
        )


@transaction.atomic
def set_active_address(address: CustomerAddress) -> CustomerAddress:
    CustomerAddress.objects.filter(user=address.user, is_active=True).exclude(
        pk=address.pk
    ).update(is_active=False)
    if not address.is_active:
        address.is_active = True
        address.save(update_fields=["is_active", "updated_at"])
    return address


@transaction.atomic
def create_customer_address(user, **fields) -> CustomerAddress:
    ensure_can_add_address(user)
    payload = normalize_address_fields(fields, partial=False)
    address = CustomerAddress.objects.create(user=user, is_active=True, **payload)
    CustomerAddress.objects.filter(user=user).exclude(pk=address.pk).update(
        is_active=False
    )
    return address


@transaction.atomic
def delete_customer_address(address: CustomerAddress) -> None:
    user = address.user
    was_active = address.is_active
    pk = address.pk
    address.delete()
    if was_active:
        replacement = (
            CustomerAddress.objects.filter(user=user).order_by("-updated_at").first()
        )
        if replacement:
            set_active_address(replacement)
