/**
 * Shared HTTP helper for e2e tests.
 *
 * Replaces the `req()` function that was copy-pasted across 24+ e2e test files.
 */

import http from "node:http";

export type HttpResponse = {
  status: number;
  headers: http.IncomingHttpHeaders;
  data: Record<string, unknown>;
};

/**
 * Make an HTTP request to a local test server.
 *
 * Superset of all the `req()` variants that were duplicated across e2e tests.
 * Supports optional body (object or string), custom headers, and content type.
 */
export function req(
  port: number,
  method: string,
  path: string,
  body?: Record<string, unknown> | string,
  headersOrContentType?:
    | Record<string, string>
    | string,
): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const contentType =
      typeof headersOrContentType === "string"
        ? headersOrContentType
        : "application/json";
    const extraHeaders =
      typeof headersOrContentType === "object" ? headersOrContentType : {};

    const b =
      body !== undefined
        ? typeof body === "string"
          ? body
          : JSON.stringify(body)
        : undefined;

    const r = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method,
        headers: {
          "Content-Type": contentType,
          ...(b ? { "Content-Length": Buffer.byteLength(b) } : {}),
          ...extraHeaders,
        },
      },
      (res) => {
        const ch: Buffer[] = [];
        res.on("data", (c: Buffer) => ch.push(c));
        res.on("end", () => {
          const raw = Buffer.concat(ch).toString("utf-8");
          let data: Record<string, unknown> = {};
          try {
            data = JSON.parse(raw) as Record<string, unknown>;
          } catch {
            data = { _raw: raw };
          }
          resolve({ status: res.statusCode ?? 0, headers: res.headers, data });
        });
      },
    );
    r.on("error", reject);
    if (b) r.write(b);
    r.end();
  });
}
