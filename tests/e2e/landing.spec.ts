import { expect, test } from "@playwright/test";

test("localized production landing page is usable", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.goto("/de");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Wurzeln",
  );
  await expect(
    page.getByRole("link", { name: "Konto erstellen", exact: true }),
  ).toBeVisible();
  await expect(page.locator("main")).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test("health endpoint responds without secrets", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBeTruthy();
  const body = JSON.stringify(await response.json());
  expect(body).not.toContain("SUPABASE");
  expect(body).not.toContain("SMTP");
});
