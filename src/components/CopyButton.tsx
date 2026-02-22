"use client";

import { useState } from "react";

export default function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="px-3 py-1 text-xs font-mono tracking-wider uppercase border border-[#B8963E] text-[#B8963E] hover:bg-[#B8963E] hover:text-black transition-colors duration-200"
      style={{ borderRadius: 0 }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
