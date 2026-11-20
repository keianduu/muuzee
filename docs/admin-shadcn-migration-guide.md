# Muuzee Admin shadcn/ui migration guide

## Ownership

Muuzee Admin keeps `docs/admin-style-guide.md` and the existing Admin CSS tokens as the visual and interaction source of truth. shadcn/ui supplies implementation primitives; its preset appearance is not the product design.

The migration boundary is:

```text
shadcn primitive (`src/components/ui`)
  -> Muuzee Admin wrapper (`src/components/admin`)
  -> Admin screen (`src/app/admin`)
```

Admin screens must not bypass a Muuzee wrapper merely to adopt a generated primitive. Phase 1A establishes only `Button`, `Input`, `Badge`, and `Card`; current screens continue using their existing components and selectors.

## Foundation contract

- shadcn style/base: `base-rhea` / Base UI
- Tailwind: v4 PostCSS integration
- theme source: Muuzee variables in `src/app/globals.css`, exposed to Tailwind through `@theme inline`
- class helper: `cn` re-exported by `src/lib/utils.ts`
- generated primitives: `src/components/ui/*`
- project-owned wrappers: `src/components/admin/*`

Tailwind Preflight is intentionally disabled. `globals.css` imports only `tailwindcss/theme.css` and `tailwindcss/utilities.css` so generated utilities cannot reset the established Admin element styles. Do not replace those imports with `@import "tailwindcss"` without a separate visual-regression decision.

## Adding or updating a primitive

1. Confirm the wrapper and screen migration belong to the active Order.
2. Run the pinned shadcn CLI version recorded in `package.json` and review every generated diff.
3. Keep generated code in `src/components/ui`; do not copy it into an Admin screen.
4. Map visual values through existing Muuzee semantic tokens. Do not introduce a second color, radius, typography, spacing, or shadow system.
5. Add or update the Muuzee wrapper before changing a screen.
6. Verify keyboard/focus behavior, responsive layout, existing selector contracts, and build impact.

Business logic, API contracts, data access, authorization, and publication behavior are outside a UI primitive migration.
