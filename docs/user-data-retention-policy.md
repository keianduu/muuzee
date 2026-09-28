# User Data Retention / Deletion / Export Policy

Status: **Draft Product / Operations policy for Human / Legal review** (Order 250, 2026-09-28).

This document is an implementation-facing policy draft. It is not legal advice, a published Privacy Policy, Terms of Service, or a final determination of statutory exceptions. Human / Legal review must approve the five decisions in Section 17 before implementation or publication.

## 1. Scope

This policy defines the intended Production lifecycle for Muuzee Account data:

- what is retained while an Account exists;
- what is removed when the user removes an item, clears a field, or deletes the Account;
- what a first-party Account export contains;
- how verified disclosure, correction, suspension, and deletion requests remain available;
- how Legal Consent records, Storage objects, external processors, logs, and backups cross the lifecycle boundary.

It does not implement a migration, `user_legal_consents`, Account deletion, export, Storage cleanup, provider configuration, or public legal text. Current implementation Sources of Truth remain:

- Target Schema v1: `docs/database/user-data-target.json`
- Physical schema: `supabase/migrations/*.sql`
- User Data access/authorization: `docs/user-data-access.md`
- Auth/session contract: `docs/auth-login-policy.md`
- Guest Saved contract: `docs/guest-save-sync-policy.md`

## 2. Legal baseline

The legal baseline researched for this draft is Japan's Act on the Protection of Personal Information (APPI) and the Personal Information Protection Commission (PPC) general guidelines. The following are legal-reference inputs, not Muuzee's final legal interpretation:

- Article 22: endeavor to keep personal data accurate and current within the purpose of use and delete it without delay when its use is no longer necessary, subject to applicable retention grounds.
- Article 32: make required retained-personal-data matters, purposes, request procedures, security-measure information, and complaint contacts knowable to the individual.
- Article 33: provide a disclosure procedure, including electronic provision where requested and available, and respond without delay subject to statutory exceptions.
- Article 34: investigate and correct, add, or delete factually inaccurate retained personal data when the statutory conditions apply, then notify the requester.
- Article 35: handle suspension of use, deletion, or suspension of third-party provision where the statutory conditions apply. This is not an unconditional GDPR-style right to erasure.
- Article 37: define request and identity-verification procedures without imposing excessive burden.
- Article 38: a reasonable fee may be charged for purpose notification or disclosure; Muuzee's ordinary no-fee recommendation is a Product policy, not a statement that all fees are legally prohibited.

Muuzee must distinguish:

1. statutory requests for purpose notification, disclosure, correction, suspension of use, or deletion; and
2. a self-service Account export offered as Product convenience.

This policy does not import GDPR portability or erasure rights into Japanese-law requirements. If another jurisdiction applies, Human / Legal review must add its requirements separately.

Official sources reviewed:

- [e-Gov: Act on the Protection of Personal Information](https://laws.e-gov.go.jp/document?lawid=415AC0000000057)
- [PPC: Guidelines under the Act on the Protection of Personal Information (General Rules)](https://www.ppc.go.jp/personalinfo/legal/guidelines_tsusoku/)

## 3. Data inventory

### 3.1 Current Account and application data

| System / domain | Account-related data | Ownership and export boundary |
| --- | --- | --- |
| Supabase Auth | `auth.users.id`, email, provider identity, confirmation/account timestamps, Auth/session metadata | Auth identity. Export only safe identity metadata; never credentials, hashes, tokens, secrets, or raw provider internals by default. |
| `profiles` | `display_name`, `avatar_object_path`, timestamps | Account data. The path is a reference; an avatar file is a separate Storage object. |
| `user_preferences` | notification/newsletter booleans; private country, region, prefecture, city; timestamps | Account data. Location is private and is not Public Profile data. |
| Personal Actions | `user_saved_items`, `user_seen_items`, `user_favorite_items`: canonical Master UUIDs and timestamps | Account data. Master Exhibition/Artist/Venue/Work records are not user-owned. |
| ArtWall | `user_artwall_settings`, `user_artwall_items` | Account data. Hydrated Master title/image/venue/artist fields are not duplicated User Data. |
| Legal Consent | planned `user_legal_consents` | Target v1 Planned; no Physical table. It records document-version acceptance, not a universal legal basis for all processing. |
| Guest Saved | browser key `muuzee:guest-saved:v1`, canonical `{kind,id}` only | Browser-local, no Account owner, no PII by contract. Server Account deletion cannot remove it automatically. |
| Derived values | Saved/Seen/Favorite counts, ArtWall summary | Reproducible and currently not persisted. They are convenience output, not independent source records. |

All seven current Physical User Data tables reference `auth.users.id` with `ON DELETE CASCADE`. `user_legal_consents` remains Planned in Target v1 with the same proposed cascade.

### 3.2 Operational and future data

These categories require a linked-system inventory before Production. Their presence and exact retention must not be assumed:

| Category | Current policy boundary |
| --- | --- |
| Supabase Auth / database logs | Provider/operations data; exact availability and retention belong to Order 260. Do not place passwords, tokens, or unnecessary personal payloads in application logs. |
| Vercel/application logs | Provider/operations data; exact retention and redaction belong to Order 260 and observability work. |
| Database backups / PITR | Provider-controlled recovery copies; Section 11 applies. |
| Analytics and Cookie IDs | Future dependency on Orders 420 and 470. Do not classify as anonymous or out of scope until the actual identifiers/linkage are reviewed. |
| Notification provider | Future Order 252 dependency; classify identifiers, delivery logs, unsubscribe/delete APIs, and independent retention before use. |
| Newsletter provider | Future Order 254 dependency; classify subscriber data, unsubscribe/delete APIs, and independent retention before use. |
| Support/contact records | Separate operational record with its own stated purpose, access, and Human / Legal-approved retention. Not automatically deleted merely by deleting the Product Account. |

## 4. Active-account retention

While an Account exists, Profile, Preferences, Saved, Seen, Favorite, and ArtWall are retained as intentional current Product state. No arbitrary 30-day or 90-day TTL applies.

Current-state rules:

- clearing private Location writes `null`; deleted values are not copied into a Location-history table;
- Unsee removes the Seen row; Seen means current membership and is not Visit history;
- removing Saved or Favorite deletes that membership row;
- removed Personal Actions are not copied into a User-domain deletion/audit history;
- updating Profile, Preferences, or ArtWall replaces the current state under the existing data model;
- logout does not delete Account data.

Legal, security, or operations records with an independently approved purpose are separate categories and must not be created implicitly by normal Product state changes.

## 5. Account deletion

### 5.1 Recommended MVP model

Use **immediate hard deletion from active Product systems**, with no reversible soft-delete Account and no grace/recovery window. This minimizes retained data and lifecycle complexity; the Product has no approved Account-restore requirement. This remains Human Decision 1.

Before execution, require:

- an authenticated Account session;
- a fresh reauthentication or equivalent recent confirmation suitable for a destructive action;
- clear irreversible-deletion copy covering Account data, Storage, Guest local state, export option, and re-registration behavior.

An old cookie session alone is not sufficient. Exact reauthentication UX/API belongs to downstream implementation.

### 5.2 Server-only orchestration

Recommended order:

1. verify fresh identity and destructive confirmation;
2. optionally generate/download an export if the user requests one;
3. delete Account-owned avatar/Storage objects through the Storage API;
4. request deletion/unsubscription from Account-linked external processors, where present;
5. delete the Auth user through the privileged server-only `auth.admin.deleteUser()` boundary;
6. let `auth.users` foreign-key cascades remove Profile, Preferences, Personal Actions, ArtWall, and—if implemented as recommended—Legal Consent rows;
7. verify active-system cleanup and clear the current browser Auth session/cookies.

The privileged Auth Admin boundary is an explicit Account-lifecycle exception to the normal owner DAL. Service-role/secret credentials must never reach the browser.

### 5.3 Re-registration

Re-registering the same email creates a new Auth UUID and a new Account. Muuzee does not restore the prior Profile, Preferences, Saved, Seen, Favorite, ArtWall, or consent rows.

## 6. Storage deletion

`avatar_object_path` does not own or delete an actual Storage object by itself. Account deletion must enumerate the user's owned avatar objects and remove them through the Supabase Storage API before Auth deletion. Deleting `storage.objects` metadata directly with SQL is prohibited because it can orphan underlying files.

Current Muuzee code has no User avatar upload/delete lifecycle or User avatar bucket implementation. The downstream implementation must define an Account-owned path/bucket convention, safe retry/idempotency, and verification before claiming avatar cleanup is complete.

Official Supabase references:

- [Managing user data](https://supabase.com/docs/guides/auth/managing-user-data)
- [Deleting objects from Storage](https://supabase.com/docs/guides/storage/management/delete-objects)

## 7. Auth deletion

Supabase currently documents two material boundaries:

- a user owning Storage objects may not be deletable until those objects are removed;
- deleting the Auth user invalidates refresh/session continuation, but an already-issued access JWT can remain cryptographically valid until its expiry.

The database ownership tree prevents a deleted Auth UUID from recreating Account rows because the owner foreign keys require an existing `auth.users` row and RLS requires the authenticated owner. For especially sensitive post-deletion operations, a future security task may additionally validate `session_id` against the live Auth sessions table. Order 250 does not add that mechanism.

## 8. Legal Consent

### 8.1 Meaning

The planned `user_legal_consents` record is a versioned audit of Terms/Privacy document acceptance or acknowledgement:

- `user_id`
- `consent_type` (`terms` or `privacy`)
- `document_version`
- `consented_at`

It must not be interpreted as proof that consent is the legal basis for every Muuzee personal-data processing activity. The need for APPI consent depends on the processing context and must be reviewed separately.

### 8.2 Retention recommendation

While the Account exists, keep each accepted document-version record immutable. At Account deletion, delete identifiable consent rows through the planned `user_id → auth.users ON DELETE CASCADE`. Separately archive the published Privacy Policy and Terms documents and their versions as non-user legal artifacts under Order 420.

Alternative B—retaining individual consent evidence after Account deletion for a legal-defense period—is **not adopted** in this draft. Adopting it later requires Human / Legal approval of a specific purpose, fixed retention term, restricted access, Privacy Policy disclosure, and anonymization/pseudonymization assessment in a separate lifecycle.

The current Target v1 JSON already matches the recommended cascade model and requires no change in Order 250.

## 9. Export / Disclosure

### 9.1 First-party Account export

Offer an optional self-service export before Account deletion and as a normal Account convenience. MVP format:

- UTF-8 JSON; or
- ZIP containing `account.json` plus the actual avatar file when one exists.

Do not use a temporary signed avatar URL as the durable exported asset.

Include:

- Account UUID, email, account-created timestamp, confirmation timestamp, and other reviewed safe identity metadata;
- Profile and Preferences;
- Saved, Seen, and Favorite canonical refs/timestamps;
- ArtWall settings and items;
- Legal Consent rows once implemented;
- the user's uploaded avatar file, when present.

Canonical Master UUIDs remain the source references. Current display labels may be resolved and included as supplemental convenience fields, but Muuzee must not copy full Master records into User Data. Derived counts may be included only as explicitly derived convenience values.

Exclude:

- password hashes;
- access, refresh, session, or recovery tokens;
- service-role keys, secrets, internal security credentials, and raw provider metadata not appropriate for disclosure;
- raw database/provider errors;
- other users' data.

### 9.2 Legal request route

Self-service export is not the exclusive APPI disclosure procedure. Order 420 must publish a verified manual channel for purpose notification, disclosure, correction, suspension of use, and deletion requests, including electronic response where appropriate.

Ordinary disclosure/export should be free for MVP. If exceptional physical delivery or another fee is considered later, Human / Legal review must confirm that it is reasonable. Operational handling should target completion within 30 calendar days, while public/legal wording remains **“without delay”**; 30 days is not represented as an APPI statutory deadline.

## 10. Correction / Suspension

- Profile and private Location factual corrections should use self-service edit/clear first.
- A claimed error in canonical Exhibition/Artist/Venue/Work data belongs to the Master Data correction flow, not Account User Data correction.
- A request to suspend use or delete specific data outside ordinary Account controls enters a verified manual Privacy workflow.
- Human / Legal—not application code—determines whether statutory conditions or an exception apply and what scope is necessary.
- The requester receives the required outcome notice without delay.

## 11. Backup / Logs

Active Product DB/Auth/Storage deletion is immediate after confirmed execution. Backup and PITR copies expire according to documented provider/environment schedules and must not be restored into ordinary processing as though the deletion never occurred.

Order 260 must define exact backup, PITR, Auth-log, database-log, Vercel-log, and application-log retention for each environment. Order 250 invents no durations.

A Production restore runbook must account for deletions that occurred after the recovered snapshot and prevent deleted Account data from returning to normal use. This draft does not create a tombstone table. Any durable deletion ledger or operational request audit requires a separately justified purpose, minimum fields, restricted access, and fixed Human / Legal-approved term; email, user UUID, or request content must not be retained indefinitely by default.

## 12. External processors

Before adding a notification, newsletter, analytics, support, or similar processor, record:

- the data/identifier sent and purpose;
- controller/processor and international-transfer roles as applicable;
- delete/unsubscribe/disclosure capability;
- provider retention and legal exceptions;
- failure/retry and reconciliation ownership;
- required Privacy Policy/Cookie disclosure.

Account deletion should invoke available delete/unsubscribe operations for Account-linked records unless a separately reviewed legal obligation requires limited retention. Orders 252 and 254 own notification/newsletter integration. Orders 420 and 470 must classify Cookie/Analytics identifiers and any Account linkage; this policy never assumes analytics data is anonymous.

## 13. Guest Saved

Guest Saved follows `docs/guest-save-sync-policy.md`:

- `muuzee:guest-saved:v1` is browser-local and has no TTL;
- it contains only canonical `{kind,id}` references and no Account UUID, email, credential, token, or display snapshot;
- Account deletion has no server-side authority to clear unrelated device-local Guest state;
- Account data is never reverse-synced into Guest Saved on logout or deletion;
- a future local “clear Guest Saved” control may be offered independently.

Delete confirmation must explain that device-local Guest Saved is separate from the Account. Successfully merged refs should already have been consumed under the Order 242 contract.

## 14. Identity verification

| Request | Minimum policy |
| --- | --- |
| Normal self-service export | Authenticated session; use fresh verification when the export contains sensitive Account data or risk requires it. |
| Account deletion | Authenticated session plus required fresh reauthentication/destructive confirmation. |
| Logged-in correction | Authenticated owner; fresh verification for sensitive identity changes. |
| Manual legal request | Verify through the registered account/email where reasonably sufficient; collect only the minimum additional evidence necessary. |

Do not collect a government ID merely as a default. Verification must be proportionate and must not make the request procedure excessively burdensome.

## 15. Operational request handling

1. Receive the request through the published channel and classify it as convenience export, purpose notification, disclosure, correction, suspension, or deletion.
2. Verify identity proportionately and record only the minimum operational evidence.
3. Locate applicable Account, Storage, processor, and operational data systems.
4. Route statutory/legal determinations and exceptions to Human / Legal review.
5. Fulfill or explain the outcome without delay; use 30 calendar days only as an internal target proposal.
6. Notify the requester and close/restrict the minimum request audit under a separately approved retention rule.

Muuzee must not automatically keep long-lived personal audit copies of completed requests. Whether minimum `request_type`, `received_at`, `completed_at`, and result metadata are needed, and for how long, is a Human / Legal decision before operations launch.

## 16. Privacy Policy dependencies

Order 420 owns final public wording and must reconcile at least:

- operator/controller identity and contact;
- data categories and purposes;
- retention and Account-deletion concepts;
- disclosure, correction, suspension, and deletion procedures;
- request method, verification, response method, and any fee;
- processors/third parties and international transfers where applicable;
- Cookie/Analytics categories and consent/opt-out requirements;
- a summary of security measures;
- versioned Privacy/Terms document publication and archive.

Order 470 owns GA4/Search Console/consent configuration and STG/Production measurement separation. Order 260 owns exact environment/provider retention settings. Order 250 remains their Draft lifecycle source, not published legal text.

## 17. Human Decisions Required

| # | Decision | Recommendation |
| --- | --- | --- |
| 1 | Account deletion uses immediate active hard delete with no soft-delete grace/recovery window. | **YES** |
| 2 | Identifiable `user_legal_consents` rows cascade on Account deletion; published legal document versions remain in a separate non-user archive. | **YES** |
| 3 | Offer JSON/ZIP self-service export plus a verified manual electronic disclosure route. | **YES** |
| 4 | Active systems delete immediately; backups expire under documented provider retention, with exact terms fixed by Order 260. | **YES** |
| 5 | Ordinary disclosure/export has no fee; internal target is 30 calendar days while legal/public wording remains “without delay.” | **YES**, subject to Human / Legal review |

Until these are reviewed, Order 250 remains `Doing`, this document remains Draft, and no lifecycle implementation or public wording should be treated as approved.

## 18. Implementation follow-up

After Human / Legal review, propose—not automatically create or start—Order 251: **[Backend] Legal Consent / Account deletion / Data export lifecycleを実装**.

Candidate scope:

- `user_legal_consents` migration, RLS, generated DB docs, and tests;
- versioned Registration consent write boundary;
- typed Account export service and reviewed JSON/ZIP contract;
- fresh-reauthenticated Account deletion orchestrator;
- User avatar Storage enumeration/removal and verification;
- external-processor hooks where integrations actually exist;
- server-only Auth Admin deletion, cascade verification, and browser-session cleanup;
- tests for failure/retry/idempotency, issued-JWT boundary, re-registration, and no restoration;
- dependency on Order 420 final Privacy/Terms versions and published request channel;
- operational retention/config dependencies from Order 260 and Analytics classification from Order 470.

Order 250 itself changes no migration, schema, RLS, Auth configuration, Storage, DB data, or Production API/UI.
