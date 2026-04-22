from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Request, Depends
from fastapi.responses import StreamingResponse, JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from typing import List, Optional
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import os
import uuid
import json
import logging
import tempfile
import asyncio
import io
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from document_processor import extract_text
from rag_engine import RagEngine
from groq_service import GroqService
from pdf_export import generate_pdf

# MongoDB
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# Singletons
rag_engine = RagEngine()
groq_service = GroqService(os.environ["GROQ_API_KEY"])

# Rate limiter
limiter = Limiter(key_func=get_remote_address)

app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

api_router = APIRouter(prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MAX_UPLOAD_SIZE = 50 * 1024 * 1024  # 50 MB


# --- Pydantic Models ---
class ChatRequest(BaseModel):
    query: str
    session_id: str
    doc_ids: Optional[List[str]] = []
    mode: str = "hybrid"


class CompareRequest(BaseModel):
    query: str
    doc_ids: List[str]


class ExportRequest(BaseModel):
    session_id: str


# --- Routes ---
@api_router.get("/health")
async def health():
    return {"status": "ok"}


@api_router.post("/documents/upload")
@limiter.limit("15/minute")
async def upload_document(request: Request, file: UploadFile = File(...)):
    doc_id = str(uuid.uuid4())
    suffix = Path(file.filename or "upload.txt").suffix or ".txt"

    content = await file.read()

    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is 50MB.",
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


@api_router.get("/documents")
async def list_documents():
    docs = await db.documents.find({}, {"_id": 0}).to_list(100)
    return docs


@api_router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str):
    await db.documents.delete_one({"id": doc_id})
    await db.chunks.delete_many({"doc_id": doc_id})
    return {"status": "deleted"}


@api_router.post("/chat")
@limiter.limit("30/minute")
async def chat(request: Request, body: ChatRequest):
    query_filter = {}
    if body.doc_ids:
        query_filter = {"doc_id": {"$in": body.doc_ids}}

    all_chunks = await db.chunks.find(query_filter, {"_id": 0}).to_list(5000)

    if not all_chunks:
        return {
            "answer": "No documents found. Please upload documents in the sidebar first.",
            "confidence": 0.0,
            "has_contradiction": False,
            "contradiction_description": "",
            "sources": [],
            "source_chunks": [],
            "is_grounded": True,
            "crag_note": "",
            "rewritten_query": body.query,
        }

    session = await db.sessions.find_one({"id": body.session_id}, {"_id": 0})
    conversation_history = session.get("messages", []) if session else []

    rewritten_query = await groq_service.rewrite_query(body.query, conversation_history)
    query_embedding = await asyncio.to_thread(rag_engine.get_embedding, rewritten_query)

    chunk_texts = [c["text"] for c in all_chunks]
    chunk_embeddings = [c["embedding"] for c in all_chunks]

    if body.mode == "hybrid":
        results = await asyncio.to_thread(
            rag_engine.hybrid_search, rewritten_query, query_embedding, chunk_texts, chunk_embeddings, 10
        )
    elif body.mode == "bm25":
        results = await asyncio.to_thread(rag_engine.bm25_search, rewritten_query, chunk_texts, 10)
    else:
        results = await asyncio.to_thread(rag_engine.vector_search, query_embedding, chunk_embeddings, 10)

    results = results or []
    reranked = await asyncio.to_thread(rag_engine.rerank, rewritten_query, chunk_texts, results[:10])
    top_results = reranked[:5] if reranked else [(idx, s) for idx, s in results[:5]]

    top_chunks = [all_chunks[idx] for idx, _ in top_results if idx < len(all_chunks)]
    top_chunk_texts = [c["text"] for c in top_chunks]

    answer_task = groq_service.generate_answer(body.query, top_chunk_texts, conversation_history)
    contradiction_task = groq_service.detect_contradictions(top_chunk_texts)
    answer, contradiction_result = await asyncio.gather(answer_task, contradiction_task)
    has_contradiction, contradiction_desc = contradiction_result

    confidence = await asyncio.to_thread(rag_engine.compute_confidence, results[:5])
    is_grounded, crag_note = await groq_service.self_evaluate(answer, top_chunk_texts)

    sources = list(set([c["doc_name"] for c in top_chunks]))
    new_messages = conversation_history + [
        {"role": "user", "content": body.query},
        {"role": "assistant", "content": answer, "sources": sources, "confidence": confidence},
    ]

    await db.sessions.update_one(
        {"id": body.session_id},
        {
            "$set": {
                "id": body.session_id,
                "messages": new_messages[-20:],
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
        upsert=True,
    )

    return {
        "answer": answer,
        "confidence": confidence,
        "has_contradiction": has_contradiction,
        "contradiction_description": contradiction_desc,
        "sources": sources,
        "source_chunks": [
            {"text": c["text"][:300], "doc_name": c["doc_name"]} for c in top_chunks
        ],
        "is_grounded": is_grounded,
        "crag_note": crag_note,
        "rewritten_query": rewritten_query,
    }


@api_router.post("/chat/stream")
@limiter.limit("30/minute")
async def chat_stream(request: Request, body: ChatRequest):
    """Streaming chat via Server-Sent Events."""

    async def generate():
        try:
            query_filter = {}
            if body.doc_ids:
                query_filter = {"doc_id": {"$in": body.doc_ids}}

            all_chunks = await db.chunks.find(query_filter, {"_id": 0}).to_list(5000)

            if not all_chunks:
                yield f"data: {json.dumps({'error': 'No documents found. Please upload documents first.'})}\n\n"
                return

            session = await db.sessions.find_one({"id": body.session_id}, {"_id": 0})
            conversation_history = session.get("messages", []) if session else []

            # Step 1: Query rewriting
            rewritten_query = await groq_service.rewrite_query(body.query, conversation_history)
            yield f"data: {json.dumps({'status': 'retrieving', 'rewritten_query': rewritten_query})}\n\n"

            # Step 2: Embedding + retrieval
            query_embedding = await asyncio.to_thread(rag_engine.get_embedding, rewritten_query)

            chunk_texts = [c["text"] for c in all_chunks]
            chunk_embeddings = [c["embedding"] for c in all_chunks]

            if body.mode == "hybrid":
                results = await asyncio.to_thread(
                    rag_engine.hybrid_search, rewritten_query, query_embedding, chunk_texts, chunk_embeddings, 10
                )
            elif body.mode == "bm25":
                results = await asyncio.to_thread(rag_engine.bm25_search, rewritten_query, chunk_texts, 10)
            else:
                results = await asyncio.to_thread(rag_engine.vector_search, query_embedding, chunk_embeddings, 10)

            results = results or []

            # Step 3: Rerank
            reranked = await asyncio.to_thread(rag_engine.rerank, rewritten_query, chunk_texts, results[:10])
            top_results = reranked[:5] if reranked else [(idx, s) for idx, s in results[:5]]
            top_chunks = [all_chunks[idx] for idx, _ in top_results if idx < len(all_chunks)]
            top_chunk_texts = [c["text"] for c in top_chunks]

            confidence = await asyncio.to_thread(rag_engine.compute_confidence, results[:5])

            # Step 4: Start contradiction detection async (runs while we stream)
            contradiction_task = asyncio.ensure_future(
                groq_service.detect_contradictions(top_chunk_texts)
            )

            yield f"data: {json.dumps({'status': 'generating'})}\n\n"

            # Step 5: Stream answer token by token
            context = "\n\n".join(
                [f"[Source {i+1}]: {chunk}" for i, chunk in enumerate(top_chunk_texts)]
            )
            history_text = (
                "\n".join(
                    [f"{m['role'].capitalize()}: {m['content'][:300]}" for m in conversation_history[-6:]]
                )
                if conversation_history
                else "None"
            )
            system_msg = """You are a precise document analysis assistant. Answer questions based solely on the provided context.
Use [Source N] notation to cite sources inline. If the context doesn't contain enough information, say so clearly."""
            user_msg = f"Previous conversation:\n{history_text}\n\nContext from documents:\n{context}\n\nQuestion: {body.query}\n\nAnswer:"

            full_answer = ""
            try:
                stream = await groq_service.client.chat.completions.create(
                    model=groq_service.main_model,
                    messages=[
                        {"role": "system", "content": system_msg},
                        {"role": "user", "content": user_msg},
                    ],
                    max_tokens=800,
                    temperature=0.1,
                    stream=True,
                )
                async for chunk in stream:
                    token = chunk.choices[0].delta.content or ""
                    if token:
                        full_answer += token
                        yield f"data: {json.dumps({'token': token})}\n\n"
            except Exception as e:
                logger.error(f"Groq streaming error: {e}")
                full_answer = f"Error generating answer: {str(e)}"
                yield f"data: {json.dumps({'token': full_answer})}\n\n"

            # Step 6: Await contradiction + CRAG
            try:
                has_contradiction, contradiction_desc = await contradiction_task
            except Exception:
                has_contradiction, contradiction_desc = False, ""

            try:
                is_grounded, crag_note = await groq_service.self_evaluate(full_answer, top_chunk_texts)
            except Exception:
                is_grounded, crag_note = True, ""

            sources = list(set([c["doc_name"] for c in top_chunks]))

            # Step 7: Save session
            new_messages = conversation_history + [
                {"role": "user", "content": body.query},
                {"role": "assistant", "content": full_answer, "sources": sources, "confidence": confidence},
            ]
            await db.sessions.update_one(
                {"id": body.session_id},
                {
                    "$set": {
                        "id": body.session_id,
                        "messages": new_messages[-20:],
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }
                },
                upsert=True,
            )

            # Final metadata packet
            final = {
                "done": True,
                "answer": full_answer,
                "confidence": confidence,
                "has_contradiction": has_contradiction,
                "contradiction_description": contradiction_desc,
                "sources": sources,
                "source_chunks": [
                    {"text": c["text"][:300], "doc_name": c["doc_name"]} for c in top_chunks
                ],
                "is_grounded": is_grounded,
                "crag_note": crag_note,
                "rewritten_query": rewritten_query,
            }
            yield f"data: {json.dumps(final)}\n\n"

        except Exception as e:
            logger.error(f"Streaming error: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@api_router.post("/compare")
@limiter.limit("20/minute")
async def compare_documents(request: Request, body: CompareRequest):
    if not body.doc_ids:
        raise HTTPException(status_code=400, detail="Select at least one document.")

    query_embedding = await asyncio.to_thread(rag_engine.get_embedding, body.query)
    results = {}

    for doc_id in body.doc_ids:
        doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
        if not doc:
            continue

        chunks = await db.chunks.find({"doc_id": doc_id}, {"_id": 0}).to_list(1000)
        if not chunks:
            continue

        chunk_texts = [c["text"] for c in chunks]
        chunk_embeddings = [c["embedding"] for c in chunks]

        vector_results = await asyncio.to_thread(
            rag_engine.vector_search, query_embedding, chunk_embeddings, 5
        )
        reranked = await asyncio.to_thread(
            rag_engine.rerank, body.query, chunk_texts, vector_results
        )
        top_chunks = [chunk_texts[idx] for idx, _ in reranked[:3]]

        answer = await groq_service.generate_compare_answer(body.query, top_chunks, doc["name"])

        results[doc_id] = {
            "doc_name": doc["name"],
            "answer": answer,
            "source_chunks": top_chunks[:2],
        }

    return {"results": results}


@api_router.get("/visualize")
async def get_visualization():
    all_chunks = await db.chunks.find(
        {}, {"_id": 0, "text": 1, "doc_id": 1, "doc_name": 1, "embedding": 1}
    ).to_list(500)

    if len(all_chunks) < 2:
        return {
            "points": [],
            "message": "Upload at least 2 documents to see the visualization.",
        }

    embeddings = [c["embedding"] for c in all_chunks]
    coords = await asyncio.to_thread(rag_engine.get_umap_coords, embeddings)

    points = [
        {
            "x": float(coord[0]),
            "y": float(coord[1]),
            "doc_id": chunk["doc_id"],
            "doc_name": chunk["doc_name"],
            "text_preview": chunk["text"][:120] + "...",
        }
        for chunk, coord in zip(all_chunks, coords)
    ]
    return {"points": points}


@api_router.post("/export/pdf")
async def export_pdf(body: ExportRequest):
    session = await db.sessions.find_one({"id": body.session_id}, {"_id": 0})
    if not session or not session.get("messages"):
        raise HTTPException(
            status_code=404,
            detail="No conversation found. Chat first before exporting.",
        )

    messages = session.get("messages", [])
    pdf_bytes = await asyncio.to_thread(generate_pdf, messages)

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=conversation_{body.session_id[:8]}.pdf"
        },
    )


@api_router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    session = await db.sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        return {"id": session_id, "messages": []}
    return session


app.include_router(api_router)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
