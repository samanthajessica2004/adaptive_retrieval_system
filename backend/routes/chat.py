"""Chat endpoints (non-streaming, streaming SSE, session retrieval)."""
import json
import asyncio
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from deps import db, rag_engine, groq_service, limiter
from models import ChatRequest

router = APIRouter()
logger = logging.getLogger(__name__)


async def _retrieve_top_chunks(body: ChatRequest):
    """Shared retrieval logic: returns (all_chunks, top_chunks, rewritten_query, confidence, results, history)."""
    query_filter = {}
    if body.doc_ids:
        query_filter = {"doc_id": {"$in": body.doc_ids}}

    all_chunks = await db.chunks.find(query_filter, {"_id": 0}).to_list(5000)

    if not all_chunks:
        return None

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

    confidence = await asyncio.to_thread(rag_engine.compute_confidence, results[:5])

    return {
        "all_chunks": all_chunks,
        "top_chunks": top_chunks,
        "rewritten_query": rewritten_query,
        "confidence": confidence,
        "conversation_history": conversation_history,
    }


async def _persist_session(session_id: str, history: list, query: str, answer: str, sources: list, confidence: float):
    new_messages = history + [
        {"role": "user", "content": query},
        {"role": "assistant", "content": answer, "sources": sources, "confidence": confidence},
    ]
    await db.sessions.update_one(
        {"id": session_id},
        {
            "$set": {
                "id": session_id,
                "messages": new_messages[-20:],
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
        upsert=True,
    )


@router.post("/chat")
@limiter.limit("30/minute")
async def chat(request: Request, body: ChatRequest):
    ctx = await _retrieve_top_chunks(body)
    if ctx is None:
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

    top_chunks = ctx["top_chunks"]
    top_chunk_texts = [c["text"] for c in top_chunks]

    answer_task = groq_service.generate_answer(body.query, top_chunk_texts, ctx["conversation_history"])
    contradiction_task = groq_service.detect_contradictions(top_chunk_texts)
    answer, (has_contradiction, contradiction_desc) = await asyncio.gather(answer_task, contradiction_task)

    is_grounded, crag_note = await groq_service.self_evaluate(answer, top_chunk_texts)
    sources = list(set([c["doc_name"] for c in top_chunks]))
    await _persist_session(body.session_id, ctx["conversation_history"], body.query, answer, sources, ctx["confidence"])

    return {
        "answer": answer,
        "confidence": ctx["confidence"],
        "has_contradiction": has_contradiction,
        "contradiction_description": contradiction_desc,
        "sources": sources,
        "source_chunks": [
            {"text": c["text"][:300], "doc_name": c["doc_name"]} for c in top_chunks
        ],
        "is_grounded": is_grounded,
        "crag_note": crag_note,
        "rewritten_query": ctx["rewritten_query"],
    }


@router.post("/chat/stream")
@limiter.limit("30/minute")
async def chat_stream(request: Request, body: ChatRequest):
    """Streaming chat via Server-Sent Events."""

    async def generate():
        try:
            ctx = await _retrieve_top_chunks(body)
            if ctx is None:
                yield f"data: {json.dumps({'error': 'No documents found. Please upload documents first.'})}\n\n"
                return

            yield f"data: {json.dumps({'status': 'retrieving', 'rewritten_query': ctx['rewritten_query']})}\n\n"

            top_chunks = ctx["top_chunks"]
            top_chunk_texts = [c["text"] for c in top_chunks]

            contradiction_task = asyncio.ensure_future(
                groq_service.detect_contradictions(top_chunk_texts)
            )

            yield f"data: {json.dumps({'status': 'generating'})}\n\n"

            context = "\n\n".join(
                [f"[Source {i+1}]: {chunk}" for i, chunk in enumerate(top_chunk_texts)]
            )
            history = ctx["conversation_history"]
            history_text = (
                "\n".join(
                    [f"{m['role'].capitalize()}: {m['content'][:300]}" for m in history[-6:]]
                )
                if history
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

            try:
                has_contradiction, contradiction_desc = await contradiction_task
            except Exception:
                has_contradiction, contradiction_desc = False, ""

            try:
                is_grounded, crag_note = await groq_service.self_evaluate(full_answer, top_chunk_texts)
            except Exception:
                is_grounded, crag_note = True, ""

            sources = list(set([c["doc_name"] for c in top_chunks]))
            await _persist_session(body.session_id, history, body.query, full_answer, sources, ctx["confidence"])

            final = {
                "done": True,
                "answer": full_answer,
                "confidence": ctx["confidence"],
                "has_contradiction": has_contradiction,
                "contradiction_description": contradiction_desc,
                "sources": sources,
                "source_chunks": [
                    {"text": c["text"][:300], "doc_name": c["doc_name"]} for c in top_chunks
                ],
                "is_grounded": is_grounded,
                "crag_note": crag_note,
                "rewritten_query": ctx["rewritten_query"],
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


@router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    session = await db.sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        return {"id": session_id, "messages": []}
    return session
