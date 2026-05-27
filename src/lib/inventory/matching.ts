import type { MatchType } from "@/types/ai";

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export function normalizeForMatch(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

export interface MatchResult {
  itemId: string;
  itemName: string;
  matchType: MatchType;
  score: number;
}

export function findBestMatch(
  candidateName: string,
  existingItems: { id: string; name: string }[]
): MatchResult | null {
  const normalized = normalizeForMatch(candidateName);

  // Exact match first
  const exact = existingItems.find(
    (item) => normalizeForMatch(item.name) === normalized
  );
  if (exact) {
    return { itemId: exact.id, itemName: exact.name, matchType: "exact", score: 1.0 };
  }

  // Fuzzy match: Levenshtein distance ≤ 2
  let bestMatch: MatchResult | null = null;
  for (const item of existingItems) {
    const dist = levenshtein(normalized, normalizeForMatch(item.name));
    const maxLen = Math.max(normalized.length, item.name.length);
    const score = 1 - dist / maxLen;

    if (dist <= 2 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { itemId: item.id, itemName: item.name, matchType: "fuzzy", score };
    }
  }

  return bestMatch;
}
