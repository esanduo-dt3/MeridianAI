"""Choose and run a parser for an uploaded file, after validating its bytes.

Routing looks at the extension first and the MIME type second, because browsers
report MIME types unreliably. Only PDF and Word (.docx) are accepted (PRD MUST
scope, D-022).

Validation happens on the bytes, not the name (D-041): a file called ``.pdf``
can be anything, and a ``.docx`` is a zip, so a few kilobytes can expand to
gigabytes. Every rejection message is written to be shown to the uploader.
"""

from __future__ import annotations

import io
import zipfile
from typing import Callable

from app.core.config import get_settings
from app.rag.documents import ParsedDocument
from app.rag.parsers.docx import parse_docx
from app.rag.parsers.pdf import parse_pdf

PDF_MIME = "application/pdf"
DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

#: Canonical MIME type stored for each accepted document type.
ALLOWED_MIME = {"pdf": PDF_MIME, "docx": DOCX_MIME}

#: Matches the Storage bucket's file size limit.
MAX_UPLOAD_BYTES = 25 * 1024 * 1024

_PDF_MAGIC = b"%PDF-"
_ZIP_MAGIC = b"PK\x03\x04"
_DOCX_REQUIRED_ENTRY = "word/document.xml"

_UNSUPPORTED_MESSAGE = "Only PDF and Word (.docx) files can be uploaded."


# PUBLIC_INTERFACE
class UnsupportedDocument(ValueError):
    """The file is not a PDF or Word document this system can read safely."""


def _check_pdf(data: bytes) -> None:
    """Reject a non-PDF, a damaged PDF, or one with more pages than the cap."""
    if _PDF_MAGIC not in data[:1024]:
        raise UnsupportedDocument("This file is named as a PDF but its contents are not a PDF.")

    import pymupdf  # imported lazily: only PDF uploads need it

    try:
        with pymupdf.open(stream=data, filetype="pdf") as pdf:
            pages = pdf.page_count
    except Exception as exc:  # noqa: BLE001 - malformed PDFs raise many exception types
        raise UnsupportedDocument("This PDF is damaged and can't be opened.") from exc

    limit = get_settings().max_pdf_pages
    if pages > limit:
        raise UnsupportedDocument(
            f"This PDF has {pages} pages; the limit is {limit}. Split it into smaller files."
        )


def _check_docx(data: bytes) -> None:
    """Reject a non-zip, a zip that is not a Word document, or a zip bomb."""
    settings = get_settings()
    if not data.startswith(_ZIP_MAGIC):
        raise UnsupportedDocument("This file is named as a Word document but its contents are not one.")
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            entries = archive.infolist()
    except zipfile.BadZipFile as exc:
        raise UnsupportedDocument("This Word document is damaged and can't be opened.") from exc

    if _DOCX_REQUIRED_ENTRY not in {entry.filename for entry in entries}:
        raise UnsupportedDocument("This file is a zip archive but not a Word document.")
    if len(entries) > settings.max_docx_entries:
        raise UnsupportedDocument("This Word document contains too many internal parts to process safely.")

    # A small zip can expand to gigabytes, so the decompressed size is capped too.
    expanded = sum(entry.file_size for entry in entries)
    if expanded > settings.max_docx_uncompressed_bytes:
        raise UnsupportedDocument(
            f"This Word document expands to {expanded // (1024 * 1024)} MB when opened; the limit is "
            f"{settings.max_docx_uncompressed_bytes // (1024 * 1024)} MB."
        )


_VALIDATORS: dict[str, Callable[[bytes], None]] = {"pdf": _check_pdf, "docx": _check_docx}
_PARSERS: dict[str, Callable[[bytes], ParsedDocument]] = {"pdf": parse_pdf, "docx": parse_docx}


# PUBLIC_INTERFACE
def check_file(doc_type: str, data: bytes) -> None:
    """Verify a file's bytes match its claimed type and stay within the limits (D-041).

    Runs before anything is stored or parsed, and again before background
    parsing so a reprocess of an already-stored file is checked too.

    :param doc_type: ``pdf`` or ``docx``.
    :param data: The complete file bytes.
    :raises UnsupportedDocument: When the type is unsupported, the contents do
        not match the claimed type, the file is damaged, or a size/page/entry
        limit is exceeded.
    """
    validator = _VALIDATORS.get(doc_type)
    if validator is None:
        raise UnsupportedDocument(_UNSUPPORTED_MESSAGE)
    validator(data)


# PUBLIC_INTERFACE
def detect_type(filename: str, mime: str | None) -> str:
    """Decide a document type from the file name, falling back to the MIME type.

    :param filename: Original (or sanitised) file name.
    :param mime: Content type reported by the browser; may be ``None``.
    :returns: ``"pdf"`` or ``"docx"``.
    :raises UnsupportedDocument: When neither the extension nor the MIME type is accepted.
    """
    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    mime = (mime or "").lower()
    if extension == "pdf" or mime == PDF_MIME:
        return "pdf"
    if extension == "docx" or mime == DOCX_MIME:
        return "docx"
    raise UnsupportedDocument(_UNSUPPORTED_MESSAGE)


# PUBLIC_INTERFACE
def parse_file(doc_type: str, data: bytes) -> ParsedDocument:
    """Parse a validated file into the shared element representation.

    :param doc_type: ``pdf`` or ``docx``.
    :param data: The complete file bytes.
    :returns: The parsed document.
    :raises UnsupportedDocument: When the type has no parser.
    """
    parser = _PARSERS.get(doc_type)
    if parser is None:
        raise UnsupportedDocument(f"Unsupported document type: {doc_type}")
    return parser(data)
