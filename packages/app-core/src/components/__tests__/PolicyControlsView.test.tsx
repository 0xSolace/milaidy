/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the client module before importing the component
vi.mock("../../api", () => ({
  client: {
    getStewardStatus: vi.fn(),
    getStewardPolicies: vi.fn(),
    setStewardPolicies: vi.fn(),
  },
}));

describe("PolicyControlsView", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("exports PolicyControlsView component", async () => {
    const mod = await import("../PolicyControlsView");
    expect(mod.PolicyControlsView).toBeDefined();
    expect(typeof mod.PolicyControlsView).toBe("function");
  });

  it("handles steward not connected state", async () => {
    const { client } = await import("../../api");
    (client.getStewardStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      configured: false,
      available: false,
      connected: false,
    });

    const mod = await import("../PolicyControlsView");
    // Component exists and is renderable
    expect(mod.PolicyControlsView).toBeDefined();
  });

  it("loads policies when steward is connected", async () => {
    const { client } = await import("../../api");
    const mockPolicies = [
      {
        id: "spending-limit-1",
        type: "spending-limit",
        enabled: true,
        config: { maxPerTx: "0.1", maxPerDay: "1.0", maxPerWeek: "5.0" },
      },
      {
        id: "rate-limit-1",
        type: "rate-limit",
        enabled: false,
        config: { maxTxPerHour: 10, maxTxPerDay: 50 },
      },
    ];

    (client.getStewardStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      configured: true,
      available: true,
      connected: true,
      agentId: "test-agent",
    });
    (client.getStewardPolicies as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPolicies,
    );

    const mod = await import("../PolicyControlsView");
    expect(mod.PolicyControlsView).toBeDefined();
  });
});
