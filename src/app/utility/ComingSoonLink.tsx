import Link from "next/link";

export default function ComingSoonLink() {
  return (
    <Link 
      href="/essay"
      className="text-[#B8963E] border-b border-[#B8963E]/30 hover:border-[#B8963E] transition-colors pb-0.5 cursor-pointer text-left inline-flex items-center gap-2"
    >
      Read our essay on its development
      <span className="text-xs tracking-widest uppercase opacity-60">→</span>
    </Link>
  );
}
