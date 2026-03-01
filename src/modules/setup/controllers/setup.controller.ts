import { Controller } from '@nestjs/common';
import { SetupService } from '../services/setup.service';

/**
 * SetupController - 仅负责路由分发、HTTP 状态码和 DTO 校验。
 * 具体落库逻辑由 SetupService 在事务中完成。
 */
@Controller('setup')
export class SetupController {
  constructor(private readonly setupService: SetupService) {}
}
