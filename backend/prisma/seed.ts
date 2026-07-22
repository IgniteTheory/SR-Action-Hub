import { PrismaClient, Role, QuoteBehavior } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const USERS = [
  { name: 'Stephan', email: 'stephan@sraccounting.local', role: Role.STAFF, colour: '#c0392b', requiresTimesheetCheck: false },
  { name: 'Chanel', email: 'chanel@sraccounting.local', role: Role.ADMINISTRATOR, colour: '#1f7a4d', requiresTimesheetCheck: false },
  { name: 'Sunanne', email: 'sunanne@sraccounting.local', role: Role.STAFF, colour: '#3b82f6', requiresTimesheetCheck: true },
  { name: 'Daniella', email: 'daniella@sraccounting.local', role: Role.STAFF, colour: '#8b5cf6', requiresTimesheetCheck: true }
];

const DEFAULT_PASSWORD = 'Welcome123!';

// All default to NEVER (routine ad-hoc work, no quote friction). "Other" is
// forced to MANUAL in code regardless of this list, since it's inherently
// unclassified work. Chanel can change any type's behaviour (and set a price
// for AUTO) via Settings once specific priced services are identified.
const REQUEST_TYPES = [
  'VAT', 'PAYE', 'UIF', 'EMP501', 'Income Tax', 'Provisional Tax', 'Bookkeeping',
  'Payroll', 'Financial Statements', 'Management Accounts', 'Company Registration',
  'CIPC', 'Trust Registration', 'Tax Clearance', 'Letter Request', 'SARS Verification',
  'SARS Audit', 'SARS Refund', 'General Query', 'Follow-up', 'Internal Admin',
  'Document Request', 'Meeting', 'Other'
];

interface ClientSeed {
  name: string;
  entityType: string | null;
  status: string;
  registrationNr: string | null;
  vatNr: string | null;
  taxNr: string | null;
  payeNr: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
}

async function main() {
  for (const u of USERS) {
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      // requiresTimesheetCheck is a system-defined flag (no admin UI to set it
      // yet), safe to keep in sync. passwordHash/role/colour are left alone so
      // this never clobbers something a user has since changed.
      update: { requiresTimesheetCheck: u.requiresTimesheetCheck },
      create: { ...u, passwordHash }
    });
  }

  for (const name of REQUEST_TYPES) {
    await prisma.requestType.upsert({
      where: { name },
      update: {},
      create: {
        name,
        quoteBehavior: name === 'Other' ? QuoteBehavior.MANUAL : QuoteBehavior.NEVER
      }
    });
  }
  // "Other" must always be MANUAL — that's a system invariant, not an admin
  // preference, so force it on every run regardless of prior state. Every
  // other request type's quoteBehavior is left as whatever Chanel has since
  // configured (the update: {} above preserves it).
  await prisma.requestType.update({
    where: { name: 'Other' },
    data: { quoteBehavior: QuoteBehavior.MANUAL }
  });

  const demoClient = await prisma.client.findFirst({ where: { name: 'Acme Co' } });
  if (!demoClient) {
    await prisma.client.create({
      data: {
        name: 'Acme Co',
        contacts: {
          create: [{ name: 'Jane Smith', phone: '082 555 1234', email: 'jane@acmeco.example' }]
        }
      }
    });
  }

  const clientsPath = path.join(__dirname, 'clients-seed.json');
  if (fs.existsSync(clientsPath)) {
    const clients: ClientSeed[] = JSON.parse(fs.readFileSync(clientsPath, 'utf8'));
    let imported = 0;
    for (const c of clients) {
      const client = await prisma.client.upsert({
        where: { name: c.name },
        update: {
          entityType: c.entityType,
          active: c.status === 'Active',
          registrationNr: c.registrationNr,
          vatNr: c.vatNr,
          taxNr: c.taxNr,
          payeNr: c.payeNr
        },
        create: {
          name: c.name,
          entityType: c.entityType,
          active: c.status === 'Active',
          registrationNr: c.registrationNr,
          vatNr: c.vatNr,
          taxNr: c.taxNr,
          payeNr: c.payeNr
        }
      });

      if (c.contactName) {
        const existingContact = await prisma.contact.findFirst({
          where: { clientId: client.id, name: c.contactName }
        });
        if (!existingContact) {
          await prisma.contact.create({
            data: { clientId: client.id, name: c.contactName, phone: c.contactPhone, email: c.contactEmail }
          });
        }
      }
      imported += 1;
    }
    console.log(`Imported/updated ${imported} clients from clients-seed.json`);
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
