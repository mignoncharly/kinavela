const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3020";
const publicHttps =
  Boolean(process.env.SMOKE_BASE_URL) && new URL(baseUrl).protocol === "https:";

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

async function checkPublicApplicationRouting() {
  const signup = await fetch(new URL("/de/auth/signup", baseUrl), {
    redirect: "manual",
  });
  assert(signup.status === 200, "/de/auth/signup returned " + signup.status);
  assert(
    signup.headers.get("content-type")?.includes("text/html"),
    "/de/auth/signup did not return HTML",
  );

  const protectedRoute = await fetch(new URL("/de/app", baseUrl), {
    redirect: "manual",
  });
  assert(
    [302, 303, 307, 308].includes(protectedRoute.status),
    "/de/app returned " +
      protectedRoute.status +
      " instead of an auth redirect",
  );
  const location = protectedRoute.headers.get("location");
  assert(location, "/de/app auth redirect omitted its destination");
  const loginUrl = new URL(location, baseUrl);
  assert(
    loginUrl.pathname === "/de/auth/login" && loginUrl.searchParams.has("next"),
    "/de/app redirected outside the expected login flow",
  );
  const login = await fetch(loginUrl);
  assert(login.status === 200, "public login returned " + login.status);
  assert(
    (await login.text()).includes("Willkommen zurück"),
    "public login returned unexpected content",
  );
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

if (publicHttps) await checkPublicApplicationRouting();

console.log(`Production smoke checks passed for ${baseUrl}.`);
