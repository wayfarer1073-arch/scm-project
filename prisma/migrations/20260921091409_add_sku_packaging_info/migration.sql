-- AlterTable
ALTER TABLE "skus" ADD COLUMN     "eaPerBox" INTEGER,
ADD COLUMN     "eaPerPallet" INTEGER,
ADD COLUMN     "packagingBarcode" TEXT;

-- CreateTable
CREATE TABLE "sku_packaging_uploads" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "sourceFileName" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sku_packaging_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sku_packaging_uploads_warehouseId_key" ON "sku_packaging_uploads"("warehouseId");

-- AddForeignKey
ALTER TABLE "sku_packaging_uploads" ADD CONSTRAINT "sku_packaging_uploads_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sku_packaging_uploads" ADD CONSTRAINT "sku_packaging_uploads_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
