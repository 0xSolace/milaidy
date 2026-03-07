/**
 * Cloud Agent Entrypoint
 *
 * Runs inside the cloud agent container. Starts an ElizaOS AgentRuntime,
 * serves a health endpoint on $PORT, and serves a bridge listener on the
 * primary bridge port plus an optional compatibility bridge port.
 *
 * Bridge protocol:
 *   - POST /bridge          JSON-RPC request/response
 *   - POST /bridge/stream   JSON-RPC -> SSE stream
 *   - POST /api/snapshot    capture in-memory state
 *   - POST /api/restore     restore in-memory state
 *
 * Health / diagnostics aliases on the bridge port:
 *   - GET|HEAD /health
 *   - GET|HEAD /bridge/health
 *   - GET|HEAD /bridge
 *   - GET|HEAD /
 *
 * Compatibility aliases:
 *   - POST /stream          -> /bridge/stream
 *   - POST /snapshot        -> /api/snapshot
 *   - POST /restore         -> /api/restore
 */

import * as crypto from "node:crypto";
import * as http from "node:http";
import { readRequestBody } from "./http-helpers";

type ChatMode = "simple" | "power";

interface BridgeRpcParams {
  text?: string;
  roomId?: string;
  mode?: string;
  channelType?: string;
}

interface BridgeRpcRequest {
  jsonrpc?: string;
  id?: string | number;
  method?: string;
  params?: BridgeRpcParams;
}

function parsePort(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    console.warn(
      `[cloud-agent] Invalid ${name}=${raw}; falling back to ${fallback}`,
    );
    return fallback;
  }

  return parsed;
}

const PORT = parsePort("PORT", 2138);
const PRIMARY_BRIDGE_PORT = parsePort("BRIDGE_PORT", 31337);
const COMPAT_BRIDGE_PORT = parsePort("BRIDGE_COMPAT_PORT", 18790);
const BRIDGE_PORTS = Array.from(
  new Set(
    [PRIMARY_BRIDGE_PORT, COMPAT_BRIDGE_PORT].filter(
      (port) => Number.isInteger(port) && port > 0,
    ),
  ),
);

// ─── ElizaOS Runtime ────────────────────────────────────────────────────

/**
 * The runtime is initialized asynchronously. All bridge requests that
 * need the runtime check `agentRuntime` and return 503 if it hasn't
 * started yet.
 */
let agentRuntime: {
  processMessage: (
    text: string,
    roomId: string,
    mode: ChatMode,
  ) => Promise<string>;
  processMessageStream: (
    text: string,
    roomId: string,
    mode: ChatMode,
    onChunk: (chunk: string) => void,
  ) => Promise<string>;
  getMemories: () => Array<Record<string, unknown>>;
  getConfig: () => Record<string, unknown>;
} | null = null;

/** In-memory state that persists across snapshots. */
const state = {
  memories: [] as Array<Record<string, unknown>>,
  config: {} as Record<string, unknown>,
  workspaceFiles: {} as Record<string, string>,
  startedAt: new Date().toISOString(),
};

async function initRuntime(): Promise<void> {
  const elizaAvailable = await import("@elizaos/core")
    .then(() => true)
    .catch(() => false);

  if (elizaAvailable) {
    const {
      AgentRuntime,
      createCharacter,
      createMessageMemory,
      stringToUuid,
      ChannelType,
    } = await import("@elizaos/core");

    const character = createCharacter({
      name: process.env.AGENT_NAME ?? "CloudAgent",
      bio: "An ElizaOS agent running in the cloud.",
      settings: {
        ...(process.env.DATABASE_URL
          ? {
              POSTGRES_URL: process.env.DATABASE_URL,
              DATABASE_URL: process.env.DATABASE_URL,
            }
          : {}),
      },
      secrets: {
        ...(process.env.ELIZAOS_CLOUD_API_KEY
          ? { ELIZAOS_CLOUD_API_KEY: process.env.ELIZAOS_CLOUD_API_KEY }
          : {}),
        ...(process.env.OPENAI_API_KEY
          ? { OPENAI_API_KEY: process.env.OPENAI_API_KEY }
          : {}),
        ...(process.env.ANTHROPIC_API_KEY
          ? { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY }
          : {}),
        ...(process.env.GOOGLE_API_KEY
          ? { GOOGLE_API_KEY: process.env.GOOGLE_API_KEY }
          : {}),
        ...(process.env.XAI_API_KEY ? { XAI_API_KEY: process.env.XAI_API_KEY } : {}),
        ...(process.env.GROQ_API_KEY
          ? { GROQ_API_KEY: process.env.GROQ_API_KEY }
          : {}),
      },
    });

    const plugins = [];

    const cloudPlugin = await import("@elizaos/plugin-elizacloud")
      .then((m) => m.default ?? m.elizaOSCloudPlugin)
      .catch(() => null);
    if (cloudPlugin) plugins.push(cloudPlugin);

    const sqlPlugin = await import("@elizaos/plugin-sql")
      .then((m) => m.default ?? m.sqlPlugin)
      .catch(() => null);
    if (sqlPlugin) plugins.push(sqlPlugin);

    const runtime = new AgentRuntime({ character, plugins });
    await runtime.initialize();

    const userId = crypto.randomUUID() as ReturnType<typeof stringToUuid>;
    const roomId = stringToUuid("cloud-agent-bridge-room");
    const worldId = stringToUuid("cloud-agent-world");

    await runtime.ensureConnection({
      entityId: userId,
      roomId,
      worldId,
      userName: "BridgeUser",
      source: "cloud-bridge",
      channelId: "cloud-bridge",
      type: ChannelType.DM,
    });

    agentRuntime = {
      processMessage: async (
        text: string,
        _roomId: string,
        mode: ChatMode,
      ): Promise<string> => {
        const message = createMessageMemory({
          id: crypto.randomUUID() as ReturnType<typeof stringToUuid>,
          entityId: userId,
          roomId,
          content: {
            text,
            mode,
            simple: mode === "simple",
            source: "cloud-bridge",
            channelType: ChannelType.DM,
          },
        });

        let responseText = "";
        await runtime.messageService?.handleMessage(
          runtime,
          message,
          async (content) => {
            if (content?.text) responseText += content.text;
            return [];
          },
        );

        state.memories.push({ role: "user", text, timestamp: Date.now() });
        state.memories.push({
          role: "assistant",
          text: responseText,
          timestamp: Date.now(),
        });

        return responseText || "(no response)";
      },
      processMessageStream: async (
        text: string,
        _roomId: string,
        mode: ChatMode,
        onChunk: (chunk: string) => void,
      ): Promise<string> => {
        const message = createMessageMemory({
          id: crypto.randomUUID() as ReturnType<typeof stringToUuid>,
          entityId: userId,
          roomId,
          content: {
            text,
            mode,
            simple: mode === "simple",
            source: "cloud-bridge",
            channelType: ChannelType.DM,
          },
        });

        let responseText = "";
        await runtime.messageService?.handleMessage(
          runtime,
          message,
          async (content) => {
            if (content?.text) {
              responseText += content.text;
              onChunk(content.text);
            }
            return [];
          },
        );

        state.memories.push({ role: "user", text, timestamp: Date.now() });
        state.memories.push({
          role: "assistant",
          text: responseText,
          timestamp: Date.now(),
        });

        return responseText || "(no response)";
      },
      getMemories: () => state.memories,
      getConfig: () => state.config,
    };

    console.log("[cloud-agent] ElizaOS runtime initialized with real agent");
  } else {
    console.warn(
      "[cloud-agent] @elizaos/core not available, running in echo mode",
    );
    agentRuntime = {
      processMessage: async (
        text: string,
        _roomId: string,
        _mode: ChatMode,
      ): Promise<string> => {
        state.memories.push({ role: "user", text, timestamp: Date.now() });
        const reply = `[echo] ${text}`;
        state.memories.push({
          role: "assistant",
          text: reply,
          timestamp: Date.now(),
        });
        return reply;
      },
      processMessageStream: async (
        text: string,
        _roomId: string,
        _mode: ChatMode,
        onChunk: (chunk: string) => void,
      ): Promise<string> => {
        state.memories.push({ role: "user", text, timestamp: Date.now() });
        const reply = `[echo] ${text}`;
        onChunk(reply);
        state.memories.push({
          role: "assistant",
          text: reply,
          timestamp: Date.now(),
        });
        return reply;
      },
      getMemories: () => state.memories,
      getConfig: () => state.config,
    };
  }
}

function getBridgeStatus() {
  return {
    service: "elizaos-cloud-agent-bridge",
    status: agentRuntime ? "healthy" : "initializing",
    uptime: process.uptime(),
    startedAt: state.startedAt,
    memoryUsage: process.memoryUsage().rss,
    runtimeReady: agentRuntime !== null,
    bridgePorts: BRIDGE_PORTS,
    primaryBridgePort: PRIMARY_BRIDGE_PORT,
  };
}

function writeJson(
  res: http.ServerResponse,
  statusCode: number,
  body: unknown,
): void {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function isHeadRequest(req: http.IncomingMessage): boolean {
  return req.method === "HEAD";
}

function writeHeadOnly(
  res: http.ServerResponse,
  statusCode: number,
  headers: Record<string, string>,
): void {
  res.writeHead(statusCode, headers);
  res.end();
}

async function readJsonBody<T>(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<T | null> {
  const body = await readRequestBody(req);
  if (!body.trim()) {
    return {} as T;
  }

  try {
    return JSON.parse(body) as T;
  } catch (error: any) {
    writeJson(res, 400, { error: `Invalid JSON body: ${error.message}` });
    return null;
  }
}

// ─── Health endpoint ────────────────────────────────────────────────────

const healthServer = http.createServer((req, res) => {
  if ((req.method === "GET" || isHeadRequest(req)) && req.url === "/health") {
    if (isHeadRequest(req)) {
      writeHeadOnly(res, 200, { "Content-Type": "application/json" });
      return;
    }

    writeJson(res, 200, {
      status: agentRuntime ? "healthy" : "initializing",
      uptime: process.uptime(),
      startedAt: state.startedAt,
      memoryUsage: process.memoryUsage().rss,
      runtimeReady: agentRuntime !== null,
      bridgePorts: BRIDGE_PORTS,
      primaryBridgePort: PRIMARY_BRIDGE_PORT,
    });
    return;
  }

  if ((req.method === "GET" || isHeadRequest(req)) && req.url === "/") {
    if (isHeadRequest(req)) {
      writeHeadOnly(res, 200, { "Content-Type": "application/json" });
      return;
    }

    writeJson(res, 200, {
      service: "elizaos-cloud-agent",
      status: "running",
      bridgePorts: BRIDGE_PORTS,
      primaryBridgePort: PRIMARY_BRIDGE_PORT,
    });
    return;
  }

  res.writeHead(404);
  res.end("Not Found");
});

healthServer.listen(PORT, "0.0.0.0", () => {
  console.log(`[cloud-agent] Health endpoint listening on port ${PORT}`);
});

// ─── Bridge HTTP server ─────────────────────────────────────────────────

const bridgeRequestHandler = async (
  req: http.IncomingMessage,
  res: http.ServerResponse,
) => {
  const url = req.url ?? "/";

  try {
    if (
      (req.method === "GET" || isHeadRequest(req)) &&
      (url === "/" || url === "/health" || url === "/bridge" || url === "/bridge/health")
    ) {
      if (isHeadRequest(req)) {
        writeHeadOnly(res, 200, { "Content-Type": "application/json" });
        return;
      }

      writeJson(res, 200, getBridgeStatus());
      return;
    }

    if (req.method === "POST" && (url === "/api/snapshot" || url === "/snapshot")) {
      writeJson(res, 200, {
        memories: state.memories,
        config: state.config,
        workspaceFiles: state.workspaceFiles,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (req.method === "POST" && (url === "/api/restore" || url === "/restore")) {
      const incoming = await readJsonBody<Partial<typeof state>>(req, res);
      if (!incoming) {
        return;
      }

      if (incoming.memories) state.memories = incoming.memories;
      if (incoming.config) state.config = incoming.config;
      if (incoming.workspaceFiles) state.workspaceFiles = incoming.workspaceFiles;

      console.log("[cloud-agent] State restored from snapshot");
      writeJson(res, 200, { success: true });
      return;
    }

    if (req.method === "POST" && (url === "/bridge/stream" || url === "/stream")) {
      if (!agentRuntime) {
        writeJson(res, 503, { error: "Agent runtime not ready" });
        return;
      }

      const rpc = await readJsonBody<BridgeRpcRequest>(req, res);
      if (!rpc) {
        return;
      }

      if (rpc.method !== "message.send") {
        writeJson(res, 400, { error: "Only message.send is streamable" });
        return;
      }

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      const sendEvent = (event: string, data: unknown) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      const text = rpc.params?.text ?? "";
      const roomId = rpc.params?.roomId ?? "default";
      const mode: ChatMode = rpc.params?.mode === "simple" ? "simple" : "power";

      sendEvent("connected", {
        rpcId: rpc.id,
        timestamp: Date.now(),
        bridgePorts: BRIDGE_PORTS,
      });

      try {
        await agentRuntime.processMessageStream(text, roomId, mode, (chunk: string) => {
          sendEvent("chunk", { text: chunk });
        });

        sendEvent("done", { rpcId: rpc.id, timestamp: Date.now() });
      } catch (error: any) {
        console.error("[cloud-agent] stream bridge error:", error);
        sendEvent("error", {
          message: error instanceof Error ? error.message : String(error),
          timestamp: Date.now(),
        });
      }

      res.end();
      return;
    }

    if (req.method === "POST" && url === "/bridge") {
      const rpc = await readJsonBody<BridgeRpcRequest>(req, res);
      if (!rpc) {
        return;
      }

      if (rpc.method === "message.send") {
        if (!agentRuntime) {
          writeJson(res, 503, {
            jsonrpc: "2.0",
            id: rpc.id,
            error: { code: -32000, message: "Agent runtime not ready" },
          });
          return;
        }

        const text = rpc.params?.text ?? "";
        const roomId = rpc.params?.roomId ?? "default";
        const mode: ChatMode = rpc.params?.mode === "simple" ? "simple" : "power";
        const responseText = await agentRuntime.processMessage(text, roomId, mode);

        writeJson(res, 200, {
          jsonrpc: "2.0",
          id: rpc.id,
          result: { text: responseText, metadata: { timestamp: Date.now() } },
        });
        return;
      }

      if (rpc.method === "status.get") {
        writeJson(res, 200, {
          jsonrpc: "2.0",
          id: rpc.id,
          result: {
            status: agentRuntime ? "running" : "initializing",
            uptime: process.uptime(),
            memoriesCount: state.memories.length,
            startedAt: state.startedAt,
            bridgePorts: BRIDGE_PORTS,
            primaryBridgePort: PRIMARY_BRIDGE_PORT,
          },
        });
        return;
      }

      if (rpc.method === "heartbeat") {
        writeJson(res, 200, {
          jsonrpc: "2.0",
          method: "heartbeat.ack",
          params: { timestamp: Date.now(), runtimeReady: agentRuntime !== null },
        });
        return;
      }

      writeJson(res, 200, {
        jsonrpc: "2.0",
        id: rpc.id,
        error: { code: -32601, message: `Method not found: ${rpc.method}` },
      });
      return;
    }

    writeJson(res, 404, { error: "Not Found" });
  } catch (error: any) {
    console.error("[cloud-agent] bridge request failed:", error);

    if (!res.headersSent) {
      writeJson(res, 500, {
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    try {
      res.end();
    } catch {
      // ignore secondary failure while unwinding a broken stream
    }
  }
};

const bridgeServers = BRIDGE_PORTS.map((port) => {
  const server = http.createServer(bridgeRequestHandler);
  server.listen(port, "0.0.0.0", () => {
    const label = port === PRIMARY_BRIDGE_PORT ? "primary" : "compat";
    console.log(`[cloud-agent] Bridge server listening on port ${port} (${label})`);
  });
  return server;
});

// ─── Startup / Shutdown ─────────────────────────────────────────────────

function shutdown() {
  console.log("[cloud-agent] Shutting down...");
  healthServer.close();
  for (const server of bridgeServers) {
    server.close();
  }
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

initRuntime()
  .then(() => {
    console.log("[cloud-agent] Ready");
  })
  .catch((err) => {
    console.error("[cloud-agent] Runtime init failed:", err);
    // Keep health/bridge listeners alive for diagnostics.
  });
