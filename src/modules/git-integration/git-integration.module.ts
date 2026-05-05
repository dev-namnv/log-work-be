import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import {
  GitIntegration,
  GitIntegrationSchema,
} from 'src/schemas/git-integration';
import { WorkLog, WorkLogSchema } from 'src/schemas/work-log';
import { GitIntegrationController } from './git-integration.controller';
import { GitIntegrationService } from './git-integration.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GitIntegration.name, schema: GitIntegrationSchema },
      { name: WorkLog.name, schema: WorkLogSchema },
    ]),
    JwtModule.register({}),
  ],
  controllers: [GitIntegrationController],
  providers: [GitIntegrationService],
  exports: [GitIntegrationService],
})
export class GitIntegrationModule {}
