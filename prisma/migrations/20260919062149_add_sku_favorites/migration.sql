-- CreateTable
CREATE TABLE "sku_favorites" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sku_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sku_favorites_skuId_idx" ON "sku_favorites"("skuId");

-- CreateIndex
CREATE UNIQUE INDEX "sku_favorites_userId_skuId_key" ON "sku_favorites"("userId", "skuId");

-- AddForeignKey
ALTER TABLE "sku_favorites" ADD CONSTRAINT "sku_favorites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sku_favorites" ADD CONSTRAINT "sku_favorites_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
