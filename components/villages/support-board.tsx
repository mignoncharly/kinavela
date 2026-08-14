"use client";

import { Flag, HandHelping, Search, Shield, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { getSupportCopy } from "@/features/villages/support-copy";
import type { SupportPost } from "@/features/villages/support-results";
import type { Locale } from "@/lib/i18n/config";
import {
  supportCategories,
  supportContentTypes,
  supportModerationReasons,
  supportReportReasons,
} from "@/lib/validation/support";

type Filters = {
  q?: string;
  category?: (typeof supportCategories)[number];
  content_type?: (typeof supportContentTypes)[number];
  status: "open" | "resolved" | "all";
};

async function submitSupportAction(payload: Record<string, unknown>) {
  const response = await fetch("/api/villages/support", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return response.ok;
}

export function SupportBoard({
  villageId,
  posts,
  filters,
  locale,
}: {
  villageId: string;
  posts: SupportPost[];
  filters: Filters;
  locale: Locale;
}) {
  const copy = getSupportCopy(locale);
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(false);

  async function act(key: string, payload: Record<string, unknown>) {
    setBusy(key);
    setError(false);
    const ok = await submitSupportAction(payload);
    setBusy(null);
    if (ok) router.refresh();
    else setError(true);
    return ok;
  }

  return (
    <section className="support-board">
      <header className="support-heading">
        <HandHelping />
        <div>
          <h2>{copy.title}</h2>
          <p>{copy.intro}</p>
        </div>
      </header>

      <details className="support-create-panel">
        <summary>{copy.create}</summary>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            const ok = await act("create", {
              action: "create",
              village_id: villageId,
              content_type: data.get("content_type"),
              category: data.get("category"),
              title: data.get("title"),
              body: data.get("body"),
              privacy_confirmed: data.get("privacy_confirmed") === "on",
            });
            if (ok) form.reset();
          }}
        >
          <div className="support-form-grid">
            <label>
              {copy.allTypes}
              <select name="content_type" defaultValue="question">
                {supportContentTypes.map((type) => (
                  <option key={type} value={type}>
                    {copy.contentTypes[type]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {copy.allCategories}
              <select name="category" defaultValue="kita">
                {supportCategories.map((category) => (
                  <option key={category} value={category}>
                    {copy.categories[category]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            {copy.titleLabel}
            <input name="title" minLength={5} maxLength={120} required />
          </label>
          <label>
            {copy.bodyLabel}
            <textarea
              name="body"
              minLength={10}
              maxLength={2000}
              rows={5}
              required
            />
          </label>
          <p className="support-privacy-hint">{copy.privacyHint}</p>
          <label className="support-confirmation">
            <input name="privacy_confirmed" type="checkbox" required />
            <span>{copy.privacy}</span>
          </label>
          <button
            className="button button-primary"
            disabled={busy !== null}
            type="submit"
          >
            {busy === "create" ? copy.publishing : copy.publish}
          </button>
        </form>
      </details>

      <form className="support-filters" method="get">
        <input name="tab" type="hidden" value="support" />
        <label>
          {copy.search}
          <span className="support-search">
            <Search size={16} />
            <input
              defaultValue={filters.q ?? ""}
              maxLength={80}
              minLength={2}
              name="q"
              placeholder={copy.searchPlaceholder}
            />
          </span>
        </label>
        <label>
          {copy.allCategories}
          <select defaultValue={filters.category ?? ""} name="category">
            <option value="">{copy.allCategories}</option>
            {supportCategories.map((category) => (
              <option key={category} value={category}>
                {copy.categories[category]}
              </option>
            ))}
          </select>
        </label>
        <label>
          {copy.allTypes}
          <select defaultValue={filters.content_type ?? ""} name="content_type">
            <option value="">{copy.allTypes}</option>
            {supportContentTypes.map((type) => (
              <option key={type} value={type}>
                {copy.contentTypes[type]}
              </option>
            ))}
          </select>
        </label>
        <label>
          {copy.open}
          <select defaultValue={filters.status} name="status">
            <option value="open">{copy.open}</option>
            <option value="resolved">{copy.resolved}</option>
            <option value="all">{copy.allStatuses}</option>
          </select>
        </label>
        <button className="button button-secondary" type="submit">
          {copy.filter}
        </button>
      </form>

      {error && <p className="form-error">{copy.actionError}</p>}
      {posts.length === 0 ? (
        <p className="support-empty">{copy.empty}</p>
      ) : (
        <div className="support-list">
          {posts.map((post) => (
            <article className="support-post" key={post.post_id}>
              <div className="support-post-meta">
                <span>{copy.contentTypes[post.content_type]}</span>
                <span>{copy.categories[post.category]}</span>
                {post.status === "resolved" && (
                  <span className="resolved">{copy.closed}</span>
                )}
              </div>
              <h3>{post.title}</h3>
              <p className="support-body">{post.body}</p>
              <small>
                {copy.familyBy.replace("{family}", post.author_family_name)} ·{" "}
                {new Intl.DateTimeFormat(locale, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(post.created_at))}
              </small>
              <div className="support-actions">
                {post.is_author && post.status === "open" && (
                  <button
                    className="chat-tool"
                    disabled={busy !== null}
                    type="button"
                    onClick={() =>
                      act("close:" + post.post_id, {
                        action: "close",
                        post_id: post.post_id,
                      })
                    }
                  >
                    <XCircle size={15} /> {copy.close}
                  </button>
                )}
                {!post.is_author && (
                  <ReportControl
                    busy={busy !== null}
                    copy={copy}
                    onSubmit={(reason, details) =>
                      act("report:" + post.post_id, {
                        action: "report",
                        post_id: post.post_id,
                        reason,
                        details,
                      })
                    }
                  />
                )}
                {post.can_moderate && (
                  <ModerationControl
                    busy={busy !== null}
                    copy={copy}
                    onSubmit={(reason) =>
                      act("moderate:" + post.post_id, {
                        action: "moderate",
                        post_id: post.post_id,
                        reason,
                      })
                    }
                  />
                )}
              </div>

              <section className="support-replies">
                <h4>
                  {copy.replies.replace("{count}", String(post.reply_count))}
                </h4>
                {post.replies.map((reply) => (
                  <article key={reply.reply_id}>
                    <p>{reply.body}</p>
                    <small>
                      {copy.familyBy.replace(
                        "{family}",
                        reply.author_family_name,
                      )}{" "}
                      ·{" "}
                      {new Intl.DateTimeFormat(locale, {
                        dateStyle: "medium",
                      }).format(new Date(reply.created_at))}
                    </small>
                    <div className="support-actions">
                      {!reply.is_author && (
                        <ReportControl
                          busy={busy !== null}
                          copy={copy}
                          onSubmit={(reason, details) =>
                            act("report:" + reply.reply_id, {
                              action: "report",
                              post_id: post.post_id,
                              reply_id: reply.reply_id,
                              reason,
                              details,
                            })
                          }
                        />
                      )}
                      {post.can_moderate && (
                        <ModerationControl
                          busy={busy !== null}
                          copy={copy}
                          onSubmit={(reason) =>
                            act("moderate:" + reply.reply_id, {
                              action: "moderate",
                              reply_id: reply.reply_id,
                              reason,
                            })
                          }
                        />
                      )}
                    </div>
                  </article>
                ))}
                {post.status === "open" && (
                  <form
                    className="support-reply-form"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      const form = event.currentTarget;
                      const data = new FormData(form);
                      const ok = await act("reply:" + post.post_id, {
                        action: "reply",
                        post_id: post.post_id,
                        body: data.get("body"),
                        privacy_confirmed:
                          data.get("privacy_confirmed") === "on",
                      });
                      if (ok) form.reset();
                    }}
                  >
                    <label>
                      {copy.reply}
                      <textarea
                        name="body"
                        minLength={2}
                        maxLength={1500}
                        placeholder={copy.replyPlaceholder}
                        rows={3}
                        required
                      />
                    </label>
                    <label className="support-confirmation">
                      <input
                        name="privacy_confirmed"
                        type="checkbox"
                        required
                      />
                      <span>{copy.privacy}</span>
                    </label>
                    <button
                      className="button button-secondary"
                      disabled={busy !== null}
                    >
                      {copy.sendReply}
                    </button>
                  </form>
                )}
              </section>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

type Copy = ReturnType<typeof getSupportCopy>;

function ReportControl({
  copy,
  busy,
  onSubmit,
}: {
  copy: Copy;
  busy: boolean;
  onSubmit: (reason: string, details: string) => Promise<boolean>;
}) {
  const [sent, setSent] = useState(false);
  return (
    <details className="support-inline-control">
      <summary>
        <Flag size={14} /> {sent ? copy.reported : copy.report}
      </summary>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const ok = await onSubmit(
            String(data.get("reason")),
            String(data.get("details") ?? ""),
          );
          if (ok) setSent(true);
        }}
      >
        <label>
          {copy.reportReason}
          <select name="reason" defaultValue="privacy_exposure">
            {supportReportReasons.map((reason) => (
              <option key={reason} value={reason}>
                {copy.reportReasons[reason]}
              </option>
            ))}
          </select>
        </label>
        <label>
          {copy.reportDetails}
          <textarea name="details" maxLength={1000} rows={2} />
        </label>
        <button className="chat-tool" disabled={busy}>
          {copy.submitReport}
        </button>
      </form>
    </details>
  );
}

function ModerationControl({
  copy,
  busy,
  onSubmit,
}: {
  copy: Copy;
  busy: boolean;
  onSubmit: (reason: string) => Promise<boolean>;
}) {
  return (
    <details className="support-inline-control">
      <summary>
        <Shield size={14} /> {copy.remove}
      </summary>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          void onSubmit(String(data.get("reason")));
        }}
      >
        <label>
          {copy.removeReason}
          <select name="reason" defaultValue="outdated">
            {supportModerationReasons.map((reason) => (
              <option key={reason} value={reason}>
                {copy.moderationReasons[reason]}
              </option>
            ))}
          </select>
        </label>
        <button className="chat-tool danger" disabled={busy}>
          {copy.remove}
        </button>
      </form>
    </details>
  );
}
