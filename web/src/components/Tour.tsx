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
  openOverview: () => void;
  /** Put a real identifier in the search box, so the step has something to point at. */
  typeExample: () => void;
  /** Select that entity, so the inspector is full rather than showing its placeholder. */
  selectExample: () => void;
}

/** `before` runs, then the DOM settles, then the step is shown. */
interface Step { el: string; title: string; text: string; side?: "left" | "right" | "top" | "bottom"; before?: () => void; }

const STEPS = (h: TourHooks): Step[] => [
  {
    el: '[data-testid="search"]',
    title: "Start by naming something",
    text: "A program, a copybook, a DB2 table, a CICS transaction. We have put LGPOLICY in for you — the copybook eleven programs depend on. Press Enter to open it, or press ⌘P for the palette, which also searches by intent: “where is the premium calculated” finds the code without you knowing its name.",
    side: "bottom",
    before: () => { h.openOverview(); h.typeExample(); },
  },
  {
    el: ".sidebar",
    title: "The estate, by business domain",
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
    el: '[data-testid="sidebar-versions"]',
    title: "Your work lives in versions",
    text: "Nothing is edited in place. “+ New version” opens a real git branch off the estate, and every version you or a teammate has open is listed here with its state — draft while you work, proposed once it is submitted, merged when it has been applied. Click one to work inside it; the status bar then tells you which version you are in.",
    side: "right",
  },
  {
    el: '[data-testid="rp-changes"]',
    title: "A change is a proposal",
    text: "This is what happens to the version you picked: the files you touched, the diff against main, the impact recomputed at every edit, and the team's comments. Propose submits it for review; the merge gate then states the blast radius out loud and asks whoever is entitled to confirm it.",
    side: "left",
    before: () => h.openTab("changes"),
  },
  {
    el: '[data-testid="rp-audit"]',
    title: "Everything, including the refusals",
    text: "Every query, read, change and denial is appended to an HMAC-chained log. Altering one line breaks the chain, and the panel says so. Reading it is itself a right — not every role has it.",
    side: "left",
    before: () => h.openTab("audit"),
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

    const steps = STEPS(hooks).filter((s) => document.querySelector(s.el));
    if (!steps.length) { onClose(); return; }

    const d = driver({
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
      onDestroyed: () => { localStorage.setItem(TOUR_SEEN, "1"); onClose(); },
      steps: steps.map<DriveStep>((s, i) => ({
        element: s.el,
        popover: {
          title: s.title,
          description: s.text,
          side: s.side ?? "bottom",
          align: "start",
          // Put the interface in the state the step talks about, then let React
          // paint before driver measures the target.
          onPopoverRender: () => { if (i === 0) s.before?.(); },
        },
      })),
      onHighlightStarted: (_el, step) => {
        const found = steps.find((s) => s.el === (step as any).element);
        found?.before?.();
      },
    });

    // The first target may need a tab opened too; give React one frame.
    steps[0].before?.();
    const t = window.setTimeout(() => d.drive(), 60);
    return () => { window.clearTimeout(t); d.destroy(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  return null;
}
