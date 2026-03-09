/**
 * Standalone script to create a Supabase auth user via InfraService.createUser().
 *
 * Edit USER_TO_CREATE below, then run:
 *   npx ts-node -r tsconfig-paths/register scripts/create-user.ts
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { InfraService } from '../src/common/services/infra.service';

const USER_TO_CREATE = {
  email: 'gtj1984@hotmail.com',
  password: 'tuoji123',
  organizationName: 'Test Org',
  firstName: 'Ben',
  lastName: 'GU',
  role: 'Owner' as const,
};

async function main(): Promise<void> {
  const { email, password, organizationName, firstName, lastName, role } =
    USER_TO_CREATE;

  if (
    !email ||
    !password ||
    !organizationName ||
    !firstName ||
    email === 'test@example.com'
  ) {
    console.error(
      'Please edit USER_TO_CREATE in scripts/create-user.ts before running this script.',
    );
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule);
  const infra = app.get(InfraService);

  try {
    const result = await infra.createUser({
      email,
      password,
      organizationName,
      firstName,
      lastName,
      role,
      emailConfirm: true,
    });

    console.log(
      JSON.stringify(
        {
          userId: result.user?.id,
          email: result.user?.email,
          metadata: result.user?.user_metadata,
        },
        null,
        2,
      ),
    );
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
