"""Embeddings via IBM Granite (Granite Embedding, served by Ollama).

Keeping the whole retrieval stack on IBM models: the vector side uses
``granite-embedding`` just like the agent uses ``granite3.3`` for reasoning.
"""
from __future__ import annotations

import os

MODEL = os.environ.get("COBOL_EXPLORER_EMBED_MODEL", "granite-embedding:278m")


def embed_text(text: str, model: str = MODEL) -> list[float]:
    import ollama

    return ollama.embed(model=model, input=text)["embeddings"][0]


def embed_texts(texts: list[str], model: str = MODEL) -> list[list[float]]:
    import ollama

    return [ollama.embed(model=model, input=t)["embeddings"][0] for t in texts]
