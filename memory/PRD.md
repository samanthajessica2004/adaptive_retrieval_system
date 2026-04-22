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
13. Light/clean soft-glassmorphism design (indigo-cyan gradient accents, IBM Plex Sans + Cabinet Grotesk)

## What's Been Implemented (2026-02)

### Backend Refactor (2026-02-22)
- `server.py` reduced from 585 → 33 lines (just app bootstrap + CORS + shutdown)
- New modules: `deps.py` (singletons), `models.py` (pydantic), `routes/__init__.py` (aggregator)
- Split into `routes/{documents,chat,compare,visualize,export,search}.py`
- Shared retrieval helpers `_retrieve_top_chunks` + `_persist_session` in `routes/chat.py`
- Tests live at `/app/backend/tests/test_rag_api.py`

### New Features (2026-02-22)
- **POST /api/search** — Case-insensitive keyword search across chunks with Mongo `$regex` prefilter, returns per-doc groups with `match_count` and contextual snippets (`before`, `match`, `after` segments). Optional `doc_ids` filter, 40/min rate limit.
- **POST /api/compare (URL extension)** — `CompareRequest` now accepts optional `url` field. Live-fetches URL via trafilatura (not persisted), chunks + embeds in-memory, compares alongside selected docs. Returns entry keyed `__url__{domain}` with `is_external: true` + `source_url`.
- **SearchTab** (new 4th tab) — Pill-shaped search bar, doc filter chips, highlighted `<mark>` snippets with yellow-underline style, per-doc cards with match count pill.
- **CompareTab inline URL chip** — Purple dashed "+ Compare vs URL" chip expands into a URL input with remove button; submits alongside doc comparison. URL result pane shows "EXTERNAL" pill and clickable source URL.

### UI Overhaul — Soft Glassmorphism (2026-02-22)
- Mesh gradient canvas with ambient blobs (indigo, cyan, violet, rose) + noise overlay
- Frosted glass panels for Sidebar / Tab bar / Tab content with `backdrop-filter: blur(24px) saturate(180%)`
- Pill-style tabs with active indigo→cyan gradient
- Message bubbles: user (indigo gradient), AI (glass card with soft shadow + rounded 18px)
- Gradient send button, gradient text titles, animated floating empty-state icon
- Source chunks removed from Chat UI (per user request); confidence bar, source pills, grounded badge retained

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
1. **P2 — Bulk upload**: drag multiple files at once into the upload zone
2. **P3 — Shareable chat links**: generate read-only session URLs for team sharing
3. **P3 — Named entity highlighting** in retrieved chunks
4. **P3 — Saved search / recent queries** history panel
