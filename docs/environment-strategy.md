# Environment Strategy

Status: **Draft for Human Review** (Order 260). This document defines the proposed LOCAL / STG / Production operating contract. It does not provision a remote project, set a credential, deploy an application, apply a migration, or create CI/CD.

`main` and the current repository files are the implementation Source of Truth. This document is the operating Source of Truth once the Human Review decisions in Section 15 are approved.

## 1. Decision summary

- LOCAL, STG, and Production use fully separate database, Auth, Storage, secrets, and data.
- STG and Production use separate Supabase projects.
- STG and Production use separate Vercel projects connected to the same GitHub repository.
- `main` is the only canonical release branch. Task branches remain temporary; there is no long-lived `develop` or `staging` branch.
- Both Vercel projects track `main` as their Production Branch. In the STG project, a successful `main` deployment updates the STG domain automatically. In the Production project, production-domain auto-assignment is disabled, so the same commit produces a **staged Production build** that requires explicit promotion.
- A Git SHA is the release identity. STG and Production create different environment-specific build artifacts from the same source SHA; no STG build artifact or STG environment value is copied into Production.
- `supabase/migrations/*.sql` is the only remote schema-change Source of Truth. Dashboard-only schema edits are prohibited.
- Production data, Auth users, Storage objects, dumps, and logs must never be copied into LOCAL or STG.
- Secrets are unique per environment and remain in local `.env.local` or the relevant Vercel/Supabase secret store. Values never belong in Git, Notion, tickets, chat, screenshots, or logs.

## 2. Environment boundary

| Boundary | LOCAL | STG | Production |
| --- | --- | --- | --- |
| Purpose | Development and destructive-safe testing | Integrated release validation | Public service |
| Next.js runtime | Developer machine | Dedicated Vercel STG project | Dedicated Vercel Production project |
| Supabase | Local CLI stack | Dedicated hosted STG project | Dedicated hosted Production project |
| Database/Auth/Storage | Local only | STG only | Production only |
| Data | Synthetic fixtures, local development records | Synthetic QA users/actions and reproducible non-Production seed | Real users and approved Production content |
| Git input | Current task branch or `main` | `main` | `main` |
| Domain | `http://127.0.0.1:3000` (localhost callback also allow-listed) | Stable STG HTTPS origin selected by Order 280 | Canonical public HTTPS origin selected by Order 320/domain work |
| Access | Developer machine | Restricted QA/team access | Public User Front; privileged surfaces require their own authorization |
| Failure impact | Local only | Must not alter Production | Production incident process |

The fact that each Vercel project uses Vercel's `Production` environment does not make STG Production data. The project boundary is authoritative: the STG Vercel project's Production variables point only to the STG Supabase project.

The current `/admin` surface has no Production Admin authentication. STG must use deployment protection and limited membership. Production internet exposure of `/admin` remains prohibited until a dedicated Admin authorization boundary exists; Vercel project separation does not solve application authorization.

## 3. Vercel deployment model

### 3.1 Options considered

| Option | Evaluation |
| --- | --- |
| **A. Separate STG/Production projects; both track `main`; STG automatic; Production staged then manually promoted** | **Recommended.** One linear Git history, exact SHA comparison, project-level environment isolation, no Production traffic switch on a push, and clear Vercel deployment rollback. |
| B. Long-lived `staging` branch promoted or merged into `main` | Rejected. It creates a second release history, merge/cherry-pick drift, and ambiguity over which SHA STG actually approved. |
| C. One Vercel project with a Custom Environment | Rejected for the current small-team baseline. It can isolate environment variables, but keeps STG and Production in one project control plane, adds plan/workflow concepts, and weakens the explicit separate-project boundary without a current benefit. |

### 3.2 Recommended project settings

**STG Vercel project**

- Connect the Muuzee GitHub repository.
- Set Production Branch to `main`.
- Keep automatic deployment and domain assignment enabled for successful `main` builds.
- Require Vercel Authentication with **All Deployments** scope so the persistent STG production domain is protected as well as generated URLs. This currently requires the applicable Pro add-on or Enterprise capability and is part of the plan decision; Standard Protection alone does not protect a production domain.
- Store only STG values in this project.

**Production Vercel project**

- Connect the same repository and set Production Branch to `main`.
- Disable **Auto-assign Custom Production Domains**. Each `main` commit may build, but it remains `Staged` and cannot receive public traffic until explicitly promoted.
- Use Standard Deployment Protection for generated deployment URLs. The public canonical domain is assigned only to the promoted Current deployment.
- Store only Production values in this project.

This setting is project-specific and therefore must be configured in Vercel rather than committed as a repository-wide `vercel.json` `git.deploymentEnabled` rule. A shared rule would apply to both projects and cannot express “STG automatic, Production staged.”

### 3.3 Release gate

For release SHA `S`:

1. Merge the reviewed task to `main`; record `S`.
2. Confirm the STG and staged Production Vercel deployments both report Git SHA `S`.
3. Apply the migrations present at `S` to STG through the controlled migration procedure.
4. Run STG schema verification, Auth checks, data checks, and application smoke tests.
5. If STG fails, stop. Do not promote Production.
6. Confirm the Production backup/PITR state, migration scope, rollback/forward-fix plan, secret inventory, and human approval.
7. Apply exactly the pending migrations present at `S` to the Production Supabase project.
8. Smoke-test the protected staged Production deployment against Production configuration. Never use destructive test data or a real-user credential for this check.
9. Manually promote the staged Production deployment for `S` to Current. Promotion must not rebuild.
10. Run a non-destructive public smoke test and record SHA, Vercel deployment ID, migration versions, operator, and time.

No deployment command, hook, CI workflow, or provider project is created by Order 260. Orders 280 and 320 implement these project settings; Orders 300 and 340 implement the environment-specific migration and smoke runbooks.

## 4. Rollback and incident boundary

- **Application rollback:** use Vercel Instant Rollback to a previously Current Production deployment. Record the restored deployment ID and Git SHA.
- **Environment variables:** an Instant Rollback does not rebuild a deployment, so it also does not apply newly edited environment variables. Config rollback requires selecting a deployment built with the required values or rotating the values and creating a new staged build.
- **Database:** application rollback never rolls back a database migration. Prefer backward-compatible expand/contract changes so both the old and new application SHAs can run during rollback.
- **Database correction:** prefer a reviewed forward-fix migration. A reverse migration is permitted only when it was tested, does not destroy required data, and has explicit human approval.
- **Restore:** before a risky Production migration, verify that the selected backup/PITR capability is active and usable. A restore is an incident operation with downtime and data-reconciliation consequences, not a normal release step.
- **Deleted Accounts:** a restored snapshot can contain data deleted after the restore point. The Production restore runbook must reconcile those deletions before normal processing resumes; backup/PITR is never a user-request Account restoration feature.

If a migration is not backward compatible with the previously Current app, it is not eligible for ordinary promotion. Split it into expand, application adoption, and later contract migrations.

## 5. Database migration contract

1. Create and test migrations locally. Use forward migration against a data-bearing local database when preservation matters; never use reset as a routine update mechanism.
2. Commit migrations with the application code that consumes them and regenerate/check database docs.
3. After merge, apply only committed migrations to STG and compare `supabase migration list` with SHA `S`.
4. After STG acceptance and the Production gate, apply the same ordered migration set to Production.
5. Do not edit hosted schema through the Dashboard. If an emergency provider-side change is unavoidable, immediately capture the exact change as a migration and reconcile history before the next release.
6. Never run `db reset`, `TRUNCATE`, or reseed against STG/Production.

Migration credentials are operations secrets, not application runtime variables. Future automation may use Supabase access/project/database credentials in a dedicated deployment secret scope, but those variables are not added until a reviewed CI/CD workflow exists.

## 6. Data and seed policy

### LOCAL

- Use migrations, repository fixtures, and synthetic test identities/actions.
- Existing developer data may be preserved across forward migrations.
- Never import a Production dump or Production Storage object.

### STG

- Use deterministic synthetic Auth users, User Data, and test content.
- Rebuild canonical Master data from approved public-source pipelines or attributable repository seed artifacts. Preserve source/provenance and rights state.
- Do not copy Production email addresses, UUID-linked User Data, sessions, Storage objects, raw provider logs, database dumps, or analytics identifiers.
- A masked Production dump is not the default. Any future exceptional dataset requires a separate Privacy/Security review proving necessity and irreversible de-identification.

### Production

- Start from the migration history and separately approved Production import/seed procedures.
- Do not promote a STG database or Storage bucket into Production.
- Import only approved canonical data with its provenance and publication/rights controls. Production Auth users arise only through approved Production flows.

Seed and migration are separate concepts. Seed failure must not be hidden by resetting a remote database.

## 7. Environment variable inventory

`.env.example` records names and safe non-secret defaults only. `.env.local` is developer-local and ignored. Vercel variables are scoped to exactly one project.

| Variable | Classification | Required where | Owner / notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser-visible config | LOCAL, STG, Production | Environment-specific Supabase API URL. Embedded into the client bundle; change requires a new build. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser-visible public credential | LOCAL, STG, Production | Environment-specific anon/publishable key. RLS remains the security boundary; never substitute service role. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server Secret** | Any deployed runtime that uses Admin/data-maintenance or Account hard-delete boundaries | Separate per Supabase project; never available to Client Components or `NEXT_PUBLIC_*`. Orders 290/330 provision. |
| `ACCOUNT_LIFECYCLE_MARKER_SECRET` | **Server Secret** | STG, Production, and LOCAL when lifecycle routes are tested | Dedicated random secret, minimum 32 UTF-8 bytes; unique per environment and purpose. |
| `PASSWORD_RECOVERY_MARKER_SECRET` | **Server Secret** | STG, Production, and LOCAL when Recovery routes are tested | Dedicated random secret, minimum 32 UTF-8 bytes; unique per environment and purpose. |
| `JPSEARCH_BASE_URL` | Server config | Optional override | Safe default is public; not a credential. |
| `JPSEARCH_DATABASE_ID` | Server config | Optional override | Safe default is public; not a credential. |
| `JPSEARCH_REQUEST_DELAY_MS` | Server config | Optional override | Positive numeric throttle; validate during environment smoke testing. |
| `MUUZEE_DB_CONTAINER` | Local-tool config | LOCAL only | Optional Docker container override used by local analysis scripts. Never set in Vercel. |
| `NODE_ENV` | Platform-owned config | All Next.js runtimes | Set by Next.js/Vercel tooling. Do not manage manually as a Muuzee secret. |

Vercel/Supabase system variables, project IDs, deployment IDs, and future CI credentials are operational metadata, not current application configuration. Add them to this inventory before application code begins to depend on them.

## 8. Secret lifecycle

- Never share a secret value across LOCAL, STG, and Production or between the two marker purposes.
- Use Vercel `Secret` visibility for service-role and marker secrets. Use readable `Config` only for non-sensitive values.
- Limit provider/project membership to people who require it; require MFA on GitHub, Vercel, Supabase, and email-provider accounts.
- Record secret name, environment, system, owner, created/rotated date, and next review date without recording the value.
- Rotate immediately after suspected exposure, accidental logging/commit, privileged-member removal, or provider instruction. Rotate initial setup/test credentials before public launch.
- Review the inventory quarterly. Routine time-based rotation is not invented where the provider and threat model do not require it; Human Review may add a fixed cadence.
- Rotation order is: create/rotate at the provider, update the one affected Vercel project, create and validate a new deployment, then revoke the old credential. Do not rotate both environments in one unverified step.
- Rotating either marker secret invalidates outstanding markers. The maximum intentional user impact is one hour for Recovery callback state and 15 minutes for the short action markers; perform the change deliberately and retest both flows.

## 9. Auth environment contract

| Setting | LOCAL | STG | Production |
| --- | --- | --- | --- |
| Site URL | `http://127.0.0.1:3000` | Exact stable STG HTTPS origin | Exact canonical public HTTPS origin |
| Redirect allowlist | Exact `127.0.0.1` and `localhost` `/auth/callback` | Exact STG `/auth/callback` | Exact Production `/auth/callback`; no wildcard |
| Email + Password | Enabled | Enabled | Enabled |
| Email confirmation | Required | Required | Required |
| Anonymous sign-in | Disabled | Disabled | Disabled |
| Minimum password | 8 | At least 8 | At least 8 |
| Double-confirm email change | Enabled | Enabled | Enabled before Order 243 Email Change work |
| Email OTP/link expiry | 3,600 seconds | 3,600 seconds | 3,600 seconds |
| Recovery application state | 3,600 seconds | 3,600 seconds | 3,600 seconds |
| Short Recovery/Account marker | 900 seconds | 900 seconds | 900 seconds |
| Email delivery | CLI Mailpit | Approved sandbox/test SMTP | Approved Production SMTP |
| Templates | Local test copy | Version recorded and tested | Same Human-approved version, with Production URLs |
| Rate limit / CAPTCHA | Local defaults; no security claim | Record exact provider values and test failure UX | Human-approved values; CAPTCHA decision required before public signup |

Email templates must use the intended redirect value and must not hardcode another environment's origin. STG must validate confirmation, recovery, expiry, resend, and error handling before the same template version is configured in Production.

Order 270 owns STG Supabase/Auth settings; Order 290 owns STG runtime secrets; Order 300 validates the STG flows. Orders 310, 330, and 340 own the corresponding Production setup and validation. Order 243 may not complete environment-dependent Email Change QA until these hosted Auth settings exist.

## 10. Storage boundary

- Each Supabase project has its own Storage namespace and policies. No bucket is shared across environments.
- Current repository configuration enables local Storage with a `20MiB` file limit, but no User avatar bucket/lifecycle is implemented.
- Future User-owned buckets must be private, use a stable owner path convention, enforce owner RLS/policies, and delete objects through the Storage API before Account deletion.
- STG uses synthetic files only. Production objects are never copied into STG/LOCAL.
- Bucket definitions/policies must be migration-managed where supported, with an explicit object migration/cleanup runbook. A database restore alone does not guarantee object restoration consistency.

## 11. Backup and log retention proposal

Order 250 requires exact environment schedules. The following is the **recommended launch baseline pending Human Review and plan selection**; Orders 270/310/280/320 must record the actual provider settings before their environment is accepted.

| Category | LOCAL | STG proposed baseline | Production proposed baseline |
| --- | --- | --- | --- |
| Database backup | No automatic guarantee; local volume is disposable | Supabase Pro daily backup, 7-day availability; not relied upon for Product recovery | Supabase Pro daily backup, 7-day availability until PITR decision |
| PITR | Off | Off | **Recommended: enable 7-day PITR before public User Data.** When enabled, it replaces daily backups. Human approval required for cost/RPO. |
| Supabase Auth/DB/Storage logs | Process/local tooling lifetime | Pro accessible history: 7 days | Pro accessible history: 7 days |
| Vercel runtime/application logs | Terminal process lifetime | Pro: 1 day | Pro: 1 day |
| Durable application log sink | None | None | None until separately approved observability work |
| Platform audit logs | Local Git/shell evidence only | Supabase Team/Enterprise feature; not assumed on Pro | Supabase Team/Enterprise feature; Human Review decides whether required |

If a different plan is selected, this table must be updated with the provider's current documented retention before provisioning is declared complete. Provider defaults are not a substitute for a recorded decision. Log payloads must exclude passwords, tokens, marker values, secrets, and unnecessary personal data regardless of retention length.

The daily-backup-only Production alternative has up to approximately 24 hours of data-loss exposure. The recommendation is therefore 7-day PITR before public User Data; Human Review must either approve that cost or explicitly accept and record the daily-backup risk.

## 12. Access, monitoring, and operational ownership

- **GitHub:** `main` protection/review and repository access are the source-release controls.
- **Vercel:** only designated release operators may edit Production variables, domain assignment, or promote/rollback. STG access is limited to the project/QA team.
- **Supabase:** Production owner/service-role/database credentials have the smallest operator set. Application users never receive elevated credentials.
- **Email/SMTP:** credentials and sender/domain verification are environment-specific. STG must not deliver to arbitrary real users.
- **Monitoring:** use provider health/build/runtime/Auth/database logs for the provider-retention window; define alert destinations and an incident owner during Orders 280/320. No durable external log drain is approved yet.
- **Change evidence:** each remote setup Order records provider project name/ID, region, plan, domain, relevant non-secret settings, credential owners, and validation time in the authorized operations record. Secret values are excluded.

Before public release, resolve the current combined User Front/Admin exposure. The environment strategy permits protected STG validation but does not authorize exposing unauthenticated `/admin` in Production.

## 13. Downstream Order map

| Order | Handoff from Order 260 |
| --- | --- |
| 243 Account Email Change | Validate hosted double-confirm behavior, exact callback allowlists, expiry, templates, and failure UX after STG/Production Auth settings exist. |
| 270 STG Supabase | Create the dedicated project; choose region/plan; record Auth, log, backup, Storage, and access settings. |
| 280 STG Vercel | Create the dedicated project, connect `main`, enable automatic STG domain assignment/protection, and record deployment evidence. |
| 290 STG environment/secrets | Provision only STG values, verify Secret/Config classification, and run the inventory checklist. |
| 300 STG migration/seed/smoke | Apply committed migrations, create synthetic/reproducible seed data, and validate Auth/application/Storage boundaries without Production data. |
| 310 Production Supabase | Create the dedicated project; approve region/plan/PITR/retention and apply the Production Auth/Storage/access contract. |
| 320 Production Vercel | Create the dedicated project, track `main`, disable automatic production-domain assignment, configure protection/domain, and test staged promotion/rollback. |
| 330 Production environment/secrets | Provision unique Production values, rotate setup credentials before launch, and verify no STG reuse. |
| 340 Production migration/seed | Apply the exact approved migration set, import only approved canonical data, verify backup/rollback gates, and perform non-destructive smoke tests. |

## 14. Provisioning and release checklists

### Environment creation

- [ ] Project/account owner and backup owner recorded; MFA enabled.
- [ ] Region and plan approved.
- [ ] Supabase and Vercel project IDs/names recorded without secret values.
- [ ] Database/Auth/Storage endpoints point only to the same environment.
- [ ] Exact Site URL and callback allowlist recorded.
- [ ] Auth confirmation, expiry, SMTP/template, rate-limit, and CAPTCHA settings recorded.
- [ ] Backup/PITR and log retention match the approved table.
- [ ] Vercel protection and branch/domain assignment match Section 3.
- [ ] Secret inventory complete and values unique.
- [ ] Production data-copy prohibition confirmed.

### Per-release

- [ ] One reviewed `main` SHA recorded for STG and Production builds.
- [ ] STG migration list and smoke checks pass.
- [ ] Production staged build exists and is not Current.
- [ ] Production backup/PITR status and migration plan verified.
- [ ] Production migration list matches the release.
- [ ] Protected staged-Production smoke passes.
- [ ] Human promotion approval recorded.
- [ ] Current deployment, domain, public smoke, and rollback target recorded.

## 15. Human Review decisions

Order 260 remains `Doing` until these are decided:

1. Approve Option A: two Vercel projects, `main` for both, STG auto-domain assignment, Production staged manual promotion.
2. Approve the separate Supabase/Vercel project names, regions, plans (including STG All Deployments protection), and owner/operator membership.
3. Approve STG and Production stable domains and exact callback origins.
4. Approve provider plans and the retention baseline, especially 7-day Production PITR versus accepting daily-backup RPO/cost.
5. Approve STG sandbox SMTP and Production SMTP providers/sender domains; approve where template source/version evidence lives.
6. Approve Production Auth rate limits and whether CAPTCHA is mandatory at first public signup.
7. Decide whether Supabase Platform Audit Logs/Team plan or an external log drain is required at launch.
8. Assign the release approver, secret owner, incident owner, and backup/restore test owner.
9. Decide the Production `/admin` isolation/authentication plan before any public Production deployment.
10. Confirm whether live Auth `session_id` validation needs a separate Security implementation task beyond current fresh `getUser()` checks.

## 16. Official platform evidence

Checked against current official documentation on 2026-09-29:

- [Supabase: Managing Environments](https://supabase.com/docs/guides/deployment/managing-environments)
- [Supabase: Deployment and Branching](https://supabase.com/docs/guides/deployment)
- [Supabase: Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Supabase CLI Auth configuration](https://supabase.com/docs/guides/local-development/cli/config)
- [Supabase: Email templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Supabase: Database Backups and PITR](https://supabase.com/docs/guides/platform/backups)
- [Supabase: Logs in Studio](https://supabase.com/docs/guides/observability/logs)
- [Supabase: Auth log availability by plan](https://supabase.com/docs/guides/troubleshooting/check-usage-for-monthly-active-users-mau-MwZaBs)
- [Supabase: Platform Audit Logs](https://supabase.com/docs/guides/security/platform-audit-logs)
- [Vercel: Environments](https://vercel.com/docs/deployments/environments)
- [Vercel: Promoting Deployments](https://vercel.com/docs/deployments/promoting-a-deployment)
- [Vercel: Instant Rollback](https://vercel.com/docs/instant-rollback)
- [Vercel: Environment Variables](https://vercel.com/docs/environment-variables)
- [Vercel: Secret Environment Variables](https://vercel.com/docs/environment-variables/sensitive-environment-variables)
- [Vercel: Deployment Protection](https://vercel.com/docs/deployment-protection)
- [Vercel: Runtime Logs](https://vercel.com/docs/logs/runtime)
