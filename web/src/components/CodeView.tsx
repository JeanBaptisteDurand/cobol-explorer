import { StreamLanguage } from "@codemirror/language";
import { cobol } from "@codemirror/legacy-modes/mode/cobol";
import { StateEffect, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView } from "@codemirror/view";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { useEffect, useRef, useState } from "react";

const cobolExt = StreamLanguage.define(cobol);

// A transient "flash" highlight on one line, driven by a StateEffect — used when the
// agent cites file:line and the user clicks the citation.
const flashLine = StateEffect.define<number | null>();
const flashField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (!e.is(flashLine)) continue;
      if (e.value == null) deco = Decoration.none;
      else {
        const ln = Math.max(1, Math.min(e.value, tr.state.doc.lines));
        deco = Decoration.set([Decoration.line({ class: "cm-flash" }).range(tr.state.doc.line(ln).from)]);
      }
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

export default function CodeView({
  value,
  editable,
  onChange,
  highlight,
}: {
  value: string;
  editable: boolean;
  onChange?: (v: string) => void;
  highlight?: { line: number; nonce: number };
}) {
  const ref = useRef<ReactCodeMirrorRef>(null);
  // Flips once the editor exists. The flash effect used to depend on the nonce
  // alone, so when a citation opened a file that was NOT already open, the
  // effect fired while the view was still null, returned early, and never fired
  // again — the one gesture the product is named for landed on line 1 with no
  // flash. Re-running on `ready` covers the fresh-tab case.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const view = ref.current?.view;
    if (!view || !highlight) return;
    const ln = Math.max(1, Math.min(highlight.line, view.state.doc.lines));
    const at = view.state.doc.line(ln).from;
    view.dispatch({ effects: [flashLine.of(ln), EditorView.scrollIntoView(at, { y: "center" })] });
    const t = setTimeout(() => view.dispatch({ effects: flashLine.of(null) }), 2000);
    return () => clearTimeout(t);
  }, [highlight?.nonce, ready]);

  return (
    <CodeMirror
      ref={ref}
      value={value}
      theme="dark"
      editable={editable}
      readOnly={!editable}
      extensions={[cobolExt, flashField]}
      onChange={onChange}
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        highlightActiveLine: editable,
        highlightActiveLineGutter: editable,
      }}
      onCreateEditor={() => setReady(true)}
      height="100%"
      className="cm-theme"
    />
  );
}
