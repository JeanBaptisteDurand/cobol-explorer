"""web_search tool: external context (e.g. an insurance regulation).

Uses Tavily if ``TAVILY_API_KEY`` is set (agent-grade), else a key-free
DuckDuckGo lite fallback so the tool always works for a student demo.
"""
from __future__ import annotations

import html
import os
import re

import requests


def web_search(query: str, max_results: int = 5) -> list[dict]:
    key = os.environ.get("TAVILY_API_KEY")
    if key:
        try:
            r = requests.post(
                "https://api.tavily.com/search",
                json={"api_key": key, "query": query, "max_results": max_results},
                timeout=15,
            )
            data = r.json()
            return [
                {"title": x.get("title"), "url": x.get("url"), "snippet": (x.get("content") or "")[:200]}
                for x in data.get("results", [])
            ]
        except Exception:
            pass
    # key-free fallback
    try:
        r = requests.get(
            "https://lite.duckduckgo.com/lite/",
            params={"q": query},
            headers={"User-Agent": "Mozilla/5.0 (cobol-explorer)"},
            timeout=15,
        )
        rows = re.findall(r'<a[^>]+class="result-link"[^>]*href="([^"]+)"[^>]*>(.*?)</a>', r.text, re.S)
        if not rows:
            rows = re.findall(r'<a rel="nofollow"[^>]+href="([^"]+)"[^>]*>(.*?)</a>', r.text, re.S)
        out = []
        for url, title in rows[:max_results]:
            out.append({"title": html.unescape(re.sub("<[^>]+>", "", title)).strip(), "url": url, "snippet": ""})
        return out or [{"title": "no results", "url": "", "snippet": ""}]
    except Exception as exc:
        return [{"title": "web search unavailable", "url": "", "snippet": str(exc)}]
