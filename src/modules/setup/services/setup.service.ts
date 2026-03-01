import { Injectable } from '@nestjs/common';

/**
 * SetupService - 承载 buildings / documents / category / inspections 的联合落库事务。
 * 未来在此实现：单次事务内写入多表，并注入 created_by_id / last_modified_by_id。
 * 禁止物理删除，使用状态机 + archived_at 软删除。
 */
@Injectable()
export class SetupService {}
