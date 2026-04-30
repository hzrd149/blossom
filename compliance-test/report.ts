import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { getServerTargets, DEFAULT_SERVERS, type ServerTarget } from "./helpers/config.ts";
import type { AssertResult } from "./helpers/assert.ts";

const reportDir = resolve(import.meta.dir, "report");
mkdirSync(reportDir, { recursive: true });

interface BudResult {
  budId: string;
  mandatory: boolean;
  cases: AssertResult[];
}

interface ServerResult {
  server: ServerTarget;
  buds: BudResult[];
  duration: number;
}

const budModules = [
  "./bud-00.test.ts",
  "./bud-01.test.ts",
  "./bud-02.test.ts",
  "./bud-03.test.ts",
  "./bud-04.test.ts",
  "./bud-05.test.ts",
  "./bud-06.test.ts",
  "./bud-07.test.ts",
  "./bud-08.test.ts",
  "./bud-09.test.ts",
  "./bud-10.test.ts",
  "./bud-11.test.ts",
  "./bud-12.test.ts",
];

async function runTestsForServer(server: ServerTarget): Promise<ServerResult> {
  const start = performance.now();
  const buds: BudResult[] = [];

  process.env.BLOSSOM_SERVER_URL = server.url;

  for (const modPath of budModules) {
    const mod = await import(modPath);
    const budId: string = mod.budId;
    const mandatory: boolean = mod.mandatory;

    let cases: AssertResult[];
    try {
      cases = await mod.run();
    } catch (err: any) {
      cases = [{ name: `${budId} runner error`, status: "fail", message: err?.message ?? String(err) }];
    }

    if (!mandatory) {
      cases = cases.map((c) => {
        if (c.status === "fail") {
          return { ...c, status: "warn" as const };
        }
        return c;
      });
    }

    buds.push({ budId, mandatory, cases });
  }

  const duration = performance.now() - start;
  return { server, buds, duration };
}

const targets = getServerTargets();

console.log(`Running compliance tests against ${targets.length} server(s)...\n`);

const results: ServerResult[] = [];

for (const target of targets) {
  console.log(`  Testing ${target.name} (${target.url})...`);
  const result = await runTestsForServer(target);
  results.push(result);
  const pass = result.buds.reduce((s, b) => s + b.cases.filter((c) => c.status === "pass").length, 0);
  const fail = result.buds.reduce((s, b) => s + b.cases.filter((c) => c.status === "fail").length, 0);
  const warn = result.buds.reduce((s, b) => s + b.cases.filter((c) => c.status === "warn").length, 0);
  console.log(`    ${pass} pass, ${warn} warn, ${fail} fail\n`);
}

const jsonOut = resolve(reportDir, "results.json");
writeFileSync(jsonOut, JSON.stringify(results, null, 2));

const htmlOut = resolve(reportDir, "index.html");
const html = renderHTML(results);
writeFileSync(htmlOut, html);

console.log(`Report written to ${htmlOut}`);
console.log(`JSON results written to ${jsonOut}`);

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderHTML(results: ServerResult[]): string {
  const timestamp = new Date().toISOString();

  const serverCards = results.map((r) => {
    const allCases = r.buds.flatMap((b) => b.cases);
    const totalTests = allCases.length;
    const totalPass = allCases.filter((c) => c.status === "pass").length;
    const totalFail = allCases.filter((c) => c.status === "fail").length;
    const totalWarn = allCases.filter((c) => c.status === "warn").length;
    const totalSkip = allCases.filter((c) => c.status === "skip").length;
    const pct = totalTests > 0 ? Math.round((totalPass / totalTests) * 100) : 0;
    const hasFail = totalFail > 0;
    const hasWarn = totalWarn > 0;
    const barColor = hasFail ? "var(--fail)" : hasWarn ? "var(--warn)" : "var(--pass)";
    const serverId = r.server.name.replace(/[^a-zA-Z0-9]/g, "_");

    const budRows = r.buds.map((bud) => {
      const pass = bud.cases.filter((c) => c.status === "pass").length;
      const fail = bud.cases.filter((c) => c.status === "fail").length;
      const warn = bud.cases.filter((c) => c.status === "warn").length;
      const skip = bud.cases.filter((c) => c.status === "skip").length;
      const total = bud.cases.length;
      const sPct = total > 0 ? Math.round((pass / total) * 100) : 0;
      const sBarColor = fail > 0 ? "var(--fail)" : warn > 0 ? "var(--warn)" : "var(--pass)";
      const mandatoryLabel = bud.mandatory ? "" : `<span class="optional-badge">OPTIONAL</span>`;

      const caseRows = bud.cases.map((c) => {
        const badge = c.status === "pass"
          ? `<span class="badge pass">PASS</span>`
          : c.status === "fail"
            ? `<span class="badge fail">FAIL</span>`
            : c.status === "warn"
              ? `<span class="badge warn">WARN</span>`
              : `<span class="badge skip">SKIP</span>`;
        const authBadge = c.authRequired ? ` <span class="badge auth">AUTH</span>` : "";
        const msg = c.message ? `<div class="case-message">${escapeHtml(c.message)}</div>` : "";
        const detail = c.detail ? `<div class="case-detail">${escapeHtml(c.detail)}</div>` : "";
        return `<tr class="case-row"><td class="col-status">${badge}${authBadge}</td><td class="col-name">${escapeHtml(c.name)}${msg}${detail}</td><td class="col-status-badge">${c.status === "skip" && c.message ? escapeHtml(c.message) : ""}</td></tr>`;
      }).join("");

      return `
        <div class="suite">
          <div class="suite-header">
            <div class="suite-title">
              <span class="suite-name">${escapeHtml(bud.budId)}</span>
              ${mandatoryLabel}
            </div>
            <div class="suite-stats">
              <span class="stat-pass">${pass} pass</span>
              ${fail > 0 ? `<span class="stat-fail">${fail} fail</span>` : ""}
              ${warn > 0 ? `<span class="stat-warn">${warn} warn</span>` : ""}
              ${skip > 0 ? `<span class="stat-skip">${skip} skip</span>` : ""}
              <div class="mini-bar"><div class="mini-bar-fill" style="width:${sPct}%;background:${sBarColor}"></div></div>
              <span class="stat-pct">${sPct}%</span>
            </div>
          </div>
          <div class="suite-body">
            <table class="case-table">
              <thead><tr><th></th><th>Test</th><th></th></tr></thead>
              <tbody>${caseRows}</tbody>
            </table>
          </div>
        </div>`;
    }).join("");

    return `
      <div class="server-card">
        <div class="server-header">
          <div class="server-title">
            <div>
              <span class="server-name">${escapeHtml(r.server.name)}</span>
              <span class="server-software">${escapeHtml(r.server.software)}</span>
              <span class="server-url">${escapeHtml(r.server.url)}</span>
            </div>
          </div>
          <div class="server-score">
            <span class="score-pct" style="color:${barColor}">${pct}%</span>
            <div class="score-bar"><div class="score-bar-fill" style="width:${pct}%;background:${barColor}"></div></div>
            <span class="score-detail">${totalPass}/${totalTests}</span>
          </div>
        </div>
        <div class="server-body">
          ${budRows}
        </div>
      </div>`;
  }).join("");

  const totalAll = results.reduce((s, r) => s + r.buds.flatMap((b) => b.cases).length, 0);
  const passAll = results.reduce((s, r) => s + r.buds.flatMap((b) => b.cases).filter((c) => c.status === "pass").length, 0);
  const failAll = results.reduce((s, r) => s + r.buds.flatMap((b) => b.cases).filter((c) => c.status === "fail").length, 0);
  const warnAll = results.reduce((s, r) => s + r.buds.flatMap((b) => b.cases).filter((c) => c.status === "warn").length, 0);
  const overallPct = totalAll > 0 ? Math.round((passAll / totalAll) * 100) : 0;
  const overallBarColor = failAll > 0 ? "var(--fail)" : warnAll > 0 ? "var(--warn)" : "var(--pass)";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Blossom Compliance Report</title>
<style>
  :root { --bg: #0f172a; --surface: #1e293b; --border: #334155; --text: #e2e8f0; --muted: #94a3b8; --pass: #22c55e; --fail: #ef4444; --warn: #f59e0b; --skip: #6b7280; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); padding: 2rem; max-width: 960px; margin: 0 auto; }
  h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
  .timestamp { color: var(--muted); font-size: 0.85rem; margin-bottom: 2rem; }
  .summary { display: flex; gap: 1.5rem; margin-bottom: 2rem; align-items: center; flex-wrap: wrap; }
  .big-pct { font-size: 3rem; font-weight: 700; }
  .progress-bar { width: 100%; height: 8px; background: var(--border); border-radius: 4px; margin-bottom: 2rem; overflow: hidden; }
  .progress-bar-fill { height: 100%; border-radius: 4px; }
  .server-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 0.75rem; overflow: hidden; }
  .server-header { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; }
  .server-title { display: flex; align-items: center; gap: 0.5rem; }
  .server-name { font-weight: 600; font-size: 1rem; }
  .server-software { font-size: 0.75rem; color: var(--muted); background: rgba(255,255,255,0.05); padding: 1px 6px; border-radius: 3px; margin-left: 0.5rem; }
  .server-url { font-size: 0.75rem; color: var(--muted); margin-left: 0.5rem; }
  .server-score { display: flex; align-items: center; gap: 0.5rem; }
  .score-pct { font-weight: 700; min-width: 3rem; text-align: right; }
  .score-bar { width: 80px; height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; }
  .score-bar-fill { height: 100%; border-radius: 3px; }
  .score-detail { font-size: 0.8rem; color: var(--muted); }
  .server-body { border-top: 1px solid var(--border); }
  .suite { border-bottom: 1px solid var(--border); }
  .suite:last-child { border-bottom: none; }
  .suite-header { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 1rem 0.5rem 2rem; }
  .suite-title { display: flex; align-items: center; gap: 0.5rem; }
  .suite-name { font-weight: 500; font-size: 0.9rem; }
  .optional-badge { font-size: 0.6rem; color: var(--muted); background: rgba(255,255,255,0.05); padding: 1px 5px; border-radius: 3px; letter-spacing: 0.5px; }
  .suite-stats { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; }
  .stat-pass { color: var(--pass); }
  .stat-fail { color: var(--fail); }
  .stat-warn { color: var(--warn); }
  .stat-skip { color: var(--skip); }
  .stat-pct { color: var(--muted); min-width: 2rem; text-align: right; }
  .mini-bar { width: 50px; height: 3px; background: var(--border); border-radius: 2px; overflow: hidden; }
  .mini-bar-fill { height: 100%; border-radius: 2px; }
  .suite-body { padding: 0 1rem 0.5rem 2rem; }
  .case-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
  .case-table th { text-align: left; color: var(--muted); font-weight: 500; padding: 0.25rem 0; border-bottom: 1px solid var(--border); }
  .case-table td { padding: 0.3rem 0; vertical-align: top; }
  .col-status { width: 55px; }
  .col-status-badge { width: 80px; color: var(--muted); font-size: 0.7rem; }
  .badge { display: inline-block; padding: 1px 7px; border-radius: 3px; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.5px; }
  .badge.pass { background: rgba(34,197,94,0.15); color: var(--pass); }
  .badge.fail { background: rgba(239,68,68,0.15); color: var(--fail); }
  .badge.warn { background: rgba(245,158,11,0.15); color: var(--warn); }
  .badge.auth { background: rgba(99,102,241,0.15); color: #818cf8; margin-left: 2px; }
  .badge.skip { background: rgba(107,114,128,0.15); color: var(--skip); }
  .case-message { font-size: 0.75rem; color: #fca5a5; margin-top: 2px; }
  .case-detail { font-size: 0.7rem; color: var(--muted); margin-top: 1px; font-family: monospace; }
</style>
</head>
<body>
<h1>Blossom Compliance Report</h1>
<p class="timestamp">${timestamp} &mdash; ${results.length} server${results.length !== 1 ? "s" : ""} tested</p>
<div class="summary">
  <div class="big-pct" style="color:${overallBarColor}">${overallPct}%</div>
  <div>
    <div>${totalAll} tests total across ${results.length} servers</div>
    <div><span style="color:var(--pass)">${passAll} passed</span> &middot; <span style="color:var(--fail)">${failAll} failed</span> &middot; <span style="color:var(--warn)">${warnAll} warnings</span></div>
  </div>
</div>
<div class="progress-bar"><div class="progress-bar-fill" style="width:${overallPct}%;background:${overallBarColor}"></div></div>
${serverCards}
</body>
</html>`;
}
