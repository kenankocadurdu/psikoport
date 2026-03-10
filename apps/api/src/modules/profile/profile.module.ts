import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { StorageModule } from '../common/services/storage.module';
import { ProfileService } from './profile.service';
import { ProfileController } from './profile.controller';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [ProfileController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
