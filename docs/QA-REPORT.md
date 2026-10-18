# UBEI ShareHub — engineering and QA handover

Checked: 17 October 2026. Original inputs: `admin (2).html`, `moderator (2).html`.

The existing product UI and workflows were retained. Shared JavaScript and CSS were identical in the two inputs; they now have one source. The application targets one UBEI institution, not multiple tenants.

| Finding | Resolution |
|---|---|
| Browser-only user records, sessions and password hashing | Production Supabase Auth; credentials never stored as app database fields |
| Separate devices could not share institutional data | One server database; Realtime notifications and lightweight revision polling |
| Client-only role checks could be altered | Explicit grants, RLS, authenticated transactional RPCs; service-only member management |
| Contact details visible alongside public team information | Separate private contacts table; moderators can read only their own contacts |
| Concurrent full-object saves could overwrite another person's work | Field-level changes, row versions, one atomic transaction per user action |
| Dark hero button foreground and background both `#111827` | Theme-safe hero button styles; readable semantic state colors |
| Some status/reminder colors had weak contrast in light mode | Success, danger, reminder and solid button colors adjusted |
| “Live” ignored the scheduled time; deadlines used the viewer's timezone | Publishing, deadlines and calendar day rules use Asia/Dhaka |
| Facebook URL comparison lowercased opaque case-sensitive tokens | Host/query normalization preserves token case, also enforced on the server |
| Profile/group home URLs could look like submission links | Post-shaped URLs required; duplicates and assignments validated in PostgreSQL |
| Quick review originally wrote directly to localStorage | Quick review, back and undo use the cloud persistence flow with version checks |
| Persisted sessions from one panel could affect the other panel | Separate Auth storage keys for admin/moderator; same-panel auth changes handled |
| Save failures could leave an optimistic UI looking successful | Errors surfaced; last acknowledged server data restored; success only after confirmation |
| Modal and form behavior | Focus trapping, Escape, focus return, background inertness, dirty-form refresh protection |
| Very tall uploaded images could stay oversized | Longest-edge resizing, JPEG compression, input limits and private Storage |
| Missing manifest/icon/service-worker files | Broken references removed; no unsupported PWA/offline claim |
| Fonts required an external Google request | Fontsource font files bundled, including Bengali glyphs |
| Backup could contain temporary signed image URLs | Export normalized rows with persistent Storage paths; offline reviewed restore SQL generator |
| Optional RPC operation could create a SQL NULL validation gap | Boolean operation handling made explicit; regression test denies omitted/null privilege changes |

Validation delivered in source:

- 22 Node/PostgreSQL tests: 5 domain tests + 17 schema/permissions/restore tests.
- Browser checks: both panels and all navigation pages in light/dark, CRUD, submission/verification, Bangla, mobile overflow, modal behavior, and control contrast. See `tests/browser.mjs`.
- 11 cloud integration checks: real Supabase SDK and PostgreSQL RPCs, with a local Auth HTTP test double. Includes private profile save, quick review and failed-save rollback.
- Source syntax checks, matching hosting security headers, production build and runtime dependency audit.
- The original dark-mode defect was reproduced in a browser before the fix. Representative desktop/Bangla/mobile screens were visually inspected. Screenshots are internal QA, not part of the deliverable.

The automated control-contrast scanner covers visible, enabled controls with solid effective backgrounds. It skips gradient backgrounds and cannot certify all accessibility requirements. Representative gradient hero controls were visually inspected. These checks are not a claim of full WCAG certification or a penetration test.

Not verified against the user's hosted account: real Supabase email/password authentication, token refresh across actual devices, Storage signing/upload, Realtime delivery, deployed account Edge Function, production network/performance, and provider headers. No live Supabase project credentials or deployment account were supplied. Run the first-live-smoke-test steps in the setup guide.

Operational limits: no offline writes, Facebook auto-publishing or automatic Facebook share verification; single institution; complete history is loaded when data changes, so large-scale growth will eventually need pagination/report aggregation. Identity administration spans Auth and Postgres APIs; failed credential updates are reported explicitly because these APIs cannot share one database transaction. The JSON export excludes Auth passwords and media bytes.
