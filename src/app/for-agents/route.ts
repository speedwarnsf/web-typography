import { redirect } from 'next/navigation';

// The agent-facing canonical doc is served as raw markdown at /for-agents.md
// (copied from packages/typeset-v4/for-agents.md by scripts/release-cut.mjs).
// This route keeps the clean /for-agents URL that llms.txt and the npm
// README advertise.
export function GET() {
  redirect('/for-agents.md');
}
