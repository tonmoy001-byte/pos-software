import { prisma } from "@/lib/prisma";
import { SaleService } from "@/lib/services";

async function verifyCheckout() {
  console.log("🚀 Starting System Stability Check...");

  // 1. Setup Test Store & Product
  const store = await prisma.store.create({
    data: {
      name: "Test Store",
      invoicePrefix: "TEST",
      invoiceNumbering: 1
    }
  });

  const user = await prisma.user.create({
    data: {
      username: "testuser_" + Date.now(),
      password: "password",
      name: "Test User",
      role: "ADMIN",
      storeId: store.id
    }
  });

  const product = await prisma.product.create({
    data: {
      name: "Test Phone",
      model: "X1",
      brand: "TestBrand",
      category: "SMARTPHONE",
      price: 1000,
      cost: 800,
      stock: 10,
      storeId: store.id
    }
  });

  console.log("✅ Test environment prepared.");

  // 2. Simulate Sale
  const saleService = new SaleService();
  const saleInput = {
    items: [{
      productId: product.id,
      quantity: 2,
      price: 1000,
      cost: 800
    }],
    totalAmount: 2000,
    paidAmount: 2000,
    dueAmount: 0,
    paymentMethod: "CASH",
    saleType: "REGULAR"
  };

  console.log("🛒 Processing simulated sale...");
  const sale = await saleService.create(saleInput, store.id, user.id);

  if (!sale) throw new Error("Sale creation failed");
  console.log("✅ Sale created. Invoice:", sale.invoiceId);

  // 3. Verify Stock Decrement
  const updatedProduct = await prisma.product.findUnique({ where: { id: product.id } });
  if (updatedProduct?.stock !== 8) {
    throw new Error(`Stock mismatch! Expected 8, got ${updatedProduct?.stock}`);
  }
  console.log("✅ Stock correctly decremented.");

  // 4. Verify Financial Transaction
  const transaction = await prisma.transaction.findFirst({
    where: { referenceId: sale.id, type: "SALE" }
  });
  if (!transaction || Number(transaction.amount) !== 2000) {
    throw new Error("Financial transaction not recorded correctly");
  }
  console.log("✅ Financial transaction correctly recorded.");

  // 5. Verify Invoice Numbering (Atomicity/Sequence)
  const nextInvoiceId = await saleService.create(saleInput, store.id, user.id);
  if (!nextInvoiceId?.invoiceId.endsWith("000002")) {
    throw new Error(`Invoice numbering mismatch! Expected sequence 000002, got ${nextInvoiceId?.invoiceId}`);
  }
  console.log("✅ Invoice numbering correctly sequenced.");

  // Cleanup
  console.log("🧹 Cleaning up test data...");
  const saleIds = [sale.id, nextInvoiceId.id];
  await prisma.saleItem.deleteMany({ where: { saleId: { in: saleIds } } });
  await prisma.payment.deleteMany({ where: { saleId: { in: saleIds } } });
  await prisma.transaction.deleteMany({ where: { referenceId: { in: saleIds } } });
  await prisma.sale.deleteMany({ where: { id: { in: saleIds } } });
  await prisma.product.delete({ where: { id: product.id } });
  await prisma.event.deleteMany({ where: { storeId: store.id } });
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.store.delete({ where: { id: store.id } });

  console.log("🏁 Stability checks passed successfully!");
}

verifyCheckout().catch(err => {
  console.error("❌ Stability check failed:", err);
  process.exit(1);
});
