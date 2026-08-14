import "server-only";

import nodemailer from "nodemailer";

import { serverEnv } from "@/lib/env.server";

export const emailTransport = nodemailer.createTransport({
  host: serverEnv.SMTP_HOST,
  port: serverEnv.SMTP_PORT,
  secure: serverEnv.SMTP_SECURE,
  auth: {
    user: serverEnv.SMTP_USER,
    pass: serverEnv.SMTP_PASSWORD,
  },
  tls: { minVersion: "TLSv1.2" },
});

export type TransactionalEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export async function sendTransactionalEmail(message: TransactionalEmail) {
  return emailTransport.sendMail({
    ...message,
    from: serverEnv.EMAIL_FROM,
    replyTo: serverEnv.EMAIL_REPLY_TO,
    envelope: {
      from: serverEnv.SMTP_USER,
      to: message.to,
    },
    headers: {
      "Auto-Submitted": "auto-generated",
      "X-Auto-Response-Suppress": "All",
    },
  });
}
