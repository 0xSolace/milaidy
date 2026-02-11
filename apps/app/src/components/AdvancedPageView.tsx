/**
 * AdvancedPageView — container for advanced configuration sub-tabs.
 *
 * Sub-tabs:
 *   - Config: Wallet/RPC providers, secrets (original ConfigPageView content)
 *   - Trajectories: LLM call viewer and analysis
 *   - Voice: TTS/STT provider selection
 */

import { useState } from "react";
import { useApp } from "../AppContext";
import { ConfigPageView } from "./ConfigPageView";
import { TrajectoriesView } from "./TrajectoriesView";
import { TrajectoryDetailView } from "./TrajectoryDetailView";
import { VoiceConfigView } from "./VoiceConfigView";
import { RuntimeView } from "./RuntimeView";
import type { Tab } from "../navigation";

type SubTab = "config" | "trajectories" | "voice" | "runtime";

const SUB_TABS: Array<{ id: SubTab; label: string; description: string }> = [
  { id: "config", label: "Config", description: "Wallet, RPC providers, and secrets" },
  { id: "trajectories", label: "Trajectories", description: "LLM call history and analysis" },
  { id: "voice", label: "Voice", description: "TTS and transcription settings" },
  { id: "runtime", label: "Runtime", description: "Deep runtime object introspection and load order" },
];

function mapTabToSubTab(tab: Tab): SubTab {
  switch (tab) {
    case "trajectories": return "trajectories";
    case "voice": return "voice";
    case "runtime": return "runtime";
    default: return "config";
  }
}

export function AdvancedPageView() {
  const { tab, setTab } = useApp();
  const [selectedTrajectoryId, setSelectedTrajectoryId] = useState<string | null>(null);

  const currentSubTab = mapTabToSubTab(tab);

  const handleSubTabChange = (subTab: SubTab) => {
    setSelectedTrajectoryId(null);
    switch (subTab) {
      case "trajectories":
        setTab("trajectories");
        break;
      case "voice":
        setTab("voice");
        break;
      case "runtime":
        setTab("runtime");
        break;
      default:
        setTab("advanced");
    }
  };

  const renderContent = () => {
    switch (currentSubTab) {
      case "trajectories":
        if (selectedTrajectoryId) {
          return (
            <TrajectoryDetailView
              trajectoryId={selectedTrajectoryId}
              onBack={() => setSelectedTrajectoryId(null)}
            />
          );
        }
        return (
          <TrajectoriesView onSelectTrajectory={setSelectedTrajectoryId} />
        );
      case "voice":
        return <VoiceConfigView />;
      case "runtime":
        return <RuntimeView />;
      default:
        return <ConfigPageView />;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with sub-tabs */}
      <div className="mb-4">
        <h2 className="text-lg font-bold mb-2">Advanced</h2>

        {/* Sub-tab navigation */}
        <div className="flex gap-1 border-b border-border">
          {SUB_TABS.map((subTab) => {
            const isActive = currentSubTab === subTab.id;
            return (
              <button
                key={subTab.id}
                className={`px-4 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
                  isActive
                    ? "border-accent text-accent"
                    : "border-transparent text-muted hover:text-txt hover:border-border"
                }`}
                onClick={() => handleSubTabChange(subTab.id)}
                title={subTab.description}
              >
                {subTab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0">
        {renderContent()}
      </div>
    </div>
  );
}
