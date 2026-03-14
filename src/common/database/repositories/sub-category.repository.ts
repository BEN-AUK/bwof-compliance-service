import { Inject, Injectable } from '@nestjs/common';
import { type DrizzleDB, DRIZZLE } from '../database.module';
import { subCategory } from '../schema/base';

export type SubCategoryRow = {
  id: string;
  ssCode: string;
  name: string;
  aliases: string[];
};

export type SubCategoryMatchResult = {
  best: { id: string; ssCode: string; name: string };
  alternatives: Array<{ id: string; ssCode: string; name: string }>;
  confidence_score: number;
};

/** Normalize ss_code for comparison: trim, lowercase, treat "-" and "/" as equivalent. */
function normalizeSsCode(code: string): string {
  return code
    .trim()
    .toLowerCase()
    .replace(/-/g, '/');
}

/** Check if input code matches db code: exact (after norm) or prefix. */
function codesMatch(inputNorm: string, dbNorm: string): boolean {
  if (inputNorm === dbNorm) return true;
  if (dbNorm.startsWith(inputNorm + '/')) return true;
  if (inputNorm.startsWith(dbNorm + '/')) return true;
  return false;
}

/** Simple overlap: count shared words between systemName and name/aliases. */
function nameOverlapScore(systemName: string, name: string, aliases: string[]): number {
  const sysWords = new Set(
    systemName
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 1),
  );
  const targets = [name.toLowerCase(), ...aliases.map((a) => a.toLowerCase())];
  let maxScore = 0;
  for (const t of targets) {
    const tWords = t.split(/\s+/).filter((w) => w.length > 1);
    let overlap = 0;
    for (const w of tWords) {
      if (sysWords.has(w) || [...sysWords].some((s) => s.includes(w) || w.includes(s)))
        overlap++;
    }
    maxScore = Math.max(maxScore, overlap);
  }
  return maxScore;
}

@Injectable()
export class SubCategoryRepository {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: DrizzleDB,
  ) {}

  async findAll(): Promise<SubCategoryRow[]> {
    const rows = await this.db.select().from(subCategory);
    return rows.map((r) => ({
      id: r.id,
      ssCode: r.ssCode,
      name: r.name,
      aliases: (r.aliases ?? []).filter((a) => a && a.trim()),
    }));
  }

  /**
   * Match AI ss_code (+ optional systemName) to sub_category.
   * - 100: exact ss_code match
   * - 90: not exact but only 1 candidate (e.g. "SS 8-1" -> "SS 8/1")
   * - 60: multiple candidates, return best + alternatives
   */
  async findMatchBySsCode(
    ssCode: string,
    systemName?: string,
  ): Promise<SubCategoryMatchResult | null> {
    const all = await this.findAll();
    const inputNorm = normalizeSsCode(ssCode);

    const candidates = all.filter((row) => codesMatch(inputNorm, normalizeSsCode(row.ssCode)));

    if (candidates.length === 0) return null;

    if (candidates.length === 1) {
      const exact = normalizeSsCode(candidates[0].ssCode) === inputNorm;
      return {
        best: {
          id: candidates[0].id,
          ssCode: candidates[0].ssCode,
          name: candidates[0].name,
        },
        alternatives: [],
        confidence_score: exact ? 100 : 90,
      };
    }

    const sorted = [...candidates].sort((a, b) => {
      const scoreA = systemName
        ? nameOverlapScore(systemName, a.name, a.aliases)
        : 0;
      const scoreB = systemName
        ? nameOverlapScore(systemName, b.name, b.aliases)
        : 0;
      return scoreB - scoreA;
    });

    const best = sorted[0];
    const alternatives = sorted.slice(1).map((r) => ({
      id: r.id,
      ssCode: r.ssCode,
      name: r.name,
    }));

    return {
      best: { id: best.id, ssCode: best.ssCode, name: best.name },
      alternatives,
      confidence_score: 60,
    };
  }
}
