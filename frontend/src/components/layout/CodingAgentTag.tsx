import { codingAgentName } from "@/constants/codingAgents";

/** Prefix naming the coding agent that ran a session; nothing when unknown. */
export function CodingAgentTag({
  codingAgent,
}: {
  codingAgent: string | null;
}): React.ReactNode {
  const name = codingAgentName(codingAgent);
  if (!name) return null;
  return <span className="text-orange-400/80">{name} · </span>;
}
