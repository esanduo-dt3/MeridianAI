"""Security headers on every API response (docs/decisions.md D-041).

The API returns private JSON and is never meant to be framed, sniffed or cached
by intermediaries. The interactive docs page is exempt from the content policy
outside production, because it needs its own scripts; it is disabled in
production anyway.
"""

from __future__ import annotations

from starlette.types import ASGIApp, Message, Receive, Scope, Send

_BASE = {
    b"x-content-type-options": b"nosniff",
    b"x-frame-options": b"DENY",
    b"referrer-policy": b"no-referrer",
    b"permissions-policy": b"camera=(), microphone=(), geolocation=()",
    b"cross-origin-opener-policy": b"same-origin",
}
_API_CSP = b"default-src 'none'; frame-ancestors 'none'"
_DOCS_PATHS = ("/docs", "/openapi.json")


class SecurityHeadersMiddleware:
    def __init__(self, app: ASGIApp, *, production: bool):
        self.app = app
        self.production = production

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        is_docs = scope.get("path", "").startswith(_DOCS_PATHS)

        async def send_with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                present = {name.lower() for name, _ in headers}
                extra = dict(_BASE)
                if not is_docs:
                    extra[b"content-security-policy"] = _API_CSP
                    extra[b"cache-control"] = b"no-store"
                if self.production:
                    extra[b"strict-transport-security"] = b"max-age=31536000; includeSubDomains"
                headers.extend((k, v) for k, v in extra.items() if k not in present)
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_with_headers)
