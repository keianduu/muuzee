---
name: muuzee-image-rights-research
description: Research candidate images and usage rights for Muuzee Exhibitions, Venues, Artists, or Works. Use when asked to find usable images, confirm image rights, investigate press assets, or propose a Primary candidate; do not treat discovery as rights approval.
---

# Muuzee Image Rights Research

## Goal

Find attributable image candidates and preserve enough evidence for a human to judge relevance, Primary selection, and rights separately.

## When to use

Use for image discovery, press-material research, license/terms confirmation, and Primary-image candidate research. Use `muuzee-master-enrichment` as well when the user asks to save candidates or update Master data.

## Workflow

1. Read `AGENTS.md`, `docs/project-context.md`, and the entity-specific image policy in current repository documentation.
2. Confirm the entity identity before researching images.
3. For Exhibition images, search in order: ARTPR, museum official press, exhibition official press, organizer official press, public-domain/open collections, Wikimedia Commons, then direct inquiry. For Venue/Artist/Work, follow the current entity policy instead.
4. A search engine may discover a source, but follow it to the original publisher or file page. Do not use a search result, repost, Pinterest, unofficial blog, social repost, or unknown source as the primary evidence.
5. Capture available metadata without guessing: image URL, source page URL, provider, discovery source, author, credit, reported license, license URL, usage terms, commercial use, modification/cropping, attribution, rights status, and notes.
6. Classify Muuzee rights using the current repository model: `approved` (明確に利用可能), `rejected` (明確に不可), or `needs_review` (記載なし・不明). Preserve raw reported terms separately.
7. Distinguish Candidate relevance, Primary selection, and Rights approval. Selecting or finding an image never changes rights by implication.

## Rules

- Never infer missing permission, attribution, commercial-use, cropping, or share-alike terms.
- Prefer the original file/press page as the Source Page URL.
- For Venue and Artist, preserve an existing Primary. Follow the repository's P18-first/single-fallback policy when applicable; P18 is representative evidence, not proof of identity or permission.
- Verify whether resize, crop, or focal-point processing is allowed when terms make that determinable.
- Keep source/provenance and rights metadata even when the user chooses a Primary.

## Verification

Check that identity is correct, the source is original, the stated license/terms support the classification, missing fields remain unknown, and Candidate/Primary/Rights states are not conflated. For current implementation details, inspect `docs/integrations/wikimedia-commons.md`, `docs/master-data/venue-data-quality-operations.md`, and `docs/master-data/artist-data-quality-operations.md` as relevant.

## Output

Provide a concise candidate table with available evidence and explicit unknowns. State which items still require human judgment; do not describe a legal interpretation as legal advice.
