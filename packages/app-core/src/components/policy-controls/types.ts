export type PolicyType =
  | "spending-limit"
  | "approved-addresses"
  | "auto-approve-threshold"
  | "time-window"
  | "rate-limit";

export interface PolicyRule {
  id: string;
  type: PolicyType;
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface SpendingLimitConfig {
  maxPerTx: string;
  maxPerDay: string;
  maxPerWeek: string;
}

export interface ApprovedAddressEntry {
  address: string;
  label: string;
}

export interface ApprovedAddressesConfig {
  addresses: string[];
  labels?: Record<string, string>;
  mode: "whitelist" | "blacklist";
}

export interface RateLimitConfig {
  maxTxPerHour: number;
  maxTxPerDay: number;
}

export interface TimeWindowConfig {
  allowedHours: { start: number; end: number }[];
  allowedDays: number[];
  timezone?: string;
}

export interface AutoApproveConfig {
  threshold: string;
}
