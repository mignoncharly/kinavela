import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({
  path: new URL("../.env.production", import.meta.url).pathname,
});

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert(
  url && publicKey && serviceKey,
  "Required Supabase configuration is missing",
);

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const publicClient = createClient(url, publicKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const marker = randomBytes(8).toString("hex");
const email = `production-check-${marker}@kinavela.invalid`;
const password = `Secure-${randomBytes(12).toString("base64url")}9aA`;
let userId;

try {
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "signup",
    email,
    password,
    options: {
      data: { display_name: "Production Check", preferred_language: "en" },
    },
  });
  if (linkError) throw linkError;
  userId = link.user.id;
  assert(link.properties.hashed_token, "Signup token was not generated");

  const { data: verified, error: verificationError } =
    await publicClient.auth.verifyOtp({
      type: "signup",
      token_hash: link.properties.hashed_token,
    });
  if (verificationError) throw verificationError;
  assert(
    verified.session && verified.user,
    "Email confirmation did not create a session",
  );

  const authenticated = createClient(url, publicKey, {
    global: {
      headers: { Authorization: `Bearer ${verified.session.access_token}` },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile, error: profileError } = await authenticated
    .from("profiles")
    .select("id,verification_level,onboarding_completed")
    .single();
  if (profileError) throw profileError;
  assert.equal(profile.verification_level, "email_verified");

  const payload = {
    display_name: "Production Check",
    preferred_language: "en",
    timezone: "Europe/Berlin",
    family: {
      name: "Production Check Family",
      country_of_residence: "DE",
      city: "Berlin",
      radius_km: 25,
      visibility: "private",
      bio: "Automated production verification",
    },
    children: [
      {
        nickname: "Private Child",
        birth_year: 2020,
        birth_month: null,
        gender: null,
      },
    ],
    culture_ids: ["20000000-0000-4000-8000-000000000001"],
    languages: [
      {
        language_id: "30000000-0000-4000-8000-000000000003",
        proficiency: "fluent",
        transmission_goal: "want_to_teach_children",
      },
    ],
    preservation_goals: ["language", "stories"],
    interest_ids: ["40000000-0000-4000-8000-000000000001"],
    availability: [{ weekday: 6, period: "afternoon" }],
    preferences: {
      open_to_other_african_families: true,
      open_to_all_diaspora_families: false,
      min_child_age: 0,
      max_child_age: 12,
    },
  };
  const { data: familyId, error: onboardingError } = await authenticated.rpc(
    "complete_family_onboarding",
    { p_payload: payload },
  );
  if (onboardingError) throw onboardingError;
  assert(familyId, "Onboarding did not create a family");

  const { count: childCount, error: childError } = await authenticated
    .from("children")
    .select("id", { count: "exact", head: true })
    .eq("family_id", familyId);
  if (childError) throw childError;
  assert.equal(childCount, 1);

  const { data: deletionId, error: deletionError } = await authenticated.rpc(
    "request_account_deletion",
  );
  if (deletionError) throw deletionError;
  assert(deletionId, "Deletion workflow did not record a request");

  const anonymous = createClient(url, publicKey, {
    auth: { persistSession: false },
  });
  const { error: anonymousError } = await anonymous
    .from("families")
    .select("id")
    .limit(1);
  assert(
    anonymousError,
    "Anonymous family enumeration was unexpectedly allowed",
  );
  console.log(
    "Kinavela production auth, verification, onboarding, RLS, and deletion flow passed.",
  );
} finally {
  if (userId) {
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("auth_user_id", userId)
      .maybeSingle();
    if (profile) {
      await admin.from("families").delete().eq("created_by", profile.id);
    }
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) console.error("Temporary auth user cleanup failed");
  }
}
