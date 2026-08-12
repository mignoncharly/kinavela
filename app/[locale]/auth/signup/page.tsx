import { notFound } from "next/navigation";
import { AuthPage } from "@/components/auth/auth-page";
import { isLocale } from "@/lib/i18n/config";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <AuthPage locale={locale} mode="signup" />;
}
