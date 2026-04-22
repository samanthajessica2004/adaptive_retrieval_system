# Adaptive Retrieval RAG System — PRD

## Problem Statement
Build a full-stack Adaptive Retrieval RAG (Retrieval-Augmented Generation) System that can extract and compare information from uploaded documents. Features include advanced search optimization, multi-document comparison, contradiction detection, confidence scoring, and external-source comparison.

## Architecture
- **Backend**: FastAPI (Python) + MongoDB (Motor async)
- **Frontend**: React + Tailwind CSS + Recharts
- **LLM**: Groq API (llama-3.3-70b-versatile for answers, llama-3.1-8b-instant for utility tasks)
- **Embeddings**: sentence-transformers/all-MiniLM-L6-v2 (local)
- **Reranking**: CrossEncoder/ms-marco-MiniLM-L-6-v2 (local)
- **Visualization**: UMAP + Recharts ScatterChart

## User Personas
- Researchers comparing papers
- Students extracting information from study materials
- Knowledge workers querying internal documents

## Core Requirements (Static)
1. Multi-format document upload (PDF, DOCX, TXT, MD, CSV, HTML)
2. Semantic chunking (topic-shift-based, not fixed-size)
3. Hybrid search (BM25 + Vector similarity)
4. CrossEncoder reranking of retrieved chunks
5. Query rewriting via Groq
6. Contradiction detection across chunks
7. Real confidence scoring based on retrieval scores
8. Conversation memory (last 20 messages stored in MongoDB)
9. Multi-document side-by-side comparison
10. CRAG self-evaluation (hallucination detection)
11. UMAP 2D document map visualization
12. Chat export to PDF (ReportLab)
13. Light/clean Swiss design (#002FA7 accent, IBM Plex Sans + Cabinet Grotesk)

## What's Been Implemented (2026-02)

### Backend
- `server.py` — All routes with rate limiting (slowapi), file size validation (50MB), streaming SSE `/api/chat/stream`, URL ingestion `/api/documents/ingest-url`
- `rag_engine.py` — Embeddings, semantic chunking, BM25, vector, hybrid search, CrossEncoder reranking, UMAP
- `groq_service.py` — Query rewriting, streaming answer generation, contradiction detection, CRAG self-evaluation
- `document_processor.py` — Text extraction (PDF/DOCX/TXT/MD/CSV/HTML) + `fetch_url_content()` via trafilatura/BeautifulSoup
- `pdf_export.py` — ReportLab PDF generation with styled conversation history

### Frontend
- `App.js` — Main layout, streaming `handleSendMessage` via SSE fetch, tabs rendered with display:none
- `Sidebar.jsx` — Document list, drag-and-drop upload, **URL ingestion input**, Globe icon for URL docs
- `ChatTab.jsx` — Mode switcher, streaming messages with blinking cursor, status labels, confidence bar, contradiction alerts, CRAG warnings
- `CompareTab.jsx` — Multi-document selector, side-by-side comparison grid
- `DocumentMapTab.jsx` — UMAP scatter chart, per-document colors, hover tooltips
- Emergent badge removed via CSS + JS observer

## Backlog

### P0 (Critical)
- None currently

### P1 (High Priority)
- File size validation on upload (limit to 10MB)
- Rate limiting on API endpoints
- Streaming responses for long answers

### P2 (Nice to Have)
- URL/web page ingestion (scrape + extract text)
- Advanced PDF with table extraction
- Named entity highlighting in chunks
- Bulk document upload (drag multiple files)
- Search history / saved queries

## Next Tasks
1. Test with real PDF documents
2. Add streaming response support for long answers
3. Add file size validation
4. Consider adding a "search within documents" feature
