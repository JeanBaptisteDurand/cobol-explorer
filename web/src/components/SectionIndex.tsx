import { useEffect, useState } from "react";

/** The twelve sections, in page order, declared once.
 *
 *  The header index and the page itself both read this array, so a link can no
 *  longer point at a section that does not exist — which is exactly what had
 *  happened: two of the three header links targeted `#bob-section` and
 *  `#governance-section`, and the sections carried a `data-testid` but no `id`.
 *
 *  The number is the position in this array. Never type one by hand. */
export const SECTIONS = [
  { id: "product-section", topic: "The product" },
  { id: "problem-section", topic: "The problem" },
  { id: "gestures-section", topic: "The founding principle" },
  { id: "agent-section", topic: "The agent" },
  { id: "rag-section", topic: "Retrieval" },
  { id: "bob-section", topic: "MCP and IBM Bob" },
  { id: "governance-section", topic: "Traceability and governance" },
  { id: "ibm-section", topic: "The IBM layer" },
  { id: "fit-section", topic: "Challenge fit" },
  { id: "identity-section", topic: "Identity" },
  { id: "built-section", topic: "How it was built" },
  { id: "access-section", topic: "Access" },
] as const;

export const pad = (n: number) => String(n).padStart(2, "0");

/** Which section currently owns the viewport. Reads the section whose top edge is
 *  closest to just under the 48px header, so the answer matches what the reader
 *  is looking at rather than what merely intersects. */
function useActiveSection() {
  const [active, setActive] = useState(-1);

  useEffect(() => {
    const read = () => {
      let found = -1;
      for (let i = 0; i < SECTIONS.length; i++) {
        const el = document.getElementById(SECTIONS[i].id);
        if (el && el.getBoundingClientRect().top <= 120) found = i;
      }
      setActive(found);
    };
    read();
    window.addEventListener("scroll", read, { passive: true });
    window.addEventListener("resize", read);
    return () => {
      window.removeEventListener("scroll", read);
      window.removeEventListener("resize", read);
    };
  }, []);

  return active;
}

/** A numbered rail — one target per section — with the active topic spelled out
 *  beside it, so the numbers are an index rather than a riddle. */
export default function SectionIndex() {
  const active = useActiveSection();

  return (
    <nav className="ce-index" aria-label="Sections">
      <ol className="ce-index-rail">
        {SECTIONS.map((s, i) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className={i === active ? "is-on" : ""}
              title={`${pad(i)} — ${s.topic}`}
              aria-label={`${pad(i)} — ${s.topic}`}
              aria-current={i === active ? "true" : undefined}
            >
              {pad(i)}
            </a>
          </li>
        ))}
      </ol>
      <span className="ce-index-topic" aria-hidden="true">
        {active >= 0 ? SECTIONS[active].topic : "Overview"}
      </span>
    </nav>
  );
}
