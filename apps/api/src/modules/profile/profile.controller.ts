import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuditLog } from '../common/decorators/audit-log.decorator';
import type { JwtUser } from '../common/types/request.types';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Public()
  @Get('public/:slug')
  async getPublicProfile(@Param('slug') slug: string) {
    return this.profileService.getBySlug(slug);
  }

  @Get()
  @Roles('psychologist')
  async getMyProfile(@CurrentUser() user: JwtUser) {
    return this.profileService.getByUserId(user.userId!, user.tenantId!);
  }

  @Put()
  @Roles('psychologist')
  @AuditLog({ action: 'update', resourceType: 'profile' })
  async updateProfile(
    @Body() dto: UpdateProfileDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.profileService.update(
      user.userId!,
      user.tenantId!,
      dto,
    );
  }

  @Post('photo/upload-url')
  @Roles('psychologist')
  async getPhotoUploadUrl(
    @Query('filename') filename: string,
    @Query('contentType') contentType: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.profileService.generatePhotoUploadUrl(
      user.userId!,
      user.tenantId!,
      filename ?? 'photo.jpg',
      contentType ?? 'image/jpeg',
    );
  }

  @Post('photo/confirm')
  @Roles('psychologist')
  async confirmPhotoUpload(
    @Body('key') key: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.profileService.setPhotoKey(
      user.userId!,
      user.tenantId!,
      key,
    );
  }
}
