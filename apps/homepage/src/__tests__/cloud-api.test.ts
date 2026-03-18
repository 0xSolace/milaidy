import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CloudApiClient } from "../lib/cloud-api";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
  localStorage.clear();
});
afterEach(() => localStorage.clear());

describe("CloudApiClient", () => {
  const client = new CloudApiClient({ url: "http://localhost:2138", type: "local" });

  it("health() calls GET /api/health", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ status: "ok", uptime: 100 }),
    });
    const result = await client.health();
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:2138/api/health",
      expect.objectContaining({ method: "GET" }),
    );
    expect(result.status).toBe("ok");
  });

  it("startAgent() calls POST /api/agent/start", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true, status: { state: "paused" } }),
    });
    const result = await client.startAgent();
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:2138/api/agent/start",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.ok).toBe(true);
  });

  it("playAgent() chains start then resume", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({ ok: true, status: { state: "paused" } }),
      })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve({ ok: true, status: { state: "running" } }),
      });
    const result = await client.playAgent();
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.status.state).toBe("running");
  });

  it("exportAgent() calls POST /api/agent/export with password", async () => {
    const blob = new Blob(["data"]);
    mockFetch.mockResolvedValueOnce({
      ok: true, status: 200,
      blob: () => Promise.resolve(blob),
    });
    const result = await client.exportAgent("mypass");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:2138/api/agent/export",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ password: "mypass" }),
      }),
    );
    expect(result).toBeInstanceOf(Blob);
  });
});
