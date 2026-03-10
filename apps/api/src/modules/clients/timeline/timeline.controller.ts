import { Controller, Get, Param, Query } from '@nestjs/common';
import { TimelineService } from './timeline.service';
import { TimelineQueryDto } from './dto/timeline-query.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtUser } from '../../common/types/request.types';

@Controller('clients/:clientId/timeline')
@Roles('psychologist', 'assistant')
export class TimelineController {
  constructor(private readonly timelineService: TimelineService) {}

  @Get()
  async getTimeline(
    @Param('clientId') clientId: string,
    @Query() query: TimelineQueryDto,
    @CurrentUser() user: JwtUser,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    return this.timelineService.getTimeline(
      clientId,
      user.tenantId,
      page,
      limit,
    );
  }
}
