"""FastAPI service: graph, grounded impact, agentic chat (SSE), change-sets, source.

Endpoints
- GET  /api/health
- GET  /api/graph                         -> the mainframe dependency graph
- GET  /api/source?file=&start=&end=      -> exact source lines (citation)
- GET  /api/impact?node=LGPOLICY          -> deterministic grounded impact + trace (instant)
- POST /api/ask {question}                -> agentic RAG, SSE stream of trace + answer
- GET  /api/changesets                    -> list versions
- POST /api/changesets {title, author}    -> create a version
- GET  /api/changesets/{id}
- GET  /api/changesets/{id}/file?path=    -> effective content of a file in the version
- POST /api/changesets/{id}/edit {path, content, note}
- GET  /api/changesets/{id}/diff?path=
- POST /api/changesets/{id}/impact        -> recompute impact of the version
- POST /api/changesets/{id}/comment {author, text}
- POST /api/changesets/{id}/status {status}
"""
from __future__ import annotations

import asyncio
import json
import os
import threading
import urllib.parse
from dataclasses import asdict

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from agent.responder import answer_copybook_impact
from agent.tools import GraphTools
from agent.verify import verify_answer
from security import mailer, oidc, rbac, tokens, users
from security.audit import AuditLog
from security.identity import identify
from versioning.changeset import ChangeSet, VersionStore
from versioning.git_store import MergeConflict

GRAPH = os.environ.get("COBOL_EXPLORER_GRAPH", "graph.json")
CORPUS = os.environ.get("COBOL_EXPLORER_CORPUS", "corpora")
VERSIONS = os.environ.get("COBOL_EXPLORER_VERSIONS", "versions")
INDEX = os.environ.get("COBOL_EXPLORER_INDEX", "index.json")
VECTOR = os.environ.get("COBOL_EXPLORER_VECTOR", "json")
WEB_DIST = os.environ.get("COBOL_EXPLORER_WEB", "web/dist")
# open (default demo) · jwt (the app logs users in itself) · enforce (SSO reverse proxy)
AUTH_MODE = os.environ.get("COBOL_EXPLORER_AUTH", "open").lower()
ENFORCE = AUTH_MODE == "enforce"
JWT_MODE = AUTH_MODE == "jwt"
PROXY_SECRET = os.environ.get("COBOL_EXPLORER_PROXY_SECRET", "")
AUDIT = AuditLog()

# --- Multi-system: analyze several mainframe estates, switch between them ---
# Each system has its own graph + corpus + semantic index + version store. The
# default (genapp) keeps the existing paths so nothing changes for it. CardDemo
# (AWS, Apache-2.0) is a second, richer estate — real batch/JCL/VSAM.
SYSTEMS: dict[str, dict] = {
    "genapp": {
        "label": "GenApp", "detail": "insurance — underwriting, claims, policies",
        "graph": GRAPH, "corpus": CORPUS, "index": INDEX, "versions": VERSIONS, "vector": VECTOR,
    },
    "carddemo": {
        "label": "CardDemo", "detail": "AWS · credit cards — batch + CICS + VSAM",
        "graph": "systems/carddemo/graph.json", "corpus": "systems/carddemo/corpus",
        "index": "systems/carddemo/index.json", "versions": "systems/carddemo/versions",
        "vector": "json", "readonly": True,  # analyze-only second estate
    },
}
# Keep only systems whose graph is actually built (missing corpus never breaks startup).
SYSTEMS = {k: v for k, v in SYSTEMS.items() if os.path.exists(v["graph"])}
DEFAULT_SYSTEM = "genapp" if "genapp" in SYSTEMS else next(iter(SYSTEMS), "genapp")
_ACTIVE_SYSTEM = DEFAULT_SYSTEM


def active_cfg() -> dict:
    """Config (graph/corpus/index/versions/vector) of the currently selected system."""
    return SYSTEMS.get(_ACTIVE_SYSTEM) or {"graph": GRAPH, "corpus": CORPUS, "index": INDEX, "versions": VERSIONS, "vector": VECTOR}


def gate(request: Request, action: str, target: str = "") -> dict:
    """Identify the caller, enforce RBAC (opt-in), and write an immutable audit line.

    In jwt mode a valid signed token is required; in enforce mode identity headers are
    trusted only from an authenticating proxy presenting the shared secret. Every
    attempt (granted, denied OR rejected) is audited.
    """
    if ENFORCE and (not PROXY_SECRET or request.headers.get("x-cobol-proxy-secret") != PROXY_SECRET):
        AUDIT.record("?", "guest", action, target, result="rejected")
        raise HTTPException(401, "authentication required (enforce): trusted proxy missing")
    if JWT_MODE and not tokens.read(tokens.bearer(request.headers)):
        AUDIT.record("?", "guest", action, target, result="rejected")
        raise HTTPException(401, "authentication required: token missing, invalid or expired")
    actor = identify(request.headers)
    if (ENFORCE or JWT_MODE) and not rbac.allowed(actor["role"], action):
        AUDIT.record(actor["name"], actor["role"], action, target, result="denied")
        raise HTTPException(403, f"role '{actor['role']}' is not allowed to '{action}'")
    AUDIT.record(actor["name"], actor["role"], action, target)
    return actor

app = FastAPI(title="COBOL Explorer")
# Same-origin app; allow only the local dev/prod origins (not '*'), so a random
# site cannot drive the API via the browser.
_ORIGINS = os.environ.get(
    "COBOL_EXPLORER_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000,http://127.0.0.1:8000",
).split(",")
app.add_middleware(
    CORSMiddleware, allow_origins=_ORIGINS, allow_methods=["*"], allow_headers=["*"]
)


@app.middleware("http")
async def _no_cache_html(request, call_next):
    """Never let the browser cache the SPA shell (index.html). Vite content-hashes
    JS/CSS, so a cached index.html points at a stale bundle → the app 'looks buggy'
    until a hard refresh. The hashed /assets/* stay cacheable (they're immutable)."""
    resp = await call_next(request)
    if resp.headers.get("content-type", "").startswith("text/html"):
        resp.headers["Cache-Control"] = "no-cache, must-revalidate"
    return resp


def tools() -> GraphTools:
    c = active_cfg()
    return GraphTools(c["graph"], c["corpus"], c.get("index", "index.json"), vector_backend=c.get("vector"))


_STORES: dict[str, VersionStore] = {}
_STORE_LOCK = threading.Lock()
_REFRESH_LOCK = threading.Lock()


def store() -> VersionStore:
    """Per-system versioning backend, cached for the whole process.

    Critical for team concurrency: the git store serialises its (shared, mutable)
    working tree with one ``threading.Lock``. If we built a NEW store per request
    the lock would be per-instance and useless — two requests would run ``git
    checkout`` on the same tree at once and cross-contaminate branches. So each
    system's store is a singleton; its lock is the process-wide mutex for that tree.
    """
    key = _ACTIVE_SYSTEM
    if key not in _STORES:
        with _STORE_LOCK:
            if key not in _STORES:
                c = active_cfg()
                if os.environ.get("COBOL_EXPLORER_VCS", "git").lower() == "git":
                    from versioning.git_store import GitVersionStore

                    _STORES[key] = GitVersionStore(c["versions"], c["corpus"])
                else:
                    _STORES[key] = VersionStore(c["versions"], c["corpus"])
    return _STORES[key]


def cs_payload(s: VersionStore, cid: str) -> dict:
    """ChangeSet + its git sync state (behind/ahead vs main) for the UI."""
    d = asdict(s.get(cid))
    try:
        d["sync"] = s.sync_state(cid)
    except Exception:
        d["sync"] = None
    return d


# --- read ---
@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "graph": os.path.exists(active_cfg()["graph"])}


# --- authentication ---
class LoginBody(BaseModel):
    username: str
    password: str


@app.get("/api/auth/config")
def auth_config() -> dict:
    """What the front end needs to know before showing anything: is a login required?

    Ungated on purpose — it carries no user data, only the mode the server runs in.
    """
    return {
        "mode": AUTH_MODE, "required": JWT_MODE, "roles": list(users.SIGNUP_ROLES),
        "email_verification": mailer.ready(), "ibm_sign_in": oidc.ready(),
    }


@app.post("/api/login")
def login(body: LoginBody) -> dict:
    """Exchange credentials for a signed bearer token. Both outcomes are audited."""
    try:
        actor = users.authenticate(body.username, body.password)
    except users.UnverifiedAccount:
        AUDIT.record(body.username, "guest", "login", target="unverified", result="denied")
        raise HTTPException(403, {"code": "unverified", "message": "confirm your e-mail address first — check your inbox"})
    if not actor:
        AUDIT.record(body.username or "?", "guest", "login", target="", result="denied")
        raise HTTPException(401, "invalid credentials")
    AUDIT.record(actor["name"], actor["role"], "login")
    return {"token": tokens.mint(actor["name"], actor["role"]), "expires_in": tokens.TTL, **actor}


class SignupBody(BaseModel):
    username: str
    password: str
    display: str = ""
    role: str = "dev"
    email: str = ""


@app.post("/api/signup")
def signup(body: SignupBody) -> dict:
    """Register a visitor.

    With a mail relay configured the account is created **unverified** and a
    confirmation link is sent; without one, verification is disabled and the visitor
    is signed in immediately. The response says which of the two happened, so the UI
    never claims an e-mail was sent when it was not.
    """
    needs_email = mailer.ready()
    try:
        actor = users.create_account(
            body.username, body.password, body.display, body.role,
            email=body.email, verified=not needs_email,
        )
    except users.SignupError as exc:
        AUDIT.record(body.username or "?", "guest", "signup", target=str(exc), result="denied")
        raise HTTPException(400, str(exc))

    if not needs_email:
        AUDIT.record(actor["name"], actor["role"], "signup")
        return {
            "token": tokens.mint(actor["name"], actor["role"]), "expires_in": tokens.TTL,
            "name": actor["name"], "role": actor["role"], "verification_required": False,
        }

    sent = mailer.send_verification(body.email, actor["name"], actor["token"])
    AUDIT.record(actor["name"], actor["role"], "signup", target=f"verification sent={sent}")
    if not sent:
        raise HTTPException(502, "account created, but the confirmation e-mail could not be sent — try signing in later to receive a new link")
    return {"verification_required": True, "email": body.email, "name": actor["name"], "role": actor["role"]}


@app.get("/api/auth/ibm")
def ibm_sign_in():
    """Start “Sign in with IBM” — hand the browser to IBM Cloud App ID."""
    if not oidc.ready():
        raise HTTPException(503, "IBM sign-in is not configured on this deployment")
    return RedirectResponse(oidc.authorization_url(oidc.new_state()), status_code=303)


@app.get("/api/auth/ibm/callback")
def ibm_callback(code: str = "", state: str = "", error: str = ""):
    """Come back from IBM with an authorization code, leave with our own token.

    The token is handed to the SPA in the URL fragment: a fragment is never sent to a
    server, never lands in an access log, and never leaks through the Referer header.
    """
    if error or not code:
        AUDIT.record("?", "guest", "login", target=f"ibm:{error or 'no code'}", result="denied")
        return RedirectResponse("/?ibm=failed", status_code=303)
    if not oidc.valid_state(state):
        AUDIT.record("?", "guest", "login", target="ibm:bad state", result="rejected")
        return RedirectResponse("/?ibm=failed", status_code=303)

    actor = oidc.exchange(code)
    if not actor:
        AUDIT.record("?", "guest", "login", target="ibm:exchange failed", result="denied")
        return RedirectResponse("/?ibm=failed", status_code=303)

    AUDIT.record(actor["name"], actor["role"], "login", target="ibm")
    token = tokens.mint(actor["name"], actor["role"])
    fragment = urllib.parse.urlencode({"token": token, "name": actor["name"], "role": actor["role"]})
    return RedirectResponse(f"/#{fragment}", status_code=303)


@app.get("/api/verify")
def verify_email(token: str):
    """Consume a confirmation link and send the visitor back to the front door."""
    actor = users.verify(token)
    if not actor:
        AUDIT.record("?", "guest", "verify", target="invalid or expired", result="denied")
        return RedirectResponse("/?verified=expired", status_code=303)
    AUDIT.record(actor["name"], actor["role"], "verify")
    return RedirectResponse("/?verified=1", status_code=303)


@app.get("/api/me")
def me(request: Request) -> dict:
    """Who the server thinks you are — the identity every audit line will carry."""
    actor = identify(request.headers)
    return {**actor, "authenticated": bool(tokens.read(tokens.bearer(request.headers)))}


@app.get("/api/systems")
def systems_list() -> dict:
    """The mainframe estates available to analyze + which one is active."""
    def stat(c: dict) -> dict:
        try:
            with open(c["graph"]) as fh:
                g = json.load(fh)
            return {"nodes": g["stats"]["nodes"], "edges": g["stats"]["edges"]}
        except Exception:
            return {"nodes": 0, "edges": 0}
    return {
        "active": _ACTIVE_SYSTEM,
        "systems": [{"id": k, "label": v["label"], "detail": v.get("detail", ""), "readonly": bool(v.get("readonly")), **stat(v)} for k, v in SYSTEMS.items()],
    }


class SystemBody(BaseModel):
    id: str


@app.post("/api/system")
def system_set(body: SystemBody) -> dict:
    """Switch the active mainframe estate (graph + corpus + index + versions)."""
    global _ACTIVE_SYSTEM
    if body.id not in SYSTEMS:
        raise HTTPException(404, f"unknown system: {body.id!r}")
    _ACTIVE_SYSTEM = body.id
    return {"active": _ACTIVE_SYSTEM, "label": SYSTEMS[_ACTIVE_SYSTEM]["label"]}


@app.get("/api/graph")
def graph(request: Request) -> dict:
    # health() advertises graph:false as a normal state (pre-ingest) — so a missing
    # graph is a 503 (not built yet), not an opaque 500.
    gate(request, "read", target="graph")
    gp = active_cfg()["graph"]
    if not os.path.exists(gp):
        raise HTTPException(503, "graph not built — run the ingestion (make ingest)")
    with open(gp) as fh:
        return json.load(fh)


@app.get("/api/source")
def source(file: str, request: Request, start: int = 1, end: int = 200) -> dict:
    """Exact source lines for a citation (path-confined; audited)."""
    gate(request, "read", target=f"source:{file}")
    return tools().read_source_lines(file, start, end)


@app.get("/api/file")
def file_full(path: str, request: Request) -> dict:
    """Full content of a corpus file (by corpus-relative path or basename)."""
    import glob

    from safe import safe_corpus_path

    gate(request, "read", target=f"file:{path}")
    corpus = active_cfg()["corpus"]
    p = safe_corpus_path(corpus, path)
    if not p or not os.path.exists(p):
        # fall back to a basename lookup *inside* the corpus only
        hits = glob.glob(os.path.join(os.path.realpath(corpus), "**", os.path.basename(path)), recursive=True)
        p = hits[0] if hits else None
    if not p or not os.path.exists(p):
        raise HTTPException(404, "file not found")
    with open(p, errors="replace") as fh:
        content = fh.read()
    return {"path": os.path.relpath(p, corpus), "name": os.path.basename(p), "content": content}


@app.get("/api/search")
def search(q: str, request: Request) -> dict:
    """Semantic code search (IBM Granite embeddings)."""
    gate(request, "read", target=f"search:{q[:60]}")
    return tools().search_code(q)


@app.get("/api/impact")
def impact(node: str, request: Request) -> dict:
    """Deterministic grounded impact for a copybook (instant, for the change UI)."""
    gate(request, "read", target=f"impact:{node}")
    c = active_cfg()
    res = answer_copybook_impact(node, c["graph"], c["corpus"])
    return {"answer": res["answer"], "impact": res["impact"], "trace": res["trace"].to_list()}


@app.get("/api/audit")
def audit(request: Request, n: int = 100) -> dict:
    """Immutable audit trail (who asked / changed what). Auditor/compliance in enforce mode."""
    gate(request, "audit", target="view")
    return {"entries": AUDIT.recent(n), "chain_intact": AUDIT.verify_chain()}


@app.get("/api/quality")
def quality(request: Request) -> dict:
    """Patrimony quality: orphan programs + unreferenced copybook files (dead code)."""
    gate(request, "read", target="quality")
    return tools().dead_code()


@app.get("/api/fields")
def fields(node: str, request: Request) -> dict:
    """Field-level view of a copybook: its data items + which programs reference each."""
    gate(request, "read", target=f"fields:{node}")
    return tools().copybook_fields(node)


# --- agentic chat (SSE) ---
class AskBody(BaseModel):
    question: str
    # recent turns [{role, text}] so follow-ups keep context (conversation memory)
    history: list[dict] | None = None


@app.post("/api/ask")
async def ask(body: AskBody, request: Request):
    gate(request, "ask", target=body.question[:120])
    cfg = active_cfg()  # snapshot the system now, so a switch mid-answer can't cross wires

    async def gen():
        import queue as _queue

        from agent.agent import run_agent

        yield {"event": "start", "data": json.dumps({"question": body.question})}
        loop = asyncio.get_event_loop()
        q: _queue.Queue = _queue.Queue()

        # Runs the (blocking) agent in a worker thread; each tool-call step is
        # pushed onto the queue the moment it is recorded, so the trace streams live.
        def worker():
            sources: list[str] = []

            def on_step(s):
                sources.extend(s.get("sources", []) or [])
                q.put(("trace", s))

            try:
                res = run_agent(body.question, cfg["graph"], cfg["corpus"], cfg["versions"], on_step=on_step, history=body.history, index_path=cfg.get("index", "index.json"), vector_backend=cfg.get("vector"))
                q.put(("answer", {"text": res["answer"]}))
            except Exception as exc:  # pragma: no cover
                q.put(("error", {"message": str(exc)}))
                q.put(("__done__", None))
                return
            # Citation guardrail runs in its own try — it must never clobber the answer.
            try:
                q.put(("verify", verify_answer(res["answer"], sources, cfg["corpus"])))
            except Exception:
                pass
            q.put(("__done__", None))

        fut = loop.run_in_executor(None, worker)
        while True:
            typ, data = await loop.run_in_executor(None, q.get)
            if typ == "__done__":
                break
            yield {"event": typ, "data": json.dumps(data)}
        await fut
        yield {"event": "done", "data": "{}"}

    return EventSourceResponse(gen())


# --- change-sets / versioning ---
class CreateCS(BaseModel):
    title: str
    author: str = "anonymous"
    base: str = "main"


class EditBody(BaseModel):
    path: str
    content: str
    note: str = ""


class CommentBody(BaseModel):
    author: str
    text: str


class StatusBody(BaseModel):
    status: str


def _writable() -> None:
    """Guard: some systems (e.g. CardDemo) are analyze-only — no versioning."""
    if active_cfg().get("readonly"):
        raise HTTPException(409, "read-only system — versioning is reserved for the primary estate")


@app.get("/api/changesets")
def list_cs(request: Request) -> list[dict]:
    gate(request, "read", target="changesets")
    if active_cfg().get("readonly"):  # analyze-only system: no versions, no git seeding
        return []
    s = store()
    return [cs_payload(s, c.id) for c in s.list()]


@app.post("/api/changesets")
def create_cs(body: CreateCS, request: Request) -> dict:
    gate(request, "propose", target=body.title)
    _writable()
    s = store()
    cs = s.create(body.title, body.author, body.base)
    return cs_payload(s, cs.id)


@app.get("/api/changesets/{cid}")
def get_cs(cid: str, request: Request) -> dict:
    gate(request, "read", target=f"changeset:{cid}")
    s = store()
    if not s.exists(cid):
        raise HTTPException(404, "changeset not found")
    return cs_payload(s, cid)


@app.get("/api/changesets/{cid}/file")
def cs_file(cid: str, path: str, request: Request) -> dict:
    gate(request, "read", target=f"{cid}:{path}")
    s = store()
    if not s.exists(cid):  # else read_effective silently falls back to main's content
        raise HTTPException(404, "changeset not found")
    return {"path": path, "content": s.read_effective(cid, path)}


def _safe_rel(path: str) -> None:
    """Reject a client path that escapes the corpus (path-traversal → arbitrary
    file write). Clean 400 before the path ever reaches the versioning store."""
    from safe import safe_corpus_path

    if not safe_corpus_path(active_cfg()["corpus"], path):
        raise HTTPException(400, "invalid path (outside the corpus)")


def _editable(s: VersionStore, cid: str) -> ChangeSet:
    """Guard: the version must exist and still be open (not merged)."""
    if not s.exists(cid):
        raise HTTPException(404, "changeset not found")
    cs = s.get(cid)
    if cs.status == "merged":
        raise HTTPException(409, "version already merged into main — it is read-only")
    return cs


@app.post("/api/changesets/{cid}/edit")
def cs_edit(cid: str, body: EditBody, request: Request) -> dict:
    gate(request, "edit", target=f"{cid}:{body.path}")
    _safe_rel(body.path)
    s = store()
    _editable(s, cid)
    s.add_edit(cid, body.path, body.content, body.note)
    s.compute_impact(cid, tools())
    return cs_payload(s, cid)


class RevertBody(BaseModel):
    path: str


@app.post("/api/changesets/{cid}/revert")
def cs_revert(cid: str, body: RevertBody, request: Request) -> dict:
    """Drop a file from the version — its content returns to the team version (main)."""
    gate(request, "edit", target=f"revert:{cid}:{body.path}")
    _safe_rel(body.path)
    s = store()
    _editable(s, cid)
    s.revert_edit(cid, body.path)
    s.compute_impact(cid, tools())
    return cs_payload(s, cid)


class SyncBody(BaseModel):
    # conflict resolution: None (fail on conflict) | 'mine' (keep my changes) | 'main' (take the team's)
    strategy: str | None = None


@app.post("/api/changesets/{cid}/sync")
def cs_sync(cid: str, request: Request, body: SyncBody | None = None) -> dict:
    """Import main (the team's merged work) into this version's branch."""
    gate(request, "edit", target=f"sync:{cid}")
    s = store()
    _editable(s, cid)
    try:
        s.sync_main(cid, strategy=(body.strategy if body else None))
    except ValueError as e:
        # Typed so the UI can offer the two resolutions without matching on wording.
        code = "conflict" if isinstance(e, MergeConflict) else "sync_failed"
        raise HTTPException(409, {"code": code, "message": str(e), "files": getattr(e, "files", [])})
    return cs_payload(s, cid)


@app.get("/api/changesets/{cid}/diff")
def cs_diff(cid: str, path: str, request: Request) -> dict:
    gate(request, "read", target=f"diff:{cid}:{path}")  # a diff leaks file content
    s = store()
    if not s.exists(cid):
        raise HTTPException(404, "changeset not found")
    return {"path": path, "diff": s.diff(cid, path)}


@app.post("/api/changesets/{cid}/summary")
def cs_summary(cid: str, request: Request) -> dict:
    """(Re)write the plain-language record of what this version changes."""
    gate(request, "read", target=f"summary:{cid}")
    s = store()
    if not s.exists(cid):
        raise HTTPException(404, "changeset not found")
    _write_summary(s, cid)
    return cs_payload(s, cid)


@app.post("/api/changesets/{cid}/impact")
def cs_impact(cid: str, request: Request) -> dict:
    gate(request, "read", target=f"impact:{cid}")
    s = store()
    if not s.exists(cid):
        raise HTTPException(404, "changeset not found")
    return s.compute_impact(cid, tools())


@app.post("/api/changesets/{cid}/comment")
def cs_comment(cid: str, body: CommentBody, request: Request) -> dict:
    gate(request, "comment", target=cid)
    s = store()
    if not s.exists(cid):
        raise HTTPException(404, "changeset not found")
    s.add_comment(cid, body.author, body.text)
    return cs_payload(s, cid)


def _refresh_from_main(s: VersionStore) -> None:
    """After a merge, propagate main into the read paths: rewrite the served corpus,
    then rebuild the dependency graph so impact/search reflect the new dependencies.
    Best-effort — a merge already succeeded in git, so failure here only logs."""
    if not hasattr(s, "export_main"):
        return
    c = active_cfg()
    # Serialize refreshes so two merges never interleave the corpus export + graph
    # rebuild. ingest writes graph.json atomically, so concurrent readers are safe.
    try:
        with _REFRESH_LOCK:
            s.export_main(c["corpus"])
            from run_ingest import ingest

            ingest(c["corpus"], c["graph"])
    except Exception as exc:  # noqa: BLE001 — never fail the merge on a refresh hiccup
        print(f"[warn] refresh after merge failed: {exc}")


_STATUSES = {"draft", "proposed", "merged", "rejected"}



def _write_summary(s: VersionStore, cid: str) -> dict:
    """Write the record of what a version changed. Never blocks the caller on failure."""
    from versioning import summarize

    cs = s.get(cid)
    diffs = {}
    for e in cs.edits:
        try:
            diffs[e["path"]] = s.diff(cid, e["path"])
        except Exception:
            continue
    try:
        result = summarize.summarize(cs, diffs)
    except Exception:
        result = {"text": summarize.deterministic(cs, diffs), "grounded": False}
    s.set_summary(cid, result)
    return result


@app.post("/api/changesets/{cid}/status")
def cs_status(cid: str, body: StatusBody, request: Request) -> dict:
    status = (body.status or "").strip().lower()
    if status not in _STATUSES:
        raise HTTPException(400, f"invalid status: {body.status!r} (expected: {', '.join(sorted(_STATUSES))})")
    body.status = status
    # Merging (applying to the patrimony) needs a stronger role than proposing.
    gate(request, "merge" if body.status == "merged" else "propose", target=f"{cid}:{body.status}")
    s = store()
    cs = s.get(cid) if s.exists(cid) else None
    if cs is None:
        raise HTTPException(404, "changeset not found")
    # A merged version is closed: no re-proposing, re-merging or status flip-flop.
    if cs.status == "merged":
        raise HTTPException(409, "version already merged into main — it is closed")
    if body.status == "merged":
        # Write the record BEFORE merging: once main carries the change, the diff of the
        # version against main is empty and there is nothing left to summarise.
        if not cs.summary:
            _write_summary(s, cid)
        # Real git merge onto main — refused (409) if the branch is behind main.
        try:
            s.merge_to_main(cid)
        except ValueError as e:
            raise HTTPException(409, str(e))
        _refresh_from_main(s)
    else:
        s.set_status(cid, body.status)
    return cs_payload(s, cid)


# --- static frontend (built) ---
if os.path.isdir(WEB_DIST):
    # The argument page lives at its own URL so it can be linked, bookmarked and
    # sent to someone. StaticFiles has no SPA fallback, and a catch-all would
    # swallow genuine 404s, so the one client route is named explicitly.
    @app.get("/presentation", include_in_schema=False)
    def presentation():
        return FileResponse(os.path.join(WEB_DIST, "index.html"))

    app.mount("/", StaticFiles(directory=WEB_DIST, html=True), name="web")
