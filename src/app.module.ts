import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { DatabaseModule } from './common/database/database.module';
import { GlobalExceptionFilter } from './common/filters';
import { SupabaseAuthGuard } from './common/guards';
import { TransformInterceptor } from './common/interceptors';
import { HelloModule } from './modules/hello/hello.module';
import { SetupModule } from './modules/setup/setup.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    DatabaseModule,
    HelloModule,
    SetupModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_GUARD, useClass: SupabaseAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
