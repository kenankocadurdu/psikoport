import { Module } from '@nestjs/common';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { NotesModule } from './notes/notes.module';
import { TimelineModule } from './timeline/timeline.module';
import { FilesModule } from './files/files.module';
import { ExportModule } from './export/export.module';
import { PrismaModule } from '../../database/prisma.module';

@Module({
  imports: [PrismaModule, NotesModule, TimelineModule, FilesModule, ExportModule],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
