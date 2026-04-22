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


def fetch_url_content(url: str) -> tuple:
    """
    Fetch a webpage and extract clean text using trafilatura (with BeautifulSoup fallback).
    Returns (page_title, clean_text).
    """
    import requests
    from urllib.parse import urlparse

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )
    }

    try:
        resp = requests.get(url, headers=headers, timeout=15, allow_redirects=True)
        resp.raise_for_status()
    except requests.exceptions.ConnectionError:
        raise ValueError("Could not reach the URL. Check the address and try again.")
    except requests.exceptions.Timeout:
        raise ValueError("Request timed out. The server took too long to respond.")
    except requests.exceptions.HTTPError as e:
        raise ValueError(f"URL returned an error: {e}")
    except Exception as e:
        raise ValueError(f"Failed to fetch URL: {e}")

    html = resp.text
    title = _extract_title(html, url)

    # --- Try trafilatura first (best for articles/blogs) ---
    try:
        import trafilatura

        extracted = trafilatura.extract(
            html,
            include_tables=True,
            include_links=False,
            include_images=False,
            no_fallback=False,
        )
        if extracted and len(extracted.strip()) > 200:
            full_text = (
                f"{title}\n\n{extracted}"
                if title and title not in extracted[:200]
                else extracted
            )
            return title, full_text
    except Exception:
        pass

    # --- Fallback: BeautifulSoup ---
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(
        ["script", "style", "nav", "footer", "header",
         "aside", "noscript", "iframe", "form", "button"]
    ):
        tag.decompose()

    raw = soup.get_text(separator="\n", strip=True)
    lines = [ln.strip() for ln in raw.split("\n") if len(ln.strip()) > 15]
    text = "\n".join(lines)

    if title and title not in text[:200]:
        text = f"{title}\n\n{text}"

    if len(text.strip()) < 100:
        raise ValueError("Could not extract meaningful text from this page.")

    return title, text


def _extract_title(html: str, fallback_url: str) -> str:
    from bs4 import BeautifulSoup
    from urllib.parse import urlparse

    try:
        soup = BeautifulSoup(html, "html.parser")
        tag = soup.find("title")
        if tag and tag.text.strip():
            t = tag.text.strip()
            return t[:80] + ("…" if len(t) > 80 else "")
    except Exception:
        pass

    return urlparse(fallback_url).netloc
