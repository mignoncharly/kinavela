import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

const enabled = process.env.RUN_AUTHENTICATED_VISUAL === "1";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appOrigin = process.env.NEXT_PUBLIC_APP_URL;

test.skip(
  !enabled || !supabaseUrl || !serviceRoleKey || !appOrigin,
  "Requires explicit authenticated visual audit credentials.",
);
test.setTimeout(120_000);

test("authenticated application layouts are responsive", async ({ page }) => {
  const admin = createClient(supabaseUrl!, serviceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const marker = crypto.randomUUID();
  const email = `responsive-${marker}@example.invalid`;
  const password = `Visual-${marker}-9!`;
  const placeId = `kinavela-visual-${marker}`;
  let userId: string | undefined;
  let profileId: string | undefined;
  let familyId: string | undefined;

  try {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: "Responsive Audit" },
    });
    expect(created.error).toBeNull();
    userId = created.data.user?.id;
    expect(userId).toBeTruthy();

    const [culture, language, interest, location] = await Promise.all([
      admin.from("cultures").select("id").limit(1).single(),
      admin.from("languages").select("id").limit(1).single(),
      admin.from("interests").select("id").eq("active", true).limit(1).single(),
      admin.from("geocoding_cache").insert({
        query_hash: "0".repeat(64),
        provider_place_id: placeId,
        display_city: "Berlin",
        display_area: "Berlin",
        country_code: "DE",
        location: "POINT(13.405 52.52)",
        expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      }),
    ]);
    expect(culture.error).toBeNull();
    expect(language.error).toBeNull();
    expect(interest.error).toBeNull();
    expect(location.error).toBeNull();

    const login = await page.context().request.post("/api/auth/login", {
      headers: { origin: appOrigin! },
      data: { email, password, locale: "en" },
    });
    expect(login.status()).toBe(200);

    for (const viewport of [
      { width: 390, height: 844, label: "ios-safari" },
      { width: 412, height: 915, label: "android-chrome" },
      { width: 1440, height: 900, label: "desktop" },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/en/onboarding");
      await expect(page.getByRole("group").first()).toBeVisible();
      await page.screenshot({
        fullPage: true,
        path: `/tmp/kinavela-onboarding-${viewport.label}.png`,
      });
    }

    const onboardingResponse = await page
      .context()
      .request.post("/api/onboarding", {
        headers: { origin: appOrigin! },
        data: {
          display_name: "Responsive Audit",
          preferred_language: "en",
          timezone: "Europe/Berlin",
          family: {
            name: "Responsive Audit Family",
            country_of_residence: "DE",
            city: "Berlin",
            location_place_id: placeId,
            radius_km: 20,
            visibility: "private",
            bio: "A temporary family used only for responsive verification.",
          },
          children: [
            {
              nickname: "Sample",
              birth_year: new Date().getUTCFullYear() - 8,
              birth_month: 6,
              gender: "prefer_not_to_say",
            },
          ],
          culture_ids: [culture.data!.id],
          languages: [
            {
              language_id: language.data!.id,
              proficiency: "native",
              transmission_goal: "want_to_teach_children",
            },
          ],
          preservation_goals: ["language", "stories"],
          interest_ids: [interest.data!.id],
          availability: [{ weekday: 6, period: "afternoon" }],
          preferences: {
            open_to_other_african_families: true,
            open_to_all_diaspora_families: false,
            min_child_age: 4,
            max_child_age: 12,
          },
          accept_community_guidelines: true,
        },
      });
    expect(onboardingResponse.status()).toBe(200);
    const onboarding = await onboardingResponse.json();
    familyId = onboarding.familyId;
    expect(familyId).toBeTruthy();

    const profile = await admin
      .from("profiles")
      .select("id")
      .eq("auth_user_id", userId!)
      .single();
    expect(profile.error).toBeNull();
    profileId = profile.data!.id;

    const grant = await admin.rpc("grant_admin_role", {
      p_profile_id: profileId,
      p_role: "admin",
    });
    expect(grant.error).toBeNull();

    const villageResponse = await page.context().request.post("/api/villages", {
      headers: { origin: appOrigin! },
      data: {
        name: "Responsive Audit Village",
        description:
          "A temporary Village used only to verify responsive layouts.",
        village_type: "local",
        country_focus_id: null,
        radius_km: 20,
        visibility: "private",
        member_limit: 12,
      },
    });
    expect(villageResponse.status()).toBe(200);
    const village = await villageResponse.json();
    const villageId = village.villageId as string;

    const routes = [
      "/en/app",
      "/en/app/discover",
      "/en/app/connections",
      "/en/app/messages",
      "/en/app/villages",
      `/en/app/villages/${villageId}`,
      `/en/app/villages/${villageId}?tab=events`,
      "/en/app/missions",
      "/en/app/roots",
      "/en/app/stories",
      "/en/app/notifications",
      "/en/app/settings",
      "/en/admin",
    ];

    for (const viewport of [
      { width: 390, height: 844, label: "mobile" },
      { width: 1440, height: 900, label: "desktop" },
      { width: 1920, height: 1080, label: "large" },
    ]) {
      await page.setViewportSize(viewport);

      for (const route of routes) {
        await page.goto(route);
        await expect(page.locator("main")).toBeVisible();
        if (route === "/en/app") {
          const menu = page.locator(".app-nav-menu > summary");
          await menu.click();
          await expect(
            page.getByRole("link", { name: "Settings", exact: true }),
          ).toBeVisible();
          await menu.click();
        }
        const overflows = await page
          .locator("body")
          .evaluate(
            (body) =>
              Math.max(body.scrollWidth, document.documentElement.scrollWidth) >
              window.innerWidth,
          );
        expect(
          overflows,
          `${route} overflows at ${viewport.width}×${viewport.height}`,
        ).toBe(false);
      }

      await page.goto("/en/app");
      await page.screenshot({
        fullPage: true,
        path: `/tmp/kinavela-app-${viewport.label}.png`,
      });
    }

    const desktopCaptures = [
      { route: "/en/app/discover", name: "discover" },
      { route: "/en/app/messages", name: "messages" },
      { route: "/en/app/villages", name: "villages" },
      {
        route: `/en/app/villages/${villageId}?tab=events`,
        name: "village-events",
      },
      { route: "/en/app/roots", name: "roots" },
      { route: "/en/app/stories", name: "stories" },
      { route: "/en/app/settings", name: "settings" },
      { route: "/en/admin", name: "admin" },
    ];
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const capture of desktopCaptures) {
      await page.goto(capture.route);
      await page.screenshot({
        fullPage: true,
        path: `/tmp/kinavela-${capture.name}-desktop.png`,
      });
    }
  } finally {
    const cleanupErrors: string[] = [];
    if (familyId) {
      const villagesCleanup = await admin
        .from("villages")
        .delete()
        .eq("created_by_family_id", familyId);
      if (villagesCleanup.error)
        cleanupErrors.push(villagesCleanup.error.message);

      const familyCleanup = await admin
        .from("families")
        .delete()
        .eq("id", familyId);
      if (familyCleanup.error) cleanupErrors.push(familyCleanup.error.message);
    }

    const locationCleanup = await admin
      .from("geocoding_cache")
      .delete()
      .eq("provider_place_id", placeId);
    if (locationCleanup.error)
      cleanupErrors.push(locationCleanup.error.message);

    if (userId) {
      const userCleanup = await admin.auth.admin.deleteUser(userId);
      if (userCleanup.error) cleanupErrors.push(userCleanup.error.message);
    }

    expect(cleanupErrors, "Temporary visual-audit cleanup failed").toEqual([]);
  }
});
