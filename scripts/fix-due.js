const Database = require('better-sqlite3');
const db = new Database('prisma/dev.db');

const customers = db.prepare('SELECT id, name, dueAmount FROM Customer').all();
let fixed = 0;

for (const c of customers) {
  const row = db.prepare(
    "SELECT COALESCE(SUM(dueAmount), 0) as s FROM Sale WHERE customerId = ? AND status NOT IN ('CANCELLED', 'COMPLETED')"
  ).get(c.id);
  const saleSum = Number(row.s);
  const oldDue = Number(c.dueAmount);
  const diff = Math.abs(oldDue - saleSum);

  if (diff > 1) {
    console.log(c.name + ': ' + oldDue + ' -> ' + saleSum + ' (diff: ' + diff + ')');
    db.prepare('UPDATE Customer SET dueAmount = ? WHERE id = ?').run(saleSum, c.id);
    fixed++;
  } else if (diff > 0.01) {
    db.prepare('UPDATE Customer SET dueAmount = ? WHERE id = ?').run(saleSum, c.id);
    fixed++;
  }
}

console.log('\nFixed ' + fixed + ' customer due amounts');
const remaining = db.prepare(
  "SELECT COUNT(*) as c FROM Customer c WHERE ABS(c.dueAmount - COALESCE((SELECT SUM(dueAmount) FROM Sale WHERE customerId = c.id AND status NOT IN ('CANCELLED','COMPLETED')),0)) > 1"
).get().c;
console.log('Remaining mismatches: ' + remaining);
