import test from "node:test";
import assert from "node:assert/strict";

import {
  accountIdSuffix,
  buildAccountIdentifier,
  normalizeAccountIdInput,
} from "../lib/accountIdentifier";

test(
  "reconstructs IDs and accepts pasted matching IDs without duplicate prefixes",
  () => {
    for (const prefix of ["FM-", "PT-"] as const) {
      assert.equal(
        buildAccountIdentifier(" abc123 ", prefix),
        `${prefix}ABC123`
      );

      assert.equal(
        buildAccountIdentifier(
          `${prefix.toLowerCase()}abc123`,
          prefix
        ),
        `${prefix}ABC123`
      );

      assert.equal(
        normalizeAccountIdInput(`${prefix}ABC123`, prefix),
        "ABC123"
      );

      assert.equal(buildAccountIdentifier("", prefix), "");
      assert.equal(buildAccountIdentifier(prefix, prefix), "");
    }
  }
);

test(
  "does not turn a pasted wrong-role ID into a valid target ID",
  () => {
    assert.equal(
      buildAccountIdentifier("FM-ABC123", "PT-"),
      "PT-FM-ABC123"
    );

    assert.equal(
      buildAccountIdentifier("PT-ABC123", "FM-"),
      "FM-PT-ABC123"
    );
  }
);

test("copy removes only the leading account prefix", () => {
  assert.equal(accountIdSuffix("PT-12345678"), "12345678");
  assert.equal(accountIdSuffix("FM-87654321"), "87654321");
  assert.equal(accountIdSuffix("ABC123"), "ABC123");
});