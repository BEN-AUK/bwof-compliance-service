import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { type DrizzleDB, DRIZZLE } from '../database.module';
import { profiles } from '../schema/base';

@Injectable()
export class ProfileRepository {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: DrizzleDB,
  ) {}

  async findOrganizationIdByProfileId(
    profileId: string,
  ): Promise<string | null> {
    const [profile] = await this.db
      .select({
        organizationId: profiles.organizationId,
      })
      .from(profiles)
      .where(eq(profiles.id, profileId))
      .limit(1);

    return profile?.organizationId ?? null;
  }
}
