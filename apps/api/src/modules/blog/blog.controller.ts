import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { BlogService } from './blog.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { JwtUser } from '../common/types/request.types';

@Controller('blog')
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  @Public()
  @Get('public/:slug')
  async getPublicPost(@Param('slug') slug: string) {
    return this.blogService.getBySlug(slug);
  }

  @Get()
  @Roles('psychologist')
  async getMyPost(@CurrentUser() user: JwtUser) {
    return this.blogService.getForTenant(user.tenantId!);
  }

  @Put()
  @Roles('psychologist')
  async upsertPost(
    @Body() body: { title: string; content: string; publishedAt?: string | null },
    @CurrentUser() user: JwtUser,
  ) {
    return this.blogService.upsert(user.tenantId!, {
      title: body.title,
      content: body.content,
      publishedAt: body.publishedAt ? new Date(body.publishedAt) : null,
    });
  }
}
