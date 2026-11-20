// Place a TopUpKit order and wait until it settles.
// Usage: TOPUPKIT_API_KEY=your_key node place-order.mjs <item> <playerId> [serverId]
// Node 18+ (built-in fetch). No dependencies.
import { randomUUID } from "node:crypto";

const BASE = process.env.TOPUPKIT_BASE_URL ?? "https://topupkit.com";
const KEY = process.env.TOPUPKIT_API_KEY;
const [item, playerId, serverId] = process.argv.slice(2);

if (!KEY || !item || !playerId) {
  console.error("Usage: TOPUPKIT_API_KEY=... node place-order.mjs <item> <playerId> [serverId]");
  process.exit(1);
}

async function call(path, init = {}) {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...init.headers },
  });
  const body = await res.json();
  if (!body.ok) throw new Error(`${res.status} ${body.error.code}: ${body.error.message}`);
  return body.data;
}

// Keep this key with your own order. Resending it never pays twice.
const idempotencyKey = randomUUID();

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
