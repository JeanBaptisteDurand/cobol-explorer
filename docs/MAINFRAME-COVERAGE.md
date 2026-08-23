# Mainframe universe coverage - what is mapped, and what is missing

> The analysis: the mainframe universe (everything an *application understanding* tool can map - reference: IBM ADDI) set against what our graph model covers today. Sources at the bottom.
>
> Legend: ✅ covered · ⚠️ partial · ❌ not covered (but the schema accepts it).

## The verdict in one sentence

For a **COBOL + CICS + DB2 + JCL** application (GenApp/insurance in kind), we cover **the core and, above all, the relationships that differentiate** - impact, data lineage, batch chains. To claim we map **the whole mainframe universe**, what is missing is **entire subsystems** (IMS, MQ), the **CICS resource layer** (transactions and maps), the **other languages** (PL/I, Assembler, REXX, Natural) and a **richer DB2**. The good news: our schema (typed nodes and typed edges carrying evidence) is **generic and extensible** - adding those means "a node/edge type plus a parser", not a rewrite.

---

## 1. Languages and code

| Element | Covered | Detail / gap |
|---|---|---|
| **COBOL** (programs, paragraphs, sections) | ✅ | targeted construct extraction (cobol-rekt is optional off-graph enrichment) |
| **Copybooks** (data and procedure, REPLACING) | ✅ | the pivot of impact analysis |
| **PL/I** | ❌ | present on many sites; needs a PL/I parser |
| **Assembler / HLASM** | ❌ | **66% of sites have some**; needs an HLASM parser (macros, CSECT) |
| **REXX / CLIST** | ❌ | execution scripts, often the application glue |
| **Natural / ADABAS** | ❌ | a 4GL plus its database; the Software AG ecosystem |
| **RPG, Easytrieve, FOCUS, SAS, C/C++** | ❌ | niche languages, but real ones |
| **Java (Liberty / z/OS Connect)** | ❌ | GenApp ships a Java `webui` and SOAP services we do not map |

## 2. Batch and JCL

| Element | Covered | Detail / gap |
|---|---|---|
| JOB, STEP, EXEC PGM=, PROC (catalogued and in-stream), DD, DSN, GDG(+1) | ✅ | |
| `SELECT/ASSIGN ↔ DD ↔ DSN` lineage | ✅ | batch data lineage |
| Utilities (SORT/DFSORT, IDCAMS, IEBGENER, IEFBR14) | ⚠️ | a PGM node is created, but **the behaviour is not modelled** (an IDCAMS that defines a VSAM cluster, SORT control cards, copies) |
| INCLUDE, JCLLIB, SET/symbolics, COND/IF-THEN-ELSE, RESTART | ❌ | resolving symbolics and conditional flow |
| In-stream control cards (SYSIN `DD *`) | ❌ | we skip the content, which sometimes carries logic |

## 3. Data

| Element | Covered | Detail / gap |
|---|---|---|
| Dataset (generic), GDG (base) | ✅ | |
| VSAM types (KSDS/ESDS/RRDS), clusters, AIX | ❌ | not distinguished; no IDCAMS definition read |
| PDS/PDSE and their **members** | ❌ | no member-level granularity |
| Catalogs (master/user) | ❌ | infrastructure, of little application value |
| QSAM / sequential, tape | ⚠️ | seen simply as "dataset" |

## 4. DB2 for z/OS

| Element | Covered | Detail / gap |
|---|---|---|
| Tables (through EXEC SQL FROM/INSERT/UPDATE/DELETE) | ✅ | PGM→TABLE edge |
| Views | ⚠️ | treated as tables when referenced |
| **DCLGEN** (the copybook ↔ table link) | ❌ | the key link for column-level lineage |
| Stored procedures, triggers | ❌ | DB2-side logic stays invisible |
| Plans / packages / bind | ❌ | which program runs through which package |
| Columns, indexes, complex SQL (JOIN, cursors) | ⚠️ | base table extraction only |

## 5. CICS (online)

| Element | Covered | Detail / gap |
|---|---|---|
| `EXEC CICS LINK/XCTL PROGRAM` calls → the call graph | ✅ | |
| **Transactions** (CSD `Define Transaction...Program`) → transaction→program | ✅ | **gap closed**: 25 transactions extracted from the `cdef*.jcl` files (`CICS_TXN` node, `TXN_INVOKES` edge) - the online entry points |
| **BMS mapsets/maps** (DFHMSD/MDI) and `SEND/RECEIVE MAP` → screen↔program | ✅ | **gap closed**: 6 maps (`BMS_MAP` node, `PGM_USES_MAP` edge) |
| TDQ / TSQ (data queues) | ❌ | |
| CICS files (FCT) `READ/WRITE/REWRITE/DELETE FILE` → VSAM | ✅ | **gap closed**: 2 files (KSDSCUST, KSDSPOLY), `CICS_FILE` node, `PGM_READS_FILE`/`PGM_WRITES_FILE` edges (evidence.op) |
| CSD resources (PROGRAM, FILE, MAPSET…) | ❌ | the CICS definition repository itself |

## 6. IMS (an entire subsystem)

| Element | Covered | Detail / gap |
|---|---|---|
| DBD (database), PSB (program view), segments | ❌ | |
| DL/I calls (`CBLTDLI`) → program↔IMS database | ❌ | |
| MFS (IMS screens), IMS/TM transactions | ❌ | |

## 7. Messaging and integration

| Element | Covered | Detail / gap |
|---|---|---|
| IBM MQ (queues, channels, MQPUT/MQGET) | ❌ | cross-application integration |
| z/OS Connect / SOAP-REST services | ❌ | GenApp exposes services we do not map |

## 8. Scheduling

| Element | Covered | Detail / gap |
|---|---|---|
| Chains (SCHED_JOB, `triggers`, `runs` a JOB) | ⚠️ | **synthetic** (`scheduler.json`) - the schema itself is right |
| Calendars, special resources, real predecessors | ❌ | through an **IWS / CA7 / Control-M** export (sketched) |

## 9. Security and governance

| Element | Covered | Detail / gap |
|---|---|---|
| RACF (dataset and resource profiles, who reaches what) | ❌ | **strong for the risk and compliance angle**: "who can read this file" |

## 10. Lifecycle and SCM

| Element | Covered | Detail / gap |
|---|---|---|
| Application versioning | ✅ (ours) | in-house change-sets |
| Endevor / ChangeMan / ISPW (elements, levels) | ❌ | we could **map or import** their history rather than reinvent it |

---

## What is *enough* today, versus for "the whole universe"

**Enough for the demo and the proof of concept** (a COBOL/CICS/DB2/JCL application): yes. We have the call graph (CALL and CICS LINK), the copybooks (impact), the DB2 tables, the JCL, batch lineage, scheduler chains and business domains. The **three differentiating arguments** - lineage, chains, copybook impact - work on real data.

**To map the *whole* universe**, in order of value over effort:

1. ~~**BMS + CSD (transactions and screens)**~~ ✅ **done** (25 transactions, 6 maps). What remains is **DCLGEN** (the copybook↔table link), absent from GenApp because its copybooks are hand-written; it needs a corpus that has some.
2. **A real scheduler** (IWS `PLAN_JOB_PREDECESSORS_V`, CA7 or Control-M export) to replace the synthetic one; the schema is ready.
3. **IMS** (DBD/PSB/segments and `CBLTDLI`) - an entire subsystem, and a strong one in banking and insurance.
4. **The other languages** (PL/I first, then Assembler, REXX, Natural) through the `Parser` interface: each language is one implementation feeding the **same** schema. This is where the extensibility pays for itself.
5. **MQ** (queues, MQPUT/MQGET) - cross-system integration.
6. **RACF** - `PROFILE`/`USER` nodes and a "can access" edge; very legible to a compliance audience.

**The architectural point.** The model `Node(id, kind, label, attrs)` + `Edge(src, dst, kind, evidence)` is **agnostic of language and subsystem**. Adding PL/I, IMS, a CICS transaction or an MQ queue means **new `kind` values plus a parser**, not a rewrite. The graph, the UI (tree, inspector, graph view), the agent (`graph_lookup`) and the RAG **work as they are** on the new types. The architecture is therefore **sufficient to map the universe**; it is the **parsers** that have to grow.

---

## Sources

- IBM ADDI (the z/OS artefact repository: programs, copybooks, JCL, DB2, CICS, IMS, datasets): https://www.ibm.com/products/app-discovery-and-delivery-intelligence · https://www.ibm.com/docs/en/addi/6.1.4?topic=addi-user-guide
- Mainframe languages (COBOL/PL-I/HLASM/REXX; 66% have some Assembler): https://openmainframeproject.org/wp-content/uploads/sites/14/2025/01/Mainframe-Programming-Languages-White-Paper.pdf · https://techchannel.com/z-os/beyond-legacy-languages/
- CICS (BMS DFHMSD/MDI/MDF, CSD, transactions, TDQ/TSQ): https://www.ibm.com/docs/en/cics-ts/6.x?topic=macros-bms-map-set-map-field-definition · https://www.mainframestechhelp.com/tutorials/cics/tsq-vs-tdq.htm
- DB2 for z/OS (views, triggers, stored procedures, DCLGEN, plans and packages): https://www.ibm.com/docs/en/developer-for-zos/15.0.x?topic=applications-generating-declarations-from-db2-tables-views-aliases · https://www.idug.org/news/exploring-the-db2-for-zos-catalog
- z/OS data (VSAM KSDS/ESDS/RRDS, PDS/PDSE, GDG, catalogs): https://en.wikipedia.org/wiki/Data_set_(IBM_mainframe) · https://www.mainframestechhelp.com/tutorials/vsam/catalog-structure.htm
- SCM (Endevor/ChangeMan): https://www.broadcom.com/products/mainframe/application-development-testing-devops/endevor
- Security (RACF): https://www.rshconsulting.com/RSHpres/RSH_Consulting__Introduction_to_RACF__May_2019.pdf
