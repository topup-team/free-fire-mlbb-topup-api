# TopUpKit API: Free Fire & MLBB Diamond Top Up API

**REST API to top up Free Fire diamonds (Garena) and Mobile Legends (MLBB), Magic Chess: Go Go and Blood Strike diamonds (Smile One) automatically.**
Place diamond orders from your own top-up shop, Telegram bot, WhatsApp bot or reseller website with one HTTP call. Each order is paid by your own Garena Shell or Smile Coin account.

[Website](https://topupkit.com) · [Full API documentation](https://topupkit.com/en/api-docs) · [Examples](examples/) · [FAQ](#faq)

**Keywords:** Free Fire top up API, Free Fire diamond API, Garena top up API, Garena Shell, MLBB diamond API, Mobile Legends top up API, Smile One API, SmileOne API, Smile Coin, Magic Chess Go Go top up, Blood Strike top up, game top up API, diamond reseller API, top up bot, PPOB.

---

## Why TopUpKit

- **One API, many games.** Free Fire (Garena, regions KH, MY, SG, PH, VN, TW), Mobile Legends, Magic Chess: Go Go and Blood Strike (SmileOne).
- **Your accounts, your Shell.** Orders are paid from your own supplier accounts. TopUpKit never holds your balance.
- **Safe retries.** Send an `Idempotency-Key` and a timed-out request can be resent without paying twice.
- **Signed callbacks.** Get an HMAC-SHA256 signed webhook when an order finishes. No polling needed.
- **Clear failures.** A refused order comes back with a machine-readable `failureReason`, and the supplier took nothing.

## Use cases

- **Free Fire diamond shop website.** Customer pays you, your backend calls `POST /api/orders`, diamonds land on their Free Fire ID.
- **Telegram or WhatsApp top-up bot.** The bot takes a player ID and an item, then places the order and replies when the callback arrives.
- **MLBB diamond reseller.** Sell Mobile Legends and Magic Chess: Go Go diamonds through Smile One without logging in by hand for each order.
- **Bulk or scheduled top ups.** Script orders from a spreadsheet or your own admin panel. `Idempotency-Key` keeps reruns from paying twice.

## Quick start

1. Sign up at [topupkit.com](https://topupkit.com) and create an API key on the **API keys** page. It is shown once.
2. Open your Garena or SmileOne account page and press **Use for API orders**. Garena needs one account for each region.
3. List the items a game sells now:

```bash
curl "https://topupkit.com/api/items?game=freefire&region=KH" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

```json
{
  "ok": true,
  "data": [
    { "item": "freefire-KH-100", "name": "100 Diamonds", "price": "86 Shell", "costMinorUnits": 15652 }
  ]
}
```

4. Place an order:

```bash
curl -X POST "https://topupkit.com/api/orders" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: my-order-1001" \
  -d '{ "item": "freefire-KH-100", "playerId": "123456789" }'
```

The answer comes straight away with `"status": "pending"`. Payment runs in the background, usually in under a minute. Read the order or wait for the callback to get the result.

> Keep your API key on your server. Anyone who has it can spend the Shell and Smile Coin on your accounts. Never put it in a website or a phone app.

## Endpoints

| Method | Path | What it does |
| ------ | ---- | ------------ |
| `GET`  | `/api/items?game=&region=` | Items a game sells now, with the item code to order |
| `POST` | `/api/orders` | Place an order (`201` new, `200` repeated `Idempotency-Key`) |
| `GET`  | `/api/orders/{id}` | Read one order |
| `GET`  | `/api/orders?supplier=&search=&page=` | List your orders, newest first, 20 per page |

### Games

| `game` | Notes |
| ------ | ----- |
| `freefire` | `region` required on the item list. The item code carries the region: `freefire-KH-100`. |
| `mobilelegends` | Send `serverId` (the Zone ID) with the order. |
| `magicchessgogo` | Send `serverId` with the order. |
| `bloodstrike` | No `serverId`, no region. |

### Order body

| Field | Type | Notes |
| ----- | ---- | ----- |
| `item` | string, required | Item code from the item list. |
| `playerId` | string, required | Digits only, up to 20. |
| `serverId` | string, optional | Mobile Legends Zone ID or Magic Chess: Go Go Server ID. |
| `accountId` | string, optional | Supplier account that pays. Defaults to your API account for that supplier. |

### Order statuses

| Status | Meaning |
| ------ | ------- |
| `pending` | Accepted, still being paid. Becomes `unknown` after 10 minutes. |
| `success` | Supplier accepted the order and took the Shell or Smile Coin. |
| `failed` | Supplier took nothing. `failureReason` says why. |
| `unknown` | Answer was lost. Check the account history before ordering again. |

Failure reasons: `player_not_found`, `player_region_not_allowed`, `item_not_available`, `insufficient_shell`, `otp_rejected`, `garena_refused`, `garena_unavailable`, `smileone_account_expired`, `smileone_refused`, `smileone_unavailable`.

### Response format

Every response is JSON with an `ok` field. Branch on `error.code`, never on `error.message`.

```json
{ "ok": false, "error": { "code": "UNAUTHORIZED", "message": "…" } }
```

| HTTP | Code |
| ---- | ---- |
| 400 | `INVALID_JSON`, `VALIDATION_ERROR` |
| 401 | `UNAUTHORIZED` |
| 404 | `NOT_FOUND` |
| 409 | `NO_DEFAULT_ACCOUNT`, `GARENA_ACCOUNT_NOT_READY_FOR_ORDERS` |
| 413 | `PAYLOAD_TOO_LARGE` |
| 500 | `INTERNAL_ERROR` |

## Callbacks (webhooks)

Set an `https://` address on your API key. When an order finishes (`success`, `failed` or `unknown`) your server gets:

```http
POST /your-callback-url
Content-Type: application/json
X-Callback-Event: order.settled
X-Callback-Timestamp: 1768465804
X-Callback-Signature: sha256=5f8d0c…
```

The signature is `HMAC-SHA256(secret, timestamp + "." + rawBody)`. Always verify it: anyone who finds your address can send a fake "success". Answer `2xx` within 10 seconds. Failed deliveries are retried up to five more times over about six hours, so ignore repeats by order `id`.

See [examples/node/callback-server.mjs](examples/node/callback-server.mjs).

## Examples

| File | Shows |
| ---- | ----- |
| [examples/node/place-order.mjs](examples/node/place-order.mjs) | Place an order and poll until it settles (Node 18+, no dependencies) |
| [examples/node/callback-server.mjs](examples/node/callback-server.mjs) | Receive and verify signed callbacks |
| [examples/python/place_order.py](examples/python/place_order.py) | Place an order and poll (Python 3, standard library only) |

```bash
TOPUPKIT_API_KEY=your_key node examples/node/place-order.mjs freefire-KH-100 123456789
```

## FAQ

**Is this an official Garena or Smile One API?**
No. TopUpKit is an independent service. It places orders through the Garena and Smile One accounts you connect, and those accounts pay for them.

**Which Free Fire regions work?**
Cambodia (KH), Malaysia (MY), Singapore (SG), Philippines (PH), Vietnam (VN) and Taiwan (TW).

**How do I top up Mobile Legends (MLBB) diamonds by API?**
List items with `GET /api/items?game=mobilelegends`, then `POST /api/orders` with `item`, `playerId` and `serverId` (the Zone ID).

**Do I get the player's nickname?**
Yes. A settled order carries `playerNickname` once the supplier returns it.

**What happens if my request times out?**
Send it again with the same `Idempotency-Key`. You get the first order back and nothing is paid twice.

**Which languages can I use?**
Any language that can send HTTPS requests. This repo has Node.js and Python examples, and the curl commands above work from PHP, Go or anything else.

## Links

- Website: https://topupkit.com
- Full API documentation: https://topupkit.com/en/api-docs

This repository holds public examples only. TopUpKit itself is a hosted service.

## License

Examples are MIT licensed. See [LICENSE](LICENSE).
