-- Additive payment attestation fields. No data deletion or existing status changes.
ALTER TABLE "end_service_settlements"
  ADD COLUMN "paymentReference" TEXT,
  ADD COLUMN "paymentMethod" TEXT,
  ADD COLUMN "paymentRecordedById" TEXT;
