type RobotsGroup = { agents: string[]; allow: string[]; disallow: string[]; crawlDelay: number | null };

function pathMatches(pathname: string, rule: string) {
  if (!rule) return false;
  const anchored = rule.endsWith("$");
  const raw = anchored ? rule.slice(0, -1) : rule;
  const escaped = raw.replace(/[|\\{}()[\]^$+?.]/g, "\\$&").replaceAll("*", ".*");
  return new RegExp(`^${escaped}${anchored ? "$" : ""}`).test(pathname);
}

export function parseRobots(text: string) {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line.includes(":")) continue;
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (key === "user-agent") {
      if (!current || current.allow.length || current.disallow.length || current.crawlDelay != null) {
        current = { agents: [], allow: [], disallow: [], crawlDelay: null };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if (current && key === "allow") current.allow.push(value);
    else if (current && key === "disallow") current.disallow.push(value);
    else if (current && key === "crawl-delay") current.crawlDelay = Number(value) || null;
  }
  return groups;
}

export function robotsDecision(text: string, url: URL, userAgent = "MuuzeeOfficialVenueCrawler") {
  const groups = parseRobots(text);
  const agent = userAgent.toLowerCase();
  const specific = groups.filter((group) => group.agents.some((value) => value !== "*" && agent.includes(value)));
  const applicable = specific.length ? specific : groups.filter((group) => group.agents.includes("*"));
  const rules = applicable.flatMap((group) => [
    ...group.allow.map((value) => ({ allow: true, value })),
    ...group.disallow.map((value) => ({ allow: false, value })),
  ]).filter((rule) => pathMatches(url.pathname, rule.value)).sort((a, b) => b.value.length - a.value.length);
  return {
    allowed: rules[0]?.allow ?? true,
    crawlDelayMs: Math.max(500, ...applicable.map((group) => (group.crawlDelay || 0) * 1000)),
  };
}
