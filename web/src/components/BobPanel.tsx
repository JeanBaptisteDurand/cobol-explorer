import { useState } from "react";
import Help from "./Help";

/** Everything needed to point an IBM Bob at this estate, in the sidebar.
 *
 *  The product claimed three tools "exposed over MCP" in three places and told
 *  nobody how to reach them. This is the answer, next to the estate rather than
 *  buried in a README the person using the workshop will never open.
 *
 *  The signatures and the configuration are copied from the source of truth —
 *  server/mcp_server/server.py and .bob/mcp.json. A snippet a reader pastes has
 *  to be the real one, so if either moves, move this.
 */

const TOOLS = [
  {
    sig: "graph_lookup(op, node)",
    colour: "var(--graph)",
    d: "Deterministic traversal of the dependency graph. op is one of summary, impact, lineage, callers, callees, neighbors — impact on a copybook returns the programs and batch chains a change would reach, exhaustively.",
  },
  {
    sig: "search_code(query)",
    colour: "var(--vector)",
    d: "Semantic search over the ingested estate, on IBM Granite embeddings. For when nobody remembers which program holds the thing you are describing.",
  },
  {
    sig: "read_source_lines(file, start, end)",
    colour: "var(--text-primary)",
    d: "The exact lines, so an answer can cite file:line instead of paraphrasing.",
  },
];

const MCP_JSON = `{
  "mcpServers": {
    "cobol-explorer": {
      "command": "\${workspaceFolder}/.venv/bin/python",
      "args": ["-m", "mcp_server.server"],
      "cwd": "\${workspaceFolder}"
    }
  }
}`;

const CLONE = `git clone https://github.com/JeanBaptisteDurand/cobol-explorer
cd cobol-explorer
make setup`;

function Copy({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button className="btn bob-copy" data-testid={`bob-copy-${label}`}
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setDone(true);
          window.setTimeout(() => setDone(false), 1600);
        }).catch(() => {});
      }}>
      {done ? "copied ✓" : "copy"}
    </button>
  );
}

function Block({ text, label }: { text: string; label: string }) {
  return (
    <div className="bob-block">
      {/* The button sits above the code, not over it: in a 262px sidebar an
          overlaid button hides the end of the very line you came to copy. */}
      <div className="bob-block-bar"><Copy text={text} label={label} /></div>
      <pre>{text}</pre>
    </div>
  );
}

export default function BobPanel() {
  return (
    <div className="bob" data-testid="bob-panel">
      <div className="sidehead">
        <span className="klabel">
          Connect your Bob
          <Help text="The three analysis tools this workshop runs on are exposed over the Model Context Protocol, so IBM Bob can call them directly instead of reading files and guessing." />
        </span>
      </div>
      <div className="sidehint" style={{ padding: "0 14px 12px" }}>
        The same tools the agent here uses, callable from your own editor.
      </div>

      <div className="bob-sec">
        <div className="klabel">The three tools</div>
        {TOOLS.map((t) => (
          <div className="bob-tool" key={t.sig}>
            <code style={{ color: t.colour }}>{t.sig}</code>
            <p>{t.d}</p>
          </div>
        ))}
      </div>

      <div className="bob-sec">
        <div className="klabel">Where it runs</div>
        <p className="bob-p">
          Over <b>stdio</b>, on your machine, beside the estate it reads — not against this
          server. Nothing about your source leaves the box it is already on, which is the
          only reason a bank would let an agent near it.
        </p>
      </div>

      <div className="bob-sec">
        <div className="klabel">01 · Clone it</div>
        <Block text={CLONE} label="clone" />
      </div>

      <div className="bob-sec">
        <div className="klabel">02 · Point it at your COBOL</div>
        <p className="bob-p">
          Drop your sources under <code>corpora/</code> and run <code>make ingest</code>. It
          parses COBOL, JCL, CICS, DB2 and the scheduler export into the graph the tools
          traverse. Skip this to try it on the two demo estates first.
        </p>
      </div>

      <div className="bob-sec">
        <div className="klabel">03 · Open the folder in Bob</div>
        <p className="bob-p">
          <code>.bob/mcp.json</code> ships with the repository, so Bob finds the server by
          itself. Nothing to paste — unless your client keeps its MCP servers elsewhere,
          in which case this is the entry:
        </p>
        <Block text={MCP_JSON} label="config" />
      </div>

      <div className="bob-sec">
        <div className="klabel">Check it</div>
        <p className="bob-p">
          Ask Bob <i>“what breaks if I change LGPOLICY?”</i>. If it answers with eleven
          programs and two batch chains, it called <code>graph_lookup</code>. If it answers
          with a plausible handful, it is still reading files.
        </p>
      </div>
    </div>
  );
}
