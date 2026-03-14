import { Injectable, Logger } from '@nestjs/common';
import { FrequencyDictRepository } from '../../../common/database/repositories/frequency-dict.repository';
import { SubCategoryRepository } from '../../../common/database/repositories/sub-category.repository';
import type {
  BuildingCompliance,
  EnrichedBuildingCompliance,
} from '../dto/cs-document-analyze-response';

@Injectable()
export class IdFuzzyMatchService {
  private readonly logger = new Logger(IdFuzzyMatchService.name);

  constructor(
    private readonly frequencyDict: FrequencyDictRepository,
    private readonly subCategory: SubCategoryRepository,
  ) {}

  /**
   * Deep copy compliance and append sub_category_match (id + confidence), frequency_dict_id.
   * Original schema unchanged; enrichment is done on a copy.
   */
  async enrichWithMatchedIds(
    compliance: BuildingCompliance,
  ): Promise<EnrichedBuildingCompliance> {
    const copy = JSON.parse(
      JSON.stringify(compliance),
    ) as EnrichedBuildingCompliance;

    for (const ss of copy.specified_systems) {
      const match = await this.subCategory.findMatchBySsCode(
        ss.ss_code,
        ss.system_name,
      );
      if (match) {
        ss.sub_category_match = {
          id: match.best.id,
          confidence_score: match.confidence_score,
          alternatives:
            match.alternatives.length > 0
              ? match.alternatives.map((a) => ({
                  id: a.id,
                  ssCode: a.ssCode,
                  name: a.name,
                }))
              : undefined,
        };
      } else {
        this.logger.debug(
          `No sub_category match for ss_code="${ss.ss_code}" system_name="${ss.system_name}"`,
        );
      }

      for (const sched of ss.inspection_schedules) {
        const freqId = await this.frequencyDict.matchFrequencyId(sched.frequency);
        if (freqId) {
          sched.frequency_dict_id = freqId;
        } else {
          this.logger.debug(
            `No frequency_dict match for frequency="${sched.frequency}"`,
          );
        }
      }
    }

    return copy;
  }
}
