/**
 * Tests for getCodingAgentStatus fallback logic in MiladyClient.
 *
 * The function:
 * 1. Fetches /api/coding-agents/coordinator/status
 * 2. If tasks is empty, falls back to /api/coding-agents (PTY sessions)
 * 3. Maps PTY session fields to CodingAgentSession format
 * 4. Handles terminal states correctly in the status mapping
 */

import { describe, expect, it, vi } from "vitest";
import type { CodingAgentSession, CodingAgentStatus } from "../client";

/**
 * Minimal reimplementation of the getCodingAgentStatus fallback logic from
 * MiladyClient, isolated for unit testing without constructing the full client.
 */
async function getCodingAgentStatusFromMock(
  fetchImpl: (path: string) => Promise<unknown>,
): Promise<CodingAgentStatus | null> {
  try {
    const status = (await fetchImpl(
      "/api/coding-agents/coordinator/status",
    )) as CodingAgentStatus;

    if (status && (!status.tasks || status.tasks.length === 0)) {
      try {
        const ptySessions = (await fetchImpl("/api/coding-agents")) as Array<{
          id: string;
          name?: string;
          agentType?: string;
          workdir?: string;
          status?: string;
          metadata?: Record<string, unknown>;
        }>;
        if (Array.isArray(ptySessions) && ptySessions.length > 0) {
          status.tasks = ptySessions.map((s) => ({
            sessionId: s.id,
            agentType: s.agentType ?? "claude",
            label:
              (s.metadata?.label as string) ?? s.name ?? s.agentType ?? "Agent",
            originalTask: "",
            workdir: s.workdir ?? "",
            status:
              s.status === "ready" || s.status === "busy"
                ? ("active" as const)
                : s.status === "error"
                  ? ("error" as const)
                  : s.status === "stopped" ||
                      s.status === "done" ||
                      s.status === "completed" ||
                      s.status === "exited"
                    ? ("stopped" as const)
                    : ("active" as const),
            decisionCount: 0,
            autoResolvedCount: 0,
          }));
          status.taskCount = status.tasks.length;
        }
      } catch {
        // /api/coding-agents may not exist — ignore
      }
    }
    return status;
  } catch {
    return null;
  }
}

describe("getCodingAgentStatus fallback", () => {
  it("returns coordinator tasks when they exist (no fallback)", async () => {
    const tasks: CodingAgentSession[] = [
      {
        sessionId: "s1",
        agentType: "claude",
        label: "Claude",
        originalTask: "fix bug",
        workdir: "/tmp/ws",
        status: "active",
        decisionCount: 1,
        autoResolvedCount: 0,
      },
    ];

    const fetchImpl = vi.fn(async (path: string) => {
      if (path === "/api/coding-agents/coordinator/status") {
        return {
          supervisionLevel: "auto",
          taskCount: 1,
          tasks,
          pendingConfirmations: 0,
        };
      }
      throw new Error("unexpected path");
    });

    const result = await getCodingAgentStatusFromMock(fetchImpl);

    expect(result).not.toBeNull();
    expect(result!.tasks).toHaveLength(1);
    expect(result!.tasks[0].sessionId).toBe("s1");
    // Should NOT have called the fallback endpoint
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/coding-agents/coordinator/status",
    );
  });

  it("falls back to PTY sessions when coordinator tasks are empty", async () => {
    const fetchImpl = vi.fn(async (path: string) => {
      if (path === "/api/coding-agents/coordinator/status") {
        return {
          supervisionLevel: "auto",
          taskCount: 0,
          tasks: [],
          pendingConfirmations: 0,
        };
      }
      if (path === "/api/coding-agents") {
        return [
          {
            id: "pty-1",
            name: "gemini-session",
            agentType: "gemini",
            workdir: "/tmp/gemini",
            status: "busy",
            metadata: { label: "Gemini Agent" },
          },
          {
            id: "pty-2",
            agentType: "claude",
            workdir: "/tmp/claude",
            status: "ready",
          },
        ];
      }
      throw new Error(`unexpected path: ${path}`);
    });

    const result = await getCodingAgentStatusFromMock(fetchImpl);

    expect(result).not.toBeNull();
    expect(result!.tasks).toHaveLength(2);
    expect(result!.taskCount).toBe(2);

    // First session: label from metadata
    expect(result!.tasks[0].sessionId).toBe("pty-1");
    expect(result!.tasks[0].label).toBe("Gemini Agent");
    expect(result!.tasks[0].agentType).toBe("gemini");
    expect(result!.tasks[0].workdir).toBe("/tmp/gemini");
    expect(result!.tasks[0].status).toBe("active"); // busy -> active

    // Second session: label falls back to agentType
    expect(result!.tasks[1].sessionId).toBe("pty-2");
    expect(result!.tasks[1].label).toBe("claude");
    expect(result!.tasks[1].status).toBe("active"); // ready -> active
  });

  it("returns empty tasks when both coordinator and PTY have nothing", async () => {
    const fetchImpl = vi.fn(async (path: string) => {
      if (path === "/api/coding-agents/coordinator/status") {
        return {
          supervisionLevel: "auto",
          taskCount: 0,
          tasks: [],
          pendingConfirmations: 0,
        };
      }
      if (path === "/api/coding-agents") {
        return [];
      }
      throw new Error(`unexpected path: ${path}`);
    });

    const result = await getCodingAgentStatusFromMock(fetchImpl);

    expect(result).not.toBeNull();
    expect(result!.tasks).toHaveLength(0);
  });

  it("maps terminal PTY states correctly", async () => {
    const fetchImpl = vi.fn(async (path: string) => {
      if (path === "/api/coding-agents/coordinator/status") {
        return {
          supervisionLevel: "auto",
          taskCount: 0,
          tasks: [],
          pendingConfirmations: 0,
        };
      }
      if (path === "/api/coding-agents") {
        return [
          { id: "s-ready", status: "ready", agentType: "claude" },
          { id: "s-busy", status: "busy", agentType: "claude" },
          { id: "s-error", status: "error", agentType: "claude" },
          { id: "s-stopped", status: "stopped", agentType: "claude" },
          { id: "s-done", status: "done", agentType: "claude" },
          { id: "s-completed", status: "completed", agentType: "claude" },
          { id: "s-exited", status: "exited", agentType: "claude" },
          { id: "s-unknown", status: "something-else", agentType: "claude" },
        ];
      }
      throw new Error(`unexpected path: ${path}`);
    });

    const result = await getCodingAgentStatusFromMock(fetchImpl);
    expect(result).not.toBeNull();

    const statusMap = new Map(
      result!.tasks.map((t) => [t.sessionId, t.status]),
    );

    // "ready" and "busy" map to "active"
    expect(statusMap.get("s-ready")).toBe("active");
    expect(statusMap.get("s-busy")).toBe("active");

    // "error" maps to "error"
    expect(statusMap.get("s-error")).toBe("error");

    // Terminal states map to "stopped"
    expect(statusMap.get("s-stopped")).toBe("stopped");
    expect(statusMap.get("s-done")).toBe("stopped");
    expect(statusMap.get("s-completed")).toBe("stopped");
    expect(statusMap.get("s-exited")).toBe("stopped");

    // Unknown defaults to "active"
    expect(statusMap.get("s-unknown")).toBe("active");
  });

  it("returns null when coordinator endpoint throws", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network error");
    });

    const result = await getCodingAgentStatusFromMock(fetchImpl);
    expect(result).toBeNull();
  });

  it("ignores PTY fallback error and returns coordinator status", async () => {
    const fetchImpl = vi.fn(async (path: string) => {
      if (path === "/api/coding-agents/coordinator/status") {
        return {
          supervisionLevel: "auto",
          taskCount: 0,
          tasks: [],
          pendingConfirmations: 0,
        };
      }
      if (path === "/api/coding-agents") {
        throw new Error("PTY endpoint not available");
      }
      throw new Error(`unexpected path: ${path}`);
    });

    const result = await getCodingAgentStatusFromMock(fetchImpl);

    // Returns the coordinator status even though PTY fallback failed
    expect(result).not.toBeNull();
    expect(result!.tasks).toHaveLength(0);
  });
});
