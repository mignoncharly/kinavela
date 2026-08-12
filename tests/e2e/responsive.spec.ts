import { expect, test } from "@playwright/test";

const viewports = [
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1536, height: 864 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
] as const;

const publicRoutes = [
  "/en",
  "/en/auth/signup",
  "/en/community/cameroonian-families-in-germany",
] as const;

test("public layouts have no horizontal overflow at target viewports", async ({
  page,
}) => {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);

    for (const route of publicRoutes) {
      await page.goto(route);
      await expect(page.locator("body")).toBeVisible();

      const dimensions = await page.locator("body").evaluate((body) => ({
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: body.scrollWidth,
        viewportWidth: window.innerWidth,
      }));

      expect(
        Math.max(dimensions.documentWidth, dimensions.bodyWidth),
        `${route} overflows at ${viewport.width}×${viewport.height}`,
      ).toBeLessThanOrEqual(dimensions.viewportWidth);
    }
  }
});
