import { Module } from '@nestjs/common';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { NotesModule } from './notes/notes.module';
import { TimelineModule } from './timeline/timeline.module';
import { FilesModule } from './files/files.module';
import { ExportModule } from './export/export.module';
import { PrismaModule } from '../../database/prisma.module';
import { SubscriptionModule } from '../subscriptions/subscription.module';
import { QuotaGuard } from '../common/guards/quota.guard';
import { EncryptionModule } from '../common/services/encryption.module';

@Module({
  imports: [PrismaModule, NotesModule, TimelineModule, FilesModule, ExportModule, SubscriptionModule, EncryptionModule],
  controllers: [ClientsController],
  providers: [ClientsService, QuotaGuard],
  exports: [ClientsService],
})
export class ClientsModule {}
