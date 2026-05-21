import { Module } from '@nestjs/common';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';
import { LoginAttemptsController } from './login-attempts.controller';
import { LoginAttemptsService } from './login-attempts.service';

@Module({
  controllers: [SessionsController, ApiKeysController, LoginAttemptsController],
  providers: [SessionsService, ApiKeysService, LoginAttemptsService],
})
export class SecurityModule {}
