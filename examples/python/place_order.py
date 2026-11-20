"""Place a TopUpKit order and wait until it settles.

Usage: TOPUPKIT_API_KEY=your_key python place_order.py <item> <playerId> [serverId]
Python 3.8+, standard library only.
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
    try:
        with urllib.request.urlopen(req) as res:
            payload = json.load(res)
    except urllib.error.HTTPError as e:
        payload = json.load(e)
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

    # Keep this key with your own order. Resending it never pays twice.
    order = call("/api/orders", "POST", body, {"Idempotency-Key": str(uuid.uuid4())})
    print(f"Order {order['id']} is {order['status']}")

    while order["status"] == "pending":
        time.sleep(3)
        order = call(f"/api/orders/{order['id']}")

    print(f"Order {order['id']} is {order['status']}", order.get("failureReason") or "")


if __name__ == "__main__":
    main()
