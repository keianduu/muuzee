# User Data Architecture

Status: Draft architecture contract for Order 180. No migration, Auth configuration, RLS policy, or Production UI implementation is included.

This document is the technical reference for Production user-owned data. Approved product behavior comes from the Notion requirement **Account / Login / Guest Save** and the confirmed Order 80 Public DTO contract. Prototype files are observations only; they are not schema specifications.

## 1. Goals / Non-goals

### Goals

- Separate Supabase Auth identity from Muuzee profile presentation and preferences.
- Define ownership and canonical identifiers for Saved, Seen, Favorite, and ArtWall data.
- Keep all personal relations keyed by Muuzee Master UUIDs rather than display names, titles, slugs, or image URLs.
- Preserve the approved boundary that a guest can Save and open Saved without creating an Account DB row.
- Give Orders 190, 200, 210, 220, 230, and 240 stable ownership and access boundaries.
- Make every authenticated user-owned row compatible with owner-based RLS and account deletion.

### Non-goals

- Creating SQL migrations or modifying the current Supabase schema.
- Choosing Auth providers or login methods; Order 190 owns that decision.
- Implementing Guest Save storage or its Account merge algorithm; Order 240 owns those details.
- Implementing APIs, repositories, RLS, Storage buckets, or Production Personal UI.
- Connecting `prototype/` to Supabase or treating prototype localStorage structures as Production contracts.
- Finalizing Product semantics that are not approved, especially Favorite and Seen history behavior.

## 2. Domain Boundary

Production user data is divided into five responsibilities.

| Boundary | Owns | Does not own |
| --- | --- | --- |
| Auth Identity | Auth user UUID, login email, providers, credentials, recovery, session, auth lifecycle | Display name, avatar presentation, Saved, Seen, Favorite, ArtWall |
| Profile / Preferences | Muuzee-facing profile presentation, private preferences, privacy choices | Credentials or a duplicate login email |
| Personal Actions | Saved, Seen, and Favorite state linked to canonical masters | Master display fields or public content publication |
| My Art / ArtWall | Presentation settings and selected Exhibition membership/order | Seen history itself, copied Exhibition objects, persisted derived counts |
| Canonical Master Data | Exhibition, Artist, Venue, Work identity and display data | Viewer-specific action state |

`prototype/` remains a fixture and interaction reference. Production persistence and data access live under `src/` and Supabase.

## 3. Ownership Model

The Production user identity key is the Auth provider user UUID. With Supabase Auth, authenticated user-owned tables reference `auth.users.id` as `user_id`. A second Muuzee credential/user identity table is not required for MVP.

```mermaid
flowchart TD
  Auth["Supabase Auth user UUID"]
  Profile["Profile presentation"]
  Preferences["Private preferences / privacy choices"]
  Saved["Saved items"]
  Seen["Seen items"]
  Favorite["Favorite items - if retained"]
  Settings["ArtWall settings"]
  Items["ArtWall exhibition items"]
  Avatar["Avatar storage object"]
  Master["Canonical Master UUIDs<br>Exhibition / Artist / Venue / Work"]

  Auth --> Profile
  Auth --> Preferences
  Auth --> Saved
  Auth --> Seen
  Auth --> Favorite
  Auth --> Settings
  Auth --> Items
  Profile --> Avatar
  Saved --> Master
  Seen --> Master
  Favorite --> Master
  Items --> Master
```

Ownership rules:

- Auth user deletion owns deletion of Profile, Preferences, authenticated Personal Actions, and ArtWall rows.
- Profile owns the reference to an avatar object; object deletion needs explicit Storage cleanup because a database cascade does not delete Storage objects.
- Master entities are referenced, not owned, by Personal Actions and ArtWall.
- My Art is a read composition of Profile, Personal Actions, ArtWall, and derived stats. It is not one table.

## 4. Auth vs Profile

### Auth-owned identity

- `user_id` / Auth UUID
- login email
- provider identity
- password, recovery, MFA if introduced
- session and token lifecycle
- auth account deletion lifecycle

Auth remains the Source of Truth for credential and login email. Production must not copy the prototype `email` field into `profiles` as a second credential field.

### Profile presentation

MVP candidate fields are deliberately small:

- `display_name`
- `avatar_object_path`
- timestamps

`avatar_object_path` is a Storage object reference/path, not Base64 and not an expiring signed URL. A candidate Production location is a user-namespaced object in a `profile-avatars` bucket. Bucket access, transformation, and cleanup implementation belong to Order 200 and the account-deletion flow.

### Preferences and private metadata

Preferences are separate from Profile presentation. Prototype candidates include:

- newsletter preference
- notification preference
- friend-search visibility
- country / region / prefecture / city

These fields are not automatically approved for the Production schema. Newsletter consent may require consent audit semantics rather than a simple UI boolean. Location is private by default and must not enter a public profile DTO without a separate opt-in decision.

## 5. Guest vs Authenticated

| Capability | Guest | Authenticated |
| --- | --- | --- |
| Save Exhibition / Venue / Artist / Work | Client-owned persistent state | DB-owned user state |
| Open and remove items from Saved | Yes | Yes |
| Seen | No | Yes; exact semantics remain an Open Decision |
| Favorite / 推し | No Production commitment | Account-owned if Product retains it |
| Profile / Preferences | No | Yes |
| My Art / ArtWall persistence | No | Yes |

### Guest Save boundary

- Guest Save must not require an Auth user or Account DB row.
- Guest records carry only an entity kind plus canonical Master UUID. Display data is hydrated from the Master read contract.
- The guest persistence adapter must be replaceable without changing UI action semantics.

Candidate storage comparison:

| Candidate | Strength | Cost / risk | Order 180 position |
| --- | --- | --- | --- |
| localStorage | Smallest MVP implementation, durable per browser, already proven in prototype | Synchronous, device-local, limited structure | Leading MVP candidate, not finalized |
| IndexedDB | Structured and asynchronous; better for larger offline data | More lifecycle and migration complexity than Saved IDs need | Use only if Order 240 identifies a concrete need |
| guest cookie/session identifier + server rows | Cross-request server identity can support richer sync | Introduces anonymous server ownership, retention, consent, and abuse controls | Not required by the approved Guest Save boundary |

### Guest to Account

Order 180 fixes the input contract only: both guest and authenticated Saved state identify items by canonical entity kind and UUID. Order 240 owns merge timing, idempotency, clearing/retaining the guest store, and conflict behavior. The expected baseline is set union/deduplication by canonical ID, but it is not finalized here.

### Logout

- Logout never deletes account-owned data.
- Account Saved, Seen, Favorite, Profile, and ArtWall remain server-side.
- After logout, account state is no longer exposed to the viewer.
- If device-local Guest Saved state exists, Guest Saved may become visible again. Whether guest state is cleared after a successful merge is delegated to Order 240.

## 6. Personal Action Matrix

| Action | Product meaning | Candidate targets | Auth boundary | Persistence shape | Status |
| --- | --- | --- | --- | --- | --- |
| Saved | Keep content for later access | Exhibition, Venue/Museum, Artist, Work | Guest + authenticated | Current set membership; one row per user/entity for accounts | Approved boundary |
| Seen / 観た | Personal acknowledgement of having seen/visited something | Prototype shows Exhibition, Venue, Artist, Work | Authenticated only | Separate table; state vs repeat history is unresolved | Partially approved |
| Favorite / 推し | Strong affinity distinct from Saved | Prototype shows Artist and Venue | Authenticated if retained | Separate table; do not alias to Saved | Product meaning and targets unresolved |

### Seen boundary

Seen is not Guest state and must remain separate from ArtWall membership. A timestamp is needed if the Product uses chronology or visit history, but the following decision blocks the final Order 210 schema:

- current state with one `seen_at` per user/entity, or
- repeatable events with multiple visits and optional first/last aggregation.

Until Product decides, this document recommends a separate `user_seen_items` boundary and reserves `seen_at`, without treating prototype sample dates as approved history semantics.

### Favorite boundary

Favorite is not a Saved alias. Prototype Artist/Venue fixtures demonstrate UI possibilities only. Order 210 must not create `user_favorite_items` until Product confirms meaning, supported targets, and its relationship to My Art.

## 7. Candidate Data Model

This is a conceptual model, not migration SQL. All timestamps use timezone-aware values. Auth-owned foreign keys cascade on account deletion. Master foreign keys use `RESTRICT` for hard delete so a canonical entity cannot silently disappear from user history; archive/unpublish remains the normal Master lifecycle.

### `profiles`

| Field / rule | Candidate contract |
| --- | --- |
| Primary key | `user_id` |
| User relation | `user_id → auth.users.id`, one-to-one, `ON DELETE CASCADE` |
| Fields | `display_name`, `avatar_object_path`, `created_at`, `updated_at` |
| Excluded | credential email, provider, password/recovery fields |

### `user_preferences`

| Field / rule | Candidate contract |
| --- | --- |
| Primary key | `user_id` |
| User relation | `user_id → auth.users.id`, one-to-one, `ON DELETE CASCADE` |
| Candidate fields | notification/newsletter/privacy/location preferences after Product and legal review |
| Default exposure | private |

### `user_saved_items`

| Field / rule | Candidate contract |
| --- | --- |
| Primary key | UUID `id` |
| Owner | required `user_id → auth.users.id`, `ON DELETE CASCADE` |
| Entity references | nullable `exhibition_id`, `artist_id`, `venue_id`, `work_id` |
| Integrity | exactly one entity FK is non-null |
| Uniqueness | partial unique key for each `(user_id, entity_id)` target |
| Timestamps | `created_at`; update timestamp is unnecessary for set membership unless later required |
| Master delete | `RESTRICT` |
| Query index | `(user_id, created_at desc)` plus target FK indexes |

### `user_seen_items`

| Field / rule | Candidate contract |
| --- | --- |
| Primary key | UUID `id` |
| Owner | required `user_id → auth.users.id`, `ON DELETE CASCADE` |
| Entity references | explicit nullable Master FKs; final supported columns depend on Product decision |
| Integrity | exactly one entity FK is non-null |
| State candidate | one row per user/entity with `seen_at` |
| History candidate | repeat event rows; requires a separate event identity and different uniqueness |
| Master delete | `RESTRICT` |

### `user_favorite_items`

| Field / rule | Candidate contract |
| --- | --- |
| Creation gate | only if Product retains Favorite |
| Primary key / owner | UUID `id`; required `user_id`, `ON DELETE CASCADE` |
| Entity references | explicit nullable Master FKs for approved targets only |
| Integrity / uniqueness | exactly one entity FK; one current Favorite per user/entity |
| Master delete | `RESTRICT` |

### `user_artwall_settings`

MVP assumes one ArtWall presentation per authenticated user. The table uses `user_id` as its primary key and account-deletion cascade boundary. Candidate explicit columns are:

- `show_icon`
- `title`
- `comment`
- `background_key`
- `columns`
- `wall_height_mode`
- `created_at`, `updated_at`

These presentation fields are observed in the prototype, not all Product-approved. Order 210 or a dedicated ArtWall schema task must include only approved fields and validate values with explicit columns/checks rather than an unconstrained JSON settings bag.

### `user_artwall_items`

| Field / rule | Candidate contract |
| --- | --- |
| Primary key | UUID `id` |
| Owner | required `user_id → auth.users.id`, `ON DELETE CASCADE` |
| Membership | required `exhibition_id → exhibitions.id`, `ON DELETE RESTRICT` |
| Uniqueness | one `(user_id, exhibition_id)` row |
| Ordering | integer `sort_order`; deterministic read order is `sort_order, id` |
| Visibility | `is_visible` preserves a selected item while hiding it from the wall |
| Timestamps | `created_at`, `updated_at` |
| Query index | `(user_id, sort_order, id)` |

`sort_order` does not need to be globally unique. Avoiding a uniqueness constraint permits simple transactional reorder updates; deterministic `id` tie-breaking prevents unstable reads.

### Why separate action tables

Two designs were compared:

| Concern | Separate `user_saved_items` / `user_seen_items` / `user_favorite_items` | Generic `user_entity_actions` |
| --- | --- | --- |
| RLS | Direct owner policy per action | Direct owner policy but broader mixed-purpose table |
| Uniqueness | Matches each action's semantics | Conditional uniqueness across action types |
| Indexes / queries | Small, action-specific indexes and simple reads | Every query filters `action_type`; indexes become composite/conditional |
| Action-specific fields | Seen timestamps/history can evolve independently | Nullable action-specific columns or JSON are likely |
| Guest merge | Saved merge stays isolated | Merge must protect unrelated action types |
| Migration | More tables, clearer constraints | Fewer tables, more generic constraints and coupling |

Recommendation: separate tables by action. Saved, Seen, and Favorite have different Product meaning and lifecycle. A generic table reduces table count but increases conditional constraints and makes future Seen history harder.

Within each action table, explicit nullable Master FKs plus an exactly-one check are preferred over `entity_type + entity_id`. This preserves database FK integrity and follows the current Master Data architecture. Creating one table per action *and* per entity would provide the strongest simple FKs but multiplies repositories, RLS policies, and guest merge paths without a current need.

## 8. ArtWall Persistence

ArtWall is composed from four layers:

```text
Seen / visit source history
        ↓ derive candidates
User-selected ArtWall membership and order
        +
ArtWall presentation settings
        ↓ hydrate by canonical Exhibition UUID
Visual ArtWall + derived stats
```

- Source history and ArtWall membership are separate. Removing an item from the wall does not erase Seen history.
- Membership rows reference canonical Exhibition UUIDs only.
- Exhibition title, image URL, Venue name, or fixture order must not be copied into user tables.
- Rendering hydrates current public display data from the canonical Exhibition read model.
- ArtWall membership/order uses relation rows, not a JSON UUID array. Rows preserve FK integrity, support RLS and per-item updates, and make hidden membership explicit.
- ArtWall stats are calculated from Personal Actions plus canonical relations. MVP does not create a duplicated `user_stats` table.
- If performance later requires a cache/materialized projection, it must be rebuildable and never become the ownership Source of Truth.

## 9. Canonical Master References

Personal tables use UUID foreign keys to:

- `exhibitions.id`
- `artists.id`
- `venues.id` for the Museum UI concept
- `works.id`

They never use title, name, slug, external source ID, or image URL as a relation key. Slugs remain URL identifiers and can change independently of user relations. Display values always come from Master DTOs.

Public Content and Viewer State remain separate contracts:

```text
Public Content DTO (cacheable canonical content)
        +
ViewerEntityStateDTO (guest or authenticated actions keyed by UUID)
        ↓
UI
```

Public DTOs must not gain `isSaved`, `isSeen`, or `isFavorite` fields. The viewer-state layer composes those flags at the application boundary.

## 10. Delete / Retention

### Account deletion

1. Authenticate and authorize the deletion request.
2. Delete or schedule deletion of the user's avatar Storage objects.
3. Delete the Auth user through the approved privileged account lifecycle.
4. `ON DELETE CASCADE` removes Profile, Preferences, Personal Actions, ArtWall settings, and ArtWall items.
5. Verify no user-owned rows or avatar objects remain, subject to a separately approved legal/audit retention policy.

Logout is not deletion and performs none of these steps.

### Master lifecycle

- Archive/unpublish is preferred to hard deletion and leaves UUID integrity intact.
- Personal action and ArtWall FKs use `RESTRICT` for hard delete in the candidate model.
- A personal list may need an unavailable/archived state rather than silently dropping an item; the exact UX is an Open Decision.
- Admin destructive deletion must account for user references before a future hard-delete operation is allowed.

### Guest retention

Guest Saved state is owned by the browser/device, not by an Auth account. Account deletion therefore does not automatically clear unrelated device-local Guest Saved state. Order 240 must define local expiry, clear controls, and post-merge retention.

## 11. Privacy / RLS Implications

| Data | Default | Future exposure |
| --- | --- | --- |
| Saved | Private | No public scope approved |
| Seen | Private | No public scope approved |
| Favorite | Private | Meaning and public scope unresolved |
| Preferences / location | Private | Location requires explicit field-level Product/privacy decision |
| Profile display name / avatar | Private to authenticated experience until a public profile contract exists | Potential public opt-in |
| ArtWall | Private | Public sharing is an explicit future opt-in decision |

Every authenticated user-owned table has a direct `user_id` so Order 230 can implement owner policies equivalent to `auth.uid() = user_id`. User Front access must not depend on a service-role client. Privileged service-role operations are limited to server-only account lifecycle or controlled maintenance paths.

Child rows should not rely solely on an application-supplied owner. Inserts/updates must be checked by RLS, and any server repository must derive the viewer user ID from the authenticated session rather than accepting an arbitrary client `user_id`.

## 12. Data Access Boundary

Production UI does not know Supabase table names or joins. A candidate responsibility split is:

```text
src/lib/user/
  profile repository and commands
  personal-action repositories
  ArtWall repository
  guest Saved adapter contract

src/lib/viewer/
  compose ViewerEntityStateDTO for canonical entity IDs

src/app/ route handlers or server actions
  authenticated request boundary, validation, error mapping
```

The exact filenames are Order 220 implementation details. The fixed contract is:

- read viewer state by a bounded set of canonical IDs;
- create/remove Saved and approved Personal Actions idempotently;
- read/update Profile, Preferences, and ArtWall through domain functions;
- keep guest persistence behind the same Saved semantics without pretending it is an account repository;
- return typed domain/DTO values rather than raw database rows;
- map Loading / Empty / Error / Retry behavior at the consumer boundary.

## 13. Migration Dependencies

| Order | Receives from Order 180 | Must decide / implement |
| --- | --- | --- |
| 190 Auth | Auth UUID is the Production identity key; Guest Save does not need an account | Provider, login methods, session/recovery, account deletion entry point |
| 200 Profile | Profile and Preferences are separate from Auth credentials; avatar is a Storage object reference | migrations, profile creation lifecycle, approved MVP fields, avatar bucket/cleanup |
| 210 Personal schema | separate action tables, explicit Master FKs, exactly-one checks, account cascade and Master restrict; ArtWall settings/items are separate from Seen | Personal Action and ArtWall migrations/indexes after resolving the relevant Product blockers |
| 240 Guest merge | guest payload and account Saved share canonical kind + UUID identity | storage choice, union/conflict algorithm, idempotency, post-merge and logout behavior |
| 220 Data access | UI never reads tables directly; Public DTO and Viewer State stay separate | repositories/API/server actions, validation, retry/error contract |
| 230 RLS | every authenticated row has direct `user_id`; no service-role User Front | policies and owner/anonymous authorization tests |

Migration order should be 190 decision → 200 Profile foundation → 210 Personal tables → 240 merge policy → 220 access layer → 230 authorization, matching the approved Production foundation sequence. No migration is created by Order 180.

## 14. Open Product Decisions

The following must remain explicit and must not be inferred from prototype fixtures:

1. Favorite / 推し Product meaning and how it differs from Saved.
2. Favorite target entities and whether Favorite remains in MVP.
3. Seen meaning and supported entity targets.
4. Seen as current state versus repeatable visit/view events, including timestamp semantics.
5. Public profile scope and which fields can be exposed.
6. Location collection purpose, granularity, retention, and public/private scope.
7. ArtWall initial generation rule from Seen/history.
8. ArtWall maximum item count.
9. Which prototype presentation settings are Product-approved for persistence.
10. Guest Save storage implementation, expiry, clear behavior, and cross-device expectations.
11. Guest Saved retention after a successful Account merge and behavior after logout.
12. UX for Personal Actions that reference an archived/unpublished Master.
13. Whether public/shared ArtWall is in MVP; default remains private until decided.

These decisions do not change the ownership model or canonical UUID strategy. They gate the relevant columns, target checks, and API behavior in downstream tasks.

## Current State Investigation

- Current migrations and generated schema contain canonical Master/Admin tables only; there are no Profile, user-owned Personal Action, ArtWall, or Auth-user FK tables and no existing `auth.uid()` RLS policies.
- Prototype Saved is split across localStorage keys and includes name/title-based Work/Artist values in places. That is fixture behavior and is not Production identity design.
- Prototype Seen stores `{type, id, date}` objects and includes Exhibition, Museum, Artist, and Work samples. Product approves authenticated-only Seen, but not this target matrix or date semantics.
- Prototype Favorite stores Artist/Museum samples. Its Product meaning is not approved.
- Prototype Profile stores nickname, credential-like email, Base64/avatar URL, preferences, and location in one localStorage object. Production separates Auth email, Profile, Preferences, and Storage avatar ownership.
- The shared prototype ArtWall store already demonstrates the desired ID-only boundary for committed membership/order and separates presentation from catalog hydration. Its exact presentation fields remain candidates.
