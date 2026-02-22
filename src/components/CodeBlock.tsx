"use client";

import CopyButton from "./CopyButton";

export default function CodeBlock({
  code,
  title,
}: {
  code: string;
  title?: string;
}) {
  return (
    <div className="border border-neutral-800 bg-neutral-950" style={{ borderRadius: 0 }}>
      {title && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-800">
          <span className="text-xs font-mono uppercase tracking-widest text-neutral-500">
            {title}
          </span>
          <CopyButton text={code} />
        </div>
      )}
      {!title && (
        <div className="flex justify-end px-4 py-2 border-b border-neutral-800">
          <CopyButton text={code} />
        </div>
      )}
      <pre className="p-4 overflow-x-auto text-sm leading-relaxed">
        <code className="font-mono text-neutral-300">{code}</code>
      </pre>
    </div>
  );
}
