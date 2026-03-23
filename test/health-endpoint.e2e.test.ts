/**
 * Health Endpoint — E2E Tests
 *
 * Tests the GET /api/health endpoint added for system observability.
 */

import { startApiServer } from "@miladyai/app-core/src/api/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { req } from "./helpers/http";

vi.mock("@miladyai/app-core/src/services/mcp-marketplace", () => ({
  searchMcpMarketplace: vi.fn().mockResolvedValue({ results: [] }),
  getMcpServerDetails: vi.fn().mockResolvedValue(null),
}));

let port: number;
let server: Awaited<ReturnType<typeof startApiServer>>;

beforeAll(async () => {
  server = await startApiServer({
    port: 0,
    initialAgentState: "not_started",
  });
  port = server.port;
}, 30_000);

afterAll(async () => {
  if (server) {
    await server.close();
  }
}, 15_000);

describe("GET /api/health", () => {
  it("returns structured status", async () => {
    const { status, data } = await req(port, "GET", "/api/health");
    expect(status).toBe(200);
    expect(data).toHaveProperty("runtime");
    expect(data).toHaveProperty("database");
    expect(data).toHaveProperty("plugins");
    expect(data).toHaveProperty("coordinator");
    expect(data).toHaveProperty("connectors");
    expect(data).toHaveProperty("uptime");
    expect(data).toHaveProperty("agentState");
  });

  it("reports runtime not_initialized when no runtime", async () => {
    const { data } = await req(port, "GET", "/api/health");
    expect(data.runtime).toBe("not_initialized");
    expect(data.coordinator).toBe("not_wired");
  });

  it("reports plugins count", async () => {
    const { data } = await req(port, "GET", "/api/health");
    const plugins = data.plugins as Record<string, number>;
    expect(typeof plugins.loaded).toBe("number");
    expect(typeof plugins.failed).toBe("number");
  });

  it("reports agentState=starting while the agent is still starting", async () => {
    const startingServer = await startApiServer({
      port: 0,
      initialAgentState: "starting",
    });

    try {
      const { status, data } = await req(
        startingServer.port,
        "GET",
        "/api/health",
      );
      expect(status).toBe(200);
      expect(data.agentState).toBe("starting");
    } finally {
      await startingServer.close();
    }
  });
});
