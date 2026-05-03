import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const dbUrl = process.env.DATABASE_URL?.replace("file:", "") || 
  path.join(process.cwd(), "prisma", "dev.db");

const adapter = new PrismaBetterSqlite3({ url: dbUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  const hashedPassword = await bcrypt.hash("admin123", 10);

  // 1. Create Store
  const store = await prisma.store.upsert({
    where: { id: "main-store" },
    update: {},
    create: {
      id: "main-store",
      name: "RetailOS Flagship Store",
    },
  });

  // 2. Create Admin User
  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      name: "Super Admin",
      password: hashedPassword,
      role: "ADMIN",
      storeId: store.id,
    },
  });

  // 3. Create Products
  const iphone = await prisma.product.create({
    data: {
      name: "iPhone 15 Pro",
      brand: "Apple",
      model: "A3102",
      category: "SMARTPHONE",
      cost: 130000,
      price: 145000,
      minStock: 5,
      storeId: store.id,
      items: {
        create: [
          { imei: "IMEI1234567890", status: "AVAILABLE" },
          { imei: "IMEI0987654321", status: "AVAILABLE" },
        ]
      }
    }
  });

  const s24 = await prisma.product.create({
    data: {
      name: "Samsung S24 Ultra",
      brand: "Samsung",
      model: "SM-S928B",
      category: "SMARTPHONE",
      cost: 110000,
      price: 125000,
      minStock: 3,
      storeId: store.id,
      items: {
        create: [
          { imei: "IMEI555666777", status: "AVAILABLE" }
        ]
      }
    }
  });

  console.log("Seed data created successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
