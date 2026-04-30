export interface AssertResult {
  name: string;
  status: "pass" | "fail" | "warn" | "skip";
  message?: string;
  detail?: string;
  authRequired?: boolean;
}

const results: AssertResult[] = [];

export function getResults(): AssertResult[] {
  return [...results];
}

export function resetResults() {
  results.length = 0;
}

function fmtVal(v: unknown): string {
  if (v === null) return "null";
  if (v === undefined) return "undefined";
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

function record(name: string, passed: boolean, opts?: { warn?: boolean; message?: string; detail?: string }): boolean {
  if (passed) {
    results.push({ name, status: "pass" });
  } else {
    results.push({
      name,
      status: opts?.warn ? "warn" : "fail",
      message: opts?.message ?? "Assertion failed",
      detail: opts?.detail,
    });
  }
  return passed;
}

export function assertEquals<T>(
  actual: T,
  expected: T,
  name: string,
  opts?: { warn?: boolean; detail?: string },
): boolean {
  return record(name, actual === expected, { ...opts, message: `Expected ${fmtVal(expected)}, got ${fmtVal(actual)}` });
}

export function assertNotEquals<T>(
  actual: T,
  notExpected: T,
  name: string,
  opts?: { warn?: boolean; detail?: string },
): boolean {
  return record(name, actual !== notExpected, { ...opts, message: `Expected value not to equal ${fmtVal(notExpected)}` });
}

export function assertOneOf<T>(
  actual: T,
  expected: T[],
  name: string,
  opts?: { warn?: boolean; detail?: string },
): boolean {
  return record(name, expected.includes(actual), { ...opts, message: `Expected one of [${expected.map(fmtVal).join(", ")}], got ${fmtVal(actual)}` });
}

export function assertGreaterThan(
  actual: number,
  threshold: number,
  name: string,
  opts?: { warn?: boolean; detail?: string },
): boolean {
  return record(name, actual > threshold, { ...opts, message: `Expected ${actual} > ${threshold}` });
}

export function assertGreaterThanOrEqual(
  actual: number,
  threshold: number,
  name: string,
  opts?: { warn?: boolean; detail?: string },
): boolean {
  return record(name, actual >= threshold, { ...opts, message: `Expected ${actual} >= ${threshold}` });
}

export function assertLessThan(
  actual: number,
  threshold: number,
  name: string,
  opts?: { warn?: boolean; detail?: string },
): boolean {
  return record(name, actual < threshold, { ...opts, message: `Expected ${actual} < ${threshold}` });
}

export function assertLessThanOrEqual(
  actual: number,
  threshold: number,
  name: string,
  opts?: { warn?: boolean; detail?: string },
): boolean {
  return record(name, actual <= threshold, { ...opts, message: `Expected ${actual} <= ${threshold}` });
}

export function assertNotNull(
  actual: unknown,
  name: string,
  opts?: { warn?: boolean; detail?: string },
): actual is NonNullable<typeof actual> {
  const passed = actual !== null && actual !== undefined;
  record(name, passed, { ...opts, message: `Expected non-null value, got ${fmtVal(actual)}` });
  return passed;
}

export function assertMatches(
  actual: string,
  pattern: RegExp,
  name: string,
  opts?: { warn?: boolean; detail?: string },
): boolean {
  return record(name, pattern.test(actual), { ...opts, message: `Expected ${fmtVal(actual)} to match ${pattern}` });
}

export function assertContains(
  actual: string,
  substring: string,
  name: string,
  opts?: { warn?: boolean; detail?: string },
): boolean {
  return record(name, actual.includes(substring), { ...opts, message: `Expected string to contain ${fmtVal(substring)}` });
}

export function assertIsArray(
  actual: unknown,
  name: string,
  opts?: { warn?: boolean; detail?: string },
): actual is unknown[] {
  return record(name, Array.isArray(actual), { ...opts, message: `Expected array, got ${typeof actual}` });
}

export function skip(name: string, reason: string) {
  results.push({ name, status: "skip", message: reason });
}

export function statusDetail(status: number): string {
  return `HTTP ${status}`;
}

export function headerDetail(headers: Headers, ...names: string[]): string {
  const parts = names.map((n) => `${n}: ${headers.get(n) ?? "(missing)"}`);
  return parts.join(", ");
}

export function resDetail(res: { status: number; headers: Headers; body: string }): string {
  const parts: string[] = [`HTTP ${res.status}`];
  const reason = res.headers.get("x-reason");
  if (reason) parts.push(`X-Reason: ${reason}`);
  const bodySnippet = res.body?.substring(0, 200).trim();
  if (bodySnippet) parts.push(`Body: ${bodySnippet}`);
  return parts.join(" | ");
}
