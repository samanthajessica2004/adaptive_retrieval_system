"""Backend tests for Adaptive Retrieval RAG System"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Shared state for cross-test data
uploaded_doc_id = None
session_id = "test-session-" + str(int(time.time()))


class TestHealth:
    """Health check"""

    def test_health(self):
        res = requests.get(f"{BASE_URL}/api/health")
        assert res.status_code == 200
        assert res.json().get("status") == "ok"


class TestDocumentUpload:
    """Document upload and listing"""

    def test_upload_txt_file(self):
        global uploaded_doc_id
        txt_content = (
            "This is a test document about artificial intelligence. "
            "AI systems process large data to identify patterns. "
            "Machine learning enables computers to learn from experience."
        )
        files = {"file": ("test_ai.txt", txt_content.encode(), "text/plain")}
        res = requests.post(f"{BASE_URL}/api/documents/upload", files=files, timeout=90)
        assert res.status_code == 200, f"Upload failed: {res.text}"
        data = res.json()
        assert "id" in data
        assert "chunk_count" in data
        assert data["chunk_count"] > 0
        uploaded_doc_id = data["id"]
        print(f"Uploaded doc ID: {uploaded_doc_id}, chunks: {data['chunk_count']}")

    def test_list_documents(self):
        res = requests.get(f"{BASE_URL}/api/documents", timeout=30)
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        # Should have at least one document after upload
        assert len(data) >= 1
        # Check structure
        if data:
            doc = data[0]
            assert "id" in doc
            assert "name" in doc


class TestChat:
    """Chat endpoint"""

    def test_chat_no_docs(self):
        """Chat with empty doc_ids returns a helpful message"""
        res = requests.post(
            f"{BASE_URL}/api/chat",
            json={"query": "What is AI?", "session_id": session_id, "doc_ids": ["nonexistent-id"], "mode": "hybrid"},
            timeout=60,
        )
        assert res.status_code == 200
        data = res.json()
        assert "answer" in data
        assert "confidence" in data
        assert "rewritten_query" in data
        assert "sources" in data

    def test_chat_with_uploaded_doc(self):
        """Chat with a real document"""
        if not uploaded_doc_id:
            pytest.skip("No uploaded doc available")
        res = requests.post(
            f"{BASE_URL}/api/chat",
            json={
                "query": "What does this document discuss?",
                "session_id": session_id,
                "doc_ids": [uploaded_doc_id],
                "mode": "hybrid",
            },
            timeout=90,
        )
        assert res.status_code == 200
        data = res.json()
        assert "answer" in data
        assert isinstance(data["confidence"], float)
        assert "rewritten_query" in data
        assert "sources" in data
        assert "is_grounded" in data
        print(f"Answer: {data['answer'][:100]}, confidence: {data['confidence']}")


class TestCompare:
    """Compare endpoint"""

    def test_compare_missing_docs(self):
        res = requests.post(
            f"{BASE_URL}/api/compare",
            json={"query": "Tell me about AI", "doc_ids": []},
            timeout=30,
        )
        assert res.status_code == 400

    def test_compare_with_doc(self):
        if not uploaded_doc_id:
            pytest.skip("No uploaded doc available")
        res = requests.post(
            f"{BASE_URL}/api/compare",
            json={"query": "What is machine learning?", "doc_ids": [uploaded_doc_id]},
            timeout=90,
        )
        assert res.status_code == 200
        data = res.json()
        assert "results" in data


class TestVisualize:
    """Visualize endpoint"""

    def test_visualize_returns_data(self):
        res = requests.get(f"{BASE_URL}/api/visualize", timeout=60)
        assert res.status_code == 200
        data = res.json()
        assert "points" in data or "message" in data


class TestExportPDF:
    """Export PDF endpoint"""

    def test_export_pdf_no_session(self):
        res = requests.post(
            f"{BASE_URL}/api/export/pdf",
            json={"session_id": "nonexistent-session-xyz"},
            timeout=30,
        )
        assert res.status_code == 404

    def test_export_pdf_with_session(self):
        """Export PDF after having a conversation"""
        if not uploaded_doc_id:
            pytest.skip("No uploaded doc available")
        # First chat to create session
        requests.post(
            f"{BASE_URL}/api/chat",
            json={
                "query": "Tell me about AI",
                "session_id": session_id,
                "doc_ids": [uploaded_doc_id],
                "mode": "hybrid",
            },
            timeout=90,
        )
        # Now export
        res = requests.post(
            f"{BASE_URL}/api/export/pdf",
            json={"session_id": session_id},
            timeout=30,
        )
        assert res.status_code == 200
        assert res.headers.get("content-type") == "application/pdf"
        assert len(res.content) > 100
