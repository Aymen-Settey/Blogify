"""Extract plain text from Tiptap JSON content."""
from __future__ import annotations


def extract_text(node: dict | list | None) -> str:
    """Recursively extract plain text from a Tiptap document JSON."""
    if not node:
        return ""
    if isinstance(node, list):
        return " ".join(extract_text(n) for n in node if n)
    if isinstance(node, dict):
        parts: list[str] = []
        text = node.get("text")
        if isinstance(text, str):
            parts.append(text)
        children = node.get("content")
        if children:
            parts.append(extract_text(children))
        # Add a space after block-level nodes to preserve sentence boundaries
        node_type = node.get("type")
        if node_type in {"paragraph", "heading", "blockquote", "listItem", "codeBlock"}:
            parts.append(" ")
        return " ".join(p for p in parts if p)
    return ""


def extract_paragraphs(node: dict | list | None) -> list[str]:
    """Extract block-level text chunks (paragraphs, headings) as separate strings."""
    chunks: list[str] = []

    def walk(n: dict | list | None) -> None:
        if not n:
            return
        if isinstance(n, list):
            for child in n:
                walk(child)
            return
        if isinstance(n, dict):
            node_type = n.get("type")
            if node_type in {"paragraph", "heading", "blockquote", "codeBlock", "listItem"}:
                text = extract_text(n.get("content")).strip()
                if text:
                    chunks.append(text)
                return
            walk(n.get("content"))

    walk(node)
    return chunks
