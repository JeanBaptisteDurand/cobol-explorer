import { useState } from "react";
import { csComment, csRevert, csStatus, csSummarize, csSync } from "../api";
import type { ChangeSet } from "../types";
import Help from "./Help";
import { Icon } from "./Icons";

const short = (id: string) => id.split(":")[1] || id;

export default function ChangesPanel({ version, author, onReload, onOpenDiff, onFileReverted, onExit }: {
  version: ChangeSet | null; author: string; onReload: () => void;
  onOpenDiff: (path: string) => void; onFileReverted?: (path: string) => void; onExit?: () => void;
}) {
  const [comment, setComment] = useState("");
  const [confirmMerge, setConfirmMerge] = useState(false);
  const [confirmRevert, setConfirmRevert] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!version)
    return (
      <div className="emptypane">
        <Icon name="branch" size={24} color="var(--text-helper)" />
        <div className="t">Versions</div>
        <div className="d" style={{ textAlign: "left" }}>
          Everyone works on <b style={{ color: "var(--text-primary)" }}>their own version</b> (a git branch);
          <b style={{ color: "var(--interactive)" }}> main</b> is the team's version.<br /><br />
          Create a version (« + New version » on the left) or click « Edit… » on a file —
          the changed files, their diff and impact will appear here, like a PR review.
        </div>
      </div>
    );

  const nProg = version.impact?.programs?.length || 0;
  const merged = version.status === "merged";
  // A merged version is done: no sync warnings, no further actions.
  const sync = merged ? null : version.sync;
  const behind = sync ? !sync.up_to_date : false;

  const run = (p: Promise<any>, after?: () => void) => {
    setBusy(true); setError(null);
    p.then(() => { after?.(); onReload(); })
      .catch((e) => setError({ message: String(e?.message || e), code: e?.code }))
      .finally(() => setBusy(false));
  };

  return (
    <div style={{ padding: 15, display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
      {/* The written record: what this version changes, what it puts at risk, what to
          check. Generated at merge time, and on demand before it — because the diff of
          a merged version against main is empty, and by then it is too late to write. */}
      <div className="card" style={{ padding: "12px 13px" }} data-testid="cs-summary">
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: version.summary?.text ? 8 : 0 }}>
          <Icon name="spark" size={12} color="var(--interactive)" />
          <span className="klabel" style={{ margin: 0 }}>Change record</span>
          {version.summary?.grounded === false && (
            <span className="tag" title="No model was reachable — the facts were written without prose">facts only</span>
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
            Written automatically when the version is merged — or now, so reviewers read it before they approve.
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
              title="Back to main (read-only) — leave this version without deleting it">✕ main</button>
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
            {sync.ahead > 0 && <span style={{ font: "400 10px var(--m)", color: "var(--text-helper)" }}>{sync.ahead} commit{sync.ahead > 1 ? "s" : ""} to propose</span>}
            {behind && (
              <button className="btn" style={{ fontSize: 10.5, padding: "3px 9px", marginLeft: "auto" }} disabled={busy}
                data-testid="sync-btn" title="git merge main → your branch: pulls in the work merged by the team"
                onClick={() => run(csSync(version.id))}>
                ↓ Import main
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
        <div className="klabel" style={{ marginBottom: 6 }}>Changed files · {version.edits.length}<Help text="diff: compare your file with the main version. revert: undo your change to this file — it returns exactly to the main version (useful after a mistake)." /></div>
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
                    title="Revert this file — its content returns to main's (undoes your change, e.g. an accidental deletion)"
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
      <div className="klabel">Team review<Help wide text="Team work functions like pull requests: everyone has their branch (their version), main is the team's branch. « Import main » brings the others' merged work into your branch (git merge). « Merge » applies your branch onto main — accepted only if you are up to date, so you never overwrite a colleague's work." /></div>
      <div style={{ font: "400 10.5px/1.55 var(--s)", color: "var(--text-helper)" }}>
        Propose = submit for review. Merge = apply onto <b style={{ color: "var(--interactive)" }}>main</b> —
        only possible if your branch is <b style={{ color: "var(--text-primary)" }}>up to date with main</b>.
      </div>
      {error && (
        <div className="card" style={{ padding: "10px 12px", borderColor: "var(--danger)", font: "400 11px/1.5 var(--s)", color: "var(--danger)" }} data-testid="cs-error">
          {error.message}
          {/* Conflict resolution: both sides touched the same lines — the user decides. */}
          {error.code === "conflict" && (
            <div style={{ display: "flex", gap: 7, marginTop: 9 }}>
              <button className="btn" style={{ flex: 1, fontSize: 10.5, justifyContent: "center" }} disabled={busy} data-testid="resolve-mine"
                title="Your changes win on the conflicting lines; the rest of main is imported"
                onClick={() => run(csSync(version.id, "mine"))}>
                Keep my changes
              </button>
              <button className="btn" style={{ flex: 1, fontSize: 10.5, justifyContent: "center" }} disabled={busy} data-testid="resolve-main"
                title="The team version (main) wins on the conflicting lines; your other changes are kept"
                onClick={() => run(csSync(version.id, "main"))}>
                Take the main version
              </button>
            </div>
          )}
        </div>
      )}
      {confirmMerge && (
        <div className="card" style={{ padding: "10px 12px", borderColor: "var(--interactive)", background: "rgba(15, 98, 254, .12)", font: "400 11px/1.5 var(--s)", color: "var(--text-secondary)" }} data-testid="merge-gate">
          <span style={{ color: "var(--interactive)" }}>⚠ Merge-gate</span> — this merge applies the change to the estate and touches <b style={{ color: "var(--text-primary)" }}>{nProg} program{nProg > 1 ? "s" : ""}</b>. Confirm?
        </div>
      )}
      {merged && (
        <div className="grounded ok" style={{ alignSelf: "flex-start" }}>✓ merged into main — version closed</div>
      )}
      <div style={{ display: merged ? "none" : "flex", gap: 8 }}>
        <button className="btn-pri" style={{ flex: 1, justifyContent: "center", font: "600 12px var(--s)", padding: 8 }} disabled={busy}
          onClick={() => run(csStatus(version.id, "proposed"))}>Propose</button>
        <button className={confirmMerge ? "btn-pri" : "btn"} style={{ flex: 1, justifyContent: "center", border: confirmMerge ? "none" : undefined, opacity: behind ? 0.5 : 1 }}
          data-testid="merge-btn" disabled={busy || behind}
          title={behind ? "Your branch is behind main — import main first" : "Apply this version onto main (git merge)"}
          onClick={() => (confirmMerge ? run(csStatus(version.id, "merged"), () => setConfirmMerge(false)) : setConfirmMerge(true))}>
          {behind ? "Merge (import main first)" : confirmMerge ? "Confirm merge" : "Merge"}
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
