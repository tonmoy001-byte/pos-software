-- CreateTable
CREATE TABLE "ExchangeItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "estimatedValue" DOUBLE PRECISION NOT NULL,
    "condition" TEXT NOT NULL DEFAULT 'good',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExchangeItem_saleId_idx" ON "ExchangeItem"("saleId");

-- CreateIndex
CREATE INDEX "ExchangeItem_productId_idx" ON "ExchangeItem"("productId");

-- AddForeignKey
ALTER TABLE "ExchangeItem" ADD CONSTRAINT "ExchangeItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeItem" ADD CONSTRAINT "ExchangeItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
