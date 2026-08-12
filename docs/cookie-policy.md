# Cookie and Browser-Storage Policy

Version 1.0  
Effective date: 11 August 2026  
Last updated: 11 August 2026

Kinavela has no advertising, social-media, marketing or third-party analytics cookie.

| Name / technology                                                                   | Purpose                                                  | Duration                                             | Consent                                           |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------- |
| Supabase Auth cookie family `sb-lchpxzbjawqpirqlhqlh-auth-token` and chunk suffixes | Authentication and session continuity                    | Until logout or Supabase Auth session/refresh expiry | Strictly necessary                                |
| `kinavela:metrics-consent` in localStorage                                          | Stores the opt-in choice for first-party product metrics | Until changed or cleared                             | Necessary to remember consent; metrics are opt-in |
| `kinavela:app_session_started` in sessionStorage                                    | Prevents duplicate opt-in session metric events          | Browser tab/session                                  | Only written after metrics consent                |
| IndexedDB `kinavela-offline-v1`                                                     | User-selected offline Passport/Missions snapshots        | 30 days without refresh or until cleared             | User feature action                               |
| Cache Storage `kinavela-shell-v1` and service worker                                | Offline shell and static assets; no account content      | Until update, uninstall or browser clear             | Strictly necessary for the enabled PWA shell      |

The current production Web Push public key is empty, so push subscription storage and delivery are not enabled. Kinavela does not embed a payment widget or store payment details in browser storage; Stripe-hosted Checkout and Portal pages open on Stripe infrastructure. Optional product metrics can be declined in the privacy banner or changed on the Cookies page.
