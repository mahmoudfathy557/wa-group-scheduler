-- CreateTable
CREATE TABLE "LogViewState" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "logsClearedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LogViewState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LogViewState_tenantId_key" ON "LogViewState"("tenantId");

-- AddForeignKey
ALTER TABLE "LogViewState" ADD CONSTRAINT "LogViewState_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
