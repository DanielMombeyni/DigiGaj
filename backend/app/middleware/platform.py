class ClientPlatformMiddleware:
    """Attach request.client_platform from headers."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        platform = (
            request.headers.get("X-Client-Platform")
            or request.headers.get("X-Platform")
            or "web"
        )
        request.client_platform = str(platform).lower().strip()
        return self.get_response(request)
