"""Place a TopUpKit order and wait until it settles.

Usage: TOPUPKIT_API_KEY=your_key python place_order.py <item> <playerId> [serverId]
To resend an order after a crash, run again with TOPUPKIT_IDEMPOTENCY_KEY set
to the key this script printed: you get the first order back, never a second one.
Python 3.9+, standard library only.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request
import uuid

BASE = os.environ.get("TOPUPKIT_BASE_URL", "https://topupkit.com")
KEY = os.environ.get("TOPUPKIT_API_KEY")


def call(path, method="GET", body=None, headers=None):
    """Retries network errors and timeouts only. Safe for the POST because every
    try sends the same Idempotency-Key, so the server never pays twice."""
    req = urllib.request.Request(
        BASE + path,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={
            "Authorization": f"Bearer {KEY}",
            "Content-Type": "application/json",
            **(headers or {}),
        },
    )
    for attempt in range(1, 4):
        try:
            res = urllib.request.urlopen(req, timeout=30)
        except urllib.error.HTTPError as e:
            res = e  # 4xx/5xx still carry a JSON body
        except OSError as e:  # URLError, socket timeout, connection reset
            if attempt == 3:
                raise
            print(f"Network error, retrying ({attempt}/3): {e}", file=sys.stderr)
            time.sleep(2 * attempt)
            continue
        with res:
            if "application/json" not in (res.headers.get("Content-Type") or ""):
                raise RuntimeError(f"Server answered {res.status} without JSON")
            payload = json.load(res)
        if not payload["ok"]:
            raise RuntimeError(f"{payload['error']['code']}: {payload['error']['message']}")
        return payload["data"]


def main():
    if not KEY or len(sys.argv) < 3:
        sys.exit("Usage: TOPUPKIT_API_KEY=... python place_order.py <item> <playerId> [serverId]")
    item, player_id = sys.argv[1], sys.argv[2]
    body = {"item": item, "playerId": player_id}
    if len(sys.argv) > 3:
        body["serverId"] = sys.argv[3]

    idempotency_key = os.environ.get("TOPUPKIT_IDEMPOTENCY_KEY") or str(uuid.uuid4())
    print(f"Idempotency-Key: {idempotency_key}")

    order = call("/api/orders", "POST", body, {"Idempotency-Key": idempotency_key})
    print(f"Order {order['id']} is {order['status']}")

    while order["status"] == "pending":
        time.sleep(3)
        order = call(f"/api/orders/{order['id']}")

    print(f"Order {order['id']} is {order['status']}", order.get("failureReason") or "")


if __name__ == "__main__":
    main()
