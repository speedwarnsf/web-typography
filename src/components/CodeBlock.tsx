"use client";

import { useState, useCallback } from "react";
import CopyButton from "./CopyButton";

function DownloadButton({ code, filename }: { code: string; filename: string }) {
  const handleDownload = useCallback(() => {
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, [code, filename]);

  return (
    <button
      onClick={handleDownload}
      className="px-3 py-1 text-xs font-mono tracking-wider uppercase border border-neutral-700 text-neutral-500 hover:border-[#B8963E] hover:text-[#B8963E] transition-colors duration-200"
      style={{ borderRadius: 0 }}
    >
      Download
    </button>
  );
}

export default function CodeBlock({
  code,
  title,
  defaultOpen = false,
}: {
  code: string;
  title?: string;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const ext = title?.toLowerCase().includes("css")
    ? "css"
    : title?.toLowerCase().includes("js") || title?.toLowerCase().includes("typescript")
    ? "ts"
    : "txt";
  const downloadName = title
    ? `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "")}.${ext}`
    : `code.${ext}`;

  return (
    <div className="border border-neutral-800 bg-neutral-950" style={{ borderRadius: 0 }}>
      <div
        className="flex items-center justify-between px-4 py-2 border-b border-neutral-800 cursor-pointer select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-3 h-3 text-neutral-600 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
            viewBox="0 0 12 12"
            fill="currentColor"
          >
            <path d="M4 1l5 5-5 5V1z" />
          </svg>
          <span className="text-xs font-mono uppercase tracking-widest text-neutral-500">
            {title || "Code"}
          </span>
        </div>
        {isOpen && (
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <CopyButton text={code} />
            <DownloadButton code={code} filename={downloadName} />
          </div>
        )}
      </div>
      {isOpen && (
        <pre className="p-3 sm:p-4 overflow-x-auto text-[11px] sm:text-xs md:text-sm leading-relaxed">
          <code className="font-mono text-neutral-300">{code}</code>
        </pre>
      )}
    </div>
  );
}
