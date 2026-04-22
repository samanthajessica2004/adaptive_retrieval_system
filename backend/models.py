"""Pydantic models shared across routes."""
from pydantic import BaseModel
from typing import List, Optional


class ChatRequest(BaseModel):
    query: str
    session_id: str
    doc_ids: Optional[List[str]] = []
    mode: str = "hybrid"


class IngestUrlRequest(BaseModel):
    url: str


class CompareRequest(BaseModel):
    query: str
    doc_ids: List[str] = []
    url: Optional[str] = None  # Optional inline URL to compare against


class ExportRequest(BaseModel):
    session_id: str


class SearchRequest(BaseModel):
    query: str
    doc_ids: Optional[List[str]] = []
    max_results: int = 50
