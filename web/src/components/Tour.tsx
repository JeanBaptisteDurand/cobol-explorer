import { useEffect } from "react";
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import "./tour.css";

/** The guided tour of the workshop.
 *
 *  It runs once on a first visit and can be replayed from the header. Two rules
 *  it follows, because a tour that breaks them is worse than none:
 *
 *  · every step puts the interface into the state it is describing before it
 *    speaks — highlighting a closed panel and talking about its contents is how
 *    a tour teaches someone the wrong thing;
 *  · every step points at something that exists. A step whose target is missing
 *    is skipped rather than shown against the page corner, so a narrow window or
 *    a role without a panel degrades quietly.
 */

export interface TourHooks {
  openTab: (tab: "chat" | "inspector" | "changes" | "audit") => void;
  openGraph: () => void;
  /** Swap the sidebar to the estate tree, or to the Bob connection panel. */
  openSide: (which: "explorer" | "bob") => void;
  openOverview: () => void;
  /** Select that entity, so the inspector is full rather than showing its placeholder. */
  selectExample: () => void;
  /** Restore the pre-tour state: leave any version the tour entered, back to the overview. */
  finish: () => void;
}

/** `before` runs, then the DOM settles, then the step is shown. */
interface Step { el: string; title: string; text: string; side?: "left" | "right" | "top" | "bottom"; before?: () => void; }

const STEPS = (h: TourHooks): Step[] => [
  {
    el: '[data-testid="search"]',
    title: "Start by naming something",
    text: "A program, a copybook, a DB2 table, a CICS transaction — type its name and press Enter. Try LGPOLICY: the copybook eleven programs depend on, and the one the rest of this tour follows.",
    side: "bottom",
    before: h.openOverview,
  },
  {
    el: ".cmdk .kbd",
    title: "Or describe it, if you do not know the name",
    text: "⌘P opens the palette. Beside the exact matches it runs a semantic search over the estate — IBM Granite embeddings — so “where is the premium calculated” finds the code when nobody remembers which program holds it. On an estate this old, nobody knows the names; that is the whole point.",
    side: "bottom",
  },
  {
    el: ".sidebar",
    title: "The estate, by business domain",
    before: () => h.openSide("explorer"),
    text: "Not a file tree — the programs grouped the way the business thinks, with the mainframe resources underneath: copybooks, CICS transactions, VSAM files, BMS screens, DB2 tables, and the batch that runs at night.",
    side: "right",
  },
  {
    el: '[data-testid="impact-hero"]',
    title: "The question everyone actually has",
    text: "Change this copybook and you must recompile 25 programs. Not a sample, not an estimate — a deterministic traversal of the graph, and one click shows you exactly which ones.",
    side: "bottom",
    before: h.openOverview,
  },
  {
    el: '[data-ab="graph"]',
    title: "The estate as a graph",
    text: "Every dependency the parser found: COPY, CALL, EXEC SQL, EXEC CICS, the JCL steps and the scheduler chains. Ask for an impact and the closure lights up in red, right there.",
    side: "right",
    before: h.openGraph,
  },
  {
    el: '[data-testid="rp-chat"]',
    title: "Ask in plain language",
    text: "An agent on IBM Granite that picks its own tools and logs why before each one. Every answer cites file:line, and the server re-verifies each citation against the source before it reaches you.",
    side: "left",
    before: () => h.openTab("chat"),
  },
  {
    el: '[data-testid="rp-inspector"]',
    title: "What one entity touches",
    text: "LGPOLICY is selected, so this is its real context: the programs that copy it, the tables and screens they reach, the batch steps that run them — and the field-level impact, down to which of its fields anything actually references.",
    side: "left",
    before: () => { h.selectExample(); h.openTab("inspector"); },
  },
  {
    el: '[data-testid="insp-edit"]',
    title: "The one bridge from reading to changing",
    text: "Everything so far was read-only by construction, not by policy. This is the single button that crosses over — and it does not edit the estate: it opens an isolated version and puts you inside it. There is no other way to change anything here.",
    side: "left",
    before: () => { h.selectExample(); h.openTab("inspector"); },
  },
  {
    el: '[data-testid="sidebar-versions"]',
    before: () => h.openSide("explorer"),
    title: "Your work lives in versions",
    text: "Nothing is edited in place. “+ New version” opens a real git branch off the estate, and every version you or a teammate has open is listed here with its state — draft while you work, proposed once it is submitted, merged when it has been applied. Click one to work inside it; the status bar then tells you which version you are in.",
    side: "right",
  },
  {
    el: '[data-testid="cs-lifecycle"]',
    title: "One version, three stages",
    text: "A version is one change, reviewed as one — like a pull request. While it is a draft it is yours: edit and save as many times as you like, every save is a commit on your branch and the impact below recomputes. Nothing you save reaches the estate.",
    side: "left",
    before: () => h.openTab("changes"),
  },
  {
    el: '[data-testid="merge-btn"]',
    title: "Propose, then someone accepts",
    text: "When the change is ready, Propose submits it for review — the team reads the diff, the impact and your record. Accepting it is the Merge button, reserved to developers and architects, and the gate states the blast radius out loud before anything touches main. Merged, the version closes; the next change gets a new one.",
    side: "left",
    before: () => h.openTab("changes"),
  },
  {
    el: '[data-testid="identity"]',
    title: "Roles: who may do what",
    text: "Your badge. Six roles, and the server — never the interface — decides what each may do: dev and architect review and MERGE, risk may propose but is refused the merge, auditor and compliance READ THE AUDIT TRAIL, and a guest only reads. On the signed deployment your role travels inside your token, so relabeling yourself changes nothing — click the badge to switch to a demo account instead: a real login, a new token, every right re-decided. In production there is no switcher; an administrator or the corporate IdP assigns roles.",
    side: "bottom",
  },
  {
    el: '[data-testid="rp-audit"]',
    title: "Everything, including the refusals",
    text: "Every query, read, change and denial is appended to an HMAC-chained log. Altering one line breaks the chain, and the panel says so. Reading it is a right of the auditor and compliance roles — try it as Marc from your badge; if your role lacks it, the panel offers the switch and your refusal itself is written to the log.",
    side: "left",
    before: () => h.openTab("audit"),
  },
  {
    el: '[data-testid="bob-panel"]',
    title: "Take these tools into your own editor",
    text: "The three the agent here runs on — graph_lookup, search_code, read_source_lines — are exposed over MCP, so IBM Bob can call them instead of reading files and guessing. Everything you need is in this panel: it runs over stdio on your own machine, beside your estate, and the configuration is one copy away.",
    side: "right",
    before: () => h.openSide("bob"),
  },
  {
    el: '[data-testid="statusbar-mode"]',
    before: () => h.openSide("explorer"),
    title: "It always tells you where you stand",
    text: "Read-only on the main estate, Editing once you are inside a version — and the branch you are in is named to its left. You never have to wonder whether what you are typing can reach production.",
    side: "top",
  },
  {
    el: '[data-testid="system-btn"]',
    title: "Two real estates",
    text: "IBM GenApp for insurance and AWS CardDemo for credit cards. Same parser, same graph, same agent — switching estate is one click.",
    side: "bottom",
  },
  {
    el: '[data-testid="open-presentation"]',
    title: "And the argument, on one page",
    text: "What this product claims and why, with the numbers it is willing to be checked on. Send it to whoever asked you what you are using.",
    side: "bottom",
  },
];

const TOUR_SEEN = "cobol-explorer-tour-seen";
export const tourWasSeen = () => localStorage.getItem(TOUR_SEEN) === "1";

export default function Tour({ run, hooks, onClose }: { run: boolean; hooks: TourHooks; onClose: () => void }) {
  useEffect(() => {
    if (!run) return;
    let d: ReturnType<typeof driver> | null = null;

    const all = STEPS(hooks);
    // A step that declares `before` is responsible for its own target, so it is
    // never filtered — that check is only for steps pointing at something that
    // may genuinely be absent, like a panel a role cannot see. Filtering on the
    // live DOM instead made steps vanish depending on which panel happened to be
    // open, and cost two of them twice.
    const steps = all.filter((s) => s.before || document.querySelector(s.el));
    if (!steps.length) { onClose(); return; }

    /** Prepare a step, then let React paint before driver measures its target. */
    const goto = (i: number, move: () => void) => {
      steps[i]?.before?.();
      window.setTimeout(move, 70);
    };

    d = driver({
      showProgress: true,
      progressText: "{{current}} of {{total}}",
      nextBtnText: "Next →",
      prevBtnText: "← Back",
      doneBtnText: "Start working",
      popoverClass: "ce-tour",
      stagePadding: 6,
      stageRadius: 0,
      overlayColor: "#000",
      overlayOpacity: 0.72,
      allowClose: true,
      onDestroyed: () => { localStorage.setItem(TOUR_SEEN, "1"); hooks.openSide("explorer"); hooks.finish(); onClose(); },
      steps: steps.map<DriveStep>((s) => ({
        element: s.el,
        popover: { title: s.title, description: s.text, side: s.side ?? "bottom", align: "start" },
      })),
      onNextClick: (_e, _s, { state }) => goto((state.activeIndex ?? 0) + 1, () => d?.moveNext()),
      onPrevClick: (_e, _s, { state }) => goto((state.activeIndex ?? 0) - 1, () => d?.movePrevious()),
    });

    goto(0, () => d?.drive());
    return () => { d?.destroy(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  return null;
}
