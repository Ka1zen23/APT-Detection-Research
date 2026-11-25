/**
 * Server-side proxy for the protected research API.
 *
 * Vercel rewrites /api/v1/* to this function with the original path in
 * ?path=. Deployment Protection gates the project, and this function adds the
 * service-to-service API key so the Fly.io backend cannot be used directly.
 */
const MAX_UPSTREAM_BYTES = 4_000_000;
const FORWARD_HEADERS = [
  "accept",
  "content-type",
  "if-none-match",
  "if-modified-since",
  "range",
];
const RESPONSE_HEADERS = [
  "content-type",
  "content-disposition",
  "etag",
  "last-modified",
];

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(request, response) {
  const origin = (process.env.API_ORIGIN || "").replace(/\/+$/, "");
  const apiKey = process.env.APT_API_KEY || "";

  if (!origin || !apiKey) {
    response.status(500).json({ detail: "The API proxy is not configured." });
    return;
  }

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (!["GET", "POST"].includes(request.method || "GET")) {
    response.status(405).json({ detail: "Method not allowed." });
    return;
  }

  const rawPath = first(request.query?.path);
  const resourcePath = String(rawPath || "").replace(/^\/+/, "");
  if (!resourcePath || resourcePath.includes("..")) {
    response.status(404).json({ detail: "Only /api/v1/* is proxied." });
    return;
  }

  let target;
  try {
    target = new URL(origin);
  } catch {
    response.status(500).json({ detail: "API_ORIGIN is invalid." });
    return;
  }
  target.pathname = `${target.pathname.replace(/\/+$/, "")}/api/v1/${resourcePath}`;

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(request.query || {})) {
    if (key === "path") continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined && item !== null && item !== "") {
        query.append(key, String(item));
      }
    }
  }
  target.search = query.toString();

  const headers = {};
  for (const name of FORWARD_HEADERS) {
    const value = request.headers?.[name];
    if (typeof value === "string" && value) headers[name] = value;
  }
  headers["x-api-key"] = apiKey;
  headers["accept-encoding"] = "identity";

  let body;
  if (request.method === "POST" && request.body !== undefined) {
    body =
      typeof request.body === "string"
        ? request.body
        : Buffer.from(JSON.stringify(request.body));
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
      signal: controller.signal,
      redirect: "manual",
    });

    const contentLength = Number(upstream.headers.get("content-length") || "0");
    if (contentLength > MAX_UPSTREAM_BYTES) {
      response.status(502).json({ detail: "Upstream response is too large." });
      return;
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (buffer.byteLength > MAX_UPSTREAM_BYTES) {
      response.status(502).json({ detail: "Upstream response is too large." });
      return;
    }

    response.status(upstream.status);
    for (const name of RESPONSE_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) response.setHeader(name, value);
    }
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.send(buffer);
  } catch (error) {
    const aborted = error?.name === "AbortError";
    response.status(aborted ? 504 : 502).json({
      detail: aborted
        ? "The research API timed out."
        : "The research API is unavailable.",
    });
  } finally {
    clearTimeout(timeout);
  }
}
