import { useEffect, useState } from "react";

/** The twelve sections, in page order, declared once.
 *
 *  The header index and the page itself both read this array, so a link can no
 *  longer point at a section that does not exist — which is exactly what had
 *  happened: two of the three header links targeted `#bob-section` and
 *  `#governance-section`, and the sections carried a `data-testid` but no `id`.
 *
 *  The number is the position in this array. Never type one by hand.
 *
 *  `topic` is what the section calls itself on the page. `nav` is the short form
 *  the header uses — twelve full topics do not fit a 48px shell, and a number on
 *  its own is a riddle. */
export const SECTIONS = [
  { id: "product-section", topic: "The product", nav: "Product" },
  { id: "problem-section", topic: "The problem", nav: "Problem" },
  { id: "gestures-section", topic: "The founding principle", nav: "Principle" },
  { id: "agent-section", topic: "The agent", nav: "Agent" },
  { id: "rag-section", topic: "Retrieval", nav: "Retrieval" },
  { id: "bob-section", topic: "MCP and IBM Bob", nav: "Bob" },
  { id: "governance-section", topic: "Traceability and governance", nav: "Governance" },
  { id: "ibm-section", topic: "The IBM layer", nav: "IBM" },
  { id: "fit-section", topic: "Challenge fit", nav: "Fit" },
  { id: "identity-section", topic: "Identity", nav: "Identity" },
  { id: "built-section", topic: "How it was built", nav: "Built" },
  { id: "access-section", topic: "Access", nav: "Access" },
] as const;

export const pad = (n: number) => String(n).padStart(2, "0");

/** Which section currently owns the viewport. Reads the section whose top edge is
 *  closest to just under the 48px header, so the answer matches what the reader
 *  is looking at rather than what merely intersects. */
function useActiveSection() {
  const [active, setActive] = useState(-1);

  useEffect(() => {
    const read = () => {
      // At the very bottom the page cannot scroll further, so the last section
      // never reaches the threshold — without this the rail stops one short.
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      if (atBottom) {
        setActive(SECTIONS.length - 1);
        return;
      }
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

/** One named target per section. The label is the short form; the full topic and
 *  its number live in the tooltip, so nothing is lost and nothing is cryptic. */
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
              {s.nav}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
