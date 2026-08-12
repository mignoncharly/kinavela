const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3020";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function check(path, expectedStatus, expectedPayloadStatus) {
  const response = await fetch(new URL(path, baseUrl), {
    headers: { accept: "application/json" },
  });
  assert(
    response.status === expectedStatus,
    `${path} returned ${response.status}`,
  );
  const payload = await response.json();
  assert(
    payload.status === expectedPayloadStatus,
    `${path} returned an unexpected status`,
  );
  assert(
    response.headers.get("cache-control")?.includes("no-store"),
    `${path} is cacheable`,
  );
  return response;
}

async function checkProtectedWorker(path) {
  const response = await fetch(new URL(path, baseUrl), { method: "POST" });
  assert(
    response.status === 401,
    path + " must reject unauthenticated requests",
  );
  const body = await response.text();
  assert(!body.includes("OPENAI_API_KEY"), path + " leaked a provider secret");
}

for (const path of ["/api/cron/ai", "/api/cron/story-ai"])
  await checkProtectedWorker(path);

const health = await check("/api/health", 200, "ok");
const readiness = await check("/api/readiness", 200, "ready");
for (const response of [health, readiness]) {
  assert(
    response.headers.get("x-content-type-options") === "nosniff",
    "missing X-Content-Type-Options",
  );
  assert(
    response.headers.get("x-frame-options") === "DENY",
    "missing X-Frame-Options",
  );
  const csp = response.headers.get("content-security-policy") ?? "";
  assert(csp.length > 0 && !csp.includes("unsafe-inline"), "invalid CSP");
}

console.log(`Production smoke checks passed for ${baseUrl}.`);
