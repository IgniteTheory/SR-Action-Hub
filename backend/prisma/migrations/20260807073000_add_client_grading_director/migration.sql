-- AlterTable
ALTER TABLE "clients" ADD COLUMN "grading" TEXT;
ALTER TABLE "clients" ADD COLUMN "director1" TEXT;

-- Backfill grading/director for the clients Chanel provided, matched
-- against the real client master data by exact name where it already
-- exists (see clients-seed.json) — upserting by name (unique) creates the
-- handful that aren't in the system yet and updates the rest in place.
-- grading/director1 are operational fields Chanel edits via the Clients
-- page from here on; unlike entityType/registrationNr/etc. they are
-- deliberately NOT managed by seed.ts, so this one-time backfill is the
-- only place that sets them in bulk.
INSERT INTO "clients" ("name", "grading", "director1", "createdAt", "updatedAt") VALUES
  ('Arrunna Property (Pty) Ltd', 'A', 'Hennie Engelbrecht', now(), now()),
  ('Arunna Holdings Group (Pty) Ltd', 'A', 'Hennie Engelbrecht', now(), now()),
  ('CJH Pomona (PTY) LTD', 'A', 'Hennie Engelbrecht', now(), now()),
  ('Jimnettes Arts and Crafts CC', 'A', 'Cecil', now(), now()),
  ('Lynnwood Financial Services (Pty) Ltd', 'A', 'Rudolf', now(), now()),
  ('Diane Victor', 'A', 'Diane Victor', now(), now()),
  ('Atlas Paints', 'A', 'Cecil', now(), now()),
  ('Vizi Solutions (Pty) Ltd', 'A', 'Elsje', now(), now()),
  ('Atlas Eiendomme (Pty) Ltd', 'A', 'Gellie', now(), now()),
  ('Aliando South Africa (Pty) Ltd', 'A', 'Greg', now(), now()),
  ('T-Squared Architecture (Pty) Ltd', 'A', 'Ross', now(), now()),
  ('Leon Senekal', 'A +', 'Leon Senekal', now(), now()),
  ('Greg Sassen', 'A +', 'Greg Sassen', now(), now()),
  ('Bates Interior Solutions (Pty) Ltd', 'B', 'Eric', now(), now()),
  ('PC Interiors SA (Pty) Ltd', 'B', 'Paul', now(), now()),
  ('Rubiley Investment Holdings (Pty) Ltd', 'B', 'Wouter', now(), now()),
  ('Paint IQ', 'B', 'Brandon', now(), now()),
  -- Chanel wrote "Anchorco (Pty) Ltd"; the existing record is "Anchorco Pty Ltd" (no parens) — using the real name so this updates it instead of creating a duplicate.
  ('Anchorco Pty Ltd', 'B', 'Gerald', now(), now()),
  ('Radikal Solutions (Pty) Ltd', 'B', 'Sean', now(), now()),
  ('Extreme Water Solutions (Pty) Ltd', 'B', 'Leon', now(), now()),
  ('Cisco Tel (Pty) Ltd', 'C', 'Frank', now(), now()),
  ('V And N Financial Consulting (Pty) Ltd', 'C', 'Vaughn', now(), now()),
  ('RS Gearbox (Pty) Ltd', 'C', 'Ras', now(), now())
ON CONFLICT ("name") DO UPDATE SET
  "grading" = EXCLUDED."grading",
  "director1" = EXCLUDED."director1",
  "updatedAt" = now();
