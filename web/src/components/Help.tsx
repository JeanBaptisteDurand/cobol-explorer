// Small "?" affordance: hover (or tap) reveals a short plain-language explanation.
export default function Help({ text, wide }: { text: string; wide?: boolean }) {
  return (
    <span className="help" tabIndex={0} aria-label={text}>
      ?
      <span className="tip" style={wide ? { width: 300 } : undefined}>{text}</span>
    </span>
  );
}
