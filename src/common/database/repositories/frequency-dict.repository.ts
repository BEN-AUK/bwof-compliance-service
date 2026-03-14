import { Inject, Injectable } from '@nestjs/common';
import { asc } from 'drizzle-orm';
import { type DrizzleDB, DRIZZLE } from '../database.module';
import { frequencyDict } from '../schema/base';

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
}
