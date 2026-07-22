import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const USERS = [
  { name: 'Stephan', email: 'stephan@sraccounting.local', role: Role.STAFF, colour: '#c0392b' },
  { name: 'Chanel', email: 'chanel@sraccounting.local', role: Role.ADMINISTRATOR, colour: '#1f7a4d' },
  { name: 'Sunanne', email: 'sunanne@sraccounting.local', role: Role.STAFF, colour: '#3b82f6' },
  { name: 'Daniella', email: 'daniella@sraccounting.local', role: Role.STAFF, colour: '#8b5cf6' }
];

const DEFAULT_PASSWORD = 'Welcome123!';

const REQUEST_TYPES = [
  'VAT', 'PAYE', 'UIF', 'EMP501', 'Income Tax', 'Provisional Tax', 'Bookkeeping',
  'Payroll', 'Financial Statements', 'Management Accounts', 'Company Registration',
  'CIPC', 'Trust Registration', 'Tax Clearance', 'Letter Request', 'SARS Verification',
  'SARS Audit', 'SARS Refund', 'General Query', 'Follow-up', 'Internal Admin',
  'Document Request', 'Meeting', 'Other'
];

async function main() {
  for (const u of USERS) {
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, passwordHash }
    });
  }

  for (const name of REQUEST_TYPES) {
    await prisma.requestType.upsert({
      where: { name },
      update: {},
      create: { name }
    });
  }

  const existingClient = await prisma.client.findFirst({ where: { name: 'Acme Co' } });
  if (!existingClient) {
    await prisma.client.create({
      data: {
        name: 'Acme Co',
        contacts: {
          create: [{ name: 'Jane Smith', phone: '082 555 1234', email: 'jane@acmeco.example' }]
        }
      }
    });
  }

  console.log('Seed complete. Default password for all users:', DEFAULT_PASSWORD);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
