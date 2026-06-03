import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/pos";
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const hashedPassword = await bcrypt.hash("admin123", 10);

  // 1. Create Store
  const storeId = "flagship-store-1";
  const store = await prisma.store.upsert({
    where: { id: storeId },
    update: {},
    create: {
      id: storeId,
      name: "RetailOS Flagship Store",
      status: "ACTIVE",
      onboardingComplete: true,
      businessType: "RETAIL",
    },
  });

  // 2. Create Admin User
  // Now username is unique globally
  await prisma.user.upsert({
    where: { username: "admin" },
    update: {
      storeId: store.id // Ensure it's linked to the right store
    },
    create: {
      username: "admin",
      name: "Super Admin",
      password: hashedPassword,
      role: "ADMIN",
      storeId: store.id,
    },
  });

  // 3. Create Products
  const products = [
    { name: "iPhone 15 Pro", brand: "Apple", model: "A3102", category: "SMARTPHONE", cost: 130000, price: 145000, stock: 5 },
    { name: "Samsung S24 Ultra", brand: "Samsung", model: "SM-S928B", category: "SMARTPHONE", cost: 110000, price: 125000, stock: 3 },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: {
        barcode_storeId: {
          barcode: p.model,
          storeId: store.id
        }
      },
      update: {
        stock: p.stock
      },
      create: {
        name: p.name,
        brand: p.brand,
        model: p.model,
        category: p.category,
        cost: p.cost,
        price: p.price,
        stock: p.stock,
        barcode: p.model,
        minStock: 3,
        storeId: store.id,
      }
    });
  }

  console.log(`Seeded store and products`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
