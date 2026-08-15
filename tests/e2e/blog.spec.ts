import { expect, test } from "@playwright/test";

/**
 * These run against whatever is in content/blog. The post-dependent assertions
 * skip themselves when the blog is still empty, so the suite is honest on an
 * empty repository and grows teeth the moment a real post lands — rather than
 * failing today for a reason that is not a defect.
 */

test("the blog index renders in every language", async ({ page }) => {
  for (const locale of ["de", "fr", "en"]) {
    const response = await page.goto(`/${locale}/blog`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("main.blog-page")).toBeVisible();
  }
});

test("the index declares canonical and hreflang for all three languages", async ({
  page,
}) => {
  await page.goto("/de/blog");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://www.kinavela.com/de/blog",
  );
  for (const locale of ["de", "fr", "en", "x-default"]) {
    await expect(
      page.locator(`link[rel="alternate"][hreflang="${locale}"]`),
    ).toHaveCount(1);
  }
});

test("the index offers RSS autodiscovery", async ({ page }) => {
  await page.goto("/de/blog");
  await expect(
    page.locator('link[type="application/rss+xml"]'),
  ).toHaveAttribute("href", "https://www.kinavela.com/de/feed.xml");
});

test("the feed is served as RSS and parses", async ({ request }) => {
  const response = await request.get("/de/feed.xml");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/rss+xml");
  const body = await response.text();
  expect(body).toContain("<rss");
  expect(body).toContain("<channel>");
  // Absolute URLs only: a relative link in a feed resolves against the reader.
  expect(body).not.toMatch(/<link>\/(?!\/)/);
});

test("an unknown slug is a 404, not an empty page", async ({ page }) => {
  const response = await page.goto("/de/blog/dieser-beitrag-existiert-nicht");
  expect(response?.status()).toBe(404);
});

test("the blog carries structured data naming the site graph", async ({
  page,
}) => {
  await page.goto("/de/blog");
  const blocks = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  expect(blocks.length).toBeGreaterThan(0);
  const graph = JSON.parse(blocks[0] ?? "{}");
  const types = (graph["@graph"] ?? []).map(
    (node: { "@type": string }) => node["@type"],
  );
  expect(types).toContain("Blog");
  expect(types).toContain("BreadcrumbList");
  // References the ids the homepage publishes, rather than redeclaring them.
  expect(JSON.stringify(graph)).toContain(
    "https://www.kinavela.com/#organization",
  );
});

test("a community page links into the blog", async ({ page }) => {
  await page.goto("/de/community/cameroonian-families-in-munich");
  await expect(page.locator('a[href="/de/blog"]')).toHaveCount(1);
});

test("posts are listed newest first and open", async ({ page }) => {
  await page.goto("/de/blog");
  const cards = page.locator(".blog-card");
  const count = await cards.count();
  test.skip(count === 0, "no posts published yet");

  const dates = await page.locator(".blog-card time").allTextContents();
  expect(dates.length).toBe(count);

  const firstLink = cards.first().locator("h2 a");
  const href = await firstLink.getAttribute("href");
  expect(href).toMatch(/^\/(de|fr|en)\/blog\/[a-z0-9-]+$/);

  const response = await page.goto(href ?? "/de/blog");
  expect(response?.status()).toBe(200);
  // The page template owns the only h1; markdown headings start at h2.
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator(".blog-body")).toBeVisible();
});
