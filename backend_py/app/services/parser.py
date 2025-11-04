from __future__ import annotations
from typing import Dict, Any


# creat a summary for plain text.
def summary(txt: str, preview_len: int = 200) -> Dict[str, Any]:
    words = txt.split()
    meta = {
        "chars": len(txt),
        "words": len(words),
        "preview": txt[:preview_len],
    }
    return meta


def wenjianbytes(data: bytes) -> Dict[str, Any]:
    text = data.decode("utf-8", errors="replace")
    return summary(text)


def pdfbytes(data: bytes) -> Dict[str, Any]:
    try:
        pages = data.count(b"/Type /Page")
    except Exception:
        pages = None
    return {"pages": int(pages) if pages else None}


# return an empty analysis shell
def docbytes(_: bytes) -> Dict[str, Any]:
    return {}


def genericbytes(_: bytes) -> Dict[str, Any]:
    return {}


def build_metadata(
    kind: str, mime: str, ext: str, size: int, payload: bytes
) -> Dict[str, Any]:
    base = {"kind": kind, "mime": mime, "ext": ext, "size_bytes": size}

    if kind == "text":
        extra = wenjianbytes(payload)
    elif kind == "pdf":
        extra = pdfbytes(payload)
    elif kind in ("docx", "doc"):
        extra = docbytes(payload)
    else:
        extra = genericbytes(payload)

    base.update(extra)
    return base
