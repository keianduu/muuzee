# User Data Access Layer

Status: Order 220 implementation contract. The typed layer and unit tests are implemented; authenticated database authorization remains blocked on Order 230 owner RLS policies.

## 1. Scope

This layer provides the server-side Account data boundary for:

- Profile and private Preferences;
- Saved, Seen, and Favorite Personal Actions;
- bounded Viewer State composition;
- private ArtWall settings, Seen-eligible membership, order, and visibility.

It does not implement Login/Register UI, Auth callback routes, Guest Saved persistence or merge, Public Content hydration, HTTP routes, public/shared ArtWall, RLS policies, or service-role access.

## 2. Layering

```text
User Front / Server Component / Server Action
                    |
                    v
        src/lib/user/service.ts
  verified claims.sub, validation, domain rules,
  DTO composition, safe errors and retry contract
                    |
                    v
      src/lib/user/repository.ts
  Supabase table/query details and raw-row mapping
                    |
                    v
  cookie-aware Supabase user client + future owner RLS
```

Public Content stays separate:

```text
Public Content DTO (canonical, cacheable)
        +
ViewerEntityStateDTO (private, request-scoped)
        -> UI composition
```

Public DTOs must not receive `isSaved`, `isSeen`, or `isFavorite` fields.

## 3. Supabase clients and identity

| Boundary | File | Responsibility |
| --- | --- | --- |
| Browser | `src/lib/supabase/client.ts` | Cookie-aware publishable/anon-key client for future Client Components |
| Server | `src/lib/supabase/server.ts` | Per-request cookie-aware client for Server Components, Server Actions, and Route Handlers |
| Refresh | `src/lib/supabase/middleware.ts`, root `middleware.ts` | Verify/refresh the session and propagate request/response cookies only |
| Admin | `src/lib/supabase/admin.ts` | Existing elevated maintenance boundary; prohibited from normal User Data access |

The repository keeps the current `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` environment contract. Key-name migration is a separate operational change.

Normal User Data access calls `auth.getClaims()` and derives the owner UUID from verified `claims.sub`. Public service operations do not accept `userId`. `getSession().user` is not an authorization source. A fresh `getUser()` lookup is reserved for sensitive account-lifecycle work outside this order.

The Next.js 15 middleware does not redirect or protect routes. Route UX remains downstream; authorization is enforced at the data boundary and, after Order 230, by RLS.

## 4. DTO and operation contract

`src/lib/user/types.ts` owns camelCase domain contracts. Raw database rows and snake_case fields never leave the repository.

### Profile and Preferences

- Profile: read and partial update of `displayName` and `avatarObjectPath` only.
- Preferences: read and partial update of `notificationEnabled`, `newsletterEnabled`, `countryCode`, `region`, `prefecture`, and `city` only.
- Auth email, provider identity, credential fields, and signed avatar URLs are excluded.
- Location remains private and is not part of Public Profile/Public Content DTOs.

### Personal Actions

| Action | Supported targets | Semantics |
| --- | --- | --- |
| Saved | Exhibition, Artist, Venue, Work | current set membership |
| Seen | Exhibition, Artist, Venue, Work | current set membership |
| Favorite | Artist, Venue | current set membership; distinct from Saved |

Each action provides typed list/add/remove operations. Entity references use canonical UUIDs only. Favorite Exhibition/Work is rejected as `invalid_target` before a query is issued.

Repository row mapping requires exactly one populated entity FK. A zero-target or multiple-target row is reported as `data_integrity`; the layer never guesses an entity type.

### Viewer State

`getViewerEntityStates(refs)`:

- accepts at most 100 canonical references per call;
- validates and deduplicates the input before querying;
- queries Saved/Seen/Favorite only for the requested IDs;
- never performs a whole-account scan for this operation;
- always returns `isFavorite: false` for Exhibition and Work.

The 100-reference bound is a technical request guard, not a Product list or ArtWall maximum.

### ArtWall

- Settings read/update exactly the six approved fields: icon, title, comment, background key, columns, and wall-height mode.
- Item reads are deterministic: `sort_order ASC, id ASC`.
- Candidate IDs come only from `user_seen_items.exhibition_id IS NOT NULL`.
- Current ArtWall composition returns persisted items intersected with the current Seen Exhibition set.
- Unseeing an Exhibition does not delete its persisted ArtWall row. It becomes ineligible and can become visible again if Seen is restored.
- Desired-set save accepts only `{ exhibitionId, sortOrder, isVisible }`, rejects duplicate Exhibition IDs, negative/non-integer sort positions, and non-Seen Exhibitions.
- Persistence converges by upserting desired rows and deleting rows absent from the desired set. Retrying the same desired set is safe. Duplicate sort positions remain valid.

No Exhibition title, image, Venue, Artist, fixture order, or derived stats are copied into User Data.

## 5. Idempotency

- Adding an existing Personal Action is success/no-op only when PostgreSQL reports `23505` for the exact expected partial unique constraint for that action and entity kind.
- An unrelated unique violation is not swallowed and becomes `data_integrity`.
- Removing a missing Personal Action is success/no-op because the owner/target delete has no required affected-row count.
- ArtWall desired-set persistence is retry-safe and convergent without adding an RPC or new database transaction abstraction. A partial failure may be retried with the same complete desired set.

## 6. Error and retry contract

Consumers receive `UserDataError` only:

| Code | Retryable | Meaning |
| --- | --- | --- |
| `unauthenticated` | No | verified identity is absent/invalid |
| `invalid_input` | No | malformed fields, IDs, batch, or desired set |
| `invalid_target` | No | action/domain target is unsupported or ineligible |
| `forbidden` | No | authorization/policy refusal |
| `not_found` | No | required account row is absent |
| `temporary` | Yes | transient/unknown provider failure; consumer may offer retry |
| `data_integrity` | No | stored row/constraint result cannot be interpreted safely |

Raw SQL, PostgREST/Auth messages, JWTs, cookies, tokens, stack traces, and provider hints are not returned to User Front. Retry is an explicit consumer choice for `retryable: true`; the DAL does not introduce hidden retry loops that could duplicate mutations.

## 7. RLS and current execution status

All eight User Data tables have RLS enabled and currently have zero owner policies. Consequently:

- Order 220 unit-tests domain/session/repository behavior with fakes and static dependency guards;
- it does not bypass RLS with `SUPABASE_SERVICE_ROLE_KEY`;
- it does not claim live end-to-end authenticated database access;
- Order 230 must add owner SELECT/INSERT/UPDATE/DELETE policies and real anonymous/cross-user/owner authorization tests before this DAL is connected to User Front.

The normal User Data modules contain no import of the Admin client and no service-role environment access.

## 8. Guest boundary

Guest Save is not an Account repository operation. Guest browsing creates no Supabase Auth row, and this layer does not read localStorage or merge device state. Order 240 owns the client persistence adapter, expiry/clear behavior, Guest-to-Account union, retry/idempotency, post-merge cleanup, and logout behavior.

## 9. Downstream integration

- **Order 230:** owner RLS policies and real authorization/integration tests.
- **Order 240:** Guest Saved adapter and Account merge.
- **User Front wiring:** consume typed service/DTOs through Server Actions or Route Handlers after RLS is available; do not import repository/table names into components.
- **Public Content hydration:** combine canonical Public DTOs with request-scoped Viewer State at the application boundary.

## 10. Implementation evidence

Tests cover verified claims identity, missing/invalid claims, Favorite target validation, four-target Saved/Seen, expected duplicate add, missing remove, safe error mapping, retryability, no arbitrary public `userId`, exactly-one row mapping, bounded/deduplicated Viewer State, DTO separation, ArtWall ordering/Seen eligibility/validation/retry convergence, and the Admin/service-role dependency guard.

Official guidance checked for this implementation:

- [Supabase Server-Side Rendering](https://supabase.com/docs/guides/auth/server-side)
- [Creating a Supabase client for SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs)
- [Supabase `getClaims()`](https://supabase.com/docs/reference/javascript/auth-getclaims)
- [Next.js 15 Authentication / DAL guidance](https://nextjs.org/docs/15/pages/guides/authentication)
