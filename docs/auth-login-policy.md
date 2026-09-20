# Auth / Login Policy

Status: Proposed Production contract for Order 190, pending user review. This document does not install Auth packages, configure Supabase Auth, create migrations, or implement Login UI.

This document defines Muuzee's Production identity, session, login, recovery, and account-lifecycle boundaries. Approved Product behavior comes from the Notion requirement **Account / Login / Guest Save**. `docs/user-data-architecture.md` is the ownership contract. Prototype Auth is a UX reference only.

## 1. Decision Summary

| Topic | Decision | Reason | Deferred / downstream |
| --- | --- | --- | --- |
| Auth provider | Supabase Auth | Direct `auth.users.id` alignment with the accepted User Data Architecture, RLS, existing Supabase DB, and smallest MVP integration surface | Dashboard/project configuration and implementation follow in later tasks |
| MVP login method | Email + Password only | Matches the approved Product requirement; adding passwordless or social login has no approved MVP need | Magic Link, Google, Apple, and other OAuth are future options |
| Email verification | Required in STG and Production | Prevents unverified/mistyped addresses from becoming completed accounts and provides a reliable recovery address | LOCAL uses captured test mail; exact STG mail environment is operational work |
| Session | Supabase Auth PKCE session in cookies via `@supabase/ssr` | Makes the same identity available to Next.js browser and server code without a custom token store | Client/server utilities and Next.js 15 middleware are implementation work |
| Recovery | Forgot/Reset Password is MVP scope | Email + Password is incomplete without a supported recovery path | Exact UI and route implementation are downstream |
| Guest Auth | Do not create Supabase anonymous users for normal Guest browsing or Guest Save | Guest Save is approved as client-owned state and does not require an Account/Auth row | Storage, expiry, and Account merge remain Order 240 |
| Account deletion | Authenticated, confirmed, server-only privileged operation | User Front must never receive elevated credentials; deletion owns User Data and avatar cleanup | Exact retention/soft-delete and reauthentication UX need downstream security/legal confirmation |
| Service Role / secret key | Server-only administrative boundary; never used for normal User Front access | Elevated keys bypass RLS | Existing Admin client remains separate; future key-name migration is a separate operational change |
| Profile creation | Minimal idempotent DB trigger from `auth.users` is recommended | Guarantees a one-to-one Profile shell for every Auth creation path; avoids lazy row races | Order 200 implements and tests the trigger and approved fields |
| OAuth / passwordless | Not in MVP | Not approved Product scope; each method adds provider, callback, recovery, and test surface | May be added through Supabase Auth later without changing the Muuzee user UUID contract |

The Production identity key is the Supabase Auth user UUID. Auth establishes identity; it does not grant access by itself. Database authorization remains RLS based on the same UUID.

## 2. Current State

### Production repository

- Production uses Next.js 15 App Router and Supabase PostgreSQL.
- `@supabase/supabase-js` is installed.
- `.env.example` contains `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and server-only `SUPABASE_SERVICE_ROLE_KEY`.
- `src/lib/supabase/admin.ts` is an Admin-only server client with session persistence and token refresh disabled.
- No Production browser Auth client, server session client, `@supabase/ssr`, Auth middleware, callback route, Login/Register UI, Profile/Auth FK, or User RLS exists.
- Current Admin v0 authentication/authorization remains a separate scope. Selecting User Auth does not make `/admin` Production-ready.

### Prototype observations that are not Production contracts

`prototype/assets/js/muuzee-auth.js` and `muuzee-user-config.js` use URL `?loginID`, static/local users, plaintext prototype passwords, and localStorage. Production explicitly rejects:

- login state or credentials in URL parameters;
- passwords or custom session tokens in localStorage;
- static JavaScript credentials;
- Prototype `loginID` as a Production identity;
- the Prototype six-character password minimum as a Production security rule.

The Shared Popup, Guest Save UX, protected Personal surfaces, and post-login navigation are interaction references only.

## 3. Provider Decision

### Selected: Supabase Auth

Supabase Auth is the selected Production identity provider for MVP.

| Comparison | Supabase Auth | Separate external identity provider |
| --- | --- | --- |
| Current DB integration | Native `auth.users` in the existing Supabase project | Requires external subject-to-Muuzee UUID mapping or third-party JWT integration |
| RLS identity | Direct `auth.uid()` maps to the accepted `user_id` | Requires claims/JWT configuration and lifecycle synchronization |
| Next.js SSR | Official cookie-based `@supabase/ssr` path | Provider-specific SDK, callbacks, and Supabase authorization integration |
| Email/password and recovery | Built in | Available, but adds another vendor and cross-system lifecycle |
| Account deletion | Auth Admin API plus owned-data/storage cleanup | Requires coordinated deletion across provider and Supabase |
| Environment operations | One Auth/DB platform per environment | Separate provider tenants, secrets, callbacks, and incident surface |
| Future OAuth | Can add providers under the same Auth user model | Possible, but does not justify replacing the current identity plane |

The external-provider alternative is not rejected forever. It is rejected for MVP because it adds identity mapping and operational boundaries without an approved capability that Supabase Auth lacks.

### Package direction

- Implement cookie SSR with `@supabase/ssr`; do not introduce deprecated `@supabase/auth-helpers-nextjs`.
- Keep `@supabase/supabase-js` as the base client dependency.
- Current Supabase guidance is moving from legacy `anon` / `service_role` keys to publishable / secret keys. Order 190 does not rename environment variables or keys. The Auth implementation/environment task must plan that migration deliberately rather than mixing it into this docs-only change.

## 4. MVP Login Methods

### In scope

- Register with Email + Password.
- Login with Email + Password.
- Email confirmation.
- Resend confirmation with rate-limit-safe UX.
- Forgot Password and Reset Password.
- Logout of the current browser session.
- Account deletion entry point and server-side lifecycle.

### Out of scope

- Magic Link / email OTP login.
- Google, Apple, or other OAuth.
- Phone/SMS login.
- Supabase Anonymous Sign-In.
- MFA.
- Email change UI and recovery beyond password reset.
- Production Admin authentication or roles.

Future login methods must preserve the same Supabase Auth UUID. They must not create a second Muuzee credential identity.

### Password policy

- Supabase Auth is authoritative for password acceptance and hashing.
- Configure a Production minimum of **8 characters**. The UI mirrors this rule for feedback, but server/provider enforcement is decisive.
- The Prototype six-character rule is not carried forward.
- Do not require a custom password store or custom hashing.
- Required character classes and leaked-password protection are security configuration decisions before Production launch. Enable leaked-password protection when the selected Supabase plan supports it; do not silently weaken the minimum if it does not.
- UI copy should encourage long, unique passwords and password managers without exposing internal provider errors.

## 5. Guest vs Authenticated

| Capability | Unauthenticated Guest | Authenticated user |
| --- | --- | --- |
| Browse public content | Yes | Yes |
| Save and open Saved | Client-owned state; no Auth user | Account-owned DB state |
| Seen | No | Yes |
| My Art / Profile Settings | Login required | Yes |
| Favorite | No decision | Product decision required before implementation |
| Persistent ArtWall | No | Yes |

Guest browsing does not call `signInAnonymously()` and does not create `auth.users` rows. Supabase Anonymous Sign-In produces an authenticated-role user with cleanup, abuse, retention, and RLS implications. Those costs conflict with the approved simple Guest Save boundary.

The Auth UI state contract is:

```text
unknown / checking session
        ↓
unauthenticated | authenticated

orthogonal transition states:
submitting | awaiting_email_confirmation | recovering | expired | error
```

The application must not render authenticated Personal data while the session is `unknown`. Public content may render, but account-specific controls require a resolved state to avoid a transient Guest flash or data leak.

## 6. Session Model

### Source of Truth

- Supabase Auth owns access tokens, refresh tokens, session rotation, and server-side session records.
- Next.js SSR stores the Auth session in cookies through `@supabase/ssr` and PKCE flows.
- Muuzee does not create another token, cookie session database, URL login flag, or localStorage credential/session store.

### Next.js 15 lifecycle

The eventual implementation uses:

```text
Browser / Client Components
  → createBrowserClient

Server Components / Server Actions / Route Handlers
  → createServerClient with request cookies

Next.js 15 middleware.ts
  → refresh/verify session and return updated request/response cookies

Admin-only server operations
  → existing elevated Admin client, never the user-session client
```

Current Supabase documentation calls the refresh layer a Proxy for Next.js 16. This repository is Next.js 15, so the implementation file remains `middleware.ts` with an exported `middleware` function until a framework upgrade deliberately renames it.

### Identity verification

- Use `getClaims()` for normal protected-page/data identity checks and token verification.
- Use `getUser()` when a fresh Auth-server user record or immediate revocation check is required, including sensitive account lifecycle operations.
- Use `getSession()` only when raw token/session values are needed; never trust its embedded user object alone for authorization.
- Do not cache personalized session responses across users. Authenticated routes that set cookies or contain Viewer State must not enter shared static/CDN caches.

### Lifetime and refresh

- Use Supabase access-token expiry and refresh-token rotation; do not implement manual refresh timers.
- MVP does not add a custom absolute or inactivity timeout. Sessions persist until current-session logout, revocation/security event, provider-configured expiry, or account deletion.
- Cookie `Max-Age` is not treated as the security lifetime Source of Truth.
- Exact JWT lifetime and optional session-count/inactivity limits are environment security settings, not frontend constants.

## 7. Server / Browser Boundary

The eventual responsibility split is:

```text
src/lib/supabase/client.ts
  browser publishable-key client; session-aware, no elevated operations

src/lib/supabase/server.ts
  request-cookie server client; caller identity and RLS

src/lib/supabase/admin.ts
  server-only elevated maintenance/account deletion/Admin work

middleware.ts (Next.js 15)
  session refresh and cookie propagation

Auth domain actions / route handlers
  validation, safe error mapping, redirect validation, lifecycle orchestration
```

This is a responsibility contract, not authorization to add those files in Order 190.

The Shared Login/Register Popup calls Auth domain actions. It must not own provider setup, token storage, redirect allowlists, account deletion, or raw Supabase error presentation.

## 8. Registration

### Registration flow

1. Shared Register UI collects email, password, and explicit Terms/Privacy agreement.
2. The registration action trims surrounding email whitespace, validates required fields and consent, and lets Supabase Auth remain the email/uniqueness Source of Truth. Do not reproduce an independent user lookup.
3. `signUp()` requests email confirmation using an environment-derived allow-listed confirmation URL.
4. UI shows a neutral “check your email” result. It does not reveal whether an address already exists.
5. The SSR confirmation endpoint verifies the token hash/PKCE flow, establishes the cookie session, validates the internal destination, and redirects to Profile Settings.
6. Registration is Product-complete only after the required legal-consent record and Profile shell exist.

If email confirmation is enabled, `signUp()` can return a user while the session remains null. Application code must not interpret user creation as an authenticated session.

### Email and duplicates

- Trim accidental leading/trailing whitespace before submission.
- Do not create a second lowercased email field in `profiles`; Auth remains authoritative.
- Use neutral registration/recovery responses to limit user enumeration.
- Login failure copy does not distinguish “unknown email” from “wrong password.”

### Terms and Privacy consent

The checkbox is a Product gate, not Auth credential metadata. A durable consent record should contain at least:

- `user_id`;
- `consented_at`;
- `terms_version`;
- `privacy_version`.

Do not treat editable `user_metadata` as the consent Source of Truth. Order 200/250 must define the append-only/auditable schema and the idempotent registration-finalization mechanism. A Profile must not be considered onboarding-complete if required consent persistence failed.

### Profile creation recommendation

| Option | Strength | Risk | Decision |
| --- | --- | --- | --- |
| Minimal DB trigger on `auth.users` | Covers every signup/provider path; Profile shell exists before first app read | Trigger failure can block signup | Recommended, kept minimal and tested |
| Server application flow | Explicit application errors | Auth and public-schema writes are not one simple client transaction; can leave missing rows | Use for onboarding finalization, not base Profile existence |
| Lazy Profile creation | Avoids signup trigger | First-request races, missing-row branches, and wider RLS complexity | Rejected for MVP |

Order 200 should implement an idempotent, minimal trigger that creates only the required Profile shell. Optional preferences, consent, and onboarding content remain explicit downstream operations. Trigger tests must cover failure and repeat safety.

## 9. Email Verification

Email confirmation is required in STG and Production.

- A new user is not considered authenticated/onboarded until confirmation establishes a valid session.
- The confirmation email points to an allow-listed environment URL and a server confirmation endpoint that verifies `token_hash` / type before redirecting.
- Successful confirmation defaults to Profile Settings for registration, unless a validated internal `returnTo` from an existing Login flow is explicitly supported.
- Invalid, expired, or already-used links show a safe retry/resend state without raw provider errors.
- LOCAL uses Supabase CLI Mailpit to capture Auth emails.
- STG uses isolated test delivery/recipients or an approved SMTP sandbox.
- Production requires custom SMTP; Supabase's default email service is not a Production delivery system.

## 10. Password Recovery

Password Recovery is part of MVP:

```text
Forgot Password
  → submit email
  → always show neutral sent-if-eligible response
  → reset email to allow-listed callback
  → server verifies recovery token/session
  → authenticated update-password page
  → provider-enforced new password
  → success confirmation and login/account destination
```

Candidate routes are `/forgot-password`, `/auth/confirm`, and `/account/update-password`; final URL naming belongs to the implementation task. The update-password surface is accessible only with a valid recovery session. It must not accept a user ID or email as proof of authorization.

Email change UI is not MVP. General account recovery beyond password reset is Future scope. These omissions must be visible in Product/Support documentation before launch.

## 11. Protected Routes

| Route/capability | Guest policy | Expired-session policy |
| --- | --- | --- |
| Public discovery/detail | Render as Guest | Continue as Guest |
| Save / Saved | Use Guest client state | Return to Guest state; merge behavior is Order 240 |
| My Art | Require Login | Auth-required state, then validated return flow |
| Profile Settings | Require Login | Auth-required state, then validated return flow |
| Seen mutation/list | Require Login | Reject mutation safely and offer Login |
| Favorite | Not decided | Define only after Product decision |

Protection is enforced at the server/data boundary, not only by hiding Client Components. Direct URL access must not stream Personal content before authentication resolves.

## 12. Redirect / Return Flow

Post-auth navigation preserves context without creating an open redirect.

- Protected-page Login returns to the original internal route.
- Login opened from a Guest Save tooltip stays in the current context unless the user selected another internal destination.
- Registration defaults to Profile Settings after successful email confirmation.
- Password recovery goes only to the update-password/account completion route.

`returnTo` validation rules:

- accept only application-relative paths beginning with a single `/`;
- reject schemes, hosts, protocol-relative `//` values, backslashes, control characters, and Auth callback loops;
- optionally restrict to a maintained route allowlist;
- fall back to Home/Login default on any invalid value;
- never copy an external `redirectTo` directly into `Location`.

The environment base URL creates the absolute provider callback. The user-controlled value may select only the validated internal path.

## 13. Logout

- Logout ends the current browser session with local-scope sign-out unless Product later adds “log out all devices.”
- Clear/expire the SSR session cookies and resolve Auth state as unauthenticated.
- Public pages remain in place and render Guest state.
- Logout from My Art, Profile Settings, or another protected surface redirects to Home.
- Logout never deletes Profile, Personal Actions, ArtWall, or avatar objects.
- Account Saved remains server-side. Whether prior device-local Guest Saved reappears is Order 240.

## 14. Account Deletion

Account deletion is a server-orchestrated privileged lifecycle:

1. Resolve a fresh authenticated user on the server.
2. Show an explicit destructive confirmation and require recent authentication for the final operation. The exact reauthentication UX is a downstream security decision.
3. Block concurrent personal-data mutations and make the request idempotent.
4. Delete or reassign user-owned Storage objects first; Supabase Auth user deletion can fail while the user owns Storage objects.
5. Invoke `auth.admin.deleteUser()` only from a server-only elevated client.
6. Auth-user deletion cascades to Profile, Preferences, Personal Actions, and ArtWall rows according to `docs/user-data-architecture.md`.
7. Verify cleanup, clear the local session cookies, and redirect to Home with a non-sensitive completion message.

User Front JavaScript never receives a service-role/secret key and never directly calls the Admin deletion API.

Deleting an Auth user revokes refresh-token/session continuity, but an already-issued access JWT can remain cryptographically valid until expiry. Sensitive deletion completion checks should use a fresh Auth-server lookup where immediate account existence matters. Exact hard/soft deletion, audit retention, and legal hold behavior must be settled with Order 250 before Production launch.

## 15. Security Boundary

### Identity and authorization

- Supabase Auth UUID is the Production `user_id` and future `auth.uid()` RLS identity.
- Authentication proves identity. Order 230 owns table grants, RLS policies, and allow/deny tests.
- Normal User Front reads/mutations use the caller session and RLS, never the Admin client.
- Elevated service-role/secret clients are limited to server-only account lifecycle, Admin, and controlled maintenance operations.

### Secret handling

- Public URL and publishable/legacy anon key may be used by browser clients with correct RLS.
- `SUPABASE_SERVICE_ROLE_KEY` and future Supabase secret keys are never prefixed `NEXT_PUBLIC_`, serialized into props, logged, returned by routes, or imported into Client Components.
- Secrets are configured per environment outside Git. Documentation records variable names only.

### Error mapping and abuse

Map provider errors to stable UI categories:

| Internal category | Safe UI behavior |
| --- | --- |
| Invalid credentials | Generic email/password error |
| Unverified email | Explain verification requirement and offer controlled resend |
| Duplicate/unknown email | Neutral registration/recovery response |
| Rate limited | Ask the user to wait; respect retry timing |
| Network/provider unavailable | Retryable service message; preserve non-secret form state |
| Expired/revoked session | Resolve to unauthenticated and offer Login/return flow |
| Invalid/expired callback | Safe error page with restart action |

Do not display raw provider responses, tokens, stack traces, or user existence. Configure rate limits and evaluate CAPTCHA/Turnstile before Production exposure; the exact provider and trigger thresholds remain an operational security decision.

## 16. Environment Boundary

LOCAL, STG, preview, and Production use separate Supabase/Auth configuration and secrets.

| Concern | LOCAL | STG / Preview | Production |
| --- | --- | --- | --- |
| Base/Site URL | Localhost configuration | Environment deployment URL | Canonical Production domain |
| Redirect allowlist | Explicit localhost paths | Scoped preview/STG patterns | Exact HTTPS callback paths; avoid broad wildcards |
| Email | Supabase CLI Mailpit | Approved sandbox/test delivery | Custom SMTP and monitored sender domain |
| Keys/secrets | Local environment | STG secret store | Production secret store |
| Data/Auth users | Local only | Isolated test identities | Production identities |

Code must derive confirmation, recovery, and post-auth callback origins from validated environment configuration. Do not hardcode the future Production domain. Supabase Site URL and Redirect URLs must be configured per environment; Production should use exact paths rather than broad wildcard patterns.

## 17. Downstream Dependencies

| Order | Contract received from Order 190 | Must implement / decide |
| --- | --- | --- |
| 200 User/Profile | Auth UUID identity; minimal trigger recommendation; Auth email excluded from Profile; consent is separate; avatar cleanup precedes Auth deletion | Profile/Preferences/consent migrations, trigger tests, avatar Storage ownership, onboarding completion |
| 210 Personal Actions | Only permanent authenticated users own DB actions; Guest has no Auth UUID; RLS-ready direct `user_id` | Saved/Seen/Favorite/ArtWall tables after Product blockers resolve |
| 240 Guest merge | Guest remains unauthenticated client state; login/register completion is the merge boundary | Storage, merge idempotency, post-merge cleanup, logout reappearance |
| 220 Data access | Cookie session reaches Server Components/Actions/Route Handlers; Popup calls domain actions; safe Auth error categories | Browser/server clients, middleware, Auth actions, callbacks, typed viewer/session contract |
| 230 RLS | Supabase Auth UUID maps to `auth.uid()`; normal User Front never uses elevated key | grants, owner policies, anon/authenticated tests, session-based authorization tests |
| 250 Account/legal lifecycle | Consent is auditable data; account deletion needs retention/re-auth rules | consent retention/version policy, deletion audit, hard/soft deletion decision |
| 260+ Environments | Site URL, Redirect URLs, SMTP, and secrets vary by environment | STG/Production Auth config, domain, delivery, monitoring, secret rotation |

Implementation order remains: Auth configuration/client foundation → Profile foundation → Personal schema → Guest merge contract → Data Access → RLS/authorization, with environment readiness before Production exposure.

## 18. Open Decisions

The following do not change the selected provider or MVP Email + Password boundary, but must be resolved before their owning implementation/release gate:

1. Exact required password character classes and whether the selected Supabase plan enables leaked-password protection.
2. JWT lifetime, optional inactivity timeout, maximum session lifetime, and multi-session limits.
3. Terms/Privacy version source, append-only consent schema, and retention policy.
4. Exact recent-authentication mechanism/window for account deletion.
5. Hard deletion versus any required soft-delete/legal-retention period.
6. Custom SMTP provider, sender/domain, delivery monitoring, and fallback provider.
7. CAPTCHA provider and risk/rate-limit threshold.
8. Final Production domain, STG domain, and exact callback allowlists.
9. Whether/when Email change, MFA, OAuth, or passwordless enters a later release.
10. Guest Saved storage, expiry, post-login merge cleanup, and logout behavior remain Order 240.
11. Favorite semantics and authorization remain unresolved Product work, not an Auth decision.

## Official Evidence

Official Supabase sources checked on **2026-09-20**:

- [Server-Side Rendering](https://supabase.com/docs/guides/auth/server-side)
- [Creating a Supabase client for SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs&package-manager=npm&queryGroups=framework&queryGroups=package-manager)
- [Choosing a server package](https://supabase.com/docs/guides/auth/choosing-a-server-package)
- [Migrating from Auth Helpers to SSR](https://supabase.com/docs/guides/auth/server-side/migrating-to-ssr-from-auth-helpers)
- [Password-based Auth](https://supabase.com/docs/guides/auth/passwords)
- [Password security](https://supabase.com/docs/guides/auth/password-security)
- [User sessions](https://supabase.com/docs/guides/auth/sessions)
- [Signing out](https://supabase.com/docs/guides/auth/signout)
- [User Management](https://supabase.com/docs/guides/auth/managing-user-data)
- [JavaScript `deleteUser`](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Anonymous Sign-Ins](https://supabase.com/docs/guides/auth/auth-anonymous)
- [Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits)
- [Local Auth email testing](https://supabase.com/docs/guides/local-development/cli/testing-and-linting#testing-auth-emails)

## Out of Scope for Order 190

- Installing `@supabase/ssr` or changing dependencies.
- Adding browser/server Supabase clients, `middleware.ts`, Auth routes, Server Actions, or UI.
- Changing Supabase Auth, email, URL, key, or SMTP configuration.
- Creating Profile, consent, Personal Action, ArtWall, or RLS migrations.
- Connecting `prototype/` to Supabase.
- Implementing Guest merge, Account deletion API, or Production Admin Auth.
