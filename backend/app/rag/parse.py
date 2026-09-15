"""Pick a parser for an uploaded file.

Routes on the extension first and the MIME type second, because browsers report
MIME types unreliably. Week 1 accepts PDF and Word only (PRD MUST scope, D-022).
"""

from __future__ import annotations

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
