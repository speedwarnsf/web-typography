"use client";

import { useEffect, useRef } from "react";
import typeset from "@/lib/typeset-site";

export default function ListTest() {
  const leftColRef = useRef<HTMLDivElement>(null);
  const rightColRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (leftColRef.current) {
      typeset(leftColRef.current);
      leftColRef.current.querySelectorAll("ul").forEach(ul => {
        ul.classList.remove("ts-styled");
        ul.style.listStyle = "disc";
        ul.style.paddingLeft = "2em";
      });
    }
    if (rightColRef.current) {
      typeset(rightColRef.current);
    }
  }, []);

  const paragraph1 = "Typography is the art and technique of arranging type to make written language legible, readable, and appealing when displayed. The arrangement of type involves selecting typefaces, point sizes, line lengths, line-spacing, and letter-spacing, and adjusting the space between pairs of letters.";
  const paragraph2 = "Good typography is often invisible. When it is done well, the reader's focus is drawn entirely to the content, rather than the formatting. However, when typography is poor, it creates friction, making it harder for the reader to absorb the information and resulting in a disjointed user experience.";

  return (
    <div style={{ padding: "80px 40px", maxWidth: "1400px", margin: "0 auto", fontFamily: "var(--font-sans, inherit)" }}>
      <h1 style={{ color: "var(--gold, #B8963E)", marginBottom: "40px", fontSize: "2rem" }}>Typeset.ts Full Context Comparison</h1>
      
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "60px" }}>
        {/* LEFT COLUMN */}
        <div>
          <h2 style={{ color: "var(--gold, #B8963E)", borderBottom: "1px solid #333", paddingBottom: "10px", marginTop: 0, fontSize: "1.2rem", marginBottom: "30px" }}>
            Typeset.ts (Original - No List Fixes)
          </h2>
          <div ref={leftColRef}>
            <p style={{ marginBottom: "1.5em" }}>{paragraph1}</p>
            
            <ul style={{ marginBottom: "1.5em" }}>
              <li style={{ marginBottom: "0.5em" }}>We use industry-standard encryption to protect your data both in transit and at rest, ensuring your information remains secure from unauthorized access and potential breaches at all times.</li>
              <li style={{ marginBottom: "0.5em" }}>Our platform is built with redundant systems and regular automated backups, guaranteeing that your work is always safe, accessible, and recoverable in the event of an unexpected failure.</li>
              <li style={{ marginBottom: "0.5em" }}>Continuous monitoring and regular third-party security audits are conducted to identify and mitigate vulnerabilities before they can be exploited by malicious actors.</li>
            </ul>

            <p>{paragraph2}</p>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div>
          <h2 style={{ color: "var(--gold, #B8963E)", borderBottom: "1px solid #333", paddingBottom: "10px", marginTop: 0, fontSize: "1.2rem", marginBottom: "30px" }}>
            Typeset.ts (Revised - With List Fixes)
          </h2>
          <div ref={rightColRef}>
            <p style={{ marginBottom: "1.5em" }}>{paragraph1}</p>
            
            <ul style={{ marginBottom: "1.5em" }}>
              <li>We use industry-standard encryption to protect your data both in transit and at rest, ensuring your information remains secure from unauthorized access and potential breaches at all times.</li>
              <li>Our platform is built with redundant systems and regular automated backups, guaranteeing that your work is always safe, accessible, and recoverable in the event of an unexpected failure.</li>
              <li>Continuous monitoring and regular third-party security audits are conducted to identify and mitigate vulnerabilities before they can be exploited by malicious actors.</li>
            </ul>

            <p>{paragraph2}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
