from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status
from sqlalchemy.orm import Session
from nanoid import generate
import mimetypes, os, json
from pydantic import BaseModel
from ..services.storage import save_bytes
from ..db import get_db
from ..models import Material
from ..services.parser import build_metadata, summary
from typing import Optional, Tuple  # ← 新增


router = APIRouter(prefix="/materials", tags=["materials"])

# Allow-list and size guardrails
EXT_WHITELIST = {".txt", ".pdf", ".doc", ".docx"}
MIME_WHITELIST = {
    "text/plain",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
MAX_BYTES = 2 * 1024 * 1024  # 2MB


@router.get("/ping")
def ping():
    return {"ok": True}


def detect_kind_mime(
    filename: str, content_type: Optional[str]
) -> Tuple[str, str, str]:
    "Return kind, mime, ext"
    ext = os.path.splitext(filename)[1].lower()
    mime = (
        content_type or mimetypes.guess_type(filename)[0] or "application/octet-stream"
    )

    if ext == ".pdf" or mime == "application/pdf":
        kind = "pdf"
    elif ext == ".txt" or (mime.startswith("text/") and ext in {"", ".txt"}):
        kind = "text"
    elif (
        ext == ".docx"
        or mime
        == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ):
        kind = "docx"
    elif ext == ".doc" or mime == "application/msword":
        kind = "doc"
    else:
        kind = "file"
    return kind, mime, ext


@router.post("/upload-file")
async def upload_file(file: UploadFile = File(...), db: Session = Depends(get_db)):
    # Basic checks
    if not file.filename:
        raise HTTPException(status_code=400, detail="filename empty ")

    kind, mime, ext = detect_kind_mime(file.filename, file.content_type)

    if ext not in EXT_WHITELIST and mime not in MIME_WHITELIST:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type. Allowed: {', '.join(sorted(EXT_WHITELIST))}",
        )

    # Read & size guard
    payload = await file.read()
    size = len(payload or b"")
    if size == 0:
        raise HTTPException(status_code=400, detail="empty file")
    if size > MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=f"File too large ({size} bytes). Max is {MAX_BYTES} bytes.",
        )
    storage_url = await save_bytes(payload, file.filename)
    # Build metadata
    meta = build_metadata(kind=kind, mime=mime, ext=ext, size=size, payload=payload)
    meta["original_filename"] = file.filename

    mat = Material(
        id=f"mat_{generate(size=8)}",
        type=kind,
        status="available",
        storage_url=None,
        metadata_json=json.dumps(meta, ensure_ascii=False),
        filename=file.filename,
        mime=mime,
        sizebyte=size,
    )
    db.add(mat)
    db.commit()
    db.refresh(mat)
    return mat


@router.get("/{material_id}")
def get_material(material_id: str, db: Session = Depends(get_db)):
    mat = db.query(Material).filter_by(id=material_id).first()
    if not mat:
        raise HTTPException(status_code=404, detail="not found")
    return mat


# Text ingest
MAX_TEXT_CHARS = 10_000


class TextIn(BaseModel):
    text: str


@router.post("/ingest-text")
def ingest_text(body: TextIn, db: Session = Depends(get_db)):
    text = (body.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="empty text")
    if len(text) > MAX_TEXT_CHARS:
        raise HTTPException(
            status_code=413, detail=f"text too long, max {MAX_TEXT_CHARS} chars"
        )

    # Build metadata from text
    meta = {"source": "paste"}
    meta.update(summary(text))

    mat = Material(
        id=f"mat_{generate(size=8)}",
        type="text",
        status="available",
        storage_url=None,
        metadata_json=json.dumps(meta, ensure_ascii=False),
        filename=None,
        mime="text/plain",
        sizebyte=meta["chars"],
    )
    db.add(mat)
    db.commit()
    db.refresh(mat)
    return mat
