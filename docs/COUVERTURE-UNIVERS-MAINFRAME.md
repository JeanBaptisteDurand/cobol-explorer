# Couverture de l'univers mainframe — que mappe-t-on, que manque-t-il ?

> Analyse : l'univers mainframe (tous les éléments qu'un outil de *application understanding* peut mapper — référence : IBM ADDI) confronté à ce que notre modèle de graphe couvre aujourd'hui. Sources en bas.
>
> Légende : ✅ couvert · ⚠️ partiel · ❌ non couvert (mais le schéma l'accepte).

## Verdict en une phrase

Pour un applicatif **COBOL + CICS + DB2 + JCL** (type GenApp/assurance), on couvre **le cœur et surtout les relations différenciantes** (impact, lignée de données, chaînes batch). Pour prétendre mapper **tout l'univers mainframe**, il manque des **sous-systèmes entiers** (IMS, MQ), la **couche ressources CICS** (transactions/maps), les **autres langages** (PL/I, Assembleur, REXX, Natural) et un **DB2 plus riche**. Bonne nouvelle : notre schéma (nœuds typés + arêtes typées avec preuve) est **générique et extensible** — ajouter ces éléments = « ajouter un type de nœud/arête + un parseur », pas une refonte.

---

## 1. Langages / code

| Élément | Couvert | Détail / gap |
|---|---|---|
| **COBOL** (programmes, paragraphes, sections) | ✅ | extraction ciblée de constructs (cobol-rekt = enrichissement optionnel hors-graphe) |
| **Copybooks** (données & procédure, REPLACING) | ✅ | pivot d'impact |
| **PL/I** | ❌ | ~présent dans beaucoup de sites ; nécessite un parseur PL/I |
| **Assembleur / HLASM** | ❌ | **66 % des sites en ont** ; parseur HLASM (macros, CSECT) |
| **REXX / CLIST** | ❌ | scripts d'exec, souvent colle applicative |
| **Natural / ADABAS** | ❌ | 4GL + base ; écosystème Software AG |
| **RPG, Easytrieve, FOCUS, SAS, C/C++** | ❌ | langages de niche mais réels |
| **Java (Liberty / z/OS Connect)** | ❌ | GenApp a un `webui` Java + services SOAP non mappés |

## 2. Batch / JCL

| Élément | Couvert | Détail / gap |
|---|---|---|
| JOB, STEP, EXEC PGM=, PROC (cat./in-stream), DD, DSN, GDG(+1) | ✅ | |
| Lignée `SELECT/ASSIGN ↔ DD ↔ DSN` | ✅ | data lineage batch |
| Utilitaires (SORT/DFSORT, IDCAMS, IEBGENER, IEFBR14) | ⚠️ | nœud PGM créé, mais **comportement non modélisé** (IDCAMS qui définit un VSAM, cartes SORT, copies) |
| INCLUDE, JCLLIB, SET/symbolics, COND/IF-THEN-ELSE, RESTART | ❌ | résolution des symboliques et du flux conditionnel |
| Cartes de contrôle in-stream (SYSIN `DD *`) | ❌ | on saute le contenu ; parfois porteur de logique |

## 3. Données

| Élément | Couvert | Détail / gap |
|---|---|---|
| Dataset (générique), GDG (base) | ✅ | |
| Types VSAM (KSDS/ESDS/RRDS), clusters, AIX | ❌ | on ne distingue pas ; pas de définition IDCAMS |
| PDS/PDSE + **membres** | ❌ | pas de granularité membre |
| Catalogues (master/user) | ❌ | infra, peu utile applicativement |
| QSAM / séquentiel, tape | ⚠️ | vu comme « dataset » |

## 4. DB2 for z/OS

| Élément | Couvert | Détail / gap |
|---|---|---|
| Tables (via EXEC SQL FROM/INSERT/UPDATE/DELETE) | ✅ | arête PGM→TABLE |
| Vues | ⚠️ | traitées comme tables si référencées |
| **DCLGEN** (lien copybook ↔ table) | ❌ | lien clé pour la lignée « colonne » |
| Stored procedures, Triggers | ❌ | logique DB2 invisible |
| Plans / Packages / Bind | ❌ | quel programme via quel package |
| Colonnes, index, SQL complexe (JOIN, curseurs) | ⚠️ | extraction table de base seulement |

## 5. CICS (online)

| Élément | Couvert | Détail / gap |
|---|---|---|
| Appels `EXEC CICS LINK/XCTL PROGRAM` → graphe d'appels | ✅ | |
| **Transactions** (CSD `Define Transaction...Program`) → transaction→programme | ✅ | **gap comblé** : 25 transactions extraites des `cdef*.jcl` (nœud `CICS_TXN`, arête `TXN_INVOKES`) — les points d'entrée online |
| **BMS mapsets/maps** (DFHMSD/MDI) + `SEND/RECEIVE MAP` → écran↔programme | ✅ | **gap comblé** : 6 maps (nœud `BMS_MAP`, arête `PGM_USES_MAP`) |
| TDQ / TSQ (files de données) | ❌ | |
| Fichiers CICS (FCT) `READ/WRITE/REWRITE/DELETE FILE` → VSAM | ✅ | **gap #2 comblé** : 2 fichiers (KSDSCUST, KSDSPOLY), nœud `CICS_FILE`, arêtes `PGM_READS_FILE`/`PGM_WRITES_FILE` (evidence.op) |
| Ressources CSD (PROGRAM, FILE, MAPSET…) | ❌ | le référentiel de définition CICS |

## 6. IMS (sous-système entier)

| Élément | Couvert | Détail / gap |
|---|---|---|
| DBD (base), PSB (vue programme), segments | ❌ | |
| Appels DL/I (`CBLTDLI`) → programme↔base IMS | ❌ | |
| MFS (écrans IMS), transactions IMS/TM | ❌ | |

## 7. Messagerie & intégration

| Élément | Couvert | Détail / gap |
|---|---|---|
| IBM MQ (queues, channels, MQPUT/MQGET) | ❌ | intégration inter-applicative |
| z/OS Connect / services SOAP-REST | ❌ | GenApp expose des services non mappés |

## 8. Ordonnancement

| Élément | Couvert | Détail / gap |
|---|---|---|
| Chaîne (SCHED_JOB, `déclenche`, `exécute` un JOB) | ⚠️ | **fictif** (`scheduler.json`) — le schéma est bon |
| Calendriers, special resources, prédécesseurs réels | ❌ | via export **IWS / CA7 / Control-M** (esquissé) |

## 9. Sécurité & gouvernance

| Élément | Couvert | Détail / gap |
|---|---|---|
| RACF (profils dataset/ressource, qui accède à quoi) | ❌ | **fort pour l'angle risque/conformité** : « qui peut lire ce fichier » |

## 10. Cycle de vie / SCM

| Élément | Couvert | Détail / gap |
|---|---|---|
| Versioning applicatif | ✅ (le nôtre) | change-sets maison |
| Endevor / ChangeMan / ISPW (éléments, niveaux) | ❌ | on pourrait **mapper/importer** leur historique plutôt que réinventer |

---

## Ce qui est *suffisant* aujourd'hui vs pour « l'univers complet »

**Suffisant pour la démo et le POC** (applicatif COBOL/CICS/DB2/JCL) : oui — on a le graphe d'appels (CALL + CICS LINK), les copybooks (impact), les tables DB2, le JCL, la lignée batch, les chaînes d'ordonnanceur, les domaines. Les **3 arguments différenciants** (lignée, chaînes, impact copybook) fonctionnent sur données réelles.

**Pour mapper *tout* l'univers**, priorités (par valeur × effort) :

1. ~~**BMS + CSD (transactions/écrans)**~~ ✅ **FAIT** (25 transactions + 6 maps). Reste **DCLGEN** (lien copybook↔table) — absent de GenApp (copybooks écrits main), à faire sur un corpus qui en contient.
2. **Ordonnanceur réel** (IWS `PLAN_JOB_PREDECESSORS_V` / CA7 / Control-M export) — remplacer le fictif ; le schéma est prêt.
3. **IMS** (DBD/PSB/segments + `CBLTDLI`) — un sous-système entier, fort dans banque/assurance.
4. **Autres langages** (PL/I d'abord, puis Assembleur/REXX/Natural) — via l'interface `Parser` : chaque langage = une implémentation qui alimente le **même** schéma. C'est là que l'extensibilité paie.
5. **MQ** (queues + MQPUT/MQGET) — intégration inter-systèmes.
6. **RACF** — nœuds `PROFIL`/`UTILISATEUR` + arête « peut accéder » : très parlant pour le public conformité.

**Point d'architecture (rassurant)** : le modèle `Node(id, kind, label, attrs)` + `Edge(src, dst, kind, evidence)` est **agnostique du langage et du sous-système**. Ajouter PL/I, IMS, une transaction CICS ou une queue MQ = **de nouveaux `kind` + un parseur**, pas une refonte. Le graphe, l'UI (arbre, inspecteur, graphe), l'agent (`graph_lookup`) et le RAG **fonctionnent tels quels** sur les nouveaux types. L'architecture est donc **suffisante pour mapper l'univers** ; ce sont les **parseurs** qui sont à étendre.

---

## Sources
- IBM ADDI (référentiel d'artefacts z/OS : programmes, copybooks, JCL, DB2, CICS, IMS, datasets) : https://www.ibm.com/products/app-discovery-and-delivery-intelligence · https://www.ibm.com/docs/en/addi/6.1.4?topic=addi-user-guide
- Langages mainframe (COBOL/PL-I/HLASM/REXX ; 66 % ont de l'Assembleur) : https://openmainframeproject.org/wp-content/uploads/sites/14/2025/01/Mainframe-Programming-Languages-White-Paper.pdf · https://techchannel.com/z-os/beyond-legacy-languages/ · https://planetmainframe.com/2026/02/beyond-the-demo-testing-ibm-bob-ai/
- CICS (BMS DFHMSD/MDI/MDF, CSD, transactions, TDQ/TSQ) : https://www.ibm.com/docs/en/cics-ts/6.x?topic=macros-bms-map-set-map-field-definition · https://www.mainframestechhelp.com/tutorials/cics/tsq-vs-tdq.htm
- DB2 z/OS (vues, triggers, stored procs, DCLGEN, plans/packages, MQ) : https://www.ibm.com/docs/en/developer-for-zos/15.0.x?topic=applications-generating-declarations-from-db2-tables-views-aliases · https://www.idug.org/news/exploring-the-db2-for-zos-catalog
- Données z/OS (VSAM KSDS/ESDS/RRDS, PDS/PDSE, GDG, catalogues) : https://en.wikipedia.org/wiki/Data_set_(IBM_mainframe) · https://www.mainframestechhelp.com/tutorials/vsam/catalog-structure.htm
- SCM (Endevor/ChangeMan) : https://www.broadcom.com/products/mainframe/application-development-testing-devops/endevor
- Sécurité (RACF) : https://www.rshconsulting.com/RSHpres/RSH_Consulting__Introduction_to_RACF__May_2019.pdf
- Ordonnanceurs (IWS/CA7/Control-M) : voir `RAG_cobol/recherche/03-MODELE-MAINFRAME-NATIF.md`
