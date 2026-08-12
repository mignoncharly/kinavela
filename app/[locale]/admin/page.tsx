import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import {
  AdminActionButton,
  FeatureFlagToggle,
} from "@/components/admin/admin-actions";
import { PilotRegionToggle } from "@/components/admin/pilot-region-toggle";
import {
  adminAiJobSchema,
  adminAuditEventSchema,
  adminEventSchema,
  adminFamilySchema,
  adminFeatureFlagSchema,
  adminPilotMetricSchema,
  adminRegionalDensitySchema,
  adminReportSchema,
  adminUserSchema,
  adminVillageSchema,
} from "@/lib/validation/admin";
import { isLocale } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/server";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

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
    pilotMetricsResult,
    densityResult,
  ] = await Promise.all([
    supabase.rpc("admin_list_reports", { p_status: null, p_limit: 100 }),
    supabase.rpc("admin_list_users", { p_limit: 100 }),
    supabase.rpc("admin_list_families", { p_limit: 100 }),
    supabase.rpc("admin_list_villages", { p_limit: 100 }),
    supabase.rpc("admin_list_events", { p_limit: 100 }),
    supabase.rpc("admin_list_ai_jobs", { p_limit: 100 }),
    supabase.rpc("admin_list_feature_flags"),
    supabase.rpc("admin_list_audit_events", { p_limit: 100 }),
    supabase.rpc("admin_list_pilot_metrics"),
    supabase.rpc("admin_list_regional_density"),
  ]);
  const reports = parseRows(adminReportSchema, reportsResult.data);
  const users = parseRows(adminUserSchema, usersResult.data);
  const families = parseRows(adminFamilySchema, familiesResult.data);
  const villages = parseRows(adminVillageSchema, villagesResult.data);
  const events = parseRows(adminEventSchema, eventsResult.data);
  const aiJobs = parseRows(adminAiJobSchema, aiResult.data);
  const flags = parseRows(adminFeatureFlagSchema, flagsResult.data);
  const auditEvents = parseRows(adminAuditEventSchema, auditResult.data);
  const pilotMetrics = parseRows(
    adminPilotMetricSchema,
    pilotMetricsResult.data,
  );
  const regionalDensity = parseRows(
    adminRegionalDensitySchema,
    densityResult.data,
  );

  return (
    <main className="app-shell admin-page">
      <header className="app-header">
        <Link className="brand" href={`/${locale}/app`}>
          <span className="brand-mark">K</span>
          <span>KINAVELA OPS</span>
        </Link>
        <nav>
          <Link href={`/${locale}/app`}>App</Link>
          <Link aria-current="page" href={`/${locale}/admin`}>
            Admin
          </Link>
        </nav>
      </header>
      <section className="settings-panel">
        <Link className="back-link" href={`/${locale}/app`}>
          <ArrowLeft size={17} /> Back to app
        </Link>
        <div className="admin-intro">
          <p className="eyebrow">OPERATIONS · {role.toUpperCase()}</p>
          <h1>Safety and moderation</h1>
          <p>
            Review reports, account status, product controls and operational
            history.
          </p>
        </div>
        <div className="admin-grid">
          <section className="dashboard-card admin-card">
            <h2>Reports ({reports.length})</h2>
            <table>
              <thead>
                <tr>
                  <th>Target</th>
                  <th>Reason</th>
                  <th>Details</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.report_id}>
                    <td>
                      {report.target_type}
                      <br />
                      <small>
                        {report.target_family_id ??
                          report.target_village_id ??
                          report.target_message_id}
                      </small>
                    </td>
                    <td>{report.reason}</td>
                    <td className="admin-detail">{report.details ?? "—"}</td>
                    <td>
                      <span className="admin-status">{report.status}</span>
                    </td>
                    <td>
                      {report.status === "open" && (
                        <AdminActionButton
                          action={{
                            action: "set_report_status",
                            report_id: report.report_id,
                            status: "reviewing",
                          }}
                          label="Review"
                        />
                      )}
                      {report.status === "reviewing" && (
                        <AdminActionButton
                          action={{
                            action: "set_report_status",
                            report_id: report.report_id,
                            status: "resolved",
                          }}
                          label="Resolve"
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="dashboard-card admin-card">
            <h2>Feature flags ({flags.length})</h2>
            <table>
              <thead>
                <tr>
                  <th>Flag</th>
                  <th>Rollout</th>
                  <th>Status</th>
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
                    <td>{flag.rollout_percent}%</td>
                    <td>{flag.enabled ? "enabled" : "disabled"}</td>
                    <td>
                      <FeatureFlagToggle
                        flagKey={flag.flag_key}
                        enabled={flag.enabled}
                        rolloutPercent={flag.rollout_percent}
                        description={flag.description}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="dashboard-card admin-card">
            <h2>Users ({users.length})</h2>
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Status</th>
                  <th>Families</th>
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
                      <span className="admin-status">{userRow.status}</span>
                    </td>
                    <td>{userRow.family_count}</td>
                    <td>
                      {userRow.status === "suspended" ? (
                        <AdminActionButton
                          action={{
                            action: "restore_profile",
                            profile_id: userRow.profile_id,
                          }}
                          label="Restore"
                        />
                      ) : userRow.status === "active" ? (
                        <AdminActionButton
                          action={{
                            action: "suspend_profile",
                            profile_id: userRow.profile_id,
                            reason: "Manual moderation review",
                          }}
                          label="Suspend"
                        />
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="dashboard-card admin-card">
            <h2>Families ({families.length})</h2>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>City</th>
                  <th>Visibility</th>
                  <th>Members</th>
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
                      {family.city}, {family.country_of_residence}
                    </td>
                    <td>{family.visibility}</td>
                    <td>{family.member_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="dashboard-card admin-card">
            <h2>Villages ({villages.length})</h2>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>City</th>
                  <th>Status</th>
                  <th>Members</th>
                </tr>
              </thead>
              <tbody>
                {villages.map((village) => (
                  <tr key={village.village_id}>
                    <td>{village.name}</td>
                    <td>{village.village_type}</td>
                    <td>{village.city}</td>
                    <td>{village.status}</td>
                    <td>{village.member_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="dashboard-card admin-card">
            <h2>Events ({events.length})</h2>
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Starts</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.event_id}>
                    <td>{event.title}</td>
                    <td>{event.category}</td>
                    <td>{event.status}</td>
                    <td>{formatDate(event.starts_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="dashboard-card admin-card">
            <h2>AI jobs ({aiJobs.length})</h2>
            <table>
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Status</th>
                  <th>Moderation</th>
                  <th>Attempts</th>
                  <th>Cost</th>
                </tr>
              </thead>
              <tbody>
                {aiJobs.map((job) => (
                  <tr key={job.job_id}>
                    <td>{job.feature}</td>
                    <td>{job.status}</td>
                    <td>{job.moderation_status}</td>
                    <td>{job.attempts}</td>
                    <td>{job.cost_micros ?? 0} μ</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="dashboard-card admin-card">
            <h2>Pilot metrics (30 days)</h2>
            <table>
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Value</th>
                  <th>Denominator</th>
                </tr>
              </thead>
              <tbody>
                {pilotMetrics.map((metric) => (
                  <tr key={metric.metric_key}>
                    <td>{metric.metric_key}</td>
                    <td>{metric.metric_value.toFixed(1)}</td>
                    <td>{metric.denominator}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="dashboard-card admin-card">
            <h2>Germany density / waitlist</h2>
            <table>
              <thead>
                <tr>
                  <th>City</th>
                  <th>Families</th>
                  <th>Waiting</th>
                  <th>Threshold</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {regionalDensity.map((region) => (
                  <tr key={`${region.country_code}-${region.city}`}>
                    <td>{region.city}</td>
                    <td>{region.family_count}</td>
                    <td>{region.waiting_count}</td>
                    <td>{region.threshold}</td>
                    <td>{region.rollout_status}</td>
                    <td>
                      <PilotRegionToggle
                        city={region.city}
                        status={region.rollout_status}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="dashboard-card admin-card">
            <h2>Audit log ({auditEvents.length})</h2>
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Event</th>
                  <th>Entity</th>
                  <th>Metadata</th>
                </tr>
              </thead>
              <tbody>
                {auditEvents.map((event) => (
                  <tr key={event.audit_id}>
                    <td>{formatDate(event.created_at)}</td>
                    <td>{event.event_type}</td>
                    <td>{event.entity_type ?? "—"}</td>
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
