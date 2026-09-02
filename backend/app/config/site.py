"""Public site domain — used by deploy auto-config and store settings."""

SITE_DOMAIN = "digigadg.com"


def domain_hosts(domain: str | None = None) -> list[str]:
    """Return apex + www hostnames for ALLOWED_HOSTS."""
    name = (domain or SITE_DOMAIN or "").strip().lower()
    if not name:
        return []
    if name.startswith("http://") or name.startswith("https://"):
        name = name.split("://", 1)[1].split("/")[0]
    name = name.split(":")[0]
    if name.startswith("www."):
        base = name[4:]
        return [base, f"www.{base}"]
    return [name, f"www.{name}"]
