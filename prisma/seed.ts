import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // 0. Seed Plans
  const plans = [
    {
      name: "trial",
      displayName: "Free Trial",
      maxProducts: 100,
      maxUsers: 3,
      maxBranches: 1,
      priceMonthly: 0,
      priceYearly: 0,
      trialDays: 14,
      isCustomPricing: false,
      features: JSON.stringify(["basic_reports", "single_branch"]),
    },
    {
      name: "starter",
      displayName: "Starter",
      maxProducts: 500,
      maxUsers: 3,
      maxBranches: 1,
      priceMonthly: 1000,
      priceYearly: 10000,
      trialDays: 0,
      isCustomPricing: false,
      features: JSON.stringify(["basic_reports", "single_branch", "emi_tracking"]),
    },
    {
      name: "growth",
      displayName: "Growth",
      maxProducts: -1,
      maxUsers: -1,
      maxBranches: -1,
      priceMonthly: 2000,
      priceYearly: 20000,
      trialDays: 0,
      isCustomPricing: false,
      features: JSON.stringify(["advanced_reports", "multi_branch", "emi_tracking", "priority_support"]),
    },
    {
      name: "enterprise",
      displayName: "Enterprise",
      maxProducts: -1,
      maxUsers: -1,
      maxBranches: -1,
      priceMonthly: 0,
      priceYearly: 0,
      trialDays: 0,
      isCustomPricing: true,
      features: JSON.stringify(["advanced_reports", "multi_branch", "emi_tracking", "priority_support", "custom_integration", "dedicated_support"]),
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { name: plan.name },
      update: plan,
      create: plan,
    });
  }

  console.log(`Seeded ${plans.length} plans`);

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
    where: { username_storeId: { username: "admin", storeId: store.id } },
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
  const products = [
    { name: "iPhone 15 Pro", brand: "Apple", model: "A3102", category: "SMARTPHONE", cost: 130000, price: 145000, stock: 5 },
    { name: "Samsung S24 Ultra", brand: "Samsung", model: "SM-S928B", category: "SMARTPHONE", cost: 110000, price: 125000, stock: 3 },
    { name: "iPhone 14", brand: "Apple", model: "A2885", category: "SMARTPHONE", cost: 85000, price: 95000, stock: 4 },
    { name: "Samsung A55", brand: "Samsung", model: "SM-A556", category: "SMARTPHONE", cost: 35000, price: 42000, stock: 10 },
    { name: "iPhone 13", brand: "Apple", model: "A2633", category: "SMARTPHONE", cost: 65000, price: 75000, stock: 2 },
    { name: "Samsung S23", brand: "Samsung", model: "SM-S911", category: "SMARTPHONE", cost: 75000, price: 85000, stock: 3 },
    { name: "iPad Air", brand: "Apple", model: "iPad Air 6", category: "TABLET", cost: 55000, price: 65000, stock: 2 },
    { name: "Samsung Tab S9", brand: "Samsung", model: "SM-X810", category: "TABLET", cost: 65000, price: 75000, stock: 2 },
    { name: "AirPods Pro", brand: "Apple", model: "AirPods Pro 2", category: "ACCESSORIES", cost: 18000, price: 25000, stock: 10 },
    { name: "Samsung Buds2", brand: "Samsung", model: "SM-R510", category: "ACCESSORIES", cost: 8000, price: 12000, stock: 8 },
  ];

  for (const p of products) {
    await prisma.product.create({
      data: {
        ...p,
        minStock: 3,
        storeId: store.id,
      }
    });
  }

  console.log(`Created ${products.length} products with stock`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
