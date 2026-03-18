import { useEffect, useState } from "react";
import { useAgents } from "../../lib/AgentProvider";
import { isAuthenticated, getToken } from "../../lib/auth";

const CLOUD_BASE = "https://www.elizacloud.ai";

export function BillingPanel() {
  const { agents } = useAgents();
  const [billing, setBilling] = useState<object | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) return;
    const token = getToken();
    fetch(`${CLOUD_BASE}/api/v1/billing`, {
      headers: { "X-Api-Key": token! },
    })
      .then((r) => r.ok ? r.json() : Promise.reject(`${r.status}`))
      .then(setBilling)
      .catch((e) => setError(String(e)));
  }, []);

  if (!isAuthenticated()) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-3">
        <div className="text-text-muted/30 text-4xl">{"\u25C8"}</div>
        <div className="text-text-muted font-mono text-sm">Not connected to cloud</div>
        <div className="text-text-muted/50 font-mono text-xs">
          Log in with Eliza Cloud to view billing information.
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 font-mono text-sm">{error}</div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="font-mono text-xs uppercase tracking-widest text-brand">Billing</h3>
      <pre className="bg-dark border border-white/10 rounded p-4 font-mono text-xs text-text-muted overflow-auto">
        {billing ? JSON.stringify(billing, null, 2) : "Loading..."}
      </pre>
    </div>
  );
}
