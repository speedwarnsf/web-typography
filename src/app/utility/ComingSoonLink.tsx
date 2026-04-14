"use client";

export default function ComingSoonLink() {
  return (
    <button 
      onClick={() => alert('Coming soon: Read the essay on the development of typeset.ts!')}
      className="text-[#B8963E] border-b border-[#B8963E]/30 hover:border-[#B8963E] transition-colors pb-0.5 cursor-pointer text-left"
    >
      Read our essay on its development (Coming Soon)
    </button>
  );
}
