export type OfficialArtistImageCandidate = {
  qid: string;
  imageUrl: string;
  sourceUrl: string;
  sourceType: string;
  discoverySource: "artist_official" | "museum_official" | "official_press";
  stableIdentifier: string;
  author: string | null;
  credit: string | null;
  reportedLicense: string | null;
  licenseUrl: string | null;
  usageTerms: string | null;
  commercialUse: "allowed" | "forbidden" | "unknown";
  modificationCrop: "allowed" | "forbidden" | "unknown";
  attributionRequirement: "required" | "not_required" | "unknown";
  validUntil: string | null;
  notes: string;
};

// Curated only from pages that visibly identify the image as the artist. An
// official page alone does not imply permission to redistribute the image.
export const TIER_A_OFFICIAL_IMAGE_CANDIDATES: OfficialArtistImageCandidate[] = [
  {
    qid: "Q27917904", imageUrl: "https://miohashimoto.com/img/bg-profile.jpg",
    sourceUrl: "https://miohashimoto.com/profile/", sourceType: "artist_official", discoverySource: "artist_official",
    stableIdentifier: "miohashimoto-profile-bg-profile.jpg", author: null, credit: null, reportedLicense: null, licenseUrl: null,
    usageTerms: null, commercialUse: "unknown", modificationCrop: "unknown", attributionRequirement: "unknown", validUntil: null,
    notes: "本人公式Profileの背景画像。再配布条件の明記を確認できないため利用条件不明。",
  },
  {
    qid: "Q11352469", imageUrl: "https://www.city.otaru.lg.jp/docs/2020111300132/file_contents/ichihara_portrait.png",
    sourceUrl: "https://www.city.otaru.lg.jp/docs/2020111300132/", sourceType: "museum_official", discoverySource: "museum_official",
    stableIdentifier: "ichihara_portrait.png", author: null, credit: "市立小樽美術館 / 小樽市", reportedLicense: null, licenseUrl: null,
    usageTerms: null, commercialUse: "unknown", modificationCrop: "unknown", attributionRequirement: "unknown", validUntil: null,
    notes: "公式ページで『一原有徳の肖像写真』と明記。再配布条件の明記を確認できないため利用条件不明。",
  },
  {
    qid: "Q11464231", imageUrl: "https://www.city.kasaoka.okayama.jp/uploaded/image/4694.jpg",
    sourceUrl: "https://www.city.kasaoka.okayama.jp/site/museum/3162.html", sourceType: "museum_official", discoverySource: "museum_official",
    stableIdentifier: "kasaoka-ono-chikkyo-4694.jpg", author: null, credit: "笠岡市立竹喬美術館 / 笠岡市", reportedLicense: null, licenseUrl: null,
    usageTerms: null, commercialUse: "unknown", modificationCrop: "unknown", attributionRequirement: "unknown", validUntil: null,
    notes: "公式ページで『スケッチをする小野竹喬の写真』と明記。再配布条件の明記を確認できないため利用条件不明。",
  },
];
