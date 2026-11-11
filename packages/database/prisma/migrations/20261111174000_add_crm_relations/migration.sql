-- CRM referential integrity only.
-- Preconditions are verified separately against production before applying.
-- No DROP/TRUNCATE/DELETE/UPDATE statements are allowed in this migration.

ALTER TABLE "contacts"
  ADD CONSTRAINT "contacts_assignedToId_fkey"
  FOREIGN KEY ("assignedToId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "deals"
  ADD CONSTRAINT "deals_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "contacts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "deals"
  ADD CONSTRAINT "deals_assignedToId_fkey"
  FOREIGN KEY ("assignedToId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "activities"
  ADD CONSTRAINT "activities_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "contacts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "activities"
  ADD CONSTRAINT "activities_dealId_fkey"
  FOREIGN KEY ("dealId") REFERENCES "deals"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "activities"
  ADD CONSTRAINT "activities_assignedToId_fkey"
  FOREIGN KEY ("assignedToId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
