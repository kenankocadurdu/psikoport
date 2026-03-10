import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { NotesService } from './notes.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteMetaDto } from './dto/update-note-meta.dto';
import { NoteQueryDto } from './dto/note-query.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuditLog } from '../../common/decorators/audit-log.decorator';
import { AssistantForbidden } from '../../common/decorators/assistant-forbidden.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtUser } from '../../common/types/request.types';

@Controller('clients/:clientId/notes')
@Roles('psychologist', 'assistant')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @AssistantForbidden()
  @Post()
  async create(
    @Param('clientId') clientId: string,
    @Body() dto: CreateNoteDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.notesService.create(clientId, user.tenantId, dto);
  }

  @Get()
  async findAll(
    @Param('clientId') clientId: string,
    @Query() query: NoteQueryDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.notesService.findAll(clientId, user.tenantId, query);
  }

  @AssistantForbidden()
  @AuditLog({ action: 'decrypt', resourceType: 'consultation_note' })
  @Get(':noteId')
  async findOne(
    @Param('clientId') clientId: string,
    @Param('noteId') noteId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.notesService.findOne(clientId, noteId, user.tenantId);
  }

  @AssistantForbidden()
  @Patch(':noteId/meta')
  async updateMeta(
    @Param('clientId') clientId: string,
    @Param('noteId') noteId: string,
    @Body() dto: UpdateNoteMetaDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.notesService.updateMeta(
      clientId,
      noteId,
      user.tenantId,
      dto,
    );
  }

  @AssistantForbidden()
  @AuditLog({ action: 'delete', resourceType: 'consultation_note' })
  @Delete(':noteId')
  async delete(
    @Param('clientId') clientId: string,
    @Param('noteId') noteId: string,
    @CurrentUser() user: JwtUser,
  ) {
    await this.notesService.delete(clientId, noteId, user.tenantId);
    return { success: true };
  }
}
