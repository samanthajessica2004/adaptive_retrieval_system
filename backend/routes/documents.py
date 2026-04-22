"""Document upload, URL ingestion, listing, and deletion."""
import os
import uuid
import asyncio
import tempfile
import logging
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from fastapi import APIRouter, UploadFile, File, HTTPException, Request

from deps import db, rag_engine, limiter, MAX_UPLOAD_SIZE
from document_processor import extract_text, fetch_url_content
from models import IngestUrlRequest

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/documents/upload")
@limiter.limit("15/minute")
async def upload_document(request: Request, file: UploadFile = File(...)):
    doc_id = str(uuid.uuid4())
    suffix = Path(file.filename or "upload.txt").suffix or ".txt"

    content = await file.read()

    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413, detail="File too large. Maximum size is 50MB."
        )

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        file_ext = suffix.lstrip(".").lower()
        text = await asyncio.to_thread(extract_text, tmp_path, file_ext)

        if not text or len(text.strip()) < 10:
            raise HTTPException(
                status_code=400,
                detail="Could not extract meaningful text from this document.",
            )

        chunks = await asyncio.to_thread(rag_engine.semantic_chunk, text)
        chunk_texts = [c for c in chunks if len(c.strip()) > 20]

        if not chunk_texts:
            raise HTTPException(
                status_code=400, detail="No valid text chunks found in document."
            )

        embeddings = await asyncio.to_thread(rag_engine.get_embeddings, chunk_texts)

        doc = {
            "id": doc_id,
            "name": file.filename,
            "file_type": file_ext,
            "text_preview": text[:2000],
            "chunk_count": len(chunk_texts),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.documents.insert_one(doc)

        chunk_docs = [
            {
                "doc_id": doc_id,
                "doc_name": file.filename,
                "text": ct,
                "embedding": emb,
                "chunk_index": i,
            }
            for i, (ct, emb) in enumerate(zip(chunk_texts, embeddings))
        ]
        if chunk_docs:
            await db.chunks.insert_many(chunk_docs)

        return {
            "id": doc_id,
            "name": file.filename,
            "chunk_count": len(chunk_texts),
        }
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


@router.post("/documents/ingest-url")
@limiter.limit("10/minute")
async def ingest_url(request: Request, body: IngestUrlRequest):
    """Fetch a URL, extract clean text, and store as a document."""
    raw_url = body.url.strip()
    if not raw_url.startswith(("http://", "https://")):
        raw_url = "https://" + raw_url

    try:
        parsed = urlparse(raw_url)
        if not parsed.netloc:
            raise HTTPException(status_code=400, detail="Invalid URL — no hostname found.")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid URL format.")

    try:
        page_title, text = await asyncio.to_thread(fetch_url_content, raw_url)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    doc_id = str(uuid.uuid4())

    chunks = await asyncio.to_thread(rag_engine.semantic_chunk, text)
    chunk_texts = [c for c in chunks if len(c.strip()) > 20]

    if not chunk_texts:
        raise HTTPException(status_code=400, detail="No valid text chunks found in page.")

    embeddings = await asyncio.to_thread(rag_engine.get_embeddings, chunk_texts)

    doc = {
        "id": doc_id,
        "name": page_title or parsed.netloc,
        "file_type": "url",
        "source_url": raw_url,
        "text_preview": text[:2000],
        "chunk_count": len(chunk_texts),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.documents.insert_one(doc)

    chunk_docs = [
        {
            "doc_id": doc_id,
            "doc_name": page_title or parsed.netloc,
            "text": ct,
            "embedding": emb,
            "chunk_index": i,
        }
        for i, (ct, emb) in enumerate(zip(chunk_texts, embeddings))
    ]
    if chunk_docs:
        await db.chunks.insert_many(chunk_docs)

    return {
        "id": doc_id,
        "name": page_title or parsed.netloc,
        "chunk_count": len(chunk_texts),
        "source_url": raw_url,
    }


@router.get("/documents")
async def list_documents():
    docs = await db.documents.find({}, {"_id": 0}).to_list(100)
    return docs


@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str):
    await db.documents.delete_one({"id": doc_id})
    await db.chunks.delete_many({"doc_id": doc_id})
    return {"status": "deleted"}
