// Place a TopUpKit order and wait until it settles.
// Usage: TOPUPKIT_API_KEY=your_key node place-order.mjs <item> <playerId> [serverId]
// To resend an order after a crash, run again with TOPUPKIT_IDEMPOTENCY_KEY set
// to the key this script printed: you get the first order back, never a second one.
// Node 18+ (built-in fetch). No dependencies.
import { randomUUID } from "node:crypto";

const BASE = process.env.TOPUPKIT_BASE_URL ?? "https://topupkit.com";
const KEY = process.env.TOPUPKIT_API_KEY;
const [item, playerId, serverId] = process.argv.slice(2);

if (!KEY || !item || !playerId) {
  console.error("Usage: TOPUPKIT_API_KEY=... node place-order.mjs <item> <playerId> [serverId]");
  process.exit(1);
}

// Retries network errors and timeouts only. Safe for the POST because every
// try sends the same Idempotency-Key, so the server never pays twice.
async function call(path, init = {}) {
  for (let attempt = 1; ; attempt++) {
    let res;
    try {
      res = await fetch(BASE + path, {
        ...init,
        signal: AbortSignal.timeout(30_000),
        headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...init.headers },
      });
    } catch (error) {
      if (attempt === 3) throw error;
      console.error(`Network error, retrying (${attempt}/3): ${error.message}`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
      continue;
    }
    if (!res.headers.get("content-type")?.includes("application/json")) {
      throw new Error(`Server answered ${res.status} without JSON`);
    }
    const body = await res.json();
    if (!body.ok) throw new Error(`${res.status} ${body.error.code}: ${body.error.message}`);
    return body.data;
  }
}

const idempotencyKey = process.env.TOPUPKIT_IDEMPOTENCY_KEY ?? randomUUID();
console.log(`Idempotency-Key: ${idempotencyKey}`);

let order = await call("/api/orders", {
  method: "POST",
  headers: { "Idempotency-Key": idempotencyKey },
  body: JSON.stringify({ item, playerId, ...(serverId && { serverId }) }),
});
console.log(`Order ${order.id} is ${order.status}`);

while (order.status === "pending") {
  await new Promise((r) => setTimeout(r, 3000));
  order = await call(`/api/orders/${order.id}`);
}

console.log(`Order ${order.id} is ${order.status}`, order.failureReason ?? order.playerNickname ?? "");
