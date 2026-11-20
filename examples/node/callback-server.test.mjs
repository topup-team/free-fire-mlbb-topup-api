// Run from the repo root: node --test
import { createHmac } from "node:crypto";
import assert from "node:assert/strict";
import { test } from "node:test";

import { verify } from "./callback-server.mjs";

const secret = "test_secret";
const timestamp = "1768465804";
const now = 1768465810;
const body = Buffer.from(JSON.stringify({ id: "x", playerNickname: "ខ្មែរ 🔥" }));
const headers = {
  "x-callback-timestamp": timestamp,
  "x-callback-signature":
    "sha256=" + createHmac("sha256", secret).update(`${timestamp}.`).update(body).digest("hex"),
};

test("accepts a genuine callback", () => {
  assert.equal(verify(headers, body, secret, now), true);
});

test("rejects a changed body", () => {
  assert.equal(verify(headers, Buffer.concat([body, Buffer.from(" ")]), secret, now), false);
});

test("rejects an old timestamp", () => {
  assert.equal(verify(headers, body, secret, now + 600), false);
});

test("rejects a missing signature", () => {
  assert.equal(verify({ "x-callback-timestamp": timestamp }, body, secret, now), false);
});
