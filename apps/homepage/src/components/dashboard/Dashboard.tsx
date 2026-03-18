import { useState } from "react";
import { AgentProvider } from "../../lib/AgentProvider";
import { AuthGate } from "./AuthGate";
import { AgentGrid } from "./AgentGrid";
import { BillingPanel } from "./BillingPanel";
import { ExportPanel } from "./ExportPanel";
import { LogsPanel } from "./LogsPanel";
import { MetricsPanel } from "./MetricsPanel";
import { Sidebar, type DashboardSection } from "./Sidebar";
import { SourceBar } from "./SourceBar";

export function Dashboard() {
  const [section, setSection] = useState<DashboardSection>("agents");

  return (
    <AuthGate>
      <AgentProvider>
        <div
          data-testid="dashboard"
          className="min-h-screen bg-dark text-text-light"
        >
          <div className="pt-[100px] flex min-h-screen">
            <Sidebar active={section} onChange={setSection} />
            <div className="flex-1 flex flex-col min-w-0">
              <SourceBar />
              <main className="flex-1 px-8 py-6">
                <DashboardContent section={section} />
              </main>
            </div>
          </div>
        </div>
      </AgentProvider>
    </AuthGate>
  );
}

function DashboardContent({ section }: { section: DashboardSection }) {
  switch (section) {
    case "agents":
      return <AgentGrid />;
    case "metrics":
      return <MetricsPanel />;
    case "logs":
      return <LogsPanel />;
    case "export":
      return <ExportPanel connectionId="" />;
    case "billing":
      return <BillingPanel />;
  }
}
