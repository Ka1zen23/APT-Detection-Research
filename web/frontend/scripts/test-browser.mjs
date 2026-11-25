import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { build, preview } from "vite";

let baseURL = process.env.PLAYWRIGHT_BASE_URL;
let server;
try {
  if (!baseURL) {
    process.env.VITE_DATA_MODE = "static";
    await build();
    server = await preview({ preview: { host: "127.0.0.1", port: 0 } });
    baseURL = `http://127.0.0.1:${server.httpServer.address().port}`;
  }
  const cli = fileURLToPath(import.meta.resolve("@playwright/test/cli"));
  const run = spawn(process.execPath, [cli, "test", ...process.argv.slice(2)], {
    stdio: "inherit",
    env: { ...process.env, PLAYWRIGHT_BASE_URL: baseURL },
  });
  const [code] = await once(run, "exit");
  process.exitCode = code ?? 1;
} finally {
  if (server) await new Promise((resolve) => server.httpServer.close(resolve));
}
