-- CreateTable
CREATE TABLE "snapshot_inbounds" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "snapshot_inbounds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "snapshot_inbounds_snapshotId_skuId_key" ON "snapshot_inbounds"("snapshotId", "skuId");

-- CreateIndex
CREATE INDEX "snapshot_inbounds_skuId_idx" ON "snapshot_inbounds"("skuId");

-- AddForeignKey
ALTER TABLE "snapshot_inbounds" ADD CONSTRAINT "snapshot_inbounds_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "inventory_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snapshot_inbounds" ADD CONSTRAINT "snapshot_inbounds_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
