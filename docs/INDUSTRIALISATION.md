# Industrialisation — du POC au produit vendable

> État actuel : POC honnête sur ~47 programmes (parsing regex, graphe NetworkX en mémoire,
> versioning JSON maison, RAG vectoriel cosinus in-process). Ce document trace le chemin
> réaliste vers un produit d'entreprise, avec des **outils réels** et un **phasage**.
> Rien ici n'est « fake » : les briques recommandées existent et sont éprouvées.

---

## 1. Parsing de qualité industrielle

### Le problème
Le parsing actuel (`ingestion/parsers/*.py`) est **regex**. Il tient sur GenApp mais casse sur du
COBOL réel : `COPY ... REPLACING`, programmes imbriqués (`nested programs`), `PERFORM THRU`,
`GO TO`, `CALL` dynamiques (`CALL identifier`), préprocesseurs `EXEC CICS/SQL/DLI/MQ`, colonnes
72/80, `CONTINUATION`, dialectes (IBM Enterprise COBOL vs GnuCOBOL vs MF).

### Recommandation : un vrai AST, pas des regex
**COBOL → [ProLeap COBOL Parser](https://github.com/uwol/proleap-cobol-parser) (ANTLR4, open source)**
ou **[Koopa](https://github.com/krisds/koopa)**. ProLeap fournit un AST + une couche ASG
(semantic graph) et gère préprocesseur COPY/REPLACE et EXEC CICS/SQL. JVM déjà présente
(cobol-rekt/JDK 21 est un prérequis optionnel du repo).

Architecture cible (déjà amorcée : les parsers sont derrière une interface) :
```
ingestion/parsers/
  base.py            # interface Parser: parse(path) -> list[Node], list[Edge]
  cobol_antlr.py     # NOUVEAU: bridge vers ProLeap (JVM via py4j/subprocess) -> AST -> extraction
  cobol.py           # regex actuel = FALLBACK rapide / mode dégradé sans JVM
```
On garde le regex comme **fallback** (mode démo sans JVM) et on bascule sur l'AST quand la JVM
est dispo — sélection par variable d'env, comme pour l'index vectoriel.

### Résolveur de copybooks (multi-bibliothèques)
Aujourd'hui : un copybook devient un nœud **uniquement s'il est référencé** (les 11 `.cpy` non
COPY'd du corpus sont invisibles — c'est pour ça que la détection de code mort les liste).
Cible :
- **Concaténation SYSLIB** : liste ordonnée de bibliothèques de copy, résolution first-match.
- **`COPY ... REPLACING`** : appliquer les substitutions avant extraction (sinon les champs sont faux).
- **COPY imbriqués** : expansion récursive (un copybook qui en COPY un autre).
- **Copybooks de tous les niveaux** : DATA, PROCEDURE, `EXEC SQL INCLUDE`.

### Multi-langages (au-delà du COBOL)
| Langage | Approche | Priorité |
|---|---|---|
| **JCL** | Expansion **PROC** (le `JclParser` crée 4 nœuds PROC mais **n'ouvre jamais le corps** → 0 `PROC_CONTAINS`). Ajouter : résolution des membres PROC, **substitution symbolique** (`&VAR`), `INCLUDE`, `DD *`/GDG. | Haute (batch = cœur assurance) |
| **PL/I** | Parser dédié (grammaire ANTLR PL/I) — `%INCLUDE`, procédures. | Moyenne |
| **Assembleur** | Macros/CSECT/CALL — analyse plus grossière (appels + DSECT). | Basse |
| **REXX / CLIST** | Extraction des `CALL`/`ADDRESS`/EXEC. | Basse |

### Phasage parsing
1. **P1** : bridge ProLeap COBOL (AST) + résolveur copybook SYSLIB/REPLACING/nested — bascule env.
2. **P2** : JCL PROC expansion + symboliques + INCLUDE (émettre `PROC_CONTAINS`, tuer le cul-de-sac).
3. **P3** : PL/I ; **P4** : Assembleur/REXX.
4. Transverse : **ingestion incrémentale** (par membre modifié, pas de reparse total).

---

## 2. Versioning : un vrai git interne, pas un système maison

### Constat
`server/versioning/changeset.py` réimplémente à la main branches/edits/diff en JSON. C'est
un **liability** face à AXA (« vous avez réécrit git en moins bien »). L'idée de l'utilisateur
est la bonne : **s'appuyer sur git/Gitea**.

### Recommandation
- **Embarqué / simple** : backend **git plain** (CLI ou `pygit2`/libgit2) sur un dépôt du corpus.
  - `change-set` = **branche** ; `edit` = **commit** ; `diff` = `git diff` (vrai, coloré) ;
    `merge` = merge/fast-forward ; historique/blame gratuits.
- **Collaboratif / entreprise** : **[Gitea](https://about.gitea.com/)** auto-hébergé (ou GitLab).
  - Vraies **pull requests**, revue de code, permissions RBAC, webhooks, API — on **branche
    l'UI dessus** au lieu de refaire l'atelier de review.
  - Intégration au **vrai processus de change** (relier à Endevor/ChangeMan côté z/OS).

### Architecture cible (API inchangée pour le front)
```
server/versioning/
  changeset.py       # actuel (JSON) = fallback / mode démo
  git_store.py       # NOUVEAU: GitVersionStore, MÊME interface (create/add_edit/diff/list/status)
                     #   -> branche par change-set, commit par edit, git diff, compute_impact via graphe
```
Sélection par env `COBOL_EXPLORER_VCS=git|gitea|json`. Le front (`ChangesPanel`) ne change pas ;
il gagne juste des vrais diffs et, en mode Gitea, un lien « ouvrir la PR ».

### Phasage versioning
1. **P1** : `GitVersionStore` local (branche/commit/diff réels) derrière l'API existante.
2. **P2** : diff **côte à côte** (MergeView) dans l'UI.
3. **P3** : intégration **Gitea** (PR, review, permissions) ; **P4** : pont vers le SCM mainframe.

---

## 3. Productionisation LLM / RAG

### Déjà fait (cette itération)
- ✅ **Streaming réel** : la trace d'outils est émise **en direct** (file thread-safe dans
  `/api/ask`, `Trace.on_record`) — plus de burst final ; l'animation live du graphe est désormais fidèle.
- ✅ **Fix clé d'erreur** SSE (`message`), fallback déterministe assumé.

### Déjà fait (cette itération, suite)
- ✅ **pgvector implémenté** (`agent/pgvector_index.py`) : PostgreSQL + pgvector (index HNSW,
  cosine), même API que le backend JSON, sélectionné par `COBOL_EXPLORER_VECTOR=pgvector`.
  `docker compose up -d` + `make pgvector-load`. Vérifié : résultats **identiques** au cosinus
  in-process, exposé via l'agent, `/api/search` et le MCP. Reste : index **incrémental** (upsert
  par membre modifié) + montée à 100k docs (batch load, tuning HNSW `ef_search`).

- ✅ **Neo4j implémenté** (`agent/neo4j_store.py`) : le RAG graphe tourne sur un **vrai graph DB
  self-hosted** (Cypher), backend sélectionnable par `COBOL_EXPLORER_GRAPH_BACKEND=neo4j`,
  requêtes impact/lignée/callers/summary réexprimées en Cypher, **vérifiées identiques** à
  NetworkX. `docker compose up -d` + `make neo4j-load`. **`make serve-scale`** lance le duo
  **Neo4j (graphe) + pgvector (vecteur)**, tous deux self-hosted, tous deux dans l'agent.

### À faire
| Chantier | Cible | Pourquoi AXA |
|---|---|---|
| **Graphe incrémental** | MERGE par membre modifié (au lieu du reload complet) ; index Neo4j | Ingestion continue |
| **Base vectorielle managée** | Option **watsonx**/Milvus (self-host ou managé) | Latence, exploitation |
| **Retrieval hybride** | ✅ recherche sémantique **branchée à l'UI** (palette ⌘P) + consigne agent search_code→graph_lookup ; reste : **reranking** + fusion de scores graphe/vecteur | Qualité de réponse |
| **LLM on-prem / souverain** | **watsonx.ai privé** ou Ollama on-prem ; le code (IP métier) **ne sort pas** | Conformité, RGPD/DORA, IP |
| **Gouvernance** | **watsonx.governance** : traçabilité modèle, versions, biais | Audit assureur |
| **Garde-fous** | Vérification que **chaque citation existe vraiment** (fichier:ligne re-vérifié), score de confiance, refus si non ancré | Anti-hallucination sur du critique |
| **Évaluation** | Jeu de **Q/R golden** sur COBOL réel + non-régression + red-team | Preuve de fiabilité |
| **Feedback** | 👍/👎 + corrections humaines (human-in-the-loop) réinjectées | Amélioration continue |
| **Ops LLM** | Cache, rate-limit, coût/latence, quotas par équipe | Coût maîtrisé |

### Phasage RAG
1. **P1** : brancher la recherche sémantique à l'UI + `try/except` embeddings (ne pas crasher si Ollama down).
2. **P2** : **pgvector** persistant + retrieval hybride graphe+vecteur.
3. **P3** : LLM on-prem/watsonx + gouvernance + garde-fous citations + éval golden.

---

## Récapitulatif — ordre de valeur pour un pitch AXA
1. **Connexion mainframe réelle + parsing industriel** (ProLeap + SYSLIB + JCL PROC) — le vrai fossé.
2. **Sécurité/gouvernance d'entreprise** (auth serveur/RBAC, LLM on-prem, audit, RGPD/DORA).
3. **Scale** (graph DB + pgvector, ingestion incrémentale).
4. **Git réel (Gitea)** pour le change-management, branché au SCM z/OS.
5. Le reste = fonctionnalités (déjà bien avancées : impact champ, code mort, lignée, graphe live).
