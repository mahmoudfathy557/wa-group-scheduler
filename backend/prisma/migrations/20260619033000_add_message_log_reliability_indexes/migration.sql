-- Reliability and operational indexes for message delivery.
ALTER TABLE "MessageLog"
ADD CONSTRAINT "MessageLog_tenantId_runId_groupJid_key"
UNIQUE ("tenantId", "runId", "groupJid");

CREATE INDEX "MessageLog_status_createdAt_idx"
ON "MessageLog"("status", "createdAt");
