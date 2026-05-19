import { prisma } from "@/lib/prisma";

export type SmsProvider = "twilio" | "whatsapp-cloud" | "sslcommerz" | "none";

export interface AlertConfig {
  /** Which SMS provider to use */
  provider: SmsProvider;
  /** Twilio: account SID (env TWILIO_ACCOUNT_SID) */
  twilioAccountSid?: string;
  /** Twilio: auth token (env TWILIO_AUTH_TOKEN) */
  twilioAuthToken?: string;
  /** Twilio: sender phone number (env TWILIO_FROM) */
  twilioFrom?: string;
  /** WhatsApp Cloud API: phone-number id (env WA_PHONE_NUMBER_ID) */
  waPhoneNumberId?: string;
  /** WhatsApp Cloud API: access token (env WA_ACCESS_TOKEN) */
  waAccessToken?: string;
  /** BanglaTrac / SSLCommerz: sender ID (env SMS_SENDER_ID) */
  smsSenderId?: string;
  /** Whether alerts are enabled (env ALERTS_ENABLED) */
  enabled?: boolean;
}

export interface StockAlert {
  storeId: string;
  productId: string;
  productName: string;
  stock: number;
  minStock: number;
}

export interface DueAlert {
  storeId: string;
  customerId: string;
  customerName: string;
  phone: string;
  invoiceId: string;
  dueAmount: number;
  dueDate: Date;
  daysOverdue?: number;
}

/**
 * Build the alert config from environment variables.
 * Callers can also pass a partial config to override individual env values.
 */
export function buildAlertConfig(overrides?: Partial<AlertConfig>): AlertConfig {
  const rawProvider = (overrides?.provider ??
    (process.env.SMS_PROVIDER as SmsProvider | undefined) ??
    "none") as SmsProvider;

  return {
    provider: rawProvider,
    twilioAccountSid: overrides?.twilioAccountSid ?? process.env.TWILIO_ACCOUNT_SID,
    twilioAuthToken:   overrides?.twilioAuthToken   ?? process.env.TWILIO_AUTH_TOKEN,
    twilioFrom:        overrides?.twilioFrom         ?? process.env.TWILIO_FROM,
    waPhoneNumberId:   overrides?.waPhoneNumberId    ?? process.env.WA_PHONE_NUMBER_ID,
    waAccessToken:     overrides?.waAccessToken      ?? process.env.WA_ACCESS_TOKEN,
    smsSenderId:       overrides?.smsSenderId        ?? process.env.SMS_SENDER_ID,
    enabled:           overrides?.enabled ?? process.env.ALERTS_ENABLED !== "false",
  };
}

/** ── Thin senders ───────────────────────────────────────────────────────── */

async function sendViaTwilio(
  cfg: AlertConfig,
  to: string,
  body: string,
): Promise<boolean> {
  if (!cfg.twilioAccountSid || !cfg.twilioAuthToken || !cfg.twilioFrom) {
    console.warn("[SMS] Twilio not fully configured");
    return false;
  }
  try {
    // Optional dependency — load lazily so a missing install doesn't crash the app
    const twilioMod = await import("twilio").catch(() => ({ default: null } as any));
    if (!twilioMod) {
      console.warn("[SMS] twilio package not installed. Run: npm install twilio");
      return false;
    }
    const client = twilioMod.default(cfg.twilioAccountSid, cfg.twilioAuthToken);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      await client.messages.create({
        to,
        from: cfg.twilioFrom,
        body,
      });
      return true;
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    console.error("[SMS] Twilio error:", err);
    return false;
  }
}

async function sendViaWhatsAppCloud(
  cfg: AlertConfig,
  to: string,
  body: string,
): Promise<boolean> {
  if (!cfg.waPhoneNumberId || !cfg.waAccessToken) {
    console.warn("[SMS] WhatsApp Cloud not fully configured");
    return false;
  }
  // Normalise the 'to' number (Bangladesh: strip leading 0, add 88)
  const toE164 = normaliseBdPhone(to);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `https://graph.facebook.com/v22.0/${cfg.waPhoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.waAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: toE164,
          type: "text",
          text: { body },
        }),
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);
    return res.ok;
  } catch (err) {
    console.error("[SMS] WhatsApp Cloud error:", err);
    return false;
  }
}

async function sendViaHttp(
  cfg: AlertConfig,
  to: string,
  body: string,
): Promise<boolean> {
  const url = process.env.SMS_API_URL;
  const apiKey = process.env.SMS_API_KEY;
  if (!url || !apiKey) {
    console.warn("[SMS] HTTP gateway not configured (set SMS_API_URL / SMS_API_KEY)");
    return false;
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ to, body, sender: cfg.smsSenderId }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok;
  } catch (err) {
    console.error("[SMS] HTTP gateway error:", err);
    return false;
  }
}

/** ── Generic send ───────────────────────────────────────────────────────── */

export async function sendSms(to: string, body: string): Promise<boolean> {
  const cfg = buildAlertConfig();
  if (!cfg.enabled || cfg.provider === "none") {
    console.info(`[SMS] suppressed (enabled=${cfg.enabled} provider=${cfg.provider}): ${body}`);
    return false;
  }
  switch (cfg.provider) {
    case "twilio":
      return sendViaTwilio(cfg, to, body);
    case "whatsapp-cloud":
      return sendViaWhatsAppCloud(cfg, to, body);
    default:
      return sendViaHttp(cfg, to, body);
  }
}

/** ── Low-stock alert ─────────────────────────────────────────────────────── */

export async function sendLowStockAlert(
  storeId: string,
): Promise<{ sent: number; failed: number }> {
  const lowStock = await prisma.product.findMany({
    where: {
      storeId,
    },
    select: {
      name: true,
      model: true,
      stock: true,
      minStock: true,
    },
    orderBy: { stock: "asc" },
  });

  // Filter in JS since Prisma SQLite can't do column-to-column comparisons natively
  const lowStockFiltered = lowStock.filter((p) => Number(p.stock) <= Number(p.minStock));

  if (lowStockFiltered.length === 0) return { sent: 0, failed: 0 };

  // Recipient: store's contact phone (only phone field in current schema)
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { name: true, phone: true },
  });
  const recipients = store?.phone ? [store.phone] : [];

  let sent = 0;
  let failed = 0;

  const lines = lowStockFiltered.map((p) => {
    const deficit = Math.max(0, Number(p.minStock) - Number(p.stock));
    return `${p.name} (${p.model ?? "-"}) — stock: ${p.stock} (min: ${p.minStock}) — deficit: ${deficit}`;
  });

  const header = `=== LOW STOCK ALERT ===\n` +
    `Shop: ${store?.name ?? storeId}\n` +
    `Items: ${lowStockFiltered.length}\n`;

  for (const phone of recipients) {
    const ok = await sendSms(phone, header + lines.join("\n") + "\n— RetailOS");
    ok ? sent++ : failed++;
  }

  return { sent, failed };
}

/** ── Due-payment reminder ────────────────────────────────────────────────── */

export async function sendDueReminders(storeId: string): Promise<{ sent: number; failed: number }> {
  // Find sales with outstanding dues — `dueDate` is in the past or today
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const dues = await prisma.sale.findMany({
    where: {
      storeId,
      dueAmount: { gt: 0 },
      dueDate: { lte: now },
    },
    select: {
      invoiceId: true,
      dueAmount: true,
      dueDate: true,
      customer: { select: { name: true, phone: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  let sent = 0;
  let failed = 0;

  for (const sale of dues) {
    if (!sale.customer?.phone) {
      failed++;
      continue;
    }
    const daysOverdue = Math.floor((now.getTime() - sale.dueDate!.getTime()) / 86_400_000);
    const prefix = daysOverdue > 0
      ? `Payment overdue by ${daysOverdue} day${daysOverdue > 1 ? "s" : ""}. `
      : "";

    const body =
      `Dear ${sale.customer.name},\n` +
      `${prefix}Invoice ${sale.invoiceId}: ৳${sale.dueAmount.toFixed(2)} due.\n` +
      `Please visit the shop to clear your balance at your earliest convenience.\n` +
      `— RetailOS`;

    const ok = await sendSms(sale.customer.phone, body);
    ok ? sent++ : failed++;
  }

  return { sent, failed };
}

/** ── Tenant-aware wrappers (by storeId) ──────────────────────────────────── */

export async function runAllAlerts(storeId: string) {
  const [stock, dues] = await Promise.all([
    sendLowStockAlert(storeId),
    sendDueReminders(storeId),
  ]);
  return { stock, dues };
}

/** ── Helper: normalise BD phone to E.164 ─────────────────────────────────── */

/**
 * Turn:
 *   "0171xxxxxxx"   → "+880171xxxxxxx"
 *   "0171xxxxxxx"   → "+880171xxxxxxx"
 *   "+880171xxxxxxx" → "+880171xxxxxxx"
 *   "880171xxxxxxx" →  "+880171xxxxxxx"
 */
function normaliseBdPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("880") && digits.length === 13) return `+${digits}`;
  if (digits.startsWith("01") && digits.length === 11) return `+88${digits}`;
  return raw.startsWith("+") ? raw : `+${digits}`;
}
