import { Global, Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { AuditLogController } from './audit-log.controller';
import { ConsentService } from './consent.service';
import { ConsentController } from './consent.controller';
import { PrismaModule } from '../../database/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [AuditLogController, ConsentController],
  providers: [AuditLogService, ConsentService],
  exports: [AuditLogService, ConsentService],
})
export class LegalModule {}
