import { useState } from "react";
import { csComment, csRevert, csStatus, csSummarize, csSync, getCs } from "../api";
import type { ChangeSet } from "../types";
import Help from "./Help";
import { Icon } from "./Icons";

const short = (id: string) => id.split(":")[1] || id;

type StepState = "pending" | "run" | "ok" | "fail";
interface Step { label: string; state: StepState; note?: string }

export default function ChangesPanel({ version, author, role, onReload, onOpenDiff, onFileReverted, onExit }: {
  version: ChangeSet | null; author: string; role?: string; onReload: () => void;
  onOpenDiff: (path: string) => void; onFileReverted?: (path: string) => void; onExit?: () => void;
}) {
  const [comment, setComment] = useState("");
  const [confirmMerge, setConfirmMerge] = useState(false);
  const [confirmRevert, setConfirmRevert] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // The visible pipeline: each entry is ONE real server call, shown as it runs.
  const [steps, setSteps] = useState<Step[] | null>(null);

  if (!version)
    return (
      <div className="emptypane">
        <Icon name="branch" size={24} color="var(--text-helper)" />
        <div className="t">Versions</div>
        <div className="d" style={{ textAlign: "left" }}>
          Everyone works on <b style={{ color: "var(--text-primary)" }}>their own version</b> (a git branch);
          <b style={{ color: "var(--interactive)" }}> main</b> is the team's version.<br /><br />
          Create a version (« + New version » on the left) or click « Edit… » on a file:
          the changed files, their diff and impact will appear here, like a PR review.
        </div>
      </div>
    );

  const nProg = version.impact?.programs?.length || 0;
  const merged = version.status === "merged";
  // A merged version is done: no sync warnings, no further actions.
  const sync = merged ? null : version.sync;
  const behind = sync ? !sync.up_to_date : false;
  const empty = !version.edits?.length;

  const run = (p: Promise<any>, after?: () => void) => {
    setBusy(true); setError(null);
    p.then(() => { after?.(); onReload(); })
      .catch((e) => setError({ message: String(e?.message || e), code: e?.code }))
      .finally(() => setBusy(false));
  };

  const stage = version.status; // draft | proposed | merged
  const GUIDE: Record<string, string> = {
    draft:
      "Yours to edit. Save as often as you like: every save is a commit on your branch and recomputes the impact below. Nothing reaches the estate. When the change is ready, Propose it.",
    proposed:
      "Submitted for review. The team reads the diff, the impact and the record below; a developer or an architect accepts it with Merge; the gate states the blast radius first. You can still edit and save; the review sees the latest state.",
    merged:
      "Accepted and applied to main. This version is closed and read-only. Open a new version for the next change.",
  };

  // The role decides which button is THE button. A hint, not enforcement - the
  // server still arbitrates, and says so when it refuses.
  const canMerge = /^(dev|arch)/i.test(role || "");

  const mark = (i: number, state: StepState, note?: string) =>
    setSteps((cur) => cur && cur.map((st, j) => (j === i ? { ...st, state, note } : st)));

  const guardUpToDate = async (i: number): Promise<boolean> => {
    mark(i, "run");
    const fresh = await getCs(version.id);
    if (fresh.status === "merged") { mark(i, "fail", "already merged: this version is closed"); return false; }
    if (fresh.sync && !fresh.sync.up_to_date) {
      mark(i, "fail", `main moved: ${fresh.sync.behind} commit(s) ahead of you. Import main first (button above).`);
      return false;
    }
    mark(i, "ok");
    return true;
  };

  const guidedPropose = async () => {
    setBusy(true); setError(null);
    setSteps([
      { label: "Checking your branch against main", state: "pending" },
      { label: "Submitting for review", state: "pending" },
    ]);
    try {
      if (!(await guardUpToDate(0))) return;
      mark(1, "run");
      await csStatus(version.id, "proposed");
      mark(1, "ok", "proposed · a developer or an architect reviews and merges");
      onReload();
    } catch (e: any) {
      mark(1, "fail", String(e?.message || e));
    } finally { setBusy(false); }
  };

  const guidedMerge = async () => {
    setBusy(true); setError(null); setConfirmMerge(false);
    setSteps([
      { label: "Checking your branch against main", state: "pending" },
      { label: "Writing the change record", state: "pending" },
      { label: "Applying onto main (git merge)", state: "pending" },
      { label: "Version closed", state: "pending" },
    ]);
    try {
      if (!(await guardUpToDate(0))) return;
      mark(1, "run");
      if (version.summary?.text) mark(1, "ok", "already written");
      else { await csSummarize(version.id); mark(1, "ok"); }
      mark(2, "run");
      await csStatus(version.id, "merged");
      mark(2, "ok");
      mark(3, "ok", "main now carries this change · the version is read-only");
      onReload();
    } catch (e: any) {
      const running = 2;
      mark(running, "fail", String(e?.message || e));
    } finally { setBusy(false); }
  };

  // What should this person do NOW? One sentence, always true, always visible.
  const next = merged ? null
    : steps ? null
    : empty ? { text: "Nothing changed yet. Open a file and press 'Edit in a version', then save into it." }
    : behind ? { text: "Main moved since you branched: press '↓ Import main' above, then come back here." }
    : stage === "proposed"
      ? (canMerge
        ? { text: "This proposal awaits a reviewer - and your role can merge: read the diff, then Merge." }
        : { text: "Proposed. A developer or an architect reviews the diff and merges; you can keep editing meanwhile." })
      : (canMerge
        ? { text: "Ready. Propose it for review - or merge it yourself: your role holds the right, the gate will state the impact." }
        : { text: "Ready. Propose it for review: merging is reserved to developers and architects." });

  return (
    <div style={{ padding: 15, display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
      {/* Where this version stands in its life, at a glance. */}
      <div className="card" style={{ padding: "11px 13px" }} data-testid="cs-lifecycle">
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          {(["draft", "proposed", "merged"] as const).map((st, i) => (
            <span key={st} style={{ display: "flex", alignItems: "center", gap: 6, flex: st === "merged" ? "none" : 1 }}>
              <span className={`badge b-${st}`} style={stage === st ? {} : { opacity: 0.32, borderColor: "var(--border-subtle)", color: "var(--text-helper)", background: "transparent" }}>
                {st}
              </span>
              {i < 2 && <span style={{ flex: 1, height: 1, background: "var(--border-subtle)" }} />}
            </span>
          ))}
          <Help wide text="A version is one change, reviewed as one, like a pull request. draft: edit and save freely, it is your branch. proposed: you asked the team to review it. merged: a developer or architect accepted it and main moved. For an unrelated change, open another version." />
        </div>
        <p style={{ font: "400 11px/1.6 var(--s)", color: "var(--text-secondary)", margin: 0 }}>{GUIDE[stage] ?? ""}</p>
      </div>

      {next && (
        <div data-testid="next-action" style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "9px 12px",
          background: "rgba(15, 98, 254, .10)", border: "1px solid rgba(15, 98, 254, .35)" }}>
          <span style={{ color: "var(--interactive)", font: "600 11px var(--m)", flex: "none" }}>▸ next</span>
          <span style={{ font: "400 11px/1.55 var(--s)", color: "var(--text-primary)" }}>{next.text}</span>
        </div>
      )}

      {steps && (
        <div className="card" style={{ padding: "11px 13px" }} data-testid="action-steps">
          {steps.map((st, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "3px 0" }}>
              <span style={{ flex: "none", width: 14, textAlign: "center", font: "600 11px var(--m)",
                color: st.state === "ok" ? "var(--verified)" : st.state === "fail" ? "var(--danger)" : st.state === "run" ? "var(--interactive)" : "var(--text-helper)" }}>
                {st.state === "ok" ? "✓" : st.state === "fail" ? "✕" : st.state === "run" ? "◌" : "·"}
              </span>
              <span style={{ font: st.state === "pending" ? "400 11px/1.5 var(--s)" : "500 11px/1.5 var(--s)",
                color: st.state === "pending" ? "var(--text-helper)" : "var(--text-primary)" }}>
                {st.label}
                {st.note && <span style={{ display: "block", font: "400 10px/1.5 var(--s)", color: st.state === "fail" ? "var(--danger)" : "var(--text-helper)" }}>{st.note}</span>}
              </span>
            </div>
          ))}
          {!busy && (
            <button className="btn" style={{ fontSize: 9.5, padding: "2px 8px", marginTop: 7 }} onClick={() => setSteps(null)}>dismiss</button>
          )}
        </div>
      )}
      {/* The written record: what this version changes, what it puts at risk, what to
          check. Generated at merge time, and on demand before it - because the diff of
          a merged version against main is empty, and by then it is too late to write. */}
      <div className="card" style={{ padding: "12px 13px" }} data-testid="cs-summary">
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: version.summary?.text ? 8 : 0 }}>
          <Icon name="spark" size={12} color="var(--interactive)" />
          <span className="klabel" style={{ margin: 0 }}>Change record</span>
          {version.summary?.grounded === false && (
            <span className="tag" title="No model was reachable, so the facts were written without prose">facts only</span>
          )}
          <span style={{ flex: 1 }} />
          <button className="btn" style={{ fontSize: 9.5, padding: "2px 8px" }} disabled={busy}
            data-testid="cs-summarize" onClick={() => run(csSummarize(version.id))}
            title="Read the diff and the impact, and write what changed">
            {version.summary?.text ? "rewrite" : "write it"}
          </button>
        </div>
        {version.summary?.text ? (
          <p style={{ font: "400 11.5px/1.65 var(--s)", color: "var(--text-secondary)", margin: 0 }}>{version.summary.text}</p>
        ) : (
          <p style={{ font: "400 10.5px/1.5 var(--s)", color: "var(--text-helper)", margin: 0 }}>
            Written automatically when the version is merged, or now, so reviewers read it before they approve.
          </p>
        )}
      </div>

      {/* Your branch vs the team's main */}
      <div className="card" style={{ padding: "12px 13px", borderColor: "var(--interactive)", background: "rgba(15, 98, 254, .12)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Icon name="branch" size={13} color="var(--interactive)" />
          <span style={{ font: "600 12px var(--m)", color: "var(--interactive)" }}>{version.title}</span>
          <span className={`badge b-${version.status}`} style={{ marginLeft: "auto" }}>{version.status}</span>
          {onExit && (
            <button className="btn" style={{ fontSize: 9.5, padding: "2px 7px" }} onClick={onExit} data-testid="cp-exit"
              title="Back to main (read-only). Leaves this version without deleting it">✕ main</button>
          )}
        </div>
        <div style={{ font: "400 10.5px var(--s)", color: "var(--text-helper)", marginTop: 6 }}>
          your branch <span className="mono" style={{ color: "var(--text-secondary)" }}>cs/{version.id}</span> · created by {version.author}
        </div>
        {sync && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 9 }} data-testid="sync-state">
            {sync.up_to_date ? (
              <span className="grounded ok">✓ up to date with main</span>
            ) : (
              <span className="grounded warn">⚠ {sync.behind} commit{sync.behind > 1 ? "s" : ""} behind main</span>
            )}
            {sync.ahead > 0 && <span style={{ font: "400 10px var(--m)", color: "var(--text-helper)" }}>{sync.ahead} commit{sync.ahead > 1 ? "s" : ""} {stage === "proposed" ? "under review" : "to propose"}</span>}
            {/* The pull control is ALWAYS here. It used to render only when
                behind - but the sync state is computed when the panel loads,
                so a teammate merging while it was open left a stale
                "up to date" that HID the one button a user looks for. */}
            {behind ? (
              <button className="btn" style={{ fontSize: 10.5, padding: "3px 9px", marginLeft: "auto" }} disabled={busy}
                data-testid="sync-btn" title="git merge main → your branch: pulls in the work merged by the team"
                onClick={() => run(csSync(version.id))}>
                ↓ Import main
              </button>
            ) : (
              <button className="btn" style={{ fontSize: 10.5, padding: "3px 9px", marginLeft: "auto" }} disabled={busy}
                data-testid="sync-check" title="Re-check against main: did teammates merge since this panel loaded?"
                onClick={onReload}>
                ↻ Check main
              </button>
            )}
          </div>
        )}
      </div>

      {nProg > 0 && (
        <div className="card" style={{ padding: "13px 14px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ font: "600 27px var(--m)", color: "var(--text-primary)", lineHeight: 1 }} data-testid="changes-impact">{nProg}</span>
            <span style={{ font: "400 12px var(--s)", color: "var(--text-secondary)" }}>impacted programs</span>
          </div>
          {version.impact?.chains && version.impact.chains.length > 0 && (
            <div style={{ font: "400 10.5px var(--m)", color: "var(--text-secondary)", marginTop: 9 }}>chains: {version.impact.chains.map((c) => <span key={c} style={{ color: "var(--interactive)" }}>{short(c)} </span>)}</div>
          )}
        </div>
      )}

      <div>
        <div className="klabel" style={{ marginBottom: 6 }}>Changed files · {version.edits.length}<Help text="diff: compare your file with the main version. revert: undo your change to this file, it returns exactly to the main version (useful after a mistake)." /></div>
        {version.edits.length === 0 && <div style={{ font: "400 11px var(--s)", color: "var(--text-helper)" }}>No changed files.</div>}
        {version.edits.length > 0 && (
          <div className="card">
            {version.edits.map((e, i) => (
              <div key={i} className="row" style={{ borderRadius: 0, justifyContent: "space-between", padding: "7px 12px", gap: 8 }} data-testid="chg-file">
                <span style={{ font: "500 11px var(--m)", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6, flex: 1, cursor: "pointer" }}
                  onClick={() => onOpenDiff(e.path)} title="See diff with main">
                  <Icon name="file" size={12} color="var(--text-helper)" />{e.path.split("/").pop()}
                </span>
                <span style={{ font: "400 10px var(--m)", color: "var(--interactive)", cursor: "pointer" }} onClick={() => onOpenDiff(e.path)}>diff</span>
                {merged ? null : confirmRevert === e.path ? (
                  <button className="btn" style={{ fontSize: 9.5, padding: "2px 7px", color: "var(--danger)", borderColor: "var(--danger)" }} disabled={busy}
                    data-testid="revert-confirm" title="The file will return to the main version"
                    onClick={(ev) => { ev.stopPropagation(); run(csRevert(version.id, e.path), () => { onFileReverted?.(e.path); setConfirmRevert(null); }); }}>
                    confirm revert?
                  </button>
                ) : (
                  <button className="btn" style={{ fontSize: 9.5, padding: "2px 7px" }} data-testid="revert-btn"
                    title="Revert this file: its content returns to main's (undoes your change, e.g. an accidental deletion)"
                    onClick={(ev) => { ev.stopPropagation(); setConfirmRevert(e.path); setTimeout(() => setConfirmRevert((c) => (c === e.path ? null : c)), 4000); }}>
                    revert
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ height: 1, background: "var(--border-subtle)" }} />
      <div className="klabel">Team review<Help wide text="Team work functions like pull requests: everyone has their branch (their version), main is the team's branch. « Import main » brings the others' merged work into your branch (git merge). « Merge » applies your branch onto main, accepted only if you are up to date, so you never overwrite a colleague's work." /></div>
      <div style={{ font: "400 10.5px/1.55 var(--s)", color: "var(--text-helper)" }}>
        Propose = submit for review. Merge = apply onto <b style={{ color: "var(--interactive)" }}>main</b>,
        only possible if your branch is <b style={{ color: "var(--text-primary)" }}>up to date with main</b>.
      </div>
      {error && (
        <div className="card" style={{ padding: "10px 12px", borderColor: "var(--danger)", font: "400 11px/1.5 var(--s)", color: "var(--danger)" }} data-testid="cs-error">
          {error.message}
          {/* Conflict resolution: both sides touched the same lines - the user
              decides, and each choice explains itself IN the button, because
              tooltips do not exist on a video frame or a screenshot. Nothing
              merges silently either way. */}
          {error.code === "conflict" && (
            <div style={{ display: "flex", gap: 7, marginTop: 9 }}>
              <button className="btn" style={{ flex: 1, fontSize: 10.5, flexDirection: "column", alignItems: "flex-start", gap: 3, padding: "8px 10px", whiteSpace: "normal", minWidth: 0 }}
                disabled={busy} data-testid="resolve-mine" onClick={() => run(csSync(version.id, "mine"))}>
                <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>Keep my changes</span>
                <span style={{ font: "400 9.5px/1.4 var(--s)", color: "var(--text-helper)", textAlign: "left" }}>
                  your lines win on the conflict; everything else from main still comes in
                </span>
              </button>
              <button className="btn" style={{ flex: 1, fontSize: 10.5, flexDirection: "column", alignItems: "flex-start", gap: 3, padding: "8px 10px", whiteSpace: "normal", minWidth: 0 }}
                disabled={busy} data-testid="resolve-main" onClick={() => run(csSync(version.id, "main"))}>
                <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>Take the main version</span>
                <span style={{ font: "400 9.5px/1.4 var(--s)", color: "var(--text-helper)", textAlign: "left" }}>
                  main wins on the conflict; your changes to other files are kept
                </span>
              </button>
            </div>
          )}
        </div>
      )}
      {confirmMerge && !empty && (
        <div className="card" style={{ padding: "10px 12px", borderColor: "var(--interactive)", background: "rgba(15, 98, 254, .12)", font: "400 11px/1.5 var(--s)", color: "var(--text-secondary)" }} data-testid="merge-gate">
          <span style={{ color: "var(--interactive)" }}>⚠ Merge-gate</span>: this merge applies the change to the estate and touches <b style={{ color: "var(--text-primary)" }}>{nProg} program{nProg > 1 ? "s" : ""}</b>. Confirm?
        </div>
      )}
      {merged && (
        <div className="grounded ok" style={{ alignSelf: "flex-start" }}>✓ merged into main · version closed</div>
      )}
      {/* The PRIMARY button is the next action, nothing else: for a proposer
          without the merge right that is Propose; for a reviewer or a
          self-merging dev it is Merge. A done state ("Proposed ✓") is a quiet
          chip, never a blue button shouting over the real action. */}
      <div style={{ display: merged ? "none" : "flex", gap: 8, alignItems: "stretch" }}>
        {stage === "proposed" ? (
          <div style={{ flex: 1, display: "flex", gap: 8, alignItems: "center" }}>
            <span className="grounded ok" data-testid="proposed-chip">✓ proposed</span>
            <button className="btn" style={{ fontSize: 10.5, padding: "4px 10px" }} disabled={busy}
              data-testid="withdraw-btn" title="Take the proposal back to draft: nothing is lost, review simply stops"
              onClick={() => run(csStatus(version.id, "draft"))}>↩ withdraw</button>
          </div>
        ) : (
          <button className={!canMerge && !empty ? "btn-pri" : "btn"} style={{ flex: 1, justifyContent: "center", font: "600 12px var(--s)", padding: 8 }}
            disabled={busy || empty}
            title={empty ? "Nothing to propose yet" : "Submit for review"}
            onClick={guidedPropose}>Propose</button>
        )}
        <button className={confirmMerge || (canMerge && !behind && !empty) ? "btn-pri" : "btn"}
          style={{ flex: 1, justifyContent: "center", font: "600 12px var(--s)", padding: 8, border: confirmMerge && !empty ? "none" : undefined, opacity: behind || empty ? 0.5 : 1 }}
          data-testid="merge-btn" disabled={busy || behind || empty}
          title={behind ? "Your branch is behind main. Import main first" : empty ? "Nothing to merge: this version has no changed file" : "Apply this version onto main (git merge)"}
          onClick={() => (confirmMerge ? guidedMerge() : setConfirmMerge(true))}>
          {behind ? "Merge (import main first)" : empty ? "Nothing to merge" : confirmMerge ? "Confirm merge" : "Merge"}
        </button>
      </div>

      {version.comments?.map((cm, i) => (
        <div key={i} className="comment">
          <div className="av">{cm.author.charAt(0).toUpperCase()}</div>
          <div><div className="who">{cm.author}</div><div className="txt">{cm.text}</div></div>
        </div>
      ))}

      <div style={{ position: "relative", marginTop: "auto" }}>
        <input className="inp" style={{ paddingRight: 38 }} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="comment on the version…" />
        <button className="btn-pri" data-testid="comment-send" style={{ position: "absolute", right: 6, top: 6, padding: "5px 8px", border: "none" }} onClick={() => { if (comment.trim()) run(csComment(version.id, author, comment.trim()), () => setComment("")); }}>
          <Icon name="send" size={14} />
        </button>
      </div>
    </div>
  );
}
