from __future__ import annotations

from django.db import transaction

from app.models import (
    Product,
    ProductAttribute,
    ProductColor,
    ProductSize,
    ProductVariant,
)


class ProductOptionsService:
    """Sync colors / sizes / variants / attributes for a product."""

    @classmethod
    @transaction.atomic
    def sync(cls, product: Product, data: dict) -> Product:
        colors_data = data.get("colors")
        sizes_data = data.get("sizes")
        variants_data = data.get("variants")
        attributes_data = data.get("attributes")

        color_map: dict[str, ProductColor] = {}
        size_map: dict[str, ProductSize] = {}

        if colors_data is not None:
            color_map = cls._sync_colors(product, colors_data)
        else:
            color_map = {str(c.id): c for c in product.colors.all()}

        if sizes_data is not None:
            size_map = cls._sync_sizes(product, sizes_data)
        else:
            size_map = {str(s.id): s for s in product.sizes.all()}

        if variants_data is not None:
            cls._sync_variants(product, variants_data, color_map, size_map)
        elif colors_data is not None or sizes_data is not None:
            cls._ensure_variant_matrix(product)

        if attributes_data is not None:
            cls._sync_attributes(product, attributes_data)

        return product

    @staticmethod
    def _sync_colors(product: Product, items: list) -> dict[str, ProductColor]:
        keep_ids = []
        key_map: dict[str, ProductColor] = {}
        for i, row in enumerate(items or []):
            name = (row.get("name") or "").strip()
            if not name:
                continue
            cid = row.get("id")
            client_key = str(row.get("key") or cid or f"new-{i}")
            hex_code = (row.get("hex_code") or "").strip()
            sort_order = int(row.get("sort_order") or i)
            obj = None
            if cid:
                obj = product.colors.filter(pk=cid).first()
            if obj:
                obj.name = name
                obj.hex_code = hex_code
                obj.sort_order = sort_order
                obj.save()
            else:
                obj = ProductColor.objects.create(
                    product=product,
                    name=name,
                    hex_code=hex_code,
                    sort_order=sort_order,
                )
            keep_ids.append(obj.id)
            key_map[client_key] = obj
            key_map[str(obj.id)] = obj
        product.colors.exclude(id__in=keep_ids).delete()
        return key_map

    @staticmethod
    def _sync_sizes(product: Product, items: list) -> dict[str, ProductSize]:
        keep_ids = []
        key_map: dict[str, ProductSize] = {}
        for i, row in enumerate(items or []):
            name = (row.get("name") or "").strip()
            if not name:
                continue
            sid = row.get("id")
            client_key = str(row.get("key") or sid or f"new-{i}")
            sort_order = int(row.get("sort_order") or i)
            obj = None
            if sid:
                obj = product.sizes.filter(pk=sid).first()
            if obj:
                obj.name = name
                obj.sort_order = sort_order
                obj.save()
            else:
                obj = ProductSize.objects.create(
                    product=product,
                    name=name,
                    sort_order=sort_order,
                )
            keep_ids.append(obj.id)
            key_map[client_key] = obj
            key_map[str(obj.id)] = obj
        product.sizes.exclude(id__in=keep_ids).delete()
        return key_map

    @classmethod
    def _sync_variants(
        cls,
        product: Product,
        items: list,
        color_map: dict,
        size_map: dict,
    ) -> None:
        keep_ids = []
        for row in items or []:
            color = None
            size = None
            if row.get("color_id"):
                color = product.colors.filter(pk=row["color_id"]).first()
            elif row.get("color_key") is not None and str(row.get("color_key")) != "":
                color = color_map.get(str(row["color_key"]))
            if row.get("size_id"):
                size = product.sizes.filter(pk=row["size_id"]).first()
            elif row.get("size_key") is not None and str(row.get("size_key")) != "":
                size = size_map.get(str(row["size_key"]))

            # If product has colors, require a color; same for sizes
            if product.colors.exists() and color is None:
                continue
            if product.sizes.exists() and size is None:
                continue

            option_key = ProductVariant.make_option_key(
                color.id if color else None,
                size.id if size else None,
            )
            price = row.get("price_toman")
            if price == "" or price is None:
                price_val = None
            else:
                price_val = int(price)
            stock = int(row.get("stock") or 0)
            sku = (row.get("sku") or "").strip()
            is_active = bool(row.get("is_active", True))

            obj = product.variants.filter(option_key=option_key).first()
            if obj:
                obj.color = color
                obj.size = size
                obj.price_toman = price_val
                obj.stock = stock
                obj.sku = sku
                obj.is_active = is_active
                obj.save()
            else:
                obj = ProductVariant.objects.create(
                    product=product,
                    color=color,
                    size=size,
                    price_toman=price_val,
                    stock=stock,
                    sku=sku,
                    is_active=is_active,
                )
            keep_ids.append(obj.id)

        if keep_ids:
            product.variants.exclude(id__in=keep_ids).delete()
        else:
            # Empty variants list with no colors/sizes → clear variants
            if not product.colors.exists() and not product.sizes.exists():
                product.variants.all().delete()

    @classmethod
    def _ensure_variant_matrix(cls, product: Product) -> None:
        colors = list(product.colors.all())
        sizes = list(product.sizes.all())
        existing = {
            v.option_key: v for v in product.variants.select_related("color", "size")
        }
        wanted_keys = set()

        if not colors and not sizes:
            product.variants.all().delete()
            return

        combos = []
        if colors and sizes:
            for c in colors:
                for s in sizes:
                    combos.append((c, s))
        elif colors:
            for c in colors:
                combos.append((c, None))
        else:
            for s in sizes:
                combos.append((None, s))

        for color, size in combos:
            key = ProductVariant.make_option_key(
                color.id if color else None,
                size.id if size else None,
            )
            wanted_keys.add(key)
            if key not in existing:
                ProductVariant.objects.create(
                    product=product,
                    color=color,
                    size=size,
                    price_toman=None,
                    stock=0,
                )

        product.variants.exclude(
            option_key__in=wanted_keys
        ).delete()

    @staticmethod
    def _sync_attributes(product: Product, items: list) -> None:
        product.attributes.all().delete()
        bulk = []
        for i, row in enumerate(items or []):
            name = (row.get("name") or "").strip()
            value = (row.get("value") or "").strip()
            if not name or not value:
                continue
            bulk.append(
                ProductAttribute(
                    product=product,
                    name=name,
                    value=value,
                    sort_order=int(row.get("sort_order") or i),
                )
            )
        if bulk:
            ProductAttribute.objects.bulk_create(bulk)
