import { useState } from "react";
import { mintMcpKey } from "../api";
import Help from "./Help";

/** Everything needed to point an IBM Bob at this estate, in the sidebar.
 *
 *  The default path is deliberately the shortest one that exists: generate a
 *  key, download ONE dependency-free file, paste a config, ask a question.
 *  Cloning the repository is the advanced path for analysing your own estate,
 *  and lives at the bottom - a first-time reader should never meet `git clone`
 *  as step one of a two-minute setup.
 */

const TOOLS = [
  {
    sig: "graph_lookup(op, node)",
    colour: "var(--graph)",
    d: "Deterministic traversal of the dependency graph. op is one of summary, impact, lineage, callers, callees, neighbors. Impact on a copybook returns the programs and batch chains a change would reach, exhaustively.",
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

const connectorConfig = (key: string) => `{
  "mcpServers": {
    "cobol-explorer": {
      "command": "python3",
      "args": ["/absolute/path/to/cobol-explorer-mcp.py"],
      "env": { "COBOL_EXPLORER_MCP_KEY": "${key || "ce_...your key..."}" }
    }
  }
}`;

/** Verbatim .bob/mcp.json, `env` included - the advanced, own-estate path.
 *  Dropping that block once shipped a configuration that cannot start. */
const LOCAL_JSON = `{
  "mcpServers": {
    "cobol-explorer": {
      "command": "\${workspaceFolder}/.venv/bin/python",
      "args": ["-m", "mcp_server.server"],
      "cwd": "\${workspaceFolder}",
      "env": {
        "PYTHONPATH": "\${workspaceFolder}/packages/core:\${workspaceFolder}/ingestion:\${workspaceFolder}/server",
        "COBOL_EXPLORER_GRAPH": "\${workspaceFolder}/graph.json",
        "COBOL_EXPLORER_CORPUS": "\${workspaceFolder}/corpora"
      }
    }
  }
}`;

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
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [key, setKey] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const mint = () => {
    setBusy(true); setErr("");
    mintMcpKey(user.trim(), password)
      .then((r) => { setKey(r.key); setPassword(""); })
      .catch((e: any) => setErr(String(e?.message || "could not mint the key")))
      .finally(() => setBusy(false));
  };

  return (
    <div className="bob" data-testid="bob-panel">
      <div className="sidehead">
        <span className="klabel">
          Connect your Bob
          <Help text="The three analysis tools this workshop runs on are exposed over the Model Context Protocol, so IBM Bob can call them directly instead of reading files and guessing. Two minutes, nothing to install." />
        </span>
      </div>
      <div className="sidehint" style={{ padding: "0 14px 12px" }}>
        The same tools the agent here uses, callable from your own editor. Four steps, two minutes.
      </div>

      <div className="bob-sec">
        <div className="klabel">01 · Generate your key</div>
        <p className="bob-p">
          Personal and shown once: every call Bob makes is written to the audit trail
          under <b>your</b> name. Minting asks for your credentials because the key is
          itself a credential (demo account: <code>amine</code> / <code>demo</code>).
        </p>
        {key ? (
          <>
            <Block text={key} label="key" />
            <p className="bob-p" style={{ color: "var(--text-helper)" }}>
              Copy it now: it is not stored and will not be shown again. Re-minting replaces it.
            </p>
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 8 }}>
            <input className="inp" placeholder="username" value={user} data-testid="bob-key-user"
              onChange={(e) => setUser(e.target.value)} />
            <input className="inp" placeholder="password" type="password" value={password} data-testid="bob-key-password"
              onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && mint()} />
            <button className="btn" style={{ justifyContent: "center" }} disabled={busy || !user || !password}
              data-testid="bob-key-mint" onClick={mint}>Generate my key</button>
            {err && <div style={{ font: "400 11px var(--s)", color: "var(--danger)" }} data-testid="bob-key-error">{err}</div>}
          </div>
        )}
      </div>

      <div className="bob-sec">
        <div className="klabel">02 · Download the connector</div>
        <p className="bob-p">
          One file, plain <code>python3</code>, no dependency, nothing else to install.
          It relays the three tools to this estate under your key.
        </p>
        <a className="btn" style={{ justifyContent: "center", textDecoration: "none", marginTop: 8, display: "flex" }}
          href="/downloads/cobol-explorer-mcp.py" download data-testid="bob-download">
          ↓ cobol-explorer-mcp.py
        </a>
      </div>

      <div className="bob-sec">
        <div className="klabel">03 · Register it in Bob</div>
        <p className="bob-p">
          In your MCP configuration (<code>.bob/mcp.json</code> in a workspace, or the
          global MCP settings), with the real path to the file you saved:
        </p>
        <Block text={connectorConfig(key)} label="config" />
      </div>

      <div className="bob-sec">
        <div className="klabel">04 · Ask the first question</div>
        <p className="bob-p">
          Ask Bob <i>“what breaks if I change LGPOLICY?”</i>. If it answers with eleven
          programs and two batch chains, it called <code>graph_lookup</code> - and the
          call is already in the Audit panel, under your name. If it answers with a
          plausible handful, it is still reading files.
        </p>
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
        <div className="klabel">
          Your own estate, locally
          <Help text="The hosted endpoint serves the public demo estates. To run the same tools against YOUR COBOL - which then never leaves your machine - clone the repository and use the local stdio server." />
        </div>
        <p className="bob-p">
          The steps above query <b>this demo estate</b>. To analyse <b>your own COBOL</b>,
          clone the repository, run <code>make setup</code>, drop your sources
          under <code>corpora/</code> and run <code>make ingest</code>: the graph is
          rebuilt from your estate, and nothing about it ever leaves your machine.{" "}
          <code>.bob/mcp.json</code> ships in the repository, so Bob finds the local
          server on its own - this is its entry:
        </p>
        <Block text={LOCAL_JSON} label="local" />
      </div>
    </div>
  );
}
