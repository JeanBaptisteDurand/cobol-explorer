PY := .venv/bin/python
PP := PYTHONPATH=packages/core:ingestion:server

.PHONY: setup deps web ingest index test e2e serve mcp clean pgvector-up pgvector-load serve-pg neo4j-load serve-scale

setup: ## create venv (standalone python via uv) + install everything
	uv venv --python 3.12 .venv
	VIRTUAL_ENV=.venv uv pip install networkx pyyaml pytest fastapi "uvicorn[standard]" \
		sse-starlette requests beeai-framework ollama httpx "mcp[cli]" ibm-watsonx-ai
	cd web && pnpm install

ingest: ## parse corpus -> graph.json
	PYTHONPATH=packages/core:ingestion $(PY) -m run_ingest --corpus corpora --out graph.json

index: ## build the semantic index with IBM Granite embeddings -> index.json
	PYTHONPATH=packages/core:ingestion $(PY) -m build_index --graph graph.json --corpus corpora --out index.json

test: ## backend tests (LLM test skipped)
	COBOL_EXPLORER_SKIP_LLM=1 $(PY) -m pytest -q

eval: ## answer-quality regression (golden Q/A, deterministic)
	$(PP) $(PY) -m agent.eval

web: ## build the frontend
	cd web && pnpm build

serve: ## serve API + built frontend on :8000
	COBOL_EXPLORER_WEB=web/dist $(PP) $(PY) -m uvicorn api.app:app --host 127.0.0.1 --port 8000

serve-watsonx: ## serve with Granite hosted on IBM watsonx.ai instead of local Ollama
	COBOL_EXPLORER_MODEL=watsonx:ibm/granite-4-h-small COBOL_EXPLORER_WEB=web/dist \
		$(PP) $(PY) -m uvicorn api.app:app --host 127.0.0.1 --port 8000

serve-auth: ## same, with real authentication (login + signed token, RBAC from the claims)
	COBOL_EXPLORER_AUTH=jwt COBOL_EXPLORER_WEB=web/dist $(PP) $(PY) -m uvicorn api.app:app --host 127.0.0.1 --port 8000

e2e-governance: ## multi-account scenario (risk proposes, dev merges, auditor reads) — needs `make serve-auth`
	cd web && E2E_BASE_URL=$${E2E_BASE_URL:-http://127.0.0.1:8000} pnpm exec playwright test e2e/governance.spec.ts

mcp: ## run the MCP server (stdio) for IBM Bob
	$(PP) $(PY) -m mcp_server.server

pgvector-up: ## start PostgreSQL + pgvector (scale path for the vector RAG)
	docker compose up -d

pgvector-load: ## load the built index.json into pgvector
	$(PP) $(PY) ingestion/index/load_pgvector.py index.json

serve-pg: ## serve using pgvector as the vector backend
	COBOL_EXPLORER_VECTOR=pgvector COBOL_EXPLORER_WEB=web/dist $(PP) $(PY) -m uvicorn api.app:app --host 127.0.0.1 --port 8000

neo4j-load: ## load graph.json into Neo4j (self-hosted graph RAG)
	$(PP) $(PY) ingestion/graph/load_neo4j.py graph.json

serve-scale: ## serve at scale: Neo4j (graph) + pgvector (vector), both self-hosted
	COBOL_EXPLORER_GRAPH_BACKEND=neo4j COBOL_EXPLORER_VECTOR=pgvector \
		COBOL_EXPLORER_WEB=web/dist $(PP) $(PY) -m uvicorn api.app:app --host 127.0.0.1 --port 8000

e2e: ## playwright end-to-end tests (needs `make serve` running)
	cd web && pnpm exec playwright test

ask: ## CLI grounded hero answer, e.g. make ask N=LGPOLICY
	$(PP) $(PY) -m ask $(N)
