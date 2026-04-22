"""Document comparison — side-by-side per-document + optional external URL."""
import asyncio
import logging
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException, Request

from deps import db, rag_engine, groq_service, limiter
from document_processor import fetch_url_content
from models import CompareRequest

router = APIRouter()
logger = logging.getLogger(__name__)


async def _compare_chunks_list(query: str, query_embedding, chunk_texts: list, chunk_embeddings: list, doc_name: str, top_k_rerank: int = 5, top_k_answer: int = 3):
    """Retrieve + rerank + answer for an in-memory list of chunks."""
    vector_results = await asyncio.to_thread(
        rag_engine.vector_search, query_embedding, chunk_embeddings, top_k_rerank
    )
    reranked = await asyncio.to_thread(rag_engine.rerank, query, chunk_texts, vector_results)
    top_chunks = [chunk_texts[idx] for idx, _ in reranked[:top_k_answer]]
    answer = await groq_service.generate_compare_answer(query, top_chunks, doc_name)
    return {
        "doc_name": doc_name,
        "answer": answer,
        "source_chunks": top_chunks[:2],
    }


@router.post("/compare")
@limiter.limit("20/minute")
async def compare_documents(request: Request, body: CompareRequest):
    if not body.doc_ids and not body.url:
        raise HTTPException(
            status_code=400, detail="Select at least one document or provide a URL."
        )

    query_embedding = await asyncio.to_thread(rag_engine.get_embedding, body.query)
    results = {}

    # Existing documents
    for doc_id in body.doc_ids:
        doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
        if not doc:
            continue
        chunks = await db.chunks.find({"doc_id": doc_id}, {"_id": 0}).to_list(1000)
        if not chunks:
            continue
        results[doc_id] = await _compare_chunks_list(
            body.query,
            query_embedding,
            [c["text"] for c in chunks],
            [c["embedding"] for c in chunks],
            doc["name"],
        )

    # Optional inline URL (not persisted)
    if body.url:
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

        chunks = await asyncio.to_thread(rag_engine.semantic_chunk, text)
        chunk_texts = [c for c in chunks if len(c.strip()) > 20]
        if not chunk_texts:
            raise HTTPException(status_code=400, detail="URL had no usable text content.")

        chunk_embeddings = await asyncio.to_thread(rag_engine.get_embeddings, chunk_texts)

        url_result = await _compare_chunks_list(
            body.query,
            query_embedding,
            chunk_texts,
            chunk_embeddings,
            page_title or parsed.netloc,
        )
        url_result["source_url"] = raw_url
        url_result["is_external"] = True
        results[f"__url__{parsed.netloc}"] = url_result

    return {"results": results}
