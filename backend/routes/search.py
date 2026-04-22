"""Keyword search within uploaded documents with highlighted snippets."""
import re
from fastapi import APIRouter, HTTPException, Request

from deps import db, limiter
from models import SearchRequest

router = APIRouter()

SNIPPET_RADIUS = 140  # chars of context on each side of a match


def _build_snippets(text: str, query_pattern: re.Pattern, max_snippets: int = 3):
    """Return list of snippet dicts with before/match/after segments around query hits."""
    snippets = []
    for m in list(query_pattern.finditer(text))[:max_snippets]:
        start = max(0, m.start() - SNIPPET_RADIUS)
        end = min(len(text), m.end() + SNIPPET_RADIUS)
        before = text[start:m.start()]
        match = text[m.start():m.end()]
        after = text[m.end():end]
        snippets.append({
            "before": ("…" if start > 0 else "") + before,
            "match": match,
            "after": after + ("…" if end < len(text) else ""),
        })
    return snippets


@router.post("/search")
@limiter.limit("40/minute")
async def keyword_search(request: Request, body: SearchRequest):
    q = body.query.strip()
    if not q:
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
    if len(q) < 2:
        raise HTTPException(status_code=400, detail="Query must be at least 2 characters.")

    # Case-insensitive regex with escaping
    try:
        pattern = re.compile(re.escape(q), re.IGNORECASE)
    except re.error:
        raise HTTPException(status_code=400, detail="Invalid search query.")

    chunk_filter = {}
    if body.doc_ids:
        chunk_filter["doc_id"] = {"$in": body.doc_ids}

    # Mongo $regex prefilter to reduce scanned docs (case-insensitive)
    chunk_filter["text"] = {"$regex": re.escape(q), "$options": "i"}

    chunks = await db.chunks.find(
        chunk_filter, {"_id": 0, "text": 1, "doc_id": 1, "doc_name": 1, "chunk_index": 1}
    ).to_list(body.max_results * 4)

    # Group by doc_id
    by_doc = {}
    total_matches = 0
    for c in chunks:
        snippets = _build_snippets(c["text"], pattern)
        if not snippets:
            continue
        doc_entry = by_doc.setdefault(
            c["doc_id"],
            {"doc_id": c["doc_id"], "doc_name": c["doc_name"], "match_count": 0, "hits": []},
        )
        doc_entry["match_count"] += len(pattern.findall(c["text"]))
        doc_entry["hits"].append({
            "chunk_index": c.get("chunk_index", 0),
            "snippets": snippets,
        })
        total_matches += len(snippets)
        if total_matches >= body.max_results:
            break

    # Sort docs by match count, hits by chunk index
    results = sorted(by_doc.values(), key=lambda d: -d["match_count"])
    for d in results:
        d["hits"].sort(key=lambda h: h["chunk_index"])

    return {
        "query": q,
        "total_matches": total_matches,
        "doc_count": len(results),
        "results": results,
    }
