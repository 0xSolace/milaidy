import type { PolicyRule, PolicyType } from "./types";

export function findPolicy(
  policies: PolicyRule[],
  type: PolicyType,
): PolicyRule | undefined {
  return policies.find((p) => p.type === type);
}

export function ethToNumber(eth: string): number {
  const n = Number.parseFloat(eth);
  return Number.isNaN(n) ? 0 : n;
}

export function formatHour(h: number): string {
  if (h === 0) return "12:00 AM";
  if (h === 12) return "12:00 PM";
  if (h < 12) return `${h}:00 AM`;
  return `${h - 12}:00 PM`;
}

export function isValidAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}
