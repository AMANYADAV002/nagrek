# Nagrek owner approval gates

Protocol: before any gated action, the coding agent stops and sends:

`GATE-<id> | action | why | risk | what I need from you | if no answer: I do nothing`

Owner replies with explicit `approve GATE-<id>`. Secrets are never pasted into chat — enter them in each dashboard or local `.env`, then confirm by name only.

## Gate list

| ID | Meaning |
|----|---------|
| G1 | Create/connect Supabase project, any keys |
| G2 | Razorpay account, KYC, API keys, webhook secret |
| G3 | Set any env var/secret on Hostinger or any host |
| G4 | DNS/domain change or replacing nagrek.com |
| G5 | Switch Razorpay test→live; set real prices |
| G6 | Publish/replace Privacy, Terms, Guidelines, Refund |
| G7 | Send email/push/SMS to real people |
| G8 | Delete/migrate production data, destructive SQL |
| G9 | Spend money: TURN service, paid plans, ads |
| G10 | Deploy to production |
| G11 | Add analytics/trackers or third-party scripts |
| G12 | Turn on live GPS collection |

## Approval log

| Date | Gate | Approver | Notes |
|------|------|----------|-------|
| — | — | — | No approvals yet |

## Pending asks (code ready in repo)

- **GATE-G1** — apply `supabase/migrations/*.sql` on a real project and set Supabase env vars (enter keys in dashboard/.env only).
- **GATE-G12** — GPS consent UI is implemented; approve before enabling production location collection messaging/cutover.
- **GATE-G7** — web push code is stubbed off; approve before sending to real users.
- **GATE-G3 / G4 / G10** — Hostinger env + staging/production deploy; do not cut over nagrek.com without approval.
