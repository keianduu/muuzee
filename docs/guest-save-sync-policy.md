# Guest Saved → Account Saved Sync Policy

Status: Approved + Implemented by Order 242. The Production storage adapter, bounded Account merge, per-ref cleanup/retry, and `/auth/complete` handoff are implemented. The broad Production User Front Save/Saved surfaces and shell-level session-restore mount remain downstream UI wiring; no migration, schema, RLS, or DB operation was added.

Approved Product behavior comes from the Notion requirement **Account / Login / Guest Save**. The ownership and identity contracts come from `docs/user-data-architecture.md`, `docs/auth-login-policy.md`, and `docs/user-data-access.md`. Prototype localStorage keys and Prototype Auth are observations only and are not Production contracts.

## 1. Decision Summary

| Topic | Approved MVP contract |
| --- | --- |
| Guest-owned data | Saved only |
| Supported entities | Exhibition, Artist, Venue/Museum, Work |
| Storage | Browser `localStorage` |
| Storage key | `muuzee:guest-saved:v1` |
| Record | Canonical `{ kind, id }` only |
| Membership identity | Unique `kind + id`; order has no Product meaning |
| Timestamp | No Guest `savedAt`; Account `created_at` is the merge/add time |
| Expiry | No automatic TTL |
| Merge trigger | A real authenticated Supabase session plus a non-empty Guest store |
| Merge semantics | Guest Saved ∪ Account Saved; never overwrite or delete Account Saved |
| Cleanup | Consume each Guest ref only after Account add success/already-present success |
| Failure | Keep failed valid refs for retry; authentication is not rolled back |
| Logout | Never copy Account Saved back to Guest storage |
| Cross-device | No Guest sync; Account Saved syncs through the server after merge |

## 2. Scope

Guest persistent state contains Saved membership only:

- Exhibition
- Artist
- Venue, which is the canonical entity behind the Museum UI concept
- Work

Guest state does not contain Seen, Favorite, Profile, Preferences, ArtWall, notification state, an Account ID, or an Auth identity. Muuzee does not use Supabase Anonymous Sign-In for normal Guest browsing or Guest Save.

This policy does not define migration from Prototype keys. `muuzee:saved-exhibitions`, `muuzee:saved-museums`, `muuzee:saved-artists`, and any other Prototype key remain Prototype-only. Production does not scan or import them.

## 3. Guest Storage

### Storage choice

MVP uses `localStorage` because the stored data is a small browser-local set of canonical references. It satisfies the approved “Save before Login” behavior without an anonymous Auth user, Guest server table, cookie identity, or IndexedDB lifecycle.

The Production key is:

```text
muuzee:guest-saved:v1
```

The version is carried by the key. MVP does not add an envelope or metadata object without a concrete migration need.

### Payload

```json
[
  { "kind": "exhibition", "id": "00000000-0000-4000-8000-000000000001" },
  { "kind": "venue", "id": "00000000-0000-4000-8000-000000000002" }
]
```

Allowed `kind` values are `exhibition`, `artist`, `venue`, and `work`. `id` is the canonical Muuzee Master UUID. The store must not persist title, name, slug, image URL, Venue name, Artist name, fixture order, Account ID, email, login state, credential, token, or other PII. Display data is hydrated from canonical Public Content.

The array represents set membership. Duplicate `kind + id` entries collapse to one canonical ref. Array order is not a Product sort order.

### Retention

MVP has no automatic TTL. A ref remains until:

- the Guest removes it;
- a successful Account merge consumes it; or
- the browser/user clears site storage.

Private browsing, browser eviction, quota behavior, and user-initiated site-data clearing can remove Guest Saved. Guest state has no cloud durability or cross-device guarantee.

## 4. Storage Validation and Safe Failure

`localStorage` is untrusted, user-editable input. Every read must:

1. catch storage access and JSON parse failures;
2. require a top-level array;
3. retain only objects with a supported `kind` and valid UUID `id`;
4. project each valid item to `{ kind, id }`, dropping extra fields;
5. deduplicate by `kind + id`.

Malformed entries may be discarded locally and must never reach the Account DAL. A syntactically valid canonical ref that later fails a server operation is different: it remains pending and is not silently consumed.

Storage unavailable, quota exceeded, or write failure must not crash public browsing or the whole application. The Guest Save operation fails safely and the UI must not claim persistence when the canonical write did not succeed.

No Product Saved-count limit is introduced by this policy. Implementation must process merge work in bounded chunks or another bounded loop without silently dropping unprocessed valid refs.

## 5. Guest Save and Saved Page

While unauthenticated:

- Save ON adds the canonical ref if absent.
- Save OFF removes the canonical ref if present.
- Neither action requires Login.
- Save OFF does not show the membership/Login promotion tooltip.
- The Saved page reads validated canonical refs, hydrates current Public Content, and allows removal.

Guest storage never becomes a display-object cache. A valid ref whose Public Content cannot currently be hydrated is not automatically deleted merely because its display data is unavailable; archived/unavailable-item UX remains a separate Product concern.

## 6. Authenticated Source of Truth and Merge Timing

When authenticated, Account Saved in `user_saved_items` is the only durable Saved Source of Truth for Account UI. Guest localStorage is not queried as a second Account Saved list.

Merge starts only after a real authenticated Supabase session has been established and verified:

- Login: after successful sign-in and session establishment.
- Register: not at signup request time; after email confirmation establishes the authenticated session.
- Session restore: when Auth bootstrap/transition resolves authenticated and the Guest store is non-empty.

The merge trigger belongs to the Auth transition/bootstrap boundary, not an unconditional every-page scan. Implementation should keep at most one merge run in flight per browser context; duplicate runs across tabs or restores remain safe because Account add is idempotent.

## 7. Merge Algorithm

The logical flow is:

```text
resolved authenticated session
  + non-empty Guest store
        ↓
read → validate → canonicalize → deduplicate snapshot
        ↓
process refs through normal Account DAL / owner RLS
        ↓
for each ref:
  add success or already present → consume that exact Guest ref
  failure                         → keep that Guest ref pending
```

Account merge is set union:

```text
Guest  = A, B, C
Account = B, D
Result  = A, B, C, D
```

Guest absence is never evidence for Account deletion. The merge must not remove or replace Account Saved items. Duplicate Account membership is success/no-op through the existing Saved add contract.

The merge uses the normal authenticated User Data service and owner RLS. It must not accept a client-selected `user_id`, import the Admin client, use a service-role key, or write directly around the Account DAL.

## 8. Cleanup, Partial Failure, and Retry

Guest storage is the pending queue; MVP adds no `guest_merge_jobs`, `guest_sessions`, anonymous-user table, or server merge journal.

Never clear the Guest store before Account writes complete. Cleanup is per canonical ref and must remove only a ref that returned add success, including expected duplicate success. Cleanup should read the latest canonical store and remove the matching ref instead of replacing it with an old full snapshot, so a concurrent local change is not erased.

Example:

```text
Guest before = A, B, C
A success
B already exists
C temporary failure

Account after = previous Account ∪ A ∪ B
Guest after   = C
```

Repeated merge of the same snapshot is safe. Login/session establishment succeeds independently of merge completion. A partial failure may produce a non-blocking status and explicit retry action; it must not log the user out or roll back authentication.

### Error retention policy

| Account operation result | Guest ref |
| --- | --- |
| Inserted | Consume |
| Expected duplicate / already present | Consume |
| Temporary/retryable failure | Retain and retry later |
| Session became unauthenticated | Retain; stop until a later authenticated transition |
| Forbidden / authorization failure | Retain; do not bypass RLS |
| Valid ref with not-found, invalid-target, or data-integrity failure | Retain for explicit handling/manual removal; do not guess |
| Malformed local entry rejected before DAL | Discard during canonical validation |

Raw provider/DB errors are not exposed to User Front. Retry uses the same canonical refs and the existing idempotent add contract.

## 9. Logout, Multi-account, and Cross-device

Logout clears the authenticated session boundary only. It never copies Account Saved into Guest localStorage and never deletes Account Saved from the server.

After successful Guest merge, consumed refs do not reappear as Guest Saved after logout. New refs saved while subsequently unauthenticated form a new Guest set and can merge into the next authenticated account.

Guest storage is browser/device scoped rather than account scoped. The first account that successfully merges a ref consumes it from the shared device Guest store. A second account used later on the device does not receive already-consumed refs. This prevents already-attributed Guest state from leaking across accounts.

Guest state does not synchronize across devices. Once merged, Account Saved is server-owned and can be available on other authenticated devices through the normal Account data path.

## 10. Account Deletion

Account deletion cascades Account Saved according to the User Data ownership tree. It does not automatically clear unrelated browser-local Guest Saved because that state has no Account owner.

Successfully merged refs should already have been consumed. Valid unmerged Guest refs can remain in the browser after account deletion and continue to behave as Guest state. Account deletion must not perform Account → Guest reverse synchronization.

## 11. Security and Privacy

- Guest storage contains canonical entity refs only and no PII, credential, token, Account ID, or display snapshot.
- Same-origin script access means XSS remains a browser-storage risk; local payloads are always validated and never trusted as authorization evidence.
- Authenticated identity comes from verified Supabase session claims inside the Account service.
- Server writes use normal Account DAL + owner RLS; no service role is used.
- Server-side FK/RLS/domain validation remains authoritative even after client validation.
- Account Personal Data is never copied into an unauthenticated store on logout.

## 12. Implementation Dependencies

The downstream implementation depends on:

- Production Login/Register/Auth callback and an authenticated-transition/bootstrap hook;
- a client-only Guest Saved adapter for `localStorage`;
- the existing typed `EntityRef` and idempotent Account Saved add operation;
- Order 230 owner RLS;
- Public Content hydration for Saved-page rendering;
- safe Loading/Empty/Error/Retry UI that does not block successful authentication.

Auth mutation Route Handlers must use the response-aware Supabase SSR adapter required by `docs/user-data-access.md`. Guest merge is triggered after session establishment; it is not embedded in the signup request before email confirmation.

## 13. Order 242 Implementation

Order 242: **[Backend/User Front] Guest Saved adapter / Account mergeを実装**

Implemented scope:

- Production `localStorage` adapter with schema validation, canonicalization, deduplication, and safe storage failures;
- Guest Save toggle/read data source contract for future Save and Saved-page consumers;
- `/auth/complete` authenticated transition integration plus a reusable session-restore bootstrap;
- bounded idempotent union through Account DAL/RLS;
- per-ref successful cleanup, partial-failure retention, and non-blocking retry UX;
- logout/no-reverse-sync and multi-account boundaries;
- unit/integration tests for malformed data, duplicates, partial failure, retries, session loss, logout, and multiple accounts.

The merge endpoint is `POST /api/user/saved/merge`. It accepts only `{ refs }`, limits each request to 50 refs, derives the viewer from verified claims through the existing User Data service, and returns safe per-ref outcomes. The browser orchestrator chunks larger stores, keeps one run in flight per browser context, and removes confirmed merged refs from the latest store snapshot only.

Current Production does not yet have a broad User Front shell or shared Save UI. `GuestSavedMergeBootstrap` is therefore exported for that future shell but is not mounted globally, especially not under `/admin` or Password Recovery. `/auth/complete` is the currently connected post-auth surface. The adapter remains the future Guest Saved-page data source; this order intentionally does not create a new `/saved` page.

## 14. Approved Product Decisions

Human Review approved these five Product decisions on 2026-09-27:

1. Production Guest Saved uses browser `localStorage` at `muuzee:guest-saved:v1`. This is the smallest implementation for canonical UUID set membership and avoids anonymous server identity.
2. Automatic expiry/TTL is not used. Guest Saved persists until removal, successful merge consumption, or browser data clearing.
3. Each Guest ref is consumed only after successful or already-present Account add. This prevents the same browser Guest state from being attributed to a later account.
4. Logout never reverse-syncs Account Saved into Guest storage. This avoids exposing Account Personal Data after logout on a shared device.
5. Partial failure consumes successful refs and retains failed valid refs. This preserves progress and makes retry idempotent without a server journal.

## 15. Explicit Non-changes

Orders 240 and 242 introduce:

- Migration: 0
- Schema change: 0
- DB operation: 0
- RLS change: 0
- Auth configuration change: 0
- Production adapter/merge/Auth handoff implementation: implemented without schema or DB changes
- Prototype compatibility migration: 0
