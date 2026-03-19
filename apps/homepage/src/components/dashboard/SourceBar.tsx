import { useAgents } from "../../lib/AgentProvider";
import { isAuthenticated } from "../../lib/auth";

export function SourceBar() {
  const { agents, loading, refresh } = useAgents();

  const cloudCount = agents.length;
  const authed = isAuthenticated();

  return (
    <div className="px-8 py-3 border-b border-white/10 flex items-center gap-6 text-xs font-mono">
      <div className="flex items-center gap-2">
        <span
          className={`w-1.5 h-1.5 rounded-full ${authed && cloudCount > 0 ? "bg-green-500" : authed ? "bg-yellow-500" : "bg-white/20"}`}
        />
        <span className="text-text-muted">
          {!authed
            ? "cloud (not connected)"
            : cloudCount > 0
              ? `cloud (${cloudCount} agent${cloudCount !== 1 ? "s" : ""})`
              : "cloud (no agents)"}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <button
          type="button"
          onClick={() => refresh()}
          className={`text-text-muted hover:text-brand transition-colors uppercase tracking-widest ${loading ? "animate-pulse" : ""}`}
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
