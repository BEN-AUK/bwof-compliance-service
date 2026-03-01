import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { databaseProvider, DRIZZLE } from './database.provider';

export { DRIZZLE, type DrizzleDB } from './database.provider';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [databaseProvider],
  exports: [DRIZZLE],
})
export class DatabaseModule {}
