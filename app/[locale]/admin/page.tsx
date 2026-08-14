import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import {
  AdminActionButton,
  AdminReportControls,
  FeatureFlagToggle,
  VerificationReviewControls,
} from "@/components/admin/admin-actions";
import {
  adminAiJobSchema,
  adminAuditEventSchema,
  adminEventSchema,
  adminFamilySchema,
  adminFeatureFlagSchema,
  adminProductMetricSchema,
  adminRegionalOutreachSchema,
  adminReportSchema,
  adminReportActionSchema,
  adminUserSchema,
  adminVillageSchema,
} from "@/lib/validation/admin";
import { getAdminCopy } from "@/lib/i18n/app-copy";
import { formatDateTime, formatNumber, formatRegion } from "@/lib/i18n/format";
import { isLocale } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { adminVerificationRequestSchema } from "@/lib/validation/trust";

function parseRows<
  T extends {
    safeParse: (value: unknown) => { success: boolean; data?: unknown };
  },
>(schema: T, value: unknown) {
  const parsed = Array.isArray(value)
    ? value.map((row) => schema.safeParse(row))
    : [];
  return parsed.flatMap((row) =>
    row.success ? [row.data] : [],
  ) as z.infer<T>[];
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const copy = getAdminCopy(locale);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth/login`);
  const { data: role } = await supabase.rpc("get_my_admin_role");
  if (role !== "admin" && role !== "moderator") notFound();

  const [
    reportsResult,
    usersResult,
    familiesResult,
    villagesResult,
    eventsResult,
    aiResult,
    flagsResult,
    auditResult,
    productMetricsResult,
    outreachResult,
    verificationRequestsResult,
  ] = await Promise.all([
    supabase.rpc("admin_list_reports", { p_status: null, p_limit: 100 }),
    supabase.rpc("admin_list_users", { p_limit: 100 }),
    supabase.rpc("admin_list_families", { p_limit: 100 }),
    supabase.rpc("admin_list_villages", { p_limit: 100 }),
    supabase.rpc("admin_list_events", { p_limit: 100 }),
    supabase.rpc("admin_list_ai_jobs", { p_limit: 100 }),
    supabase.rpc("admin_list_feature_flags"),
    supabase.rpc("admin_list_audit_events", { p_limit: 100 }),
    supabase.rpc("admin_list_product_metrics"),
    supabase.rpc("admin_list_regional_outreach"),
    supabase.rpc("admin_list_verification_requests", { p_limit: 100 }),
  ]);
  const reports = parseRows(adminReportSchema, reportsResult.data);
  const reportHistoryEntries = await Promise.all(
    reports.map(async (report) => {
      const historyResult = await supabase.rpc(
        "admin_list_report_action_history",
        { p_report_id: report.report_id },
      );
      return [
        report.report_id,
        parseRows(adminReportActionSchema, historyResult.data),
      ] as const;
    }),
  );
  const reportHistory = new Map(reportHistoryEntries);
  const users = parseRows(adminUserSchema, usersResult.data);
  const families = parseRows(adminFamilySchema, familiesResult.data);
  const villages = parseRows(adminVillageSchema, villagesResult.data);
  const events = parseRows(adminEventSchema, eventsResult.data);
  const aiJobs = parseRows(adminAiJobSchema, aiResult.data);
  const flags = parseRows(adminFeatureFlagSchema, flagsResult.data);
  const auditEvents = parseRows(adminAuditEventSchema, auditResult.data);
  const productMetrics = parseRows(
    adminProductMetricSchema,
    productMetricsResult.data,
  );
  const regionalOutreach = parseRows(
    adminRegionalOutreachSchema,
    outreachResult.data,
  );
  const verificationRequests = parseRows(
    adminVerificationRequestSchema,
    verificationRequestsResult.data,
  );

  return (
    <main className="app-shell admin-page">
      <header className="app-header">
        <Link className="brand" href={`/${locale}/app`}>
          <span className="brand-mark">K</span>
          <span>KINAVELA OPS</span>
        </Link>
        <nav>
          <Link href={`/${locale}/app`}>{copy.app}</Link>
          <Link aria-current="page" href={`/${locale}/admin`}>
            {copy.admin}
          </Link>
        </nav>
      </header>
      <section className="settings-panel">
        <Link className="back-link" href={`/${locale}/app`}>
          <ArrowLeft size={17} /> {copy.back}
        </Link>
        <div className="admin-intro">
          <p className="eyebrow">
            {copy.eyebrow} · {role.toUpperCase()}
          </p>
          <h1>{copy.title}</h1>
          <p>{copy.intro}</p>
        </div>
        <div className="admin-grid">
          <section className="dashboard-card admin-card">
            <h2>
              {copy.reports} ({formatNumber(locale, reports.length)})
            </h2>
            <table>
              <thead>
                <tr>
                  <th>{copy.target}</th>
                  <th>{copy.reason}</th>
                  <th>{copy.details}</th>
                  <th>{copy.status}</th>
                  <th>{copy.severityTarget}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.report_id}>
                    <td>
                      {copy.targetTypes[report.target_type]}
                      <br />
                      <small>
                        {report.target_family_id ??
                          report.target_village_id ??
                          report.target_message_id ??
                          report.target_support_reply_id ??
                          report.target_support_post_id}
                      </small>
                    </td>
                    <td>
                      {copy.reportReasons[
                        report.reason as keyof typeof copy.reportReasons
                      ] ?? report.reason}
                    </td>
                    <td className="admin-detail">
                      {report.details ?? copy.noValue}
                    </td>
                    <td>
                      <span className="admin-status">
                        {copy.reportStatuses[report.status]}
                      </span>
                    </td>
                    <td>
                      <strong>
                        {report.urgent_child_safety
                          ? copy.urgentChildSafety
                          : copy.severities[report.severity]}
                      </strong>
                      <br />
                      <small>
                        {copy.due}{" "}
                        {formatDateTime(locale, report.response_due_at)} ·{" "}
                        {formatNumber(locale, report.action_count)}{" "}
                        {copy.actions}
                      </small>
                      {report.target_event_title && (
                        <p>{report.target_event_title}</p>
                      )}
                      {report.target_support_post_title && (
                        <p>{report.target_support_post_title}</p>
                      )}
                      <details>
                        <summary>{copy.actionHistory}</summary>
                        <ol className="admin-action-history">
                          {(reportHistory.get(report.report_id) ?? []).map(
                            (action) => (
                              <li key={action.action_id}>
                                <strong>
                                  {copy.actionTypes[action.action_type]}
                                </strong>{" "}
                                · {formatDateTime(locale, action.created_at)}
                                {action.severity
                                  ? ` · ${copy.severities[action.severity]}`
                                  : ""}
                                {action.note && <p>{action.note}</p>}
                              </li>
                            ),
                          )}
                        </ol>
                      </details>
                    </td>
                    <td>
                      <AdminReportControls
                        reportId={report.report_id}
                        targetEventId={report.target_event_id}
                        targetSupportPostId={report.target_support_post_id}
                        locale={locale}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="dashboard-card admin-card">
            <h2>
              {copy.verificationRequests} (
              {formatNumber(locale, verificationRequests.length)})
            </h2>
            <p>{copy.verificationDescription}</p>
            <table>
              <thead>
                <tr>
                  <th>{copy.adultProfile}</th>
                  <th>{copy.familyVillage}</th>
                  <th>{copy.requested}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {verificationRequests.map((request) => (
                  <tr key={request.request_id}>
                    <td>
                      {request.profile_display_name}
                      <br />
                      <small>{request.profile_id}</small>
                    </td>
                    <td>
                      {request.family_name}
                      <br />
                      <small>{request.village_name}</small>
                    </td>
                    <td>{formatDateTime(locale, request.requested_at)}</td>
                    <td>
                      <VerificationReviewControls
                        requestId={request.request_id}
                        locale={locale}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="dashboard-card admin-card">
            <h2>
              {copy.featureFlags} ({formatNumber(locale, flags.length)})
            </h2>
            <table>
              <thead>
                <tr>
                  <th>{copy.flag}</th>
                  <th>{copy.rollout}</th>
                  <th>{copy.status}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {flags.map((flag) => (
                  <tr key={flag.flag_key}>
                    <td>
                      {flag.flag_key}
                      <br />
                      <small>{flag.description}</small>
                    </td>
                    <td>{formatNumber(locale, flag.rollout_percent)}%</td>
                    <td>{flag.enabled ? copy.enabled : copy.disabled}</td>
                    <td>
                      <FeatureFlagToggle
                        flagKey={flag.flag_key}
                        enabled={flag.enabled}
                        rolloutPercent={flag.rollout_percent}
                        description={flag.description}
                        locale={locale}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="dashboard-card admin-card">
            <h2>
              {copy.users} ({formatNumber(locale, users.length)})
            </h2>
            <table>
              <thead>
                <tr>
                  <th>{copy.user}</th>
                  <th>{copy.status}</th>
                  <th>{copy.families}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((userRow) => (
                  <tr key={userRow.profile_id}>
                    <td>
                      {userRow.display_name}
                      <br />
                      <small>{userRow.profile_id}</small>
                    </td>
                    <td>
                      <span className="admin-status">
                        {copy.profileStatuses[userRow.status]}
                      </span>
                    </td>
                    <td>{formatNumber(locale, userRow.family_count)}</td>
                    <td>
                      {userRow.status === "suspended" ? (
                        <AdminActionButton
                          action={{
                            action: "restore_profile",
                            profile_id: userRow.profile_id,
                          }}
                          label={copy.restore}
                          locale={locale}
                        />
                      ) : userRow.status === "active" ? (
                        <AdminActionButton
                          action={{
                            action: "suspend_profile",
                            profile_id: userRow.profile_id,
                            reason: copy.manualModerationReview,
                          }}
                          label={copy.suspend}
                          locale={locale}
                        />
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="dashboard-card admin-card">
            <h2>
              {copy.families} ({formatNumber(locale, families.length)})
            </h2>
            <table>
              <thead>
                <tr>
                  <th>{copy.name}</th>
                  <th>{copy.city}</th>
                  <th>{copy.visibility}</th>
                  <th>{copy.members}</th>
                </tr>
              </thead>
              <tbody>
                {families.map((family) => (
                  <tr key={family.family_id}>
                    <td>
                      {family.name}
                      <br />
                      <small>{family.family_id}</small>
                    </td>
                    <td>
                      {family.city},{" "}
                      {formatRegion(locale, family.country_of_residence)}
                    </td>
                    <td>{copy.visibilityValues[family.visibility]}</td>
                    <td>{formatNumber(locale, family.member_count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="dashboard-card admin-card">
            <h2>
              {copy.villages} ({formatNumber(locale, villages.length)})
            </h2>
            <table>
              <thead>
                <tr>
                  <th>{copy.name}</th>
                  <th>{copy.type}</th>
                  <th>{copy.city}</th>
                  <th>{copy.status}</th>
                  <th>{copy.members}</th>
                </tr>
              </thead>
              <tbody>
                {villages.map((village) => (
                  <tr key={village.village_id}>
                    <td>{village.name}</td>
                    <td>{village.village_type}</td>
                    <td>{village.city}</td>
                    <td>{copy.villageStatuses[village.status]}</td>
                    <td>{formatNumber(locale, village.member_count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="dashboard-card admin-card">
            <h2>
              {copy.events} ({formatNumber(locale, events.length)})
            </h2>
            <table>
              <thead>
                <tr>
                  <th>{copy.title}</th>
                  <th>{copy.category}</th>
                  <th>{copy.status}</th>
                  <th>{copy.starts}</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.event_id}>
                    <td>{event.title}</td>
                    <td>{event.category}</td>
                    <td>{copy.eventStatuses[event.status]}</td>
                    <td>{formatDateTime(locale, event.starts_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="dashboard-card admin-card">
            <h2>
              {copy.aiJobs} ({formatNumber(locale, aiJobs.length)})
            </h2>
            <table>
              <thead>
                <tr>
                  <th>{copy.feature}</th>
                  <th>{copy.status}</th>
                  <th>{copy.moderation}</th>
                  <th>{copy.attempts}</th>
                  <th>{copy.cost}</th>
                </tr>
              </thead>
              <tbody>
                {aiJobs.map((job) => (
                  <tr key={job.job_id}>
                    <td>{job.feature}</td>
                    <td>{copy.aiStatuses[job.status]}</td>
                    <td>{copy.moderationStatuses[job.moderation_status]}</td>
                    <td>{formatNumber(locale, job.attempts)}</td>
                    <td>{formatNumber(locale, job.cost_micros ?? 0)} μ</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="dashboard-card admin-card">
            <h2>{copy.productHealth}</h2>
            <table>
              <thead>
                <tr>
                  <th>{copy.metric}</th>
                  <th>{copy.value}</th>
                  <th>{copy.denominator}</th>
                </tr>
              </thead>
              <tbody>
                {productMetrics.map((metric) => (
                  <tr key={metric.metric_key}>
                    <td>{metric.metric_key}</td>
                    <td>
                      {formatNumber(locale, metric.metric_value, {
                        maximumFractionDigits: 1,
                        minimumFractionDigits: 1,
                      })}
                    </td>
                    <td>{formatNumber(locale, metric.denominator)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="dashboard-card admin-card">
            <h2>{copy.outreach}</h2>
            <p>{copy.outreachDescription}</p>
            <table>
              <thead>
                <tr>
                  <th>{copy.city}</th>
                  <th>{copy.families}</th>
                  <th>{copy.historicalInterest}</th>
                </tr>
              </thead>
              <tbody>
                {regionalOutreach.map((region) => (
                  <tr key={`${region.country_code}-${region.city}`}>
                    <td>{region.city}</td>
                    <td>{formatNumber(locale, region.family_count)}</td>
                    <td>
                      {formatNumber(locale, region.historical_interest_count)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="dashboard-card admin-card">
            <h2>
              {copy.auditLog} ({formatNumber(locale, auditEvents.length)})
            </h2>
            <table>
              <thead>
                <tr>
                  <th>{copy.when}</th>
                  <th>{copy.event}</th>
                  <th>{copy.entity}</th>
                  <th>{copy.metadata}</th>
                </tr>
              </thead>
              <tbody>
                {auditEvents.map((event) => (
                  <tr key={event.audit_id}>
                    <td>{formatDateTime(locale, event.created_at)}</td>
                    <td>{event.event_type}</td>
                    <td>{event.entity_type ?? copy.noValue}</td>
                    <td className="admin-detail">
                      <code>{JSON.stringify(event.metadata)}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </section>
    </main>
  );
}
