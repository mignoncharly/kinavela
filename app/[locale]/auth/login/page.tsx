import { notFound } from "next/navigation";
import { AuthPage } from "@/components/auth/auth-page";
import { isLocale } from "@/lib/i18n/config";
import { invitationTokenSchema } from "@/lib/validation/invitations";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ invite?: string; error?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const invitation = invitationTokenSchema.safeParse(query.invite);
  const initialError = new Set([
    "invalid_link",
    "expired_link",
    "service_unavailable",
  ]).has(query.error ?? "")
    ? query.error
    : undefined;
  return (
    <AuthPage
      locale={locale}
      mode="login"
      inviteToken={invitation.success ? invitation.data : undefined}
      initialError={initialError}
    />
  );
}
