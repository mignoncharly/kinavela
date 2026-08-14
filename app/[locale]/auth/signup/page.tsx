import { notFound } from "next/navigation";
import { AuthPage } from "@/components/auth/auth-page";
import { isLocale } from "@/lib/i18n/config";
import { invitationTokenSchema } from "@/lib/validation/invitations";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ invite?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const invitation = invitationTokenSchema.safeParse(query.invite);
  return (
    <AuthPage
      locale={locale}
      mode="signup"
      inviteToken={invitation.success ? invitation.data : undefined}
    />
  );
}
