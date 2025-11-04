from __future__ import annotations
from io import BytesIO
from typing import Dict, Any


def trydecode(b: bytes) -> tuple[str, str]:
    try:
        return b.decode("utf-8"), "utf-8"
    except UnicodeDecodeError:
        return b.decode("latin-1", "ignore"), "latin-1"


def textstats(text: str) -> Dict[str, Any]:
    words = text.split()
    return {"chars": len(text), "words": len(words), "preview": text[:200]}


def pdfmeta(b: bytes) -> Dict[str, Any]:
    meta: Dict[str, Any] = {}
    try:
        from PyPDF2 import PdfReader

        reader = PdfReader(BytesIO(b))
        pages = len(reader.pages)
        text = ""
        for p in reader.pages[:5]:
            try:
                text += p.extract_text() or ""
            except Exception:
                pass
        meta.update({"pages": pages})
        meta.update(textstats(text))
    except Exception:
        meta.update({"pages": None})
    return meta


def docxmeta(b: bytes) -> Dict[str, Any]:
    meta: Dict[str, Any] = {}
    try:
        import docx

        doc = docx.Document(BytesIO(b))
        text = "\n".join([p.text for p in doc.paragraphs])[:5000]
        meta.update(textstats(text))
    except Exception:
        pass
    return meta


def extract_metadata(
    filename: str, mime: str, kind: str, data: bytes
) -> Dict[str, Any]:
    base = {
        "original_filename": filename,
        "mime": mime,
        "kind": kind,
        "size_bytes": len(data),
    }

    if kind == "text":
        text, enc = trydecode(data)
        base.update({"encoding": enc})
        base.update(textstats(text))
    elif kind == "pdf":
        base.update(pdfmeta(data))
    elif kind in {"docx", "doc"}:
        base.update(docxmeta(data))
    return base
