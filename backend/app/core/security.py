"""Supabase access-token verification.

Tokens are verified against the project's published signing keys (JWKS), so the
backend holds no JWT secret. Signature, issuer, audience and expiry are all
checked; any failure is a 401.
"""

from dataclasses import dataclass
from functools import lru_cache

import jwt
from anyio import to_thread
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import Settings, get_settings

_bearer = HTTPBearer(auto_error=False)
_ALLOWED_ALGORITHMS = ["ES256", "RS256"]


@dataclass(frozen=True)
class AuthenticatedUser:
    id: str
    email: str | None
    token: str


@lru_cache
def _jwks_client(jwks_url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(jwks_url, cache_keys=True, lifespan=600)


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def decode_access_token(token: str, settings: Settings) -> dict:
    signing_key = _jwks_client(settings.supabase_jwks_url).get_signing_key_from_jwt(token)
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=_ALLOWED_ALGORITHMS,
        audience="authenticated",
        issuer=settings.supabase_issuer,
        options={"require": ["exp", "sub", "iss", "aud"]},
    )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    settings: Settings = Depends(get_settings),
) -> AuthenticatedUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise _unauthorized("Missing bearer token")

    try:
        # The JWKS fetch is blocking on a cold cache, so keep it off the event loop.
        claims = await to_thread.run_sync(decode_access_token, credentials.credentials, settings)
    except jwt.ExpiredSignatureError as exc:
        raise _unauthorized("Token has expired") from exc
    except (jwt.PyJWTError, jwt.PyJWKClientError) as exc:
        raise _unauthorized("Invalid token") from exc

    return AuthenticatedUser(id=claims["sub"], email=claims.get("email"), token=credentials.credentials)
