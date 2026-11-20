// Receive TopUpKit callbacks and verify their signature.
// Usage: TOPUPKIT_SIGNING_SECRET=your_secret node callback-server.mjs
// Node 18+. No dependencies. Put it behind https in production.
import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";

const SECRET = process.env.TOPUPKIT_SIGNING_SECRET;
const PORT = Number(process.env.PORT ?? 8080);
const MAX_BODY_BYTES = 64 * 1024; // a callback is about 1 KB
const seen = new Set(); // use your database in production

/** rawBody: the request body exactly as received (Buffer or string). */
export function verify(headers, rawBody, secret, now = Date.now() / 1000) {
  const timestamp = headers["x-callback-timestamp"];
  const expected = Buffer.from(
    "sha256=" +
      createHmac("sha256", secret).update(`${timestamp}.`).update(rawBody).digest("hex"),
  );
  const received = Buffer.from(headers["x-callback-signature"] ?? "");
  return (
    received.length === expected.length &&
    timingSafeEqual(received, expected) &&
    Math.abs(now - Number(timestamp)) < 300
  );
}

// Start the server only when run directly, so verify() can be imported.
if (process.argv[1]?.endsWith("callback-server.mjs")) {
  if (!SECRET) {
    console.error("Set TOPUPKIT_SIGNING_SECRET");
    process.exit(1);
  }
  createServer((req, res) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        res.writeHead(413, { Connection: "close" }).end();
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      // Keep the bytes as bytes until verified: decoding chunk by chunk
      // would break multi-byte characters such as Khmer nicknames.
      const rawBody = Buffer.concat(chunks);
      if (!verify(req.headers, rawBody, SECRET)) {
        res.writeHead(401).end();
        return;
      }
      const order = JSON.parse(rawBody.toString("utf8"));
      if (req.headers["x-callback-event"] === "test") {
        console.log("Test callback received");
      } else if (!seen.has(order.id)) {
        seen.add(order.id);
        console.log(`Order ${order.id}: ${order.status}`, order.failureReason ?? "");
      }
      res.writeHead(204).end();
    });
  }).listen(PORT, () => console.log(`Listening on :${PORT}`));
}
