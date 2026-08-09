import { expect, test } from "@playwright/test";

test("production signup is responsive and free of console errors", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.goto("/de/auth/signup");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByLabel("E-Mail")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sicher registrieren" }),
  ).toBeVisible();
  expect(
    await page
      .locator("body")
      .evaluate((body) => body.scrollWidth <= window.innerWidth),
  ).toBe(true);
  expect(consoleErrors).toEqual([]);
});

test("private application route redirects to login", async ({ page }) => {
  await page.goto("/de/app");
  await expect(page).toHaveURL(/\/de\/auth\/login\?next=/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Willkommen zurück",
  );
});
