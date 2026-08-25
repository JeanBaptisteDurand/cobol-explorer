import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createChangeSet, type DemoAccount, editCsFile, getAuthConfig, getCsDiff, getCsFile, getFileFull, getGraph, getSystems, listChangeSets, login, SESSION_ENDED, setSystem, type SystemInfo } from "./api";
import AuditPanel from "./components/AuditPanel";
import ChangesPanel from "./components/ChangesPanel";
import ChatPanel from "./components/ChatPanel";
import CodeView from "./components/CodeView";
import CommandPalette from "./components/CommandPalette";
import GraphView from "./components/GraphView";
import { Icon } from "./components/Icons";
import Inspector from "./components/Inspector";
import Navigator from "./components/Navigator";
import NewVersionModal from "./components/NewVersionModal";
import Auth, { type AuthMode } from "./components/Auth";
import Landing from "./components/Landing";
import BobPanel from "./components/BobPanel";
import Logo from "./components/Logo";
import Tour, { tourWasSeen } from "./components/Tour";
import Onboarding from "./components/Onboarding";
import Overview from "./components/Overview";
import { clearHomeSession, clearSession, consumeFragmentSession, getHomeSession, getIdentity, getToken, restoreHomeSession, saveSession, stashHomeSession, type Identity } from "./identity";
import { VISIBLE_DEFAULT } from "./layout";
import { kindCount, nodeIndex } from "./model";
import type { ChangeSet, GNode, Graph } from "./types";

interface Tab { key: string; type: "overview" | "graph" | "code" | "diff"; title: string; path?: string; nodeId?: string; }
// An editor group is one pane with its own tab strip; two groups sit side by side (split view).
interface TabGroup { id: string; tabs: Tab[]; activeKey: string; }
const OVERVIEW_TAB: Tab = { key: "overview", type: "overview", title: "Overview" };
const GRAPH_TAB: Tab = { key: "graph", type: "graph", title: "Graph" };
// The copybook the whole page argues about: eleven programs copy it.
const TOUR_EXAMPLE = "LGPOLICY";

/** Feedback for the two redirects that land back on the public page: a confirmation
 *  link (?verified=1 or =expired) and a federated sign-in that did not complete
 *  (?ibm=failed).
 *
 *  The IBM case used to say nothing at all. The server redirects here on any
 *  failure - an expired state, a rejected code, a directory that refused the
 *  account - and the visitor was returned to the home page with no explanation,
 *  which is indistinguishable from a button that does nothing. */
function ReturnBanner({ expired }: { expired?: boolean }) {
  const params = new URLSearchParams(window.location.search);
  const verified = params.get("verified");
  const ibm = params.get("ibm");
  const [dismissed, setDismissed] = useState(false);
  const shown = !dismissed && (expired || !!verified || !!ibm);
  if (!shown) return null;

  const ok = verified === "1";
  const message = expired
    ? "Your session expired. Sign in again to reopen the estate. Nothing you proposed was lost; versions live on the server."
    : ibm
      ? "IBM sign-in did not complete. Use an account from this deployment's directory, or sign in with a password below."
      : ok
        ? "✓ Address confirmed. You can sign in now."
        : "This confirmation link is invalid or has expired.";
  const good = !expired && !ibm && ok;

  return (
    <div className="verified-banner" data-testid="verified-banner"
      style={{ borderColor: good ? "var(--verified)" : "var(--danger)", color: good ? "var(--verified)" : "var(--danger)" }}>
      {message}
      <span onClick={() => setDismissed(true)} style={{ cursor: "pointer", marginLeft: 12, color: "var(--text-helper)" }}>✕</span>
    </div>
  );
}

export default function App() {
  const [graph, setGraph] = useState<Graph | null>(null);
  const [versions, setVersions] = useState<ChangeSet[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [groups, setGroups] = useState<TabGroup[]>([{ id: "g1", tabs: [OVERVIEW_TAB, GRAPH_TAB], activeKey: "overview" }]);
  const [activeGroupId, setActiveGroupId] = useState("g1");
  const [splitRatio, setSplitRatio] = useState(0.5);
  const groupSeq = useRef(2);
  const [highlights, setHighlights] = useState<Record<string, { line: number; nonce: number }>>({});
  const hlSeq = useRef(1);
  // Live agent visualisation on the graph: which nodes the RAG has touched so far.
  const [agentActive, setAgentActive] = useState(false);
  const [litNodes, setLitNodes] = useState<Set<string>>(new Set());
  // Graph focus mode, lifted here so the sidebar/inspector can trigger "reveal in graph".
  const [graphFocus, setGraphFocus] = useState(false);
  const [agentPrimary, setAgentPrimary] = useState<GNode | null>(null);
  // Deterministic "impact ripple" fired from the Overview hero: tells GraphView to
  // highlight the impacted closure in red (nonce so the same node can re-fire).
  const [impactReq, setImpactReq] = useState<{ id: string; label: string; nonce: number } | null>(null);
  const impactSeq = useRef(1);
  const [base, setBase] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [diffs, setDiffs] = useState<Record<string, string>>({});
  // Which version each open file's content was loaded under - so opening a file
  // already cached under a DIFFERENT version reloads it (path-keyed cache alone
  // would show one version's bytes while claiming to be on another).
  const loadedVer = useRef<Record<string, string | null>>({});
  const loadSeq = useRef<Record<string, number>>({});
  const activeVersionIdRef = useRef<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);
  const [searchMiss, setSearchMiss] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<"chat" | "inspector" | "changes" | "audit">("inspector");
  const [chatSeed, setChatSeed] = useState<{ q: string; nonce: number } | undefined>();
  const [search, setSearch] = useState("");
  // A federated sign-in lands with the session in the URL fragment; take it before
  // anything else so the workshop opens straight away.
  const [identity, setIdent] = useState<Identity | null>(() => consumeFragmentSession() || getIdentity());
  const [showOnb, setShowOnb] = useState(false);
  const [authRequired, setAuthRequired] = useState<boolean | null>(null);
  const [signupRoles, setSignupRoles] = useState<string[]>([]);
  const [emailVerification, setEmailVerification] = useState(false);
  const [ibmSignIn, setIbmSignIn] = useState(false);
  const [demoAccounts, setDemoAccounts] = useState<DemoAccount[]>([]);
  const [token, setToken] = useState<string | null>(getToken());
  // Not signed in on a protected server: the landing page is the front door,
  // and the auth panel opens on top of it (null = panel closed).
  const [authPanel, setAuthPanel] = useState<AuthMode | null>(null);
  const needsLogin = authRequired === true && !token;
  const [newVer, setNewVer] = useState<{ defaultTitle: string } | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [systems, setSystems] = useState<SystemInfo[]>([]);
  const [activeSys, setActiveSys] = useState("genapp");
  const [sysMenu, setSysMenu] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [tourAt, setTourAt] = useState<number | null>(null);
  const tourBaseVersion = useRef<string | null>(null);
  useEffect(() => { if (tourAt !== null) tourBaseVersion.current = activeVersionIdRef.current; }, [tourAt]);
  // The sidebar shows the estate, or how to point your own Bob at it.
  const [side, setSide] = useState<"explorer" | "bob">("explorer");
  // One client route. /presentation shows the same argument page the public sees,
  // so a signed-in reader can send it to a colleague instead of describing it.
  const [route, setRoute] = useState(() => window.location.pathname);
  useEffect(() => {
    const onPop = () => setRoute(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const goto = (path: string) => { history.pushState(null, "", path); setRoute(path); window.scrollTo(0, 0); };

  // A token that has expired makes every gated call 401 at once. Rather than let
  // each of them fail on its own - which is how an expired session became a wall
  // of unhandled rejections in the console and a workshop stuck on stale data -
  // end the session once and return to the front door.
  useEffect(() => {
    const onEnded = () => {
      clearSession();
      setToken(null);
      setIdent(null);
      setGraph(null);
      setVersions([]);
      setSessionExpired(true);
    };
    window.addEventListener(SESSION_ENDED, onEnded);
    return () => window.removeEventListener(SESSION_ENDED, onEnded);
  }, []);

  // Ask the server whether it runs open (demo) or with real authentication, before
  // touching any gated endpoint - otherwise the first paint is a wall of 401s.
  useEffect(() => {
    getAuthConfig()
      .then((c) => { setAuthRequired(c.required); setSignupRoles(c.roles || []); setEmailVerification(!!c.email_verification); setIbmSignIn(!!c.ibm_sign_in); setDemoAccounts(c.demo_accounts || []); })
      .catch(() => setAuthRequired(false));
  }, []);
  // First visit: run the tour once the estate is on screen. Before that, half its
  // targets do not exist yet and it would silently skip them.
  useEffect(() => {
    if (graph && !tourWasSeen() && tourAt === null) setTourAt(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph]);

  useEffect(() => {
    if (authRequired === null || needsLogin) return;
    // Swallowed deliberately: a 401 is already handled by the session listener
    // above, and anything else leaves the pane in its loading state rather than
    // rejecting into the console.
    getGraph().then(setGraph).catch(() => {});
    reloadVersions();
    getSystems().then((d) => { setSystems(d.systems); setActiveSys(d.active); }).catch(() => {});
  }, [authRequired, needsLogin]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "p") { e.preventDefault(); setPaletteOpen((v) => !v); }
      else if (e.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  // Cmd/Ctrl+S saves the active code tab into the version (instead of the browser's
  // "save page" dialog). No dep array: always sees the latest tab/handlers.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        const g = groups.find((x) => x.id === activeGroupId) ?? groups[0];
        const t = g.tabs.find((x) => x.key === g.activeKey);
        if (t?.type === "code" && t.path) { e.preventDefault(); if (activeVersion?.status !== "merged" && activeVersionId) saveFile(t.path); }
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
  const reloadVersions = () => listChangeSets().then(setVersions).catch(() => {});
  // Mirror activeVersionId into a ref so in-flight loadContent() can detect a
  // version switch that happened after it started.
  useEffect(() => { activeVersionIdRef.current = activeVersionId; }, [activeVersionId]);

  const allTabs = groups.flatMap((g) => g.tabs);

  useEffect(() => {
    // Switching version reloads every open file to that version's copy. Callers
    // route through switchVersion(), which already warned about unsaved edits, so
    // discarding drafts here is intentional - the file must match the active version.
    const seen = new Set<string>();
    allTabs.filter((t) => t.type === "code" && t.path).forEach((t) => {
      const p = t.path!;
      if (seen.has(p)) return;
      seen.add(p);
      loadContent(p);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVersionId]);

  // True if any open file has edits not yet saved into the active version.
  function hasUnsaved() {
    return allTabs.some((t) => t.type === "code" && t.path && draft[t.path] !== undefined && draft[t.path] !== base[t.path]);
  }
  // Every change of the active version goes through here so unsaved work is never
  // silently lost - and never saved into the wrong version.
  function switchVersion(id: string | null) {
    if (id === activeVersionId) return;
    if (hasUnsaved() && !window.confirm("Unsaved changes will be lost when switching version. Continue?")) return;
    setSaveErr(null);
    setActiveVersionId(id);
  }
  function exitVersion() { switchVersion(null); if (rightTab === "changes") setRightTab("inspector"); }

  // Switch the whole analyzed estate (GenApp <-> CardDemo). Everything resets to the
  // new system: graph, versions, open tabs, selection, drafts.
  async function switchSystem(id: string) {
    setSysMenu(false);
    if (id === activeSys || switching) return;
    if (hasUnsaved() && !window.confirm("Switch system? Unsaved changes will be lost.")) return;
    setSwitching(true);
    try {
      await setSystem(id);
      setActiveSys(id);
      setActiveVersionId(null); setSelectedId(null);
      setBase({}); setDraft({}); setDiffs({}); loadedVer.current = {};
      setAgentActive(false); setLitNodes(new Set()); setGraphFocus(false);
      setGroups([{ id: "g1", tabs: [OVERVIEW_TAB, GRAPH_TAB], activeKey: "overview" }]);
      setActiveGroupId("g1"); setRightTab("inspector");
      const g = await getGraph(); setGraph(g);
      await reloadVersions();
    } finally {
      setSwitching(false);
    }
  }

  // When the Modifs panel is open with no active version, auto-select one (draft
  // first) - even if versions arrive after the panel was opened, so the branch
  // button never leaves a dead-empty panel on a fast click.
  useEffect(() => {
    if (rightTab === "changes" && !activeVersionId && versions.length) {
      const v = versions.find((x) => x.status === "draft") || versions[0];
      setActiveVersionId(v.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versions, rightTab]);

  const idx = useMemo(() => (graph ? nodeIndex(graph) : new Map<string, GNode>()), [graph]);
  // Stable Set - a fresh Set() each render would reset GraphView's kind filters on every re-render.
  const visibleKinds = useMemo(() => new Set(VISIBLE_DEFAULT), []);
  const activeVersion = versions.find((v) => v.id === activeVersionId) || null;
  // A merged version is closed - its files are read-only even though it's "active".
  const versionClosed = activeVersion?.status === "merged";
  const sysReadonly = systems.find((s) => s.id === activeSys)?.readonly ?? false;
  const editable = !!activeVersionId && !versionClosed;
  const node = selectedId ? idx.get(selectedId) || null : null;
  const activeGroup = groups.find((g) => g.id === activeGroupId) ?? groups[0];
  const activeTab = activeGroup.tabs.find((t) => t.key === activeGroup.activeKey);

  // Open a tab in a group (default: the active one), adding it if absent, and focus it.
  function focusTab(t: Tab, groupId: string = activeGroupId) {
    setActiveGroupId(groupId);
    setGroups((gs) => gs.map((g) => {
      if (g.id !== groupId) return g;
      return { ...g, tabs: g.tabs.some((x) => x.key === t.key) ? g.tabs : [...g.tabs, t], activeKey: t.key };
    }));
  }
  function activateTab(groupId: string, key: string) {
    setActiveGroupId(groupId);
    setGroups((gs) => gs.map((g) => (g.id === groupId ? { ...g, activeKey: key } : g)));
  }
  function closeTab(groupId: string, key: string) {
    let next = groups
      .map((g) => {
        if (g.id !== groupId) return g;
        const tabs = g.tabs.filter((t) => t.key !== key);
        const activeKey = g.activeKey === key ? (tabs[tabs.length - 1]?.key ?? "") : g.activeKey;
        return { ...g, tabs, activeKey };
      })
      .filter((g) => g.tabs.length > 0);
    if (!next.length) next = [{ id: "g1", tabs: [OVERVIEW_TAB, GRAPH_TAB], activeKey: "overview" }];
    setGroups(next);
    if (!next.some((g) => g.id === activeGroupId)) setActiveGroupId(next[0].id);
  }
  // Split: put the active pane's current tab into a new pane to the right (max 2).
  function splitActive() {
    if (groups.length >= 2) return;
    const t = activeGroup.tabs.find((x) => x.key === activeGroup.activeKey);
    if (!t) return;
    const id = "g" + groupSeq.current++;
    setGroups((gs) => [...gs, { id, tabs: [t], activeKey: t.key }]);
    setActiveGroupId(id);
  }
  function closeGroup(id: string) {
    const next = groups.filter((g) => g.id !== id);
    if (!next.length) return;
    setGroups(next);
    if (activeGroupId === id) setActiveGroupId(next[0].id);
  }
  function startSplitDrag(e: React.MouseEvent) {
    e.preventDefault();
    const wrap = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    const move = (ev: MouseEvent) => setSplitRatio(Math.min(0.8, Math.max(0.2, (ev.clientX - wrap.left) / wrap.width)));
    const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  async function loadContent(path: string) {
    const ver = activeVersionId;
    // Staleness guard: if the active version changed (or a newer load for this path
    // started) while this fetch was in flight, drop the result - otherwise an
    // out-of-order response overwrites the editor with the wrong version's bytes.
    const token = (loadSeq.current[path] = (loadSeq.current[path] || 0) + 1);
    const f = ver ? await getCsFile(ver, path) : await getFileFull(path);
    if (loadSeq.current[path] !== token || ver !== activeVersionIdRef.current) return;
    loadedVer.current[path] = ver;
    setBase((b) => ({ ...b, [path]: f.content }));
    setDraft((d) => ({ ...d, [path]: f.content }));
  }
  function openFile(n: GNode) {
    const path = n.attrs?.path as string | undefined;
    setSelectedId(n.id);
    if (!path) { setRightTab("inspector"); return; }
    focusTab({ key: "code:" + path, type: "code", title: n.label, path, nodeId: n.id });
    // Reload if never loaded OR cached under a different version than the active one.
    if (!(path in base) || loadedVer.current[path] !== activeVersionId) loadContent(path);
    setRightTab("inspector");
  }
  function openNode(id: string) {
    const n = idx.get(id);
    if (!n) return;
    if (n.attrs?.path) openFile(n);
    else showInGraph(id);
  }
  // Graph single-click: select + reveal context in the inspector, without leaving the graph tab.
  function selectNode(id: string) { setSelectedId(id); setRightTab("inspector"); }
  // Reveal an entity in the graph: open the graph tab, zoom on its neighbourhood.
  function showInGraph(id: string) {
    setSelectedId(id);
    setGraphFocus(true);
    setRightTab("inspector");
    focusTab(GRAPH_TAB);
  }
  // Overview hero CTA: jump to the graph and fire the deterministic red impact ripple.
  function showImpactFor(id: string) {
    const n = idx.get(id);
    if (!n) return;
    setSelectedId(id);
    setGraphFocus(false);
    setAgentActive(false);
    setImpactReq({ id, label: n.label, nonce: impactSeq.current++ });
    focusTab(GRAPH_TAB);
  }
  // Sidebar "Ressources": entities usually have no source file - the useful view is
  // their neighbourhood in the graph; copybooks (which do have source) open as code.
  const openResource = (n: GNode) => openNode(n.id);
  // Inspector "Modifier…": open the file AND start the modification gesture -
  // if no version is active yet, propose creating one (was a silent no-op before).
  function editNode(n: GNode) {
    openFile(n);
    if (!activeVersionId) newVersion(`Edit ${n.label}`);
  }
  // Source-control button: just open Modifs. Selection is handled reactively below
  // so it works even if versions are still loading when the button is clicked.
  function openChanges() { setRightTab("changes"); }
  // Open a file at a cited line: resolve "lgipol01.cbl:55" -> node -> open + flash line.
  function openFileAt(fileOrPath: string, line?: number) {
    if (!graph) return;
    const bn = fileOrPath.split("/").pop()!.toLowerCase();
    const n = graph.nodes.find((nd) => {
      const p = ((nd.attrs?.path as string) || "").toLowerCase();
      return p && (p.split("/").pop() === bn || p.endsWith(bn));
    });
    if (!n) return;
    openFile(n);
    const path = n.attrs!.path as string;
    if (line && line > 0) setHighlights((h) => ({ ...h, [path]: { line, nonce: hlSeq.current++ } }));
  }

  // Map a trace step's sources ("copy:LGPOLICY", "lgipol01.cbl:55", "LGPOLICY") to node ids.
  function litFromSources(sources: string[]): string[] {
    if (!graph) return [];
    const out: string[] = [];
    for (const s of sources || []) {
      if (idx.has(s)) { out.push(s); continue; }
      const m = s.match(/^([\w.-]+\.(?:cbl|cpy|jcl|bms|csd))(?::\d+)?$/i);
      if (m) {
        const bn = m[1].toLowerCase();
        const n = graph.nodes.find((nd) => ((nd.attrs?.path as string) || "").toLowerCase().endsWith(bn));
        if (n) out.push(n.id);
        continue;
      }
      const up = s.toUpperCase();
      const n = graph.nodes.find((nd) => nd.label.toUpperCase() === up);
      if (n) out.push(n.id);
    }
    return out;
  }
  // The main entity a question is about (longest node label appearing in the text),
  // so we can offer "collapse the reasoning to just this + its neighbours".
  function primaryEntityOf(q: string): GNode | null {
    if (!graph) return null;
    const up = q.toUpperCase();
    const kinds = new Set(["PGM", "COPYBOOK", "DB2_TABLE", "CICS_TXN", "CICS_FILE", "BMS_MAP"]);
    let best: GNode | null = null;
    for (const n of graph.nodes) {
      if (!kinds.has(n.kind)) continue;
      const lbl = n.label.toUpperCase();
      if (lbl.length >= 3 && new RegExp(`\\b${lbl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(up)) {
        if (!best || n.label.length > best.label.length) best = n;
      }
    }
    return best;
  }
  // Agent query lifecycle → live graph animation (grey all, light what the RAG touches).
  function onAgentStart(question: string) { setAgentActive(true); setLitNodes(new Set()); setAgentPrimary(primaryEntityOf(question)); focusTab(GRAPH_TAB); }
  // Collapse the whole reasoning trail down to just the asked entity + its direct
  // neighbours (drop the greyed reasoning landscape).
  function focusPrimary() {
    if (!agentPrimary) return;
    setAgentActive(false); setLitNodes(new Set());
    setSelectedId(agentPrimary.id); setGraphFocus(true); setRightTab("inspector"); focusTab(GRAPH_TAB);
  }
  function onAgentTrace(step: { sources?: string[] }) {
    const ids = litFromSources(step.sources || []);
    if (!ids.length || !graph) return;
    setLitNodes((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        next.add(id);
        for (const e of graph.edges) {
          if (e.src === id) next.add(e.dst);
          else if (e.dst === id) next.add(e.src);
        }
      }
      return next;
    });
  }
  function onAgentEnd() { setAgentActive(false); }
  function onCommand(id: string) {
    if (id === "cmd:overview") focusTab(OVERVIEW_TAB);
    else if (id === "cmd:graph") focusTab(GRAPH_TAB);
    else if (id === "cmd:agent") setRightTab("chat");
    else if (id === "cmd:version") newVersion();
  }

  function newVersion(defaultTitle = "New change-set") { setNewVer({ defaultTitle }); }
  async function createVersion(title: string) {
    const cs = await createChangeSet(title, identity?.name || "guest");
    // Carry any edits already typed on main INTO the new version - creating a version
    // to capture the current change is the whole point of "Edit in a version",
    // and the version-switch effect below would otherwise reload (discard) them.
    const dirtyPaths = [...new Set(allTabs.filter((t) => t.type === "code" && t.path && draft[t.path] !== undefined && draft[t.path] !== base[t.path]).map((t) => t.path!))];
    for (const p of dirtyPaths) {
      await editCsFile(cs.id, p, draft[p], "initial edit");
      loadedVer.current[p] = cs.id;
      setBase((b) => ({ ...b, [p]: draft[p] })); // now clean under the new version
    }
    setActiveVersionId(cs.id); await reloadVersions(); setRightTab("changes"); setNewVer(null);
  }
  async function saveFile(path: string) {
    if (!activeVersionId) { newVersion(`Edit ${path.split("/").pop()}`); return; }
    const content = draft[path] ?? base[path] ?? "";
    setSaving(true); setSaveErr(null); setSavedOk(false);
    try {
      await editCsFile(activeVersionId, path, content, "edit via editor");
      // Mark clean: base now equals the saved content, so the "unsaved" flag clears.
      loadedVer.current[path] = activeVersionId;
      setBase((b) => ({ ...b, [path]: content }));
      await reloadVersions();
      setRightTab("changes");
      setSavedOk(true); setTimeout(() => setSavedOk(false), 1800);
    } catch (e) {
      setSaveErr(String((e as Error).message || e));
    } finally {
      setSaving(false);
    }
  }
  async function openDiff(path: string) {
    if (!activeVersionId) return;
    try {
      const d = await getCsDiff(activeVersionId, path); setDiffs((x) => ({ ...x, [path]: d.diff }));
      focusTab({ key: "diff:" + path, type: "diff", title: "Diff · " + path.split("/").pop(), path });
    } catch { /* diff fetch failed - leave the current view intact */ }
  }
  function ask(q: string) { setChatSeed({ q, nonce: (chatSeed?.nonce || 0) + 1 }); setRightTab("chat"); }
  function doSearch() {
    if (!graph) return;
    const q = search.trim().toUpperCase(); if (!q) return;
    const hit = graph.nodes.find((n) => n.label.toUpperCase() === q) || graph.nodes.find((n) => n.label.toUpperCase().includes(q));
    if (hit) { setSearchMiss(false); openNode(hit.id); }
    else { setSearchMiss(true); setTimeout(() => setSearchMiss(false), 2200); }
  }

  // Real-auth mode: nothing of the estate is fetched - let alone painted - before
  // sign-in. Visitors get the public landing page instead.
  if (route === "/presentation")
    return (
      <Landing mode="presentation" onSignIn={() => {}} onSignUp={() => {}} onBack={() => goto("/")} />
    );

  if (needsLogin)
    return (
      <>
        <ReturnBanner expired={sessionExpired} />
        <Landing onSignIn={() => setAuthPanel("login")} onSignUp={() => setAuthPanel("signup")} />
        {authPanel && (
          <Auth mode={authPanel} roles={signupRoles} emailVerification={emailVerification} ibmSignIn={ibmSignIn} onMode={setAuthPanel} onClose={() => setAuthPanel(null)}
            onDone={(id) => { setIdent(id); setToken(getToken()); setAuthPanel(null); }} />
        )}
      </>
    );

  if (!graph)
    return <div className="app"><div className="titlebar"><div className="brand"><Logo size={18} /><span className="nm">COBOL Explorer</span></div></div><div className="emptypane">Loading estate…</div></div>;

  const c = kindCount(graph);
  const init = (identity?.name || "?").trim().charAt(0).toUpperCase();

  const AB = ({ name, on, badge, onClick, title }: { name: string; on?: boolean; badge?: number; onClick: () => void; title?: string }) => (
    <div className={`abtn ${on ? "on" : ""}`} onClick={onClick} data-ab={name} title={title}>
      <Icon name={name} size={20} />
      {badge ? <span className="dot">{badge}</span> : null}
    </div>
  );

  // Render one editor pane (a group). Two groups render side by side (split view).
  const renderGroup = (g: TabGroup, gi: number) => {
    const gActive = g.id === activeGroupId;
    const t = g.tabs.find((x) => x.key === g.activeKey);
    const gDirty = t?.type === "code" && t.path && draft[t.path] !== base[t.path];
    const grow = groups.length === 2 ? (gi === 0 ? splitRatio : 1 - splitRatio) : 1;
    return (
      <div key={g.id} className={`editor ${gActive && groups.length > 1 ? "eg-active" : ""}`} style={{ flex: `${grow} 1 0`, minWidth: 0 }} onMouseDown={() => setActiveGroupId(g.id)}>
        <div className="tabbar">
          {g.tabs.map((tab) => (
            <div key={tab.key} className={`tab ${g.activeKey === tab.key ? "on" : ""} ${tab.type === "diff" ? "ital" : ""}`} onClick={() => activateTab(g.id, tab.key)}>
              {tab.type === "code" && <Icon name="file" size={13} color="var(--text-helper)" />}
              {tab.type === "graph" && <Icon name="graph" size={13} color="var(--text-helper)" />}
              {tab.type === "diff" && <Icon name="branch" size={13} color="var(--text-helper)" />}
              {tab.title}
              {tab.type !== "overview" && tab.type !== "graph" && (
                <span className="x" onClick={(e) => { e.stopPropagation(); closeTab(g.id, tab.key); }}><Icon name="close" size={12} /></span>
              )}
            </div>
          ))}
          <div style={{ flex: 1 }} />
          {groups.length < 2 && t ? (
            <div className="tab-act" title="Open beside (split)" data-testid="split-editor" onClick={splitActive}><Icon name="split" size={14} /></div>
          ) : groups.length >= 2 ? (
            <div className="tab-act" title="Close this pane" onClick={() => closeGroup(g.id)}><Icon name="close" size={14} /></div>
          ) : null}
        </div>

        {t?.type === "code" && t.path ? (
          <div className="editor-top">
            <span><span className="crumb">{t.path.split("/").slice(-2, -1)[0]} › </span>{t.path.split("/").pop()}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: editable ? "var(--interactive)" : "var(--text-helper)", fontSize: 10.5 }}>
              <span className="led" style={{ background: savedOk ? "var(--verified)" : editable ? "var(--interactive)" : "var(--text-helper)" }} />
              {savedOk ? "Saved ✓" : versionClosed ? "Merged version · read-only" : editable ? (gDirty ? "Editing · unsaved" : "Editing") : "Read-only"}
            </span>
            {saveErr && <span style={{ color: "var(--danger)", fontSize: 10.5 }} data-testid="save-error" title={saveErr}>⚠ save failed</span>}
            {sysReadonly ? (
              <span style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--text-helper)" }} title="This system is read-only (analysis). Versioning is on the main system.">system is read-only</span>
            ) : versionClosed ? (
              <button className="btn" style={{ marginLeft: "auto", fontSize: 11, padding: "5px 10px" }} onClick={exitVersion} data-testid="exit-version">
                <Icon name="branch" size={13} color="var(--text-helper)" />Back to main
              </button>
            ) : (
              <button className={editable ? "btn-pri" : "btn"} style={{ marginLeft: "auto", fontSize: 11, padding: "5px 10px", opacity: saving ? 0.6 : 1 }} disabled={saving} data-testid="save-file" onClick={() => saveFile(t.path!)}>
                {!activeVersionId && <Icon name="branch" size={13} color="var(--interactive)" />}
                {saving ? "Saving…" : activeVersionId ? "Save into version" : "Edit in a version"}
              </button>
            )}
          </div>
        ) : t?.type === "diff" && t.path ? (
          <div className="editor-top">
            <Icon name="branch" size={13} color="var(--interactive)" />
            <span style={{ color: "var(--interactive)" }}>{activeVersion?.title}</span>
            <span className="crumb">›</span> {t.path.split("/").pop()}
          </div>
        ) : (
          <div className="breadcrumb">
            {/* Hardcoded "genapp" survived the second estate: on CardDemo every
                surface switched except this one word. */}
            <span className="crumb">{activeSys}</span><Icon name="chev" size={11} color="var(--text-helper)" />
            <span style={{ color: "var(--text-primary)" }}>{t?.title}</span>
          </div>
        )}

        <div className="tabcontent sb">
          {t?.type === "overview" && <Overview graph={graph} systemLabel={systems.find((s) => s.id === activeSys)?.label} systemDetail={systems.find((s) => s.id === activeSys)?.detail} onOpenNode={openNode} onAsk={ask} onShowImpact={showImpactFor} />}
          {t?.type === "graph" && <GraphView graph={graph} visibleKinds={visibleKinds} onSelect={selectNode} onOpen={openNode} selectedId={selectedId} agentActive={agentActive} litNodes={litNodes} focus={graphFocus} onFocusChange={setGraphFocus} agentPrimaryLabel={agentPrimary?.label} onFocusPrimary={focusPrimary} impactReq={impactReq} />}
          {t?.type === "code" && t.path && (
            <div className="cm-host no-top">
              <CodeView value={draft[t.path] ?? base[t.path] ?? "// loading…"} editable={editable} highlight={highlights[t.path]} onChange={(v) => setDraft((d) => ({ ...d, [t.path!]: v }))} />
            </div>
          )}
          {t?.type === "diff" && t.path && (
            <div style={{ padding: "10px 0" }}>
              {(diffs[t.path] || "").split("\n").map((l, i) => (
                <div key={i} className={"dl " + (l.startsWith("+") && !l.startsWith("+++") ? "da" : l.startsWith("-") && !l.startsWith("---") ? "dd" : "dm")}>{l}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="app">
      {/* TITLE BAR */}
      <div className="titlebar">
        <div className="brand">
          <Logo size={18} title="COBOL Explorer" />
          <span className="nm">COBOL Explorer</span>
          <span style={{ color: "var(--text-helper)" }}>·</span>
          {/* System selector: analyze a different mainframe estate */}
          <div style={{ position: "relative" }}>
            <button className="sysbtn" onClick={() => setSysMenu((v) => !v)} data-testid="system-btn" title="Switch analyzed system" disabled={switching}>
              <Icon name="graph" size={12} color="var(--interactive)" />
              <b style={{ color: "var(--text-primary)" }}>{systems.find((s) => s.id === activeSys)?.label || "GenApp"}</b>
              <span style={{ color: "var(--text-helper)", fontSize: 11 }}>{systems.find((s) => s.id === activeSys)?.detail}</span>
              <span style={{ color: "var(--text-helper)", fontSize: 9 }}>▾</span>
            </button>
            {sysMenu && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 90 }} onClick={() => setSysMenu(false)} />
                <div className="sysmenu" data-testid="system-menu">
                  <div className="sysmenu-h">System to analyze</div>
                  {systems.map((s) => (
                    <div key={s.id} className={`sysmenu-item ${s.id === activeSys ? "on" : ""}`} onClick={() => switchSystem(s.id)} data-testid={`system-${s.id}`}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <Icon name="graph" size={12} color={s.id === activeSys ? "var(--interactive)" : "var(--text-helper)"} />
                        <b style={{ color: "var(--text-primary)" }}>{s.label}</b>
                        {s.id === activeSys && <span style={{ color: "var(--interactive)", fontSize: 10 }}>● active</span>}
                      </div>
                      <div style={{ font: "400 10.5px/1.5 var(--s)", color: "var(--text-helper)", marginTop: 3 }}>{s.detail}</div>
                      <div style={{ font: "500 9.5px var(--m)", color: "var(--text-secondary)", marginTop: 2 }}>{s.nodes} nodes · {s.edges} links</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <div className="cmdk" style={searchMiss ? { borderColor: "var(--danger)" } : undefined}>
            <Icon name="search" size={13} color={searchMiss ? "var(--danger)" : "var(--text-helper)"} />
            <input
              value={search}
              data-testid="search"
              placeholder={searchMiss ? `No result for “${search}”` : "Go to a program, a table, a transaction…"}
              onChange={(e) => { setSearch(e.target.value); if (searchMiss) setSearchMiss(false); }}
              onKeyDown={(e) => e.key === "Enter" && doSearch()}
            />
            <span className="kbd" style={{ cursor: "pointer" }} onClick={() => setPaletteOpen(true)}>⌘P</span>
          </div>
        </div>
        <button className="tbtn" data-testid="open-tour" title="Replay the guided tour"
          onClick={() => setTourAt(0)}>Tour</button>
        <a className="tbtn" data-testid="open-presentation" href="/presentation" title="What this product argues, on one page"
          onClick={(e) => { e.preventDefault(); goto("/presentation"); }}>Presentation</a>
        <div className="userpill" onClick={() => setShowOnb(true)} data-testid="identity">
          <span className="av">{init}</span>
          <span className="un">{identity?.name || "guest"}</span>
        </div>
      </div>

      {/* BODY */}
      <div className="body">
        <div className="activitybar">
          {/* Exactly ONE of files / graph / plug is lit, ever. The Bob panel is
              a sidebar takeover, so any other button hands the sidebar back to
              the estate tree - clicking Explorer while the MCP panel was open
              used to change the centre tab and leave the panel standing, which
              read as "the button does nothing". */}
          <AB name="files" title="Explorer" on={side === "explorer" && activeTab?.type !== "graph"}
            onClick={() => { setSide("explorer"); focusTab(OVERVIEW_TAB); }} />
          <AB name="search" title="Search" onClick={() => { setSide("explorer"); (document.querySelector('[data-testid="search"]') as HTMLInputElement)?.focus(); }} />
          <AB name="graph" title="Estate graph" on={side === "explorer" && activeTab?.type === "graph"}
            onClick={() => { setSide("explorer"); focusTab(GRAPH_TAB); }} />
          {/* Panel jumps - the panel's own tab bar (Agent/Inspecteur/Modifs) shows which is active. */}
          <AB name="branch" title="Versions / Changes" badge={versions.length || undefined}
            onClick={() => { setSide("explorer"); openChanges(); }} />
          <AB name="spark" title="Agent" onClick={() => { setSide("explorer"); setRightTab("chat"); }} />
          <AB name="plug" title="Connect your Bob (MCP)" on={side === "bob"}
            onClick={() => setSide((v) => (v === "bob" ? "explorer" : "bob"))} />
          <div style={{ marginTop: "auto", marginBottom: 6 }}>
            <AB name="sliders" title="Settings" onClick={() => setShowOnb(true)} />
          </div>
        </div>

        <div className="sidebar sb">
          {side === "bob" ? <BobPanel /> : <Navigator
            graph={graph}
            versions={versions}
            activeVersion={activeVersionId}
            readonly={sysReadonly}
            onOpenFile={openFile}
            onOpenResource={openResource}
            onOpenVersion={(v) => { switchVersion(v.id); setRightTab("changes"); }}
            onNewVersion={() => newVersion()}
            selectedPath={activeTab?.path || null}
            selectedId={selectedId}
          />}
        </div>

        {/* EDITOR - one or two panes side by side (split view) */}
        <div className="editorwrap">
          {groups.map((g, gi) => (
            <Fragment key={g.id}>
              {gi > 0 && <div className="splitter" onMouseDown={startSplitDrag} title="Redimensionner" />}
              {renderGroup(g, gi)}
            </Fragment>
          ))}
        </div>

        {/* PANEL */}
        <div className="panel">
          <div className="tabbar">
            {([["chat", "Agent"], ["inspector", "Inspector"], ["changes", "Changes"], ["audit", "Audit"]] as const).map(([rt, label]) => (
              <div key={rt} className={`tab ${rightTab === rt ? "on" : ""}`} style={{ flex: 1, justifyContent: "center", padding: "0 8px" }} onClick={() => setRightTab(rt)} data-testid={`rp-${rt}`}>
                {label}
                {rt === "changes" && activeVersion && activeVersion.edits.length > 0 && (
                  <span style={{ background: "var(--interactive)", color: "var(--text-on-color)", font: "600 9px var(--m)", padding: "0 5px", borderRadius: 99 }}>{activeVersion.edits.length}</span>
                )}
              </div>
            ))}
          </div>
          {/* All three stay mounted; we toggle visibility so the agent conversation
              (and any in-progress input) survives switching panels - no re-seeding. */}
          <div className="tabcontent sb" style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: rightTab === "chat" ? "flex" : "none", flexDirection: "column", flex: 1, minHeight: 0 }}>
              <ChatPanel seed={chatSeed} onCite={openFileAt} onOpenNode={openNode} onQueryStart={onAgentStart} onTrace={onAgentTrace} onQueryEnd={onAgentEnd} />
            </div>
            <div style={{ display: rightTab === "inspector" ? "block" : "none" }}>
              <Inspector node={node} graph={graph} onOpenNode={openNode} onEdit={editNode} onShowInGraph={showInGraph} activePath={activeTab?.path || null} />
            </div>
            <div data-testid="rp-changes-panel" style={{ display: rightTab === "changes" ? "flex" : "none", flexDirection: "column", flex: 1, minHeight: 0 }}>
              <ChangesPanel version={activeVersion} author={identity?.name || "you"} onReload={reloadVersions} onOpenDiff={openDiff} onFileReverted={(p) => loadContent(p)} onExit={exitVersion} />
            </div>
            {rightTab === "audit" && (
              <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
                <AuditPanel />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* STATUS BAR */}
      <div className="statusbar">
        {activeVersionId ? (
          <div className="status" style={{ color: "var(--interactive)", cursor: "pointer" }} onClick={exitVersion} data-testid="statusbar-version"
            title="You are working in a version. Click to go back to main (read-only)">
            <Icon name="branch" size={12} />{activeVersion?.title} <span style={{ color: "var(--text-helper)" }}>✕ main</span>
          </div>
        ) : (
          <div className="status" style={{ color: "var(--interactive)" }}><Icon name="branch" size={12} />main</div>
        )}
        <div className="status" data-testid="statusbar-mode"><span className="led" style={{ background: editable ? "var(--interactive)" : "var(--text-helper)" }} />{versionClosed ? "Merged · read-only" : editable ? "Editing" : "Read-only"}</div>
        <div style={{ flex: 1 }} />
        <div className="status">{c.PGM || 0} prog · {graph.stats.edges} links</div>
        <div className="status">COBOL · CICS · DB2</div>
        <div className="status" style={{ color: "var(--text-secondary)" }}>{identity?.role || "Agent ready"}</div>
      </div>

      <Tour
        run={tourAt !== null}
        onClose={() => setTourAt(null)}
        hooks={{
          openTab: (t) => setRightTab(t),
          openGraph: () => focusTab(GRAPH_TAB),
          openSide: (which) => setSide(which),
          openOverview: () => focusTab(OVERVIEW_TAB),
          // The tour shows rather than tells - but it does not type into the
          // search box on the reader's behalf. Writing into a live input leaves
          // text behind after the tour ends, and the field is theirs, not ours.
          // The example is named in the popover instead.
          selectExample: () => {
            const hit = graph?.nodes.find((n) => n.label === TOUR_EXAMPLE);
            if (hit) setSelectedId(hit.id);
          },
          // Hand the workshop back the way the tour found it. Its changes step
          // auto-enters the first draft version (that is the panel's normal
          // behaviour), so without this a first-time reader finished the tour
          // INSIDE somebody's draft, status bar reading "Editing" - right after
          // being told they never have to wonder where what they type lands.
          finish: () => {
            if (!tourBaseVersion.current && activeVersionIdRef.current) switchVersion(null);
            setRightTab("inspector");
            focusTab(OVERVIEW_TAB);
          },
        }}
      />

      {paletteOpen && <CommandPalette graph={graph} onClose={() => setPaletteOpen(false)} onOpenNode={openNode} onCommand={onCommand} />}
      {newVer && <NewVersionModal defaultTitle={newVer.defaultTitle} onCreate={createVersion} onClose={() => setNewVer(null)} />}
      {/* One-click role switching, demo affordance: a REAL login as one of the
          published demo accounts - new signed token, server re-arbitrates
          everything. The reload is deliberate: every panel re-opens under the
          new role's rights, nothing carries over. */}
      {(!identity || showOnb) && (
        <Onboarding
          initial={identity}
          // With a signed session the role lives in the token: the picker would
          // change the label in the corner and nothing the server enforces.
          locked={authRequired === true && !!token}
          onDone={(id) => { setIdent(id); setShowOnb(false); }}
          onSignOut={() => {
            clearSession(); clearHomeSession(); setToken(null); setIdent(null); setShowOnb(false);
            setGraph(null); setVersions([]); setActiveVersionId(null);
          }}
          demoAccounts={demoAccounts}
          onSwitchAccount={(user) => {
            // Remember the REAL session once, so trying roles is a round trip,
            // not a one-way door: the dialog then offers "back to my account".
            stashHomeSession();
            login(user, "demo").then((r) => {
              saveSession({ name: r.name, role: r.role }, r.token);
              window.location.reload();
            });
          }}
          homeIdentity={getHomeSession()?.identity ?? null}
          onReturnHome={() => {
            if (restoreHomeSession()) window.location.reload();
          }}
        />
      )}
    </div>
  );
}
