# Wikidata integration

Status: Draft for Venue Enrichment v0.

Muuzee uses the stable MediaWiki Action API at `https://www.wikidata.org/w/api.php`.

- `wbsearchentities` discovers up to five candidates from the current venue name.
- `wbgetentities` reads Japanese/English labels, aliases, descriptions, and claims.
- v0 normalizes P856 (official website), P625 (coordinates), P18 (Commons file title), and P17 (country).

Search output is never accepted by position alone. `src/lib/wikidata/matcher.ts` owns scoring and `src/lib/venue-enrichment/policy.ts` owns the shared entity/candidate thresholds. Only high-confidence results are automatically linked; other candidates require Admin adoption. Raw entity payloads are retained through `source_records`.

Entity identity, P625 coordinate use, P18 Primary selection, and rights approval are separate states. Any non-rejected search result may provide a coordinate or image candidate before entity confirmation, including below `0.60`. Coordinates still require their source-application policy; a usable P18 may become Primary under the shared Venue / Artist P18-first policy when no Primary exists, without confirming identity or approving rights. Admin stores the candidate confidence/found threshold and a trace showing which QIDs had coordinates and at which configured threshold P18 first appeared.

Requests use a Muuzee user agent, timeout, bounded retry/backoff, and sequential batch pacing. Production hard-coded Q-IDs are not used.

Official references:

- https://www.wikidata.org/wiki/Help:Data_access
- https://www.mediawiki.org/wiki/API:Main_page
