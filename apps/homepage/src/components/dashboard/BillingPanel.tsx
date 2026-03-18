import { useEffect, useState } from "react";
import { useConnections } from "../../lib/ConnectionProvider";

export function BillingPanel() {
  const { connections } = useConnections();
  const cloudConns = connections.filter(
    (c) => c.type === "cloud" && c.health === "healthy",
  );
  const [billing, setBilling] = useState<object | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cloudConns.length === 0) return;
    const client = cloudConns[0].client;
    client
      .getBilling()
      .then(setBilling)
      .catch((e) => setError(String(e)));
  }, [cloudConns.length]);

  if (cloudConns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-3">
        <div className="text-text-muted/30 text-4xl">◈</div>
        <div className="text-text-muted font-mono text-sm">
          No cloud connections
        </div>
        <div className="text-text-muted/50 font-mono text-xs">
          Add a cloud connection to view billing information.
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 font-mono text-sm">{error}</div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="font-mono text-xs uppercase tracking-widest text-brand">
        Billing
      </h3>
      <pre className="bg-dark border border-white/10 rounded p-4 font-mono text-xs text-text-muted overflow-auto">
        {billing ? JSON.stringify(billing, null, 2) : "Loading..."}
      </pre>
    </div>
  );
}
