import { Module } from '@nestjs/common';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';
import { PrismaModule } from '../../../database/prisma.module';
import { EncryptionModule } from '../../common/services/encryption.module';

@Module({
  imports: [PrismaModule, EncryptionModule],
  controllers: [NotesController],
  providers: [NotesService],
  exports: [NotesService],
})
export class NotesModule {}
