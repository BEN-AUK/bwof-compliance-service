import { Injectable, OnModuleInit } from '@nestjs/common';
import type { z } from 'zod';
import { buildBuildingComplianceSchema } from '../dto/cs-document-analyze-response';
import type { BuildingCompliance } from '../dto/cs-document-analyze-response';
import { FrequencyDictRepository } from '../../../common/database/repositories/frequency-dict.repository';

@Injectable()
export class BuildingComplianceSchemaService implements OnModuleInit {
  private schema: z.ZodType<BuildingCompliance> | null = null;

  constructor(private readonly frequencyDict: FrequencyDictRepository) {}

  async onModuleInit(): Promise<void> {
    const names = await this.frequencyDict.findAllNames();
    this.schema = buildBuildingComplianceSchema(names);
  }

  getSchema(): z.ZodType<BuildingCompliance> {
    if (!this.schema) {
      throw new Error(
        'BuildingComplianceSchemaService not initialized: getSchema() called before onModuleInit',
      );
    }
    return this.schema;
  }
}
