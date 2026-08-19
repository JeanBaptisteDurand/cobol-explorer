# Guide d'utilisation & de démo — COBOL Explorer

## 0. Lancer

**Prérequis** : Docker (Neo4j + pgvector), Ollama avec `granite3.3:8b` (agent) et `granite-embedding:278m` (embeddings).

```bash
make serve-scale     # Neo4j (graphe) + pgvector (vectoriel), self-hosted → http://127.0.0.1:8000
# variantes :
make serve           # tout in-process (NetworkX + index JSON), zéro dépendance
make serve-pg        # pgvector pour le vectoriel, NetworkX pour le graphe
make ingest          # re-parse le corpus → graph.json
make index           # reconstruit l'index sémantique Granite → index.json
```

Au **premier lancement**, un écran d'accueil demande **ton nom + ton rôle** (voir §3).

---

## 1. La carte de l'interface

- **Barre de titre** : logo · **recherche** (Entrée = aller à l'entité) · **⌘P** (palette) · **pastille utilisateur** en haut à droite (= identité + rôle, cliquable pour changer).
- **Barre d'activité** (icônes à gauche, une seule allumée en ambre) : Explorateur · Rechercher · **Graphe** · **Versions** (pastille = nombre) · **Agent** · Paramètres (en bas).
- **Barre latérale** :
  - **Code source** — les programmes COBOL par domaine métier (clic = ouvre le code).
  - **Ressources mainframe** — copybooks, transactions CICS, fichiers VSAM, écrans BMS, tables DB2 (clic = contexte dans le graphe).
  - **Versions** — tes branches de modification.
- **Centre** : onglets **Aperçu** et **Graphe**, plus les onglets code/diff que tu ouvres. Bouton **split** (icône en haut à droite d'un volet) = 2 fichiers côte à côte.
- **Panneau droit** : **Agent · Inspecteur · Modifs · Audit**.
- **Barre de statut** (bas) : **branche active** (clic « ✕ main » = revenir à main en lecture seule) · LED **Lecture seule / Modification**.
- Partout, des petits **« ? »** expliquent les concepts au survol (fan-in, chaînes batch, code mort, conflit, audit…).

---

## 2. Chaque fonctionnalité, pas à pas

### Aperçu (onglet central par défaut)
Le patrimoine en un écran : stats (47 programmes, copybooks, tables DB2, domaines), **copybooks les plus critiques** (fan-in = combien de programmes en dépendent), **chaînes batch** (ordonnanceur), **qualité** (code mort : programmes orphelins + copybooks non référencés), et 3 **questions suggérées** (cliquables → l'agent).

### Recherche & palette ⌘P
- **Recherche** (barre de titre) : tape un nom (`LGPOLICY`, `POLICY`, une transaction) + Entrée → ouvre l'entité. Si rien ne matche, le champ le signale (« Aucun résultat pour… »).
- **⌘P** : palette floue **+ recherche sémantique Granite** — tape une *intention* (« logging », « où est calculée la prime ») et elle trouve les programmes par le sens, même sans connaître le nom.

### Explorateur vs Ressources
- **Code source** = ce qui a un fichier (programmes, copybooks) → clic ouvre le **code**.
- **Ressources mainframe** = entités souvent sans fichier (tables, transactions, VSAM…) → clic ouvre leur **voisinage dans le graphe**.

### Inspecteur (panneau droit)
Sélectionne une entité → il montre son **contexte calculé** : appels (CALL/CICS), copybooks, tables DB2 **lues/écrites**, fichiers VSAM, écrans, « utilisé par », « appelé par »… chaque ligne avec sa **ligne source** (L.xxx).
- Pour un **copybook** : **impact au niveau champ** (chaque champ → combien de programmes le référencent).
- Pour une **table DB2** : une note (« colonnes définies dans le DDL, hors corpus ») + les **programmes qui la lisent / l'écrivent**.
- Boutons : **Voir le code** · **Voir dans le graphe** · **Analyser l'impact** · **Modifier…**

### Graphe (onglet central)
- **Clic** sur un nœud = le sélectionner (l'inspecteur se remplit). **Icône split** sur le nœud (ou via l'inspecteur) = ouvrir son code au centre.
- **Focus voisinage** : ne garde que le nœud + ses voisins directs.
- **Filtrer par type** : masquer/afficher domaines, programmes, copybooks, tables DB2, transactions…
- **Voir l'impact d'un changement** : sélectionne un copybook/table → tout le rayon d'impact s'illumine en **rouge** (+ les chaînes batch touchées).

### Agent (panneau droit → Agent)
Pose une question en langage naturel. Tu vois **en direct** :
1. le **graphe passe en gris** puis **se ré-illumine** au fil du raisonnement (chaque entité que la RAG touche) ;
2. la **trace** se déroule : `think` (le pourquoi du choix) → `graph_lookup` / `search_code` / `read_source_lines`, avec input + sources ;
3. la **réponse** en markdown avec **citations cliquables** `fichier:ligne` (clic = ouvre le code à la ligne) ;
4. un badge **« ✓ N sources vérifiées »** (garde-fou anti-hallucination).
La **conversation garde le contexte** : tu peux enchaîner « et qui l'appelle ? » sans répéter le nom.

### Modifier (versions git)
1. Sur un fichier, clic **« Modifier dans une version »** → nomme la version → l'éditeur devient éditable.
2. Édite ; **Cmd/Ctrl+S** ou **« Enregistrer dans la version »** (bandeau « Enregistré ✓ »).
3. L'**impact se recalcule** (panneau Modifs : « N programmes impactés »).
4. **diff** = comparer avec main ; **retirer** = annuler ta modif sur un fichier (retour à main — utile après une suppression par erreur).
5. **« ✕ main »** (barre de statut ou panneau Modifs) = revenir à main en lecture seule.

### Audit (panneau droit → Audit)
Le **journal inviolable** : chaque action (question, lecture, modif, fusion, et chaque refus) est chaînée en **HMAC**. Badge **« ✓ chaîne intègre »** (détecte altération, insertion **et troncature**). Bouton **↓ CSV** = export pour un dossier de conformité.

### Split view
Icône **split** (haut-droite d'un volet) → deux fichiers côte à côte (ex. le programme + le copybook qu'il copie).

---

## 3. Comptes & rôles (RBAC)

**Changer de compte** : clic sur la **pastille utilisateur** (haut-droite) *ou* l'icône **Paramètres** (bas de la barre d'activité) → change **nom + rôle** → « Entrer dans l'atelier ». L'identité est mémorisée dans le navigateur ; chaque personne a son nom → sa propre branche.

| Rôle (UI)     | Lire / Demander | Commenter | Créer version / Éditer | Fusionner | Voir l'audit |
|---------------|:---:|:---:|:---:|:---:|:---:|
| **Développeur** | ✓ | ✓ | ✓ | ✓ | — |
| **Architecte**  | ✓ | ✓ | ✓ | ✓ | — |
| **Risque**      | ✓ | ✓ | ✓ | *propose seulement* | — |
| **Conformité**  | ✓ | ✓ | — | — | ✓ |
| **Auditeur**    | ✓ | — | — | — | ✓ |

> ⚠️ **En mode « ouvert » (défaut, pour la démo)**, personne n'est bloqué — mais **l'audit journalise le rôle** de chaque action. La grille ci-dessus est *appliquée* en mode **enforce** (`COBOL_EXPLORER_AUTH=enforce` derrière un proxy d'authentification). Pour la démo, reste en ouvert et explique : « en enforce, le rôle Risque ne pourrait pas fusionner, seulement proposer — et tout est tracé ».

---

## 4. Collaboration (le cœur multi-utilisateurs)

Chacun travaille sur **sa propre version** = une branche git `cs/<id>` ; **main** est la version de l'équipe. Fonctionne comme des pull requests.

- **Importer main** (« ↓ Importer main ») : ramène le travail fusionné des autres dans ta branche (`git merge`).
- **Conflit** (vous avez touché les mêmes lignes) : deux boutons apparaissent — **« Garder mes modifs »** ou **« Prendre la version de main »**. Aucune fusion silencieuse.
- **Proposer** = soumettre à revue. **Fusionner** = appliquer sur main — **uniquement si ta branche est à jour** (sinon « importez main d'abord »), pour ne jamais écraser un collègue. La fusion demande une **confirmation d'impact** (merge-gate : « touche N programmes »).
- On ne peut fusionner/proposer que **sa** version active (comme on ne pushe que sa propre branche).
- Une version **fusionnée** devient **close** (lecture seule).

**Scénario de démo collaboration** (2 comptes) :
1. Compte **Alice** (Développeur) : modifie `lgpolicy.cpy` (+65 → +72), fusionne.
2. Change de compte → **Bob** (Développeur) : modifie **le même fichier** (+65 → +80). Tente de fusionner → refusé (« en retard »). Clique **Importer main** → **conflit** → **« Garder mes modifs »** → puis **Fusionner**. Résultat : main garde le choix explicite de Bob, rien d'écrasé.

---

## 5. Exemple concret — le graphe

**But : montrer l'impact d'un changement de copybook.**
1. Onglet **Graphe** (barre d'activité ou onglet central).
2. **⌘P** → tape `LGPOLICY` → Entrée. Le nœud est sélectionné, l'inspecteur montre « utilisé par ».
3. Dans le graphe, clic **« Voir l'impact d'un changement »** → **11 programmes** s'illuminent en rouge + les chaînes **SDAILYPOL · SPOLRPT**. → *« Voilà tout ce qui casse si je touche ce copybook. »*
4. **Focus voisinage** → ne garde que LGPOLICY et ses voisins directs (lisible).
5. Clic sur l'icône **split** d'un programme (ex. LGACDB01) → ouvre son code au centre, à la **ligne du COPY**.
6. Bonus DB2 : ouvre la table **CUSTOMER** → l'inspecteur montre « lu par LGICDB01 (L.169) », « écrit par LGACDB01 (L.222), LGUCDB01 (L.155) ».

---

## 6. Exemple concret — l'agent

**But : montrer une réponse tracée et sourcée + la mémoire de conversation.**
1. Panneau droit → **Agent**.
2. Tape : **« Que fait le programme LGIPOL01 ? »**
   - Le graphe passe en gris et **s'illumine** au fil ; la **trace** montre `think → graph_lookup(summary) → read_source_lines` ; la réponse arrive avec des **citations `fichier:ligne` cliquables** et le badge **« ✓ sources vérifiées »**.
3. Enchaîne (mémoire) : **« Et quels programmes sont impactés si je le modifie ? »** → il garde le contexte de LGIPOL01.
4. Autres bonnes questions de démo :
   - **« Qui écrit dans la table POLICY ? »** (montre les EXEC SQL / lignée DB2)
   - **« Quels programmes sont impactés si je modifie le copybook LGPOLICY ? »** (impact déterministe, 11 programmes + chaînes)
   - **« Où est calculée la prime ? »** (recherche sémantique — sans connaître le nom)
5. Clic sur une citation `lgipol01.cbl:55` → ouvre le code à la ligne exacte.

---

## 7. Script de démo (≈ 5 min)

| Temps | Écran | Le message |
|---|---|---|
| 0:00 | **Aperçu** | « Le patrimoine en un écran : 47 programmes, les copybooks critiques, le code mort détecté. On voit tout de suite le risque. » |
| 0:45 | **Agent** — « Que fait LGIPOL01 ? » | « Le graphe s'illumine au fil du raisonnement, chaque phrase est reliée à une ligne source, vérifiée. » |
| 1:45 | **Graphe** — impact LGPOLICY | « Voilà les 11 programmes et les 2 chaînes batch qui cassent si je touche ce copybook. » |
| 2:30 | **Modifier** — version +65→+72 | « La modif vit dans une branche isolée ; l'impact se recalcule ; rien n'est appliqué tant que ce n'est pas fusionné. » |
| 3:30 | **Collaboration** — Bob, conflit | « Deux personnes sur le même programme : conflit détecté, je choisis, je fusionne — sans écraser personne. » |
| 4:30 | **Audit** — journal HMAC + CSV | « Chaque action est tracée, chaînée cryptographiquement, exportable pour la conformité. » |

**Fil rouge à répéter** : *Comprendre* (lecture seule, tout sourcé) **≠** *Modifier* (branche isolée, révisée, tracée). Et : le MCP tend à IBM Bob ce patrimoine **déjà calculé** (cf. slide 07).

---

## 8. Script clic-par-clic (l'ordre EXACT des actions)

**Avant de commencer** : `bash scripts/demo-reset.sh` → puis ouvre http://127.0.0.1:8000 et fais **Cmd+Shift+R** (une fois, pour purger un vieux cache). Renseigne ton **nom** + rôle **Développeur** → « Entrer dans l'atelier ».

> **La question « créer une version puis modifier, ou proposer via le menu de droite ? »** → Tu **crées la version DEPUIS LE FICHIER** (bouton « Modifier dans une version »), tu édites, tu enregistres. Le **menu de droite (Modifs)** ne sert **pas** à créer : c'est là que tu **vois l'impact** puis que tu cliques **Proposer** ou **Fusionner**.

**① Aperçu** *(tu y es déjà)* → montre stats, copybooks critiques, code mort. *« Le patrimoine + le risque en un écran. »*

**② Graphe → impact**
1. Clic onglet **Graphe** (en haut).
2. **⌘P** → tape `LGPOLICY` → **Entrée**.
3. Carte en haut à gauche du graphe → clic **« Voir l'impact d'un changement »**.
4. → 11 nœuds rouges + chaînes SDAILYPOL·SPOLRPT. *« Voilà ce qui casse. »*
5. Clic **« effacer »**.

**③ Agent**
1. Panneau droit → **Agent**.
2. Tape `Que fait le programme LGIPOL01 ?` → **Entrée**.
3. Le graphe reste lisible avec « L'agent réfléchit… », puis s'illumine ; la réponse arrive avec citation cliquable + « ✓ source vérifiée ». *(compte ~30 s — narre pendant.)*

**④ Modifier** *(créer la version DEPUIS le fichier)*
1. **⌘P** → `LGPOLICY` → **Entrée** (le copybook s'ouvre, **lecture seule**).
2. En haut à droite de l'éditeur → clic **« Modifier dans une version »**.
3. Fenêtre → titre `Hausse plafond moteur` → **« Créer la version »**.
4. L'éditeur passe en **ambre** (éditable). Ligne `WS-MOTOR-LEN … VALUE +65` → remplace `+65` par `+72`.
5. **Cmd+S** (ou bouton **« Enregistrer dans la version »**) → « **Enregistré ✓** ».
6. Le menu **Modifs** s'ouvre → montre « N programmes impactés » + le **diff**.
7. *(prépare l'étape ⑤)* Clic **« Fusionner »** → le bouton devient **« Confirmer la fusion »** (merge-gate) → clic. Main est mis à jour.

**⑤ Collaboration / conflit**
1. Clic ta **pastille en haut à droite** → nom = `Bob`, rôle **Développeur** → « Entrer ».
2. Barre latérale, section **Versions** → clic **« Ajustement tarif (Bob) »**.
3. Modifs affiche **« en retard de 1 commit »** → clic **« ↓ Importer main »**.
4. → **conflit** (rouge). Clic **« Garder mes modifs »** → « ✓ à jour avec main ».
5. Clic **« Fusionner »** → **« Confirmer »**. *« Deux personnes, même programme, sans écrasement. »*

**⑥ Audit** → panneau droit → **Audit** → « ✓ chaîne intègre », la liste, bouton **↓ CSV**.

**Pour recommencer** : `bash scripts/demo-reset.sh` (restaure le corpus, remet 1 version de Bob prête).
