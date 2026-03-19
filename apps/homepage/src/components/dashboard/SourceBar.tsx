import { useState } from "react";
import { useAgents } from "../../lib/AgentProvider";
import { isAuthenticated } from "../../lib/auth";
import { ConnectionModal } from "./ConnectionModal";

export function SourceBar() {
  const { agents, loading, refresh, addRemoteUrl } = useAgents();
  const [showAddRemote, setShowAddRemote] = useState(false);

  const cloudCount = agents.filter((a) => a.source === "cloud").length;
  const localCount = agents.filter((a) => a.source === "local").length;
  const remoteCount = agents.filter((a) => a.source === "remote").length;
  const authed = isAuthenticated();

  return (
    <div className="px-6 md:px-8 py-3 border-b border-border flex items-center gap-5 text-xs">
      {/* Sources */}
      <div className="flex items-center gap-4">
        <SourceDot
          label={!authed ? "Cloud" : `Cloud (${cloudCount})`}
          active={authed && cloudCount > 0}
          warning={authed && cloudCount === 0}
        />
        <SourceDot
          label={localCount > 0 ? `Local (${localCount})` : "Local"}
          active={localCount > 0}
        />
        {remoteCount > 0 && (
          <SourceDot label={`Remote (${remoteCount})`} active />
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowAddRemote(true)}
          className="text-text-muted hover:text-text-light px-3 py-1.5 rounded-lg
            hover:bg-surface transition-all duration-150 text-xs"
        >
          + Connect
        </button>
        <button
          type="button"
          onClick={() => refresh()}
          className={`text-text-muted hover:text-text-light px-3 py-1.5 rounded-lg
            hover:bg-surface transition-all duration-150 text-xs
            ${loading ? "animate-pulse" : ""}`}
        >
          Refresh
        </button>
      </div>

      {showAddRemote && (
        <ConnectionModal
          onSubmit={(data) => {
            addRemoteUrl(data.name, data.url, data.token);
            setShowAddRemote(false);
          }}
          onClose={() => setShowAddRemote(false)}
        />
      )}
    </div>
  );
}

function SourceDot({
  label,
  active,
  warning,
}: {
  label: string;
  active: boolean;
  warning?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          active
            ? "bg-emerald-400"
            : warning
              ? "bg-amber-400"
              : "bg-text-muted/30"
        }`}
      />
      <span className="text-text-muted">{label}</span>
    </div>
  );
}
