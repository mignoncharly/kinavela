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

async function checkBlogSurface() {
  const index = await fetch(new URL("/de/blog", baseUrl));
  assert(index.status === 200, "/de/blog returned " + index.status);
  const indexHtml = await index.text();
  assert(
    indexHtml.includes('rel="canonical"'),
    "/de/blog is missing its canonical link",
  );
  assert(
    indexHtml.includes("application/rss+xml"),
    "/de/blog is missing RSS autodiscovery",
  );

  const feed = await fetch(new URL("/de/feed.xml", baseUrl));
  assert(feed.status === 200, "/de/feed.xml returned " + feed.status);
  assert(
    feed.headers.get("content-type")?.includes("application/rss+xml"),
    "/de/feed.xml is not served as RSS",
  );
  const feedBody = await feed.text();
  assert(feedBody.startsWith("<?xml"), "/de/feed.xml is not XML");
  assert(
    !/<link>\/(?!\/)/.test(feedBody),
    "/de/feed.xml contains a relative link, which resolves against the reader",
  );

  // Every post the sitemap advertises must actually resolve. A 404 in the
  // sitemap is worse than an absent entry: it spends crawl budget to learn
  // nothing.
  const sitemap = await fetch(new URL("/sitemap.xml", baseUrl));
  assert(sitemap.status === 200, "/sitemap.xml returned " + sitemap.status);
  const postUrls = [...(await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((match) => match[1])
    .filter((url) => /\/blog\/[^/]+$/.test(url));
  for (const url of postUrls.slice(0, 10)) {
    const post = await fetch(new URL(new URL(url).pathname, baseUrl));
    assert(
      post.status === 200,
      `${url} in the sitemap returned ${post.status}`,
    );
  }

  const missing = await fetch(
    new URL("/de/blog/dieser-beitrag-existiert-nicht", baseUrl),
  );
  assert(
    missing.status === 404,
    "an unknown blog slug returned " + missing.status,
  );
}

for (const path of ["/api/cron/ai", "/api/cron/story-ai"])
  await checkProtectedWorker(path);

await checkBlogSurface();

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
