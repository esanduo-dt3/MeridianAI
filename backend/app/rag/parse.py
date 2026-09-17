"""Pick a parser for an uploaded file.

Routes on the extension first and the MIME type second, because browsers report
MIME types unreliably. Week 1 accepts PDF and Word only (PRD MUST scope, D-022).
"""

from __future__ import annotations

import io
import zipfile

from app.core.config import get_settings
from app.rag.documents import ParsedDocument
from app.rag.parsers.docx import parse_docx
from app.rag.parsers.pdf import parse_pdf

PDF_MIME = "application/pdf"
DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
ALLOWED_MIME = {"pdf": PDF_MIME, "docx": DOCX_MIME}

# Matches the Storage bucket's file size limit.
MAX_UPLOAD_BYTES = 25 * 1024 * 1024


class UnsupportedDocument(ValueError):
    """The file is not a PDF or Word document we can read."""


def check_file(doc_type: str, data: bytes) -> None:
    """Refuse a file whose contents do not match its type, or that is built to exhaust the server (D-041).

    The extension only says what a file claims to be. This checks the bytes,
    before anything is stored or parsed:

    - a PDF must carry the %PDF- header, and have no more pages than the limit;
    - a Word document must be a real zip holding word/document.xml, with a
      bounded number of entries and a bounded size once decompressed. A .docx is
      a zip, and a small zip can expand to gigabytes (a zip bomb).
    """
    settings = get_settings()
    if doc_type == "pdf":
        if b"%PDF-" not in data[:1024]:
            raise UnsupportedDocument("This file is named as a PDF but its contents are not a PDF.")
        import pymupdf  # imported here: only PDFs need it

        try:
            with pymupdf.open(stream=data, filetype="pdf") as pdf:
                pages = pdf.page_count
        except Exception as exc:  # noqa: BLE001 - malformed PDFs raise many exception types
            raise UnsupportedDocument("This PDF is damaged and can't be opened.") from exc
        if pages > settings.max_pdf_pages:
            raise UnsupportedDocument(f"This PDF has {pages} pages; the limit is {settings.max_pdf_pages}. Split it into smaller files.")
        return

    if doc_type == "docx":
        if not data.startswith(b"PK\x03\x04"):
            raise UnsupportedDocument("This file is named as a Word document but its contents are not one.")
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                entries = archive.infolist()
        except zipfile.BadZipFile as exc:
            raise UnsupportedDocument("This Word document is damaged and can't be opened.") from exc
        if "word/document.xml" not in {e.filename for e in entries}:
            raise UnsupportedDocument("This file is a zip archive but not a Word document.")
        if len(entries) > settings.max_docx_entries:
            raise UnsupportedDocument("This Word document contains too many internal parts to process safely.")
        expanded = sum(e.file_size for e in entries)
        if expanded > settings.max_docx_uncompressed_bytes:
            raise UnsupportedDocument(
                f"This Word document expands to {expanded // (1024 * 1024)} MB when opened; the limit is "
                f"{settings.max_docx_uncompressed_bytes // (1024 * 1024)} MB."
            )
        return

    raise UnsupportedDocument("Only PDF and Word (.docx) files can be uploaded.")


def detect_type(filename: str, mime: str | None) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    mime = (mime or "").lower()
    if ext == "pdf" or mime == PDF_MIME:
        return "pdf"
    if ext == "docx" or mime == DOCX_MIME:
        return "docx"
    raise UnsupportedDocument("Only PDF and Word (.docx) files can be uploaded.")


def parse_file(doc_type: str, data: bytes) -> ParsedDocument:
    if doc_type == "pdf":
        return parse_pdf(data)
    if doc_type == "docx":
        return parse_docx(data)
    raise UnsupportedDocument(f"Unsupported document type: {doc_type}")
