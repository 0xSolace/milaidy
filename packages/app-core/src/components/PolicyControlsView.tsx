/**
 * PolicyControlsView — user-friendly policy management for Steward agent wallets.
 *
 * Renders spending limits, approved addresses, rate limits, time windows,
 * and auto-approve threshold as toggleable, collapsible cards.
 */

import { Button, ConfirmDialog, Spinner } from "@miladyai/ui";
import {
  AlertTriangle,
  Clock,
  DollarSign,
  Gauge,
  UserCheck,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { client } from "../api";
import type {
  ApprovedAddressesConfig,
  AutoApproveConfig,
  PolicyRule,
  PolicyType,
  RateLimitConfig,
  SpendingLimitConfig,
  TimeWindowConfig,
} from "./policy-controls";
import {
  ApprovedAddressesSection,
  AutoApproveSection,
  addressSummary,
  autoApproveSummary,
  DEFAULT_APPROVED_ADDRESSES,
  DEFAULT_AUTO_APPROVE,
  DEFAULT_RATE_LIMIT,
  DEFAULT_SPENDING,
  DEFAULT_TIME_WINDOW,
  findPolicy,
  PolicyToggle,
  RateLimitSection,
  rateLimitSummary,
  SpendingLimitSection,
  spendingSummary,
  TimeWindowSection,
  timeWindowSummary,
} from "./policy-controls";
import { StewardLogo } from "./steward/StewardLogo";

/* ── Main Component ──────────────────────────────────────────────────── */

export function PolicyControlsView() {
  const [policies, setPolicies] = useState<PolicyRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [stewardConnected, setStewardConnected] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmCallback, setConfirmCallback] = useState<(() => void) | null>(
    null,
  );

  /* ── Load ──────────────────────────────────────────────────────────── */

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const status = await client.getStewardStatus();
        if (cancelled) return;
        setStewardConnected(status.connected);
        if (!status.connected) {
          setLoading(false);
          return;
        }
        const result = await client.getStewardPolicies();
        if (cancelled) return;
        setPolicies(result as PolicyRule[]);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Failed to load policies",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ── Policy helpers ────────────────────────────────────────────────── */

  const getPolicy = useCallback(
    (type: PolicyType) => findPolicy(policies, type),
    [policies],
  );

  const updatePolicy = useCallback(
    (type: PolicyType, updates: Partial<PolicyRule>) => {
      setPolicies((prev) => {
        const existing = prev.find((p) => p.type === type);
        if (existing) {
          return prev.map((p) => (p.type === type ? { ...p, ...updates } : p));
        }
        return [
          ...prev,
          {
            id: `${type}-${Date.now()}`,
            type,
            enabled: true,
            config: {},
            ...updates,
          },
        ];
      });
      setDirty(true);
      setSaveSuccess(false);
    },
    [],
  );

  const togglePolicy = useCallback(
    (
      type: PolicyType,
      enabled: boolean,
      defaultConfig: Record<string, unknown>,
    ) => {
      const existing = findPolicy(policies, type);
      if (!enabled && existing?.enabled) {
        setConfirmMessage(
          "Disabling this removes a safety guardrail. Are you sure?",
        );
        setConfirmCallback(() => () => {
          updatePolicy(type, { enabled: false });
        });
        setConfirmOpen(true);
        return;
      }
      updatePolicy(type, {
        enabled,
        config: existing?.config ?? defaultConfig,
      });
    },
    [policies, updatePolicy],
  );

  /* ── Save ──────────────────────────────────────────────────────────── */

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      await client.setStewardPolicies(policies);
      setSaveSuccess(true);
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save policies");
    } finally {
      setSaving(false);
    }
  }, [policies]);

  /* ── Render ────────────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={24} />
        <span className="ml-3 text-sm text-muted">Loading…</span>
      </div>
    );
  }

  if (!stewardConnected) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <StewardLogo size={48} className="opacity-30" />
        <div>
          <p className="text-sm font-semibold text-txt mb-1">
            Steward Not Connected
          </p>
          <p className="text-xs text-muted max-w-sm">
            Connect your Steward instance to manage wallet policies.
          </p>
        </div>
      </div>
    );
  }

  // Extract configs with fallbacks
  const spendingPolicy = getPolicy("spending-limit");
  const spendingConfig =
    (spendingPolicy?.config as unknown as SpendingLimitConfig) ??
    DEFAULT_SPENDING;

  const addressPolicy = getPolicy("approved-addresses");
  const addressConfig =
    (addressPolicy?.config as unknown as ApprovedAddressesConfig) ??
    DEFAULT_APPROVED_ADDRESSES;

  const rateLimitPolicy = getPolicy("rate-limit");
  const rateLimitConfig =
    (rateLimitPolicy?.config as unknown as RateLimitConfig) ??
    DEFAULT_RATE_LIMIT;

  const timeWindowPolicy = getPolicy("time-window");
  const timeWindowConfig =
    (timeWindowPolicy?.config as unknown as TimeWindowConfig) ??
    DEFAULT_TIME_WINDOW;

  const autoApprovePolicy = getPolicy("auto-approve-threshold");
  const autoApproveConfig =
    (autoApprovePolicy?.config as unknown as AutoApproveConfig) ??
    DEFAULT_AUTO_APPROVE;

  const asRecord = (v: unknown) => v as unknown as Record<string, unknown>;

  return (
    <div className="relative">
      <div className="space-y-2">
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2">
            <AlertTriangle className="h-4 w-4 text-danger shrink-0" />
            <span className="text-[12px] text-danger">{error}</span>
          </div>
        )}

        {/* Auto-Approve — first, most common */}
        <PolicyToggle
          icon={Zap}
          title="Auto-Approve"
          summary={
            autoApprovePolicy?.enabled
              ? autoApproveSummary(autoApproveConfig)
              : undefined
          }
          enabled={autoApprovePolicy?.enabled ?? false}
          onToggle={(enabled) =>
            togglePolicy(
              "auto-approve-threshold",
              enabled,
              asRecord(DEFAULT_AUTO_APPROVE),
            )
          }
        >
          <AutoApproveSection
            config={autoApproveConfig}
            onChange={(cfg) =>
              updatePolicy("auto-approve-threshold", {
                config: asRecord(cfg),
              })
            }
          />
        </PolicyToggle>

        {/* Spending Limits */}
        <PolicyToggle
          icon={DollarSign}
          title="Spending Limits"
          summary={
            spendingPolicy?.enabled
              ? spendingSummary(spendingConfig)
              : undefined
          }
          enabled={spendingPolicy?.enabled ?? false}
          onToggle={(enabled) =>
            togglePolicy("spending-limit", enabled, asRecord(DEFAULT_SPENDING))
          }
        >
          <SpendingLimitSection
            config={spendingConfig}
            onChange={(cfg) =>
              updatePolicy("spending-limit", { config: asRecord(cfg) })
            }
          />
        </PolicyToggle>

        {/* Address Controls */}
        <PolicyToggle
          icon={UserCheck}
          title="Address Controls"
          summary={
            addressPolicy?.enabled ? addressSummary(addressConfig) : undefined
          }
          enabled={addressPolicy?.enabled ?? false}
          onToggle={(enabled) =>
            togglePolicy(
              "approved-addresses",
              enabled,
              asRecord(DEFAULT_APPROVED_ADDRESSES),
            )
          }
        >
          <ApprovedAddressesSection
            config={addressConfig}
            onChange={(cfg) =>
              updatePolicy("approved-addresses", { config: asRecord(cfg) })
            }
          />
        </PolicyToggle>

        {/* Rate Limits */}
        <PolicyToggle
          icon={Gauge}
          title="Rate Limits"
          summary={
            rateLimitPolicy?.enabled
              ? rateLimitSummary(rateLimitConfig)
              : undefined
          }
          enabled={rateLimitPolicy?.enabled ?? false}
          onToggle={(enabled) =>
            togglePolicy("rate-limit", enabled, asRecord(DEFAULT_RATE_LIMIT))
          }
        >
          <RateLimitSection
            config={rateLimitConfig}
            onChange={(cfg) =>
              updatePolicy("rate-limit", { config: asRecord(cfg) })
            }
          />
        </PolicyToggle>

        {/* Time Restrictions */}
        <PolicyToggle
          icon={Clock}
          title="Time Restrictions"
          summary={
            timeWindowPolicy?.enabled
              ? timeWindowSummary(timeWindowConfig)
              : undefined
          }
          enabled={timeWindowPolicy?.enabled ?? false}
          onToggle={(enabled) =>
            togglePolicy("time-window", enabled, asRecord(DEFAULT_TIME_WINDOW))
          }
        >
          <TimeWindowSection
            config={timeWindowConfig}
            onChange={(cfg) =>
              updatePolicy("time-window", { config: asRecord(cfg) })
            }
          />
        </PolicyToggle>
      </div>

      {/* Sticky save footer — only visible when dirty */}
      {dirty && (
        <div className="sticky bottom-0 mt-3 flex items-center justify-between rounded-xl border border-accent/30 bg-bg/95 backdrop-blur-sm px-4 py-2.5">
          <span className="text-[12px] text-accent font-medium">
            Unsaved changes
          </span>
          <Button
            variant="default"
            size="sm"
            className="text-[11px] min-w-[80px]"
            onClick={() => void handleSave()}
            disabled={saving}
          >
            {saving ? (
              <>
                <Spinner size={14} />
                <span className="ml-1.5">Saving…</span>
              </>
            ) : (
              "Save Policies"
            )}
          </Button>
        </div>
      )}

      {/* Non-dirty save success */}
      {saveSuccess && !dirty && (
        <div className="mt-3 text-center">
          <span className="text-[12px] text-ok font-medium">
            ✓ Policies saved
          </span>
        </div>
      )}

      {/* Confirm dialog */}
      <ConfirmDialog
        open={confirmOpen}
        title="Disable Safety Policy"
        message={confirmMessage}
        confirmLabel="Disable"
        cancelLabel="Keep Enabled"
        tone="warn"
        onConfirm={() => {
          confirmCallback?.();
          setConfirmOpen(false);
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
