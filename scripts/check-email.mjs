import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config({
  path: new URL("../.env.production", import.meta.url).pathname,
});

const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === "true",
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  tls: { minVersion: "TLSv1.2" },
});

try {
  await transport.verify();
  console.log("Zoho Europe SMTP authentication and TLS verification passed.");
} catch {
  console.error(
    "Zoho Europe SMTP verification failed (credentials not displayed). ",
  );
  process.exit(1);
}
