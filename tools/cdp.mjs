// CDP capture helper — no external deps. Node >= 21 (built-in WebSocket).
// Usage: node tools/cdp.mjs <url> <out.png> [waitMs] [exprsJson]
// Prints captured console errors & the evaluated JSON expressions to stdout.
import { writeFileSync } from "node:fs";

const url = process.argv[2];
const out = process.argv[3];
const waitMs = parseInt(process.argv[4] || "3000", 10);
const exprs = process.env.CDP_EXPRS ? JSON.parse(process.env.CDP_EXPRS) : [];
const PORT = 9333;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let id = 0;
  const pending = new Map();
  const errors = [];
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
  const page = targets.find((t) => t.type === "page");
  if (!page) throw new Error("no page target");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  const send = (method, params = {}) =>
    new Promise((res) => {
      const mid = ++id;
      pending.set(mid, res);
      ws.send(JSON.stringify({ id: mid, method, params }));
    });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg.result);
      pending.delete(msg.id);
    } else if (msg.method === "Runtime.consoleAPICalled" || msg.method === "Runtime.exceptionThrown") {
      const txt = JSON.stringify(msg.params).slice(0, 500);
      if (/error|exception|failed|shader/i.test(txt)) errors.push(txt);
    } else if (msg.method === "Log.entryAdded" && /error|warn/i.test(JSON.stringify(msg.params))) {
      errors.push(JSON.stringify(msg.params.entry).slice(0, 500));
    }
  };
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Log.enable");
  await send("Page.navigate", { url });
  await sleep(waitMs);
  const results = {};
  for (const e of exprs) {
    const r = await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true });
    results[e] = r && r.result && r.result.value !== undefined ? r.result.value : (r && r.result && r.result.description) || null;
  }
  // prefer an in-page readback (window.__EPH.shot), else compositor screenshot
  let wrote = false;
  for (const v of Object.values(results)) {
    if (typeof v === "string" && v.startsWith("data:image/png;base64,")) {
      writeFileSync(out, Buffer.from(v.slice("data:image/png;base64,".length), "base64"));
      wrote = true;
      break;
    }
  }
  if (!wrote) {
    const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
    if (shot && shot.data) writeFileSync(out, Buffer.from(shot.data, "base64"));
  }
  const printed = {};
  for (const [k, v] of Object.entries(results)) {
    printed[k] = typeof v === "string" && v.length > 20000 ? v.slice(0, 20000) + "…" : v;
  }
  console.log(JSON.stringify({ out, errors: errors.slice(0, 12), results: printed }, null, 1));
  ws.close();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
