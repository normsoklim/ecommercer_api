/**
 * End-to-end check of the roles / users endpoints.
 *
 * It runs against the compiled application (dist) so the checks exercise the
 * same code as the production build.
 *
 * Run with: npm run build && node test/verify-roles.cjs
 */
const fs = require('fs');
const path = require('path');
const { ValidationPipe } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const { AppModule } = require('../dist/app.module');
const { PrismaService } = require('../dist/database/prisma.service');

const REPORT_FILE = path.resolve(__dirname, '..', 'verify-roles.log');
const PASSWORD = 'Str0ng-Password!';
const STAMP = Date.now();
const ADMIN_EMAIL = `role-check-admin-${STAMP}@example.com`;
const STAFF_EMAIL = `role-check-staff-${STAMP}@example.com`;

const results = [];

function report(content) {
  fs.writeFileSync(REPORT_FILE, content, 'utf8');
}

function check(label, condition, extra) {
  results.push(
    `${condition ? 'PASS' : 'FAIL'}  ${label}${
      !condition && extra !== undefined ? ` ${JSON.stringify(extra)}` : ''
    }`,
  );
}

async function main() {
  const app = await NestFactory.create(AppModule, {
    logger: false,
    abortOnError: false,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  await app.init();

  const server = app.getHttpServer();
  const prisma = app.get(PrismaService);
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const admin = await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      passwordHash,
      firstName: 'Role',
      lastName: 'Admin',
      status: 'ACTIVE',
      emailVerified: new Date(),
    },
  });
  const staff = await prisma.user.create({
    data: {
      email: STAFF_EMAIL,
      passwordHash,
      firstName: 'Role',
      lastName: 'Staff',
      status: 'ACTIVE',
      emailVerified: new Date(),
    },
  });

  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: { name: 'ADMIN', description: 'Full access' },
  });
  await prisma.userRole.create({
    data: { userId: admin.id, roleId: adminRole.id },
  });

  // --- login ------------------------------------------------------------
  const login = await request(server)
    .post('/auth/login')
    .send({ email: ADMIN_EMAIL, password: PASSWORD })
    .expect(200);

  const token = login.body && login.body.accessToken;
  check('login returns an access token', Boolean(token));
  check(
    'the token carries the ADMIN role',
    Boolean(
      login.body &&
        login.body.user &&
        login.body.user.roles &&
        login.body.user.roles.includes('ADMIN'),
    ),
    login.body && login.body.user && login.body.user.roles,
  );

  const auth = (req) => req.set('Authorization', `Bearer ${token}`);

  // --- role CRUD --------------------------------------------------------
  const list = await auth(request(server).get('/roles')).expect(200);
  check(
    'GET /roles lists the seeded default roles',
    ['ADMIN', 'STAFF', 'CUSTOMER'].every((name) =>
      list.body.some((role) => role.name === name),
    ),
    list.body.map((role) => role.name),
  );

  const created = await auth(request(server).post('/roles'))
    .send({ name: 'editor', description: 'Can edit the catalog' })
    .expect(201);
  check('POST /roles creates a role', created.body && created.body.name === 'EDITOR', created.body);
  check(
    'the role name is normalized to upper case',
    created.body && created.body.name === 'EDITOR',
  );

  const roleId = created.body && created.body.id;

  const duplicate = await auth(request(server).post('/roles'))
    .send({ name: 'EDITOR' })
    .expect(409);
  check(
    'POST /roles rejects a duplicated name',
    Boolean(duplicate.body && String(duplicate.body.message).includes('already exists')),
  );

  const invalid = await auth(request(server).post('/roles'))
    .send({ name: '1nvalid name!' })
    .expect(400);
  check('POST /roles validates the role name', Boolean(invalid.body && invalid.body.message));

  const one = await auth(request(server).get(`/roles/${roleId}`)).expect(200);
  check('GET /roles/:id returns the role', one.body && one.body.id === roleId);

  const byName = await auth(request(server).get('/roles/name/editor')).expect(200);
  check('GET /roles/name/:name finds the role', byName.body && byName.body.id === roleId);

  const updated = await auth(request(server).patch(`/roles/${roleId}`))
    .send({ name: 'senior editor', description: 'Senior editor role' })
    .expect(200);
  check(
    'PATCH /roles/:id updates the role',
    Boolean(
      updated.body &&
        updated.body.name === 'SENIOR_EDITOR' &&
        updated.body.description === 'Senior editor role',
    ),
    updated.body,
  );

  // --- assign a user to a role ------------------------------------------
  const assignByUser = await auth(request(server).post(`/users/${staff.id}/roles`))
    .send({ roleName: 'senior editor' })
    .expect(201);
  check(
    'POST /users/:id/roles assigns a role by name',
    Boolean(assignByUser.body && assignByUser.body.role && assignByUser.body.role.name === 'SENIOR_EDITOR'),
    assignByUser.body,
  );

  const idempotent = await auth(request(server).post(`/users/${staff.id}/roles`))
    .send({ roleName: 'SENIOR_EDITOR' })
    .expect(201);
  check(
    'assigning the same role twice is idempotent',
    Boolean(idempotent.body && assignByUser.body && idempotent.body.id === assignByUser.body.id),
  );

  const userRoles = await auth(request(server).get(`/users/${staff.id}/roles`)).expect(200);
  check(
    'GET /users/:id/roles lists the roles of the user',
    Boolean(
      userRoles.body &&
        userRoles.body.roles &&
        userRoles.body.roles.some((role) => role.name === 'SENIOR_EDITOR'),
    ),
    userRoles.body,
  );

  const assignByEmail = await auth(request(server).post(`/roles/${roleId}/users`))
    .send({ userEmail: STAFF_EMAIL })
    .expect(201);
  check(
    'POST /roles/:id/users assigns a role by email',
    Boolean(assignByEmail.body && assignByEmail.body.user && assignByEmail.body.user.email === STAFF_EMAIL),
    assignByEmail.body,
  );

  const roleUsers = await auth(request(server).get(`/roles/${roleId}/users`)).expect(200);
  check(
    'GET /roles/:id/users lists the users holding the role',
    Boolean(
      roleUsers.body &&
        roleUsers.body.data &&
        roleUsers.body.data.some((user) => user.email === STAFF_EMAIL),
    ),
    roleUsers.body && roleUsers.body.meta,
  );

  const users = await auth(request(server).get('/users')).expect(200);
  check(
    'GET /users lists the users with their roles',
    Boolean(
      users.body &&
        users.body.data &&
        users.body.data.some(
          (user) =>
            user.email === STAFF_EMAIL &&
            user.roles.some((role) => role.name === 'SENIOR_EDITOR'),
        ),
    ),
    users.body && users.body.meta,
  );

  const usersFiltered = await auth(request(server).get('/users?role=SENIOR_EDITOR')).expect(200);
  check(
    'GET /users?role= filters the users by role',
    Boolean(usersFiltered.body && usersFiltered.body.data && usersFiltered.body.data.length === 1),
    usersFiltered.body && usersFiltered.body.meta,
  );

  // --- revoke -----------------------------------------------------------
  await auth(request(server).delete(`/roles/${roleId}/users/${staff.id}`)).expect(200);

  const revoked = await auth(request(server).get(`/users/${staff.id}/roles`)).expect(200);
  check(
    'the revoked role is gone',
    Boolean(
      revoked.body &&
        revoked.body.roles &&
        !revoked.body.roles.some((role) => role.name === 'SENIOR_EDITOR'),
    ),
  );

  const revokeAgain = await auth(
    request(server).delete(`/roles/${roleId}/users/${staff.id}`),
  ).expect(404);
  check(
    'revoking a missing assignment returns 404',
    Boolean(revokeAgain.body && String(revokeAgain.body.message).includes('does not have')),
  );

  // --- delete -----------------------------------------------------------
  await auth(request(server).post(`/roles/${roleId}/users`))
    .send({ userId: staff.id })
    .expect(201);

  const conflict = await auth(request(server).delete(`/roles/${roleId}`)).expect(409);
  check(
    'DELETE /roles/:id refuses to delete an assigned role',
    Boolean(conflict.body && String(conflict.body.message).includes('assigned')),
  );

  const forced = await auth(request(server).delete(`/roles/${roleId}?force=true`)).expect(200);
  check('DELETE /roles/:id?force=true deletes the role', forced.body && forced.body.id === roleId);

  const gone = await auth(request(server).get(`/roles/${roleId}`)).expect(404);
  check('the deleted role is gone', Boolean(gone.body && String(gone.body.message).includes('not found')));

  // --- authorization ----------------------------------------------------
  const anonymous = await request(server).post('/roles').send({ name: 'X' });
  check('POST /roles requires authentication', anonymous.status === 401);

  await request(server)
    .post('/auth/register')
    .send({
      email: `role-check-customer-${STAMP}@example.com`,
      password: PASSWORD,
      firstName: 'Role',
      lastName: 'Customer',
    })
    .expect(201);

  const customerRoleRow = await prisma.role.findUnique({
    where: { name: 'CUSTOMER' },
    include: { userRoles: true },
  });
  check(
    'the CUSTOMER role is assigned at registration',
    Boolean(customerRoleRow && customerRoleRow.userRoles.length > 0),
  );

  const seeded = await auth(request(server).post('/roles/seed')).expect(201);
  check(
    'POST /roles/seed is idempotent',
    Boolean(seeded.body && seeded.body.existing && seeded.body.existing.includes('ADMIN')),
    seeded.body,
  );

  // --- cleanup ----------------------------------------------------------
  await prisma.user.deleteMany({ where: { email: { contains: 'role-check-' } } });
  await prisma.role.deleteMany({ where: { name: { in: ['SENIOR_EDITOR', 'EDITOR'] } } });

  await app.close();

  const failed = results.filter((line) => line.startsWith('FAIL'));
  report(
    `${results.join('\n')}\n\n${results.length - failed.length}/${results.length} checks passed`,
  );
  process.exitCode = failed.length === 0 ? 0 : 1;
}

main().catch((error) => {
  report(
    `${results.join('\n')}\n\nERROR: ${
      error instanceof Error ? error.stack || error.message : String(error)
    }`,
  );
  process.exitCode = 1;
});
