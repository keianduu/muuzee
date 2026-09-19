"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname,"..");
const sandbox = {window:{},console};
vm.createContext(sandbox);

[
  "prototype/assets/js/muuzee-collection-relations.js",
  "prototype/assets/js/muuzee-artist-collections.js",
  "prototype/assets/js/muuzee-museum-collection.js"
].forEach(file => vm.runInContext(fs.readFileSync(path.join(root,file),"utf8"),sandbox,{filename:file}));

const verified = suffix => ({
  status:"verified",
  source:"test-only",
  sourceUrl:`https://example.invalid/evidence/${suffix}`,
  sourceRecordId:null,
  verifiedAt:"2026-09-19"
});
const input = {
  artists:[{id:"artist-a",name:"Test Artist"}],
  museums:[{id:"museum-a",name:"Test Museum",location:"Test City"}],
  works:[
    {id:"work-a",title:"Verified A",yearText:"1900",publication:{titleStatus:"verified",source:"test-only",sourceUrl:"https://example.invalid/work/a"}},
    {id:"work-b",title:"Placeholder B",yearText:"1901",publication:{titleStatus:"placeholder",source:null,sourceUrl:null}},
    {id:"work-c",title:"Verified C",yearText:"1902",publication:{titleStatus:"verified",source:"test-only",sourceRecordId:"work-c"}}
  ],
  workArtists:[
    {workId:"work-a",artistId:"artist-a",sortOrder:0,verification:verified("artist-a")},
    {workId:"work-a",artistId:"artist-a",sortOrder:1,verification:verified("artist-a-duplicate")},
    {workId:"work-b",artistId:"artist-a",sortOrder:2,verification:verified("artist-b")},
    {workId:"work-c",artistId:"artist-a",sortOrder:3,verification:verified("artist-c")},
    {workId:"work-hidden",artistId:"artist-a",sortOrder:4,verification:verified("missing-work")},
    {workId:"work-a",artistId:"artist-other",sortOrder:5,verification:verified("other-artist")},
    {workId:"work-c",artistId:"artist-a",sortOrder:6,verification:{status:"ambiguous",source:"test-only",sourceUrl:"https://example.invalid/ambiguous"}}
  ],
  holdings:[
    {venueId:"museum-a",workId:"work-a",sortOrder:0,verification:verified("holding-a")},
    {venueId:"museum-a",workId:"work-a",sortOrder:1,verification:verified("holding-a-duplicate")},
    {venueId:"museum-a",workId:"work-b",sortOrder:2,verification:verified("holding-b")},
    {venueId:"museum-a",workId:"work-c",sortOrder:3,verification:verified("holding-c")},
    {venueId:"missing-museum",workId:"work-a",sortOrder:4,verification:verified("missing-museum")},
    {venueId:"museum-a",workId:"work-c",sortOrder:5,verification:{status:"unverified",source:"test-only",sourceUrl:"https://example.invalid/unverified"}}
  ]
};

const gate = sandbox.window.MuuzeeCollectionRelations;
assert.equal(gate.isPublishableRelation({verification:verified("gate")}),true);
assert.equal(gate.isPublishableRelation({verification:{status:"verified",source:"test-only"}}),false);
assert.equal(gate.isPublishableRelation({verification:{status:"unverified",source:"test-only",sourceUrl:"https://example.invalid/no"}}),false);

const artistResult = sandbox.window.MuuzeeArtistCollections.resolve("artist-a",input);
assert.equal(artistResult.items.length,1,"same Museum must be deduplicated");
assert.equal(artistResult.items[0].id,"museum-a");
assert.equal(artistResult.items[0].href,"./museum.html?id=museum-a");
assert.equal(artistResult.items[0].workCount,3,"same Work must not be double-counted");
assert.deepEqual(
  Array.from(artistResult.items[0].works,work => work.displayTitle),
  ["Verified A",null,"Verified C"],
  "only verified Work titles may be published"
);
assert.equal(artistResult.metrics.verifiedWorkArtistCount,4,"duplicate WorkArtist routes must be deduplicated");
assert.equal(artistResult.metrics.verifiedHoldingCount,4,"duplicate Holding routes must be deduplicated");
assert.equal(artistResult.metrics.missingWorkCount,1);
assert.equal(artistResult.metrics.missingVenueCount,1,"missing Venue routes are measured once and suppressed");

const museumResult = sandbox.window.MuuzeeMuseumCollection.resolve("museum-a",input);
assert.equal(museumResult.works.length,3,"Museum resolver API keeps verified unique Works");
assert.equal(museumResult.artists.length,1);
assert.equal(museumResult.artists[0].id,"artist-a");
assert.equal(museumResult.artists[0].workCount,3);
assert.equal(museumResult.works[1].displayTitle,"Test Artistの作品","placeholder title must not be exposed");

const artistPageSource = fs.readFileSync(path.join(root,"prototype/assets/js/artist.js"),"utf8");
assert.doesNotMatch(artistPageSource,/\bmuseums\s*:/,"page-local Museum fixtures must be removed");
assert.doesNotMatch(artistPageSource,/主要所蔵美術館|国内の関連美術館/,"pseudo Museum cards must be removed");
assert.match(artistPageSource,/MuuzeeArtistCollections\?\.resolve\(artist\.id\)/,"Artist stable ID must drive the resolver");
assert.ok(artistPageSource.includes('data-save-id="${esc(museum.id)}"'),"Shared Save must receive the Museum ID");
assert.ok(artistPageSource.includes('href="${esc(museum.href)}"'),"the card link must use the resolver href");

console.log("Order 70 resolver tests passed");
