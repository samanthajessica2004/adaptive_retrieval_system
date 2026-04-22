"""UMAP visualization endpoint."""
import asyncio
from fastapi import APIRouter

from deps import db, rag_engine

router = APIRouter()


@router.get("/visualize")
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
