import { Inject, Injectable } from '@nestjs/common';
import { asc } from 'drizzle-orm';
import { type DrizzleDB, DRIZZLE } from '../database.module';
import { frequencyDict } from '../schema/base';

export type FrequencyDictRow = {
  id: string;
  name: string;
  displayName: string;
};

@Injectable()
export class FrequencyDictRepository {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: DrizzleDB,
  ) {}

  /** Returns all frequency names ordered by expected_slots_per_year ascending. */
  async findAllNames(): Promise<string[]> {
    const rows = await this.db
      .select({ name: frequencyDict.name })
      .from(frequencyDict)
      .orderBy(asc(frequencyDict.expectedSlotsPerYear));

    return rows.map((r) => r.name);
  }

  /** Returns all rows with id, name, displayName for fuzzy matching. */
  async findAllWithIds(): Promise<FrequencyDictRow[]> {
    const rows = await this.db
      .select({
        id: frequencyDict.id,
        name: frequencyDict.name,
        displayName: frequencyDict.displayName,
      })
      .from(frequencyDict)
      .orderBy(asc(frequencyDict.expectedSlotsPerYear));

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      displayName: r.displayName,
    }));
  }

  /** Match AI frequency text (already validated) to frequency_dict id. Returns id or null. */
  async matchFrequencyId(text: string): Promise<string | null> {
    const rows = await this.findAllWithIds();
    const normalized = text.trim().toLowerCase();

    for (const row of rows) {
      if (row.name === normalized) return row.id;
      if (row.displayName.toLowerCase() === normalized) return row.id;
    }
    return null;
  }
}
