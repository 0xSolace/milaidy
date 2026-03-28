/**
 * Gentle empty state for steward sub-tabs when steward isn't configured.
 */

import { FileText, Settings, Shield } from "lucide-react";
import { DESKTOP_SURFACE_PANEL_CLASSNAME } from "../desktop-surface-primitives";

interface StewardEmptyStateProps {
  variant: "transactions" | "approvals";
}

export function StewardEmptyState({ variant }: StewardEmptyStateProps) {
  const Icon = variant === "approvals" ? Shield : FileText;
  const title =
    variant === "approvals" ? "No pending approvals" : "No transactions yet";
  const description =
    variant === "approvals"
      ? "When transactions exceed your agent's auto-approve thresholds, they'll appear here for review."
      : "Transaction history will appear here once your agent starts signing transactions.";

  return (
    <div className="mx-auto max-w-[76rem] px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6">
      <div
        className={`${DESKTOP_SURFACE_PANEL_CLASSNAME} px-6 py-16 text-center`}
      >
        <Icon className="mx-auto h-10 w-10 text-muted/30" />
        <p className="mt-4 text-sm font-medium text-txt">{title}</p>
        <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-muted/70">
          {description}
        </p>
        <p className="mx-auto mt-4 max-w-sm text-xs text-muted/50">
          <Settings className="mr-1 inline h-3 w-3" />
          Connect a Steward wallet in Settings → Wallet Policies to enable
          transaction management.
        </p>
      </div>
    </div>
  );
}
