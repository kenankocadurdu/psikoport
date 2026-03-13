import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { FilesService } from './files.service';
import { UploadUrlDto } from './dto/upload-url.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AssistantForbidden } from '../../common/decorators/assistant-forbidden.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtUser } from '../../common/types/request.types';

@Controller('clients/:clientId/files')
@Roles('psychologist', 'assistant')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @AssistantForbidden()
  @Post('upload-url')
  async getUploadUrl(
    @Param('clientId') clientId: string,
    @Body() dto: UploadUrlDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.filesService.getUploadUrl(
      clientId,
      user.tenantId,
      user.sub,
      dto.fileName,
      dto.contentType,
      dto.fileSize,
    );
  }

  @AssistantForbidden()
  @Post('generate-upload-url')
  async generateUploadUrl(
    @Param('clientId') clientId: string,
    @Body() body: { fileName: string; mimeType: string; fileSize: number },
    @CurrentUser() user: JwtUser,
  ) {
    return this.filesService.generateUploadUrl(
      user.tenantId,
      clientId,
      body.fileName,
      body.mimeType,
    );
  }

  @AssistantForbidden()
  @Post('confirm')
  async confirmUpload(
    @Param('clientId') clientId: string,
    @Body() body: { fileKey: string; fileName: string; mimeType: string; fileSize: number },
    @CurrentUser() user: JwtUser,
  ) {
    return this.filesService.confirmUpload(
      user.tenantId,
      clientId,
      user.userId!,
      body.fileKey,
      { fileName: body.fileName, mimeType: body.mimeType, fileSize: body.fileSize },
    );
  }

  @Get()
  async list(
    @Param('clientId') clientId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.filesService.list(clientId, user.tenantId);
  }

  @Get(':fileId/download-url')
  async getDownloadUrl(
    @Param('clientId') clientId: string,
    @Param('fileId') fileId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.filesService.getDownloadUrl(clientId, fileId, user.tenantId);
  }

  @AssistantForbidden()
  @Delete(':fileId')
  async delete(
    @Param('clientId') clientId: string,
    @Param('fileId') fileId: string,
    @CurrentUser() user: JwtUser,
  ) {
    await this.filesService.delete(clientId, fileId, user.tenantId);
    return { success: true };
  }
}
