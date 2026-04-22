import json
import logging
from groq import AsyncGroq

logger = logging.getLogger(__name__)


class GroqService:
    def __init__(self, api_key: str):
        self.client = AsyncGroq(api_key=api_key)
        self.fast_model = "llama-3.1-8b-instant"
        self.main_model = "llama-3.3-70b-versatile"

    async def rewrite_query(self, query: str, conversation_history: list) -> str:
        context = ""
        if conversation_history:
            recent = conversation_history[-4:]
            context = "\n".join(
                [f"{m['role'].capitalize()}: {m['content'][:200]}" for m in recent]
            )

        prompt = f"""Rewrite the following question into a precise search query that retrieves the most relevant information.

Previous conversation:
{context if context else "None"}

Question: {query}

Return ONLY the rewritten search query, nothing else. Keep it concise."""

        try:
            response = await self.client.chat.completions.create(
                model=self.fast_model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=100,
                temperature=0,
            )
            rewritten = response.choices[0].message.content.strip()
            return rewritten if rewritten else query
        except Exception as e:
            logger.error(f"Query rewriting failed: {e}")
            return query

    async def generate_answer(
        self, query: str, context_chunks: list, conversation_history: list
    ) -> str:
        context = "\n\n".join(
            [f"[Source {i+1}]: {chunk}" for i, chunk in enumerate(context_chunks)]
        )

        history_text = ""
        if conversation_history:
            recent = conversation_history[-6:]
            history_text = "\n".join(
                [f"{m['role'].capitalize()}: {m['content'][:300]}" for m in recent]
            )

        system = """You are a precise document analysis assistant. Answer questions based solely on the provided context.
Rules:
- Use ONLY information from the provided context
- Cite sources using [Source N] notation inline
- If context doesn't contain enough information, clearly state this
- Be comprehensive yet concise
- Use previous conversation context for follow-up questions"""

        user_msg = f"""Previous conversation:
{history_text if history_text else "None"}

Context from documents:
{context}

Question: {query}

Answer:"""

        try:
            response = await self.client.chat.completions.create(
                model=self.main_model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user_msg},
                ],
                max_tokens=800,
                temperature=0.1,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"Answer generation failed: {e}")
            return f"Error generating answer: {str(e)}"

    async def detect_contradictions(self, chunks: list) -> tuple:
        if len(chunks) < 2:
            return False, ""

        context = "\n\n".join(
            [f"[Chunk {i+1}]: {chunk[:300]}" for i, chunk in enumerate(chunks[:5])]
        )

        prompt = f"""Analyze these document excerpts for contradictory or conflicting information on the same topic.

{context}

Respond in JSON only:
{{"has_contradiction": true or false, "description": "brief description if contradiction found, empty string if not"}}"""

        try:
            response = await self.client.chat.completions.create(
                model=self.fast_model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=200,
                temperature=0,
            )
            text = response.choices[0].message.content.strip()
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                result = json.loads(text[start:end])
                return result.get("has_contradiction", False), result.get(
                    "description", ""
                )
        except Exception as e:
            logger.error(f"Contradiction detection failed: {e}")
        return False, ""

    async def self_evaluate(self, answer: str, context_chunks: list) -> tuple:
        """CRAG: Check if answer is grounded in the context."""
        context = "\n\n".join(
            [
                f"[Source {i+1}]: {chunk[:300]}"
                for i, chunk in enumerate(context_chunks)
            ]
        )

        prompt = f"""Evaluate whether this answer is fully supported by the provided context.

Context:
{context}

Answer: {answer}

Respond in JSON only:
{{"is_grounded": true or false, "note": "brief note if answer contains unsupported claims, otherwise empty string"}}"""

        try:
            response = await self.client.chat.completions.create(
                model=self.fast_model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=150,
                temperature=0,
            )
            text = response.choices[0].message.content.strip()
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                result = json.loads(text[start:end])
                return result.get("is_grounded", True), result.get("note", "")
        except Exception as e:
            logger.error(f"Self-evaluation failed: {e}")
        return True, ""

    async def generate_compare_answer(
        self, query: str, context_chunks: list, doc_name: str
    ) -> str:
        context = "\n\n".join(
            [f"[Excerpt {i+1}]: {chunk}" for i, chunk in enumerate(context_chunks)]
        )

        prompt = f"""Based on the following excerpts from "{doc_name}", answer this question concisely:

Question: {query}

Excerpts:
{context}

Answer:"""

        try:
            response = await self.client.chat.completions.create(
                model=self.main_model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=500,
                temperature=0.1,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"Compare answer generation failed: {e}")
            return f"Error: {str(e)}"
