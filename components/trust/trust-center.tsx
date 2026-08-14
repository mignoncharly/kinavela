"use client";

import { BadgeCheck, MailCheck, Phone, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { getTrustCopy } from "@/features/trust/copy";
import type { Locale } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/browser";
import type { TrustStatus } from "@/lib/validation/trust";

type VillageOption = { village_id: string; name: string };

export function TrustCenter({
  locale,
  initial,
  villages,
}: {
  locale: Locale;
  initial: TrustStatus;
  villages: VillageOption[];
}) {
  const t = getTrustCopy(locale);
  const [status, setStatus] = useState(initial);
  const [phone, setPhone] = useState("");
  const [token, setToken] = useState("");
  const [phoneStep, setPhoneStep] = useState<"idle" | "sent" | "done">(
    initial.phone_verified ? "done" : "idle",
  );
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneMessage, setPhoneMessage] = useState("");
  const [communityBusy, setCommunityBusy] = useState(false);
  const [communityError, setCommunityError] = useState(false);

  async function sendPhoneCode() {
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
      setPhoneMessage(t.phoneError);
      return;
    }
    setPhoneBusy(true);
    setPhoneMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ phone });
    setPhoneBusy(false);
    if (error) setPhoneMessage(t.phoneError);
    else {
      setPhoneStep("sent");
      setPhoneMessage(t.phoneSent);
    }
  }

  async function confirmPhone() {
    setPhoneBusy(true);
    setPhoneMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: "phone_change",
    });
    if (!error) {
      const response = await fetch("/api/trust", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "sync_auth" }),
      });
      if (response.ok) {
        setStatus((current) => ({ ...current, phone_verified: true }));
        setPhoneStep("done");
        setPhoneMessage(t.phoneVerified);
      } else setPhoneMessage(t.phoneError);
    } else setPhoneMessage(t.phoneError);
    setPhoneBusy(false);
  }

  return (
    <section className="trust-center" aria-labelledby="trust-center-title">
      <div className="settings-heading">
        <p className="eyebrow">TRUST</p>
        <h2 id="trust-center-title">{t.title}</h2>
        <p>{t.intro}</p>
      </div>
      <div className="trust-grid">
        <article>
          <MailCheck />
          <div>
            <h3>{t.email}</h3>
            <p>{t.emailDetail}</p>
            <strong>
              {status.email_verified ? t.verified : t.notVerified}
            </strong>
          </div>
        </article>
        <article>
          <Phone />
          <div>
            <h3>{t.phone}</h3>
            <p>{t.phoneDetail}</p>
            {phoneStep === "done" ? (
              <strong>{t.verified}</strong>
            ) : (
              <div className="trust-phone-form">
                <label>
                  {t.phone}
                  <input
                    type="tel"
                    autoComplete="tel"
                    placeholder={t.phonePlaceholder}
                    value={phone}
                    onChange={(event) => setPhone(event.target.value.trim())}
                  />
                </label>
                {phoneStep === "sent" && (
                  <label>
                    {t.phoneCode}
                    <input
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={token}
                      onChange={(event) => setToken(event.target.value.trim())}
                      minLength={6}
                      maxLength={8}
                    />
                  </label>
                )}
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={phoneBusy}
                  onClick={phoneStep === "sent" ? confirmPhone : sendPhoneCode}
                >
                  {phoneBusy
                    ? t.sending
                    : phoneStep === "sent"
                      ? t.verifyPhone
                      : t.sendPhoneCode}
                </button>
              </div>
            )}
            {phoneMessage && <p role="status">{phoneMessage}</p>}
          </div>
        </article>
        <article>
          <BadgeCheck />
          <div>
            <h3>{t.community}</h3>
            <p>{t.communityDetail}</p>
            {status.community_verified ? (
              <>
                <strong>{t.verified}</strong>
                <p>
                  <b>{t.exactStatement}:</b>{" "}
                  {status.community_method === "staff_review"
                    ? t.communityStaffStatement
                    : t.communityModeratorStatement}
                </p>
              </>
            ) : status.community_request_status === "pending" ? (
              <strong>{t.requestPending}</strong>
            ) : villages.length === 0 ? (
              <p>{t.noVillage}</p>
            ) : (
              <form
                onSubmit={async (event) => {
                  event.preventDefault();
                  setCommunityBusy(true);
                  setCommunityError(false);
                  const villageId = String(
                    new FormData(event.currentTarget).get("village_id") ?? "",
                  );
                  const response = await fetch("/api/trust", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      action: "request_community_verification",
                      village_id: villageId,
                    }),
                  });
                  setCommunityBusy(false);
                  if (response.ok)
                    setStatus((current) => ({
                      ...current,
                      community_request_status: "pending",
                    }));
                  else setCommunityError(true);
                }}
              >
                <label>
                  {t.chooseVillage}
                  <select name="village_id">
                    {villages.map((village) => (
                      <option
                        value={village.village_id}
                        key={village.village_id}
                      >
                        {village.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="button button-secondary"
                  disabled={communityBusy}
                >
                  {communityBusy ? t.sending : t.requestCommunity}
                </button>
                {communityError && (
                  <p className="form-error" role="alert">
                    {t.requestError}
                  </p>
                )}
              </form>
            )}
          </div>
        </article>
        <article>
          <ShieldCheck />
          <div>
            <h3>{t.safetyTitle}</h3>
            <p>
              {status.meeting_safety_acknowledged
                ? t.safetyRecorded
                : t.safetyIntro}
            </p>
          </div>
        </article>
      </div>
    </section>
  );
}
