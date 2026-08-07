"""
Upload validation and SSRF guards for external model endpoints.
"""

from __future__ import annotations

import ipaddress
import socket
from pathlib import Path
from urllib.parse import urlparse

from fastapi import HTTPException, UploadFile

from core.config import ALLOWED_UPLOAD_EXTENSIONS, CHECKSUM_REQUIRE_HTTPS_EXTERNAL, MAX_UPLOAD_BYTES


def validate_upload_file(file: UploadFile) -> None:
    """Reject oversize or disallowed uploads before writing to disk."""
    filename = file.filename or ""
    extension = Path(filename).suffix.lower()
    if extension not in ALLOWED_UPLOAD_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported file type '{extension or 'unknown'}'. "
                f"Allowed: {sorted(ALLOWED_UPLOAD_EXTENSIONS)}"
            ),
        )

    # Content-Length when provided by the client (may be absent for streams).
    if file.size is not None and file.size > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Upload exceeds maximum size of {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.",
        )


def safe_stored_filename(original_filename: str | None) -> str:
    """Return a uuid-only filename preserving a safe extension."""
    extension = Path(original_filename or "").suffix.lower()
    if extension not in ALLOWED_UPLOAD_EXTENSIONS:
        extension = ".bin"
    import uuid

    return f"{uuid.uuid4().hex}{extension}"


def validate_external_model_url(endpoint_url: str) -> str:
    """
    Block obvious SSRF targets (localhost, private IPs, non-HTTP schemes).
    Returns the normalized URL string.
    """
    parsed = urlparse(endpoint_url.strip())
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(
            status_code=400,
            detail="external_model_endpoint must use http or https.",
        )
    if CHECKSUM_REQUIRE_HTTPS_EXTERNAL and parsed.scheme != "https":
        raise HTTPException(
            status_code=400,
            detail="external_model_endpoint must use https in production.",
        )
    if not parsed.hostname:
        raise HTTPException(status_code=400, detail="external_model_endpoint URL is invalid.")

    host = parsed.hostname.lower()

    allowlist_raw = __import__("os").environ.get("EXTERNAL_MODEL_URL_ALLOWLIST", "")
    if allowlist_raw:
        allowed_prefixes = [p.strip() for p in allowlist_raw.split(",") if p.strip()]
        if not any(endpoint_url.strip().startswith(prefix) for prefix in allowed_prefixes):
            raise HTTPException(
                status_code=400,
                detail="external_model_endpoint is not in EXTERNAL_MODEL_URL_ALLOWLIST.",
            )

    if host in ("localhost", "127.0.0.1", "::1"):
        raise HTTPException(
            status_code=400,
            detail="external_model_endpoint cannot target localhost.",
        )

    try:
        resolved = socket.getaddrinfo(host, None)
    except socket.gaierror as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Could not resolve external_model_endpoint host: {host}",
        ) from exc

    for _family, _type, _proto, _canonname, sockaddr in resolved:
        ip = ipaddress.ip_address(sockaddr[0])
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
        ):
            raise HTTPException(
                status_code=400,
                detail="external_model_endpoint cannot target private or reserved IP ranges.",
            )

    return endpoint_url.strip()
