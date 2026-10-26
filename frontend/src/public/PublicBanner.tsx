import { useEffect, useState } from "react";
export function PublicBanner() {
  const [message, setMessage] = useState("");
  useEffect(() => {
    const listener = (event: Event) =>
      setMessage((event as CustomEvent<string>).detail);
    window.addEventListener("meridian:compute-status", listener);
    return () =>
      window.removeEventListener("meridian:compute-status", listener);
  }, []);
  return (
    <aside className="public-demo-banner">
      <span>
        <b>PUBLIC DEMO</b> Synthetic EUR data · trial imports stay in this tab
        and reset on reload.
      </span>
      <span role="status" aria-live="polite">
        {message ||
          "Custom calculations run locally in Python; the engine loads on first use."}
      </span>
      <a
        href="https://github.com/alkova11/meridian-portfolio-analytics"
        target="_blank"
        rel="noreferrer"
      >
        View source ↗
      </a>
    </aside>
  );
}
