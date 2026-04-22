"""Conversation PDF export."""
import asyncio
import io

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from deps import db
from models import ExportRequest
from pdf_export import generate_pdf

router = APIRouter()


@router.post("/export/pdf")
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
