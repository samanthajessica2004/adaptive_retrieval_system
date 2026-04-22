import fitz  # PyMuPDF
from docx import Document as DocxDocument
import re


def extract_text(file_path: str, file_ext: str) -> str:
    """Extract text from various document formats."""
    ext = file_ext.lower()

    if ext == "pdf":
        try:
            doc = fitz.open(file_path)
            text = ""
            for page in doc:
                text += page.get_text()
            doc.close()
            return text.strip()
        except Exception as e:
            raise ValueError(f"Failed to extract text from PDF: {e}")

    elif ext in ("docx", "doc"):
        try:
            doc = DocxDocument(file_path)
            paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
            return "\n".join(paragraphs)
        except Exception as e:
            raise ValueError(f"Failed to extract text from DOCX: {e}")

    elif ext in ("txt", "md", "csv"):
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()
        except Exception as e:
            raise ValueError(f"Failed to read text file: {e}")

    elif ext in ("html", "htm", "xml"):
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                text = f.read()
            text = re.sub(r"<[^>]+>", " ", text)
            text = re.sub(r"\s+", " ", text).strip()
            return text
        except Exception as e:
            raise ValueError(f"Failed to read HTML/XML file: {e}")

    else:
        # Try to read as plain text
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()
        except Exception:
            return ""
