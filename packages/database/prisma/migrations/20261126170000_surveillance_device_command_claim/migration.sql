-- Additive execution lease metadata. A claim does not imply successful device movement.
ALTER TABLE "surveillance_device_commands" ADD COLUMN "claimedAt" TIMESTAMP(3);
ALTER TABLE "surveillance_device_commands" ADD COLUMN "leaseTokenHash" TEXT;
