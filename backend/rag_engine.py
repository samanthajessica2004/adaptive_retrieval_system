import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.decomposition import PCA
from rank_bm25 import BM25Okapi
import re
import logging

logger = logging.getLogger(__name__)


class RagEngine:
    def __init__(self):
        self._embedding_model = None
        self._cross_encoder = None

    @property
    def embedding_model(self):
        if self._embedding_model is None:
            from sentence_transformers import SentenceTransformer
            logger.info("Loading SentenceTransformer model...")
            self._embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
            logger.info("SentenceTransformer model loaded.")
        return self._embedding_model

    @property
    def cross_encoder(self):
        if self._cross_encoder is None:
            from sentence_transformers import CrossEncoder
            logger.info("Loading CrossEncoder model...")
            self._cross_encoder = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
            logger.info("CrossEncoder model loaded.")
        return self._cross_encoder

    def get_embedding(self, text: str) -> list:
        return self.embedding_model.encode(text, normalize_embeddings=True).tolist()

    def get_embeddings(self, texts: list) -> list:
        if not texts:
            return []
        embeddings = self.embedding_model.encode(
            texts, normalize_embeddings=True, batch_size=32, show_progress_bar=False
        )
        return embeddings.tolist()

    def semantic_chunk(self, text: str) -> list:
        """Split text into semantically coherent chunks using topic-shift detection."""
        sentences = re.split(r"(?<=[.!?])\s+", text.strip())
        sentences = [s.strip() for s in sentences if len(s.strip()) > 20]

        if len(sentences) == 0:
            return [text] if text.strip() else []
        if len(sentences) <= 3:
            return [" ".join(sentences)]

        try:
            embeddings = self.embedding_model.encode(
                sentences, normalize_embeddings=True, show_progress_bar=False
            )
        except Exception:
            return self._fixed_chunk(text)

        chunks = []
        current_chunk = [sentences[0]]

        for i in range(1, len(sentences)):
            sim = float(
                cosine_similarity([embeddings[i - 1]], [embeddings[i]])[0][0]
            )
            if (sim < 0.45 and len(current_chunk) >= 3) or len(current_chunk) >= 10:
                chunks.append(" ".join(current_chunk))
                current_chunk = [sentences[i]]
            else:
                current_chunk.append(sentences[i])

        if current_chunk:
            chunks.append(" ".join(current_chunk))

        # Merge tiny chunks
        merged = []
        i = 0
        while i < len(chunks):
            if len(chunks[i].split()) < 25 and i + 1 < len(chunks):
                merged.append(chunks[i] + " " + chunks[i + 1])
                i += 2
            else:
                merged.append(chunks[i])
                i += 1

        return [c for c in merged if len(c.strip()) > 10]

    def _fixed_chunk(self, text: str, size: int = 500, overlap: int = 50) -> list:
        words = text.split()
        chunks = []
        for i in range(0, len(words), size - overlap):
            chunk = " ".join(words[i : i + size])
            if len(chunk.strip()) > 10:
                chunks.append(chunk)
        return chunks or [text]

    def vector_search(
        self, query_embedding: list, chunk_embeddings: list, top_k: int = 10
    ) -> list:
        if not chunk_embeddings:
            return []
        embs = np.array(chunk_embeddings)
        q_emb = np.array(query_embedding).reshape(1, -1)
        scores = cosine_similarity(q_emb, embs)[0]
        top_k = min(top_k, len(scores))
        top_indices = np.argsort(scores)[::-1][:top_k]
        return [(int(idx), float(scores[idx])) for idx in top_indices]

    def bm25_search(self, query: str, texts: list, top_k: int = 10) -> list:
        if not texts:
            return []
        tokenized_corpus = [t.lower().split() for t in texts]
        bm25 = BM25Okapi(tokenized_corpus)
        scores = bm25.get_scores(query.lower().split())
        top_k = min(top_k, len(scores))
        top_indices = np.argsort(scores)[::-1][:top_k]
        return [(int(idx), float(scores[idx])) for idx in top_indices]

    def hybrid_search(
        self,
        query: str,
        query_embedding: list,
        texts: list,
        chunk_embeddings: list,
        top_k: int = 10,
    ) -> list:
        vector_results = dict(
            self.vector_search(query_embedding, chunk_embeddings, top_k * 2)
        )
        bm25_results = dict(self.bm25_search(query, texts, top_k * 2))

        v_max = max(vector_results.values(), default=1) or 1
        b_max = max(bm25_results.values(), default=1) or 1

        all_indices = set(vector_results.keys()) | set(bm25_results.keys())
        combined = {}
        for idx in all_indices:
            v = vector_results.get(idx, 0) / v_max
            b = bm25_results.get(idx, 0) / b_max
            combined[idx] = 0.6 * v + 0.4 * b

        return sorted(combined.items(), key=lambda x: x[1], reverse=True)[:top_k]

    def rerank(self, query: str, texts: list, indices_scores: list) -> list:
        if not indices_scores:
            return []
        pairs = [(query, texts[idx]) for idx, _ in indices_scores]
        raw_scores = self.cross_encoder.predict(pairs)
        # Sigmoid to 0-1
        scores = 1 / (1 + np.exp(-raw_scores))
        reranked = sorted(
            zip([idx for idx, _ in indices_scores], scores.tolist()),
            key=lambda x: x[1],
            reverse=True,
        )
        return [(int(idx), float(score)) for idx, score in reranked]

    def compute_confidence(self, scores: list) -> float:
        if not scores:
            return 0.0
        top = [s for _, s in scores[:3]]
        return float(np.mean(top))

    def get_umap_coords(self, embeddings: list) -> list:
        n = len(embeddings)
        if n < 2:
            return [[0.0, 0.0] for _ in range(n)]

        arr = np.array(embeddings)

        try:
            from umap import UMAP
            n_neighbors = min(15, max(2, n - 1))
            reducer = UMAP(
                n_neighbors=n_neighbors,
                min_dist=0.1,
                n_components=2,
                metric="cosine",
                random_state=42,
            )
            coords = reducer.fit_transform(arr)
            return coords.tolist()
        except Exception as e:
            logger.warning(f"UMAP failed: {e}, falling back to PCA")

        try:
            n_components = min(2, arr.shape[1], n)
            pca = PCA(n_components=n_components)
            coords = pca.fit_transform(arr)
            if coords.shape[1] == 1:
                coords = np.hstack([coords, np.zeros((n, 1))])
            return coords.tolist()
        except Exception:
            return [[float(i), 0.0] for i in range(n)]
