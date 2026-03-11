/**
 * Standalone script to call TaskService.createTask() with a mocked AuthContext.
 * profileId and filePath are hardcoded below.
 *
 * Run:
 *   npm run script:create-task
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DatabaseModule } from '../src/common/database/database.module';
import {
  ProfileRepository,
  TaskRepository,
} from '../src/common/database/repositories';
import { AuthContext } from '../src/common/services/auth-context.service';
import { TaskService } from '../src/common/services/task.service';

const PROFILE_ID = '7451ae58-b6d7-492a-9b54-729e336ab538';
const FILE_PATH =
  'https://ckaavxsflcvgcdckzrdv.supabase.co/storage/v1/object/sign/cs_documents/temp/difficault-1-exemplar-compliance-schedule-1772970727968-vf25ddd8.pdf?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV83ZmMwZDM0OS1mMjM3LTQxNDUtYjkxNC0zNDE3NTA3OTUxZjAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJjc19kb2N1bWVudHMvdGVtcC9kaWZmaWNhdWx0LTEtZXhlbXBsYXItY29tcGxpYW5jZS1zY2hlZHVsZS0xNzcyOTcwNzI3OTY4LXZmMjVkZGQ4LnBkZiIsImlhdCI6MTc3MzIyMzMwNiwiZXhwIjoxNzczODI4MTA2fQ.89JoclrgvF5wArpn_Uxohd5sAPaUMnHC3ii7W-sflUM';

const mockAuthContext: AuthContext = {
  getProfileId: () => PROFILE_ID,
  getUser: () => ({ id: PROFILE_ID }),
  getAccessToken: () => '',
} as AuthContext;

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    DatabaseModule,
  ],
  providers: [
    { provide: AuthContext, useValue: mockAuthContext },
    ProfileRepository,
    TaskRepository,
    TaskService,
  ],
})
class CreateTaskScriptModule {}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(CreateTaskScriptModule);
  const taskService = app.get(TaskService);

  try {
    const taskId = await taskService.createTask(FILE_PATH);
    console.log('Created task id:', taskId);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
