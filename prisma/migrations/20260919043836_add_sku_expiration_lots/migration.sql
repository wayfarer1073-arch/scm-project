-- CreateTable
CREATE TABLE "sku_expiration_lots" (
    "id" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "lot" TEXT NOT NULL,
    "isAutoLot" BOOLEAN NOT NULL DEFAULT true,
    "expirationDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sku_expiration_lots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sku_expiration_lots_skuId_idx" ON "sku_expiration_lots"("skuId");

-- CreateIndex
CREATE UNIQUE INDEX "sku_expiration_lots_skuId_lot_key" ON "sku_expiration_lots"("skuId", "lot");

-- AddForeignKey
ALTER TABLE "sku_expiration_lots" ADD CONSTRAINT "sku_expiration_lots_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
