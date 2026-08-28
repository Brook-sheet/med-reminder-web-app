import assert from "node:assert/strict";
import test from "node:test";

import {
  maskPhilippineMobileNumber,
  normalizePhilippineMobileNumber,
} from "../lib/sms/phone";

import {
  configuredSmsProvider,
  sendSms,
} from "../lib/sms/index";

test(
  "normalizes common Philippine mobile formats",
  () => {
    assert.equal(
      normalizePhilippineMobileNumber(
        "09171234567"
      ),
      "+639171234567"
    );

    assert.equal(
      normalizePhilippineMobileNumber(
        "9171234567"
      ),
      "+639171234567"
    );

    assert.equal(
      normalizePhilippineMobileNumber(
        "+639171234567"
      ),
      "+639171234567"
    );

    assert.equal(
      normalizePhilippineMobileNumber(
        "+63 917-123-4567"
      ),
      "+639171234567"
    );
  }
);

test(
  "rejects invalid or incomplete Philippine numbers",
  () => {
    assert.equal(
      normalizePhilippineMobileNumber(
        "0917123456"
      ),
      null
    );

    assert.equal(
      normalizePhilippineMobileNumber(
        "+12025550123"
      ),
      null
    );

    assert.equal(
      normalizePhilippineMobileNumber(
        ""
      ),
      null
    );
  }
);

test(
  "masks a normalized family number",
  () => {
    assert.equal(
      maskPhilippineMobileNumber(
        "09171234567"
      ),
      "+63 917 *** 4567"
    );
  }
);

test(
  "disabled SMS provider skips safely",
  async () => {
    const previous =
      process.env
        .SMS_PROVIDER;

    process.env
      .SMS_PROVIDER =
      "disabled";

    try {
      assert.equal(
        configuredSmsProvider(),
        "disabled"
      );

      const result =
        await sendSms({
          to:
            "09171234567",

          message:
            "Test",

          idempotencyKey:
            "test-disabled",

          alertType:
            "TEST_SMS",
        });

      assert.equal(
        result.status,
        "skipped"
      );

      assert.equal(
        result.accepted,
        false
      );
    } finally {
      if (
        previous ===
        undefined
      ) {
        delete process
          .env
          .SMS_PROVIDER;
      } else {
        process.env
          .SMS_PROVIDER =
          previous;
      }
    }
  }
);

test(
  "missing TextBee configuration skips safely",
  async () => {
    const previousProvider =
      process.env
        .SMS_PROVIDER;

    const previousKey =
      process.env
        .TEXTBEE_API_KEY;

    const previousDevice =
      process.env
        .TEXTBEE_DEVICE_ID;

    process.env
      .SMS_PROVIDER =
      "textbee";

    delete process.env
      .TEXTBEE_API_KEY;

    delete process.env
      .TEXTBEE_DEVICE_ID;

    try {
      const result =
        await sendSms({
          to:
            "+639171234567",

          message:
            "Test",

          idempotencyKey:
            "test-no-config",

          alertType:
            "TEST_SMS",
        });

      assert.equal(
        result.provider,
        "textbee"
      );

      assert.equal(
        result.status,
        "skipped"
      );

      assert.equal(
        result.errorCode,
        "TEXTBEE_NOT_CONFIGURED"
      );
    } finally {
      if (
        previousProvider ===
        undefined
      ) {
        delete process.env
          .SMS_PROVIDER;
      } else {
        process.env
          .SMS_PROVIDER =
          previousProvider;
      }

      if (
        previousKey ===
        undefined
      ) {
        delete process.env
          .TEXTBEE_API_KEY;
      } else {
        process.env
          .TEXTBEE_API_KEY =
          previousKey;
      }

      if (
        previousDevice ===
        undefined
      ) {
        delete process.env
          .TEXTBEE_DEVICE_ID;
      } else {
        process.env
          .TEXTBEE_DEVICE_ID =
          previousDevice;
      }
    }
  }
);

test(
  "TextBee receives a normalized Philippine number and device ID",
  async () => {
    const previousProvider =
      process.env
        .SMS_PROVIDER;

    const previousKey =
      process.env
        .TEXTBEE_API_KEY;

    const previousDevice =
      process.env
        .TEXTBEE_DEVICE_ID;

    const originalFetch =
      globalThis.fetch;

    let capturedUrl =
      "";

    let capturedInit:
      | RequestInit
      | undefined;

    process.env
      .SMS_PROVIDER =
      "textbee";

    process.env
      .TEXTBEE_API_KEY =
      "server-secret";

    process.env
      .TEXTBEE_DEVICE_ID =
      "device-123";

    globalThis.fetch =
      async (
        input:
          | string
          | URL
          | Request,

        init?:
          RequestInit
      ) => {
        capturedUrl =
          String(
            input
          );

        capturedInit =
          init;

        return new Response(
          JSON.stringify({
            data: {
              success:
                true,

              smsBatchId:
                "batch-123",

              recipientCount:
                1,
            },
          }),
          {
            status:
              200,

            headers: {
              "Content-Type":
                "application/json",
            },
          }
        );
      };

    try {
      const result =
        await sendSms({
          to:
            "09171234567",

          message:
            "Rx Box test",

          idempotencyKey:
            "textbee-contract",

          alertType:
            "TEST_SMS",
        });

      assert.equal(
        capturedUrl,
        "https://api.textbee.dev/api/v1/gateway/send-sms"
      );

      const headers =
        capturedInit
          ?.headers as
          Record<
            string,
            string
          >;

      assert.equal(
        headers[
          "x-api-key"
        ],
        "server-secret"
      );

      const body =
        JSON.parse(
          String(
            capturedInit
              ?.body
          )
        );

      assert.deepEqual(
        body.recipients,
        [
          "+639171234567",
        ]
      );

      assert.equal(
        body.deviceId,
        "device-123"
      );

      assert.equal(
        result.status,
        "queued"
      );

      assert.equal(
        result.accepted,
        true
      );

      assert.equal(
        result
          .providerMessageId,
        "batch-123"
      );
    } finally {
      globalThis.fetch =
        originalFetch;

      if (
        previousProvider ===
        undefined
      ) {
        delete process.env
          .SMS_PROVIDER;
      } else {
        process.env
          .SMS_PROVIDER =
          previousProvider;
      }

      if (
        previousKey ===
        undefined
      ) {
        delete process.env
          .TEXTBEE_API_KEY;
      } else {
        process.env
          .TEXTBEE_API_KEY =
          previousKey;
      }

      if (
        previousDevice ===
        undefined
      ) {
        delete process.env
          .TEXTBEE_DEVICE_ID;
      } else {
        process.env
          .TEXTBEE_DEVICE_ID =
          previousDevice;
      }
    }
  }
);

test(
  "TextBee authentication and gateway failures are normalized",
  async () => {
    const previousProvider =
      process.env
        .SMS_PROVIDER;

    const previousKey =
      process.env
        .TEXTBEE_API_KEY;

    const previousDevice =
      process.env
        .TEXTBEE_DEVICE_ID;

    const originalFetch =
      globalThis.fetch;

    process.env
      .SMS_PROVIDER =
      "textbee";

    process.env
      .TEXTBEE_API_KEY =
      "server-secret";

    process.env
      .TEXTBEE_DEVICE_ID =
      "device-123";

    try {
      globalThis.fetch =
        async () =>
          new Response(
            JSON.stringify({
              message:
                "Invalid API key",
            }),
            {
              status:
                401,
            }
          );

      const authFailure =
        await sendSms({
          to:
            "+639171234567",

          message:
            "Test",

          idempotencyKey:
            "auth-failure",

          alertType:
            "TEST_SMS",
        });

      assert.equal(
        authFailure
          .errorCode,
        "TEXTBEE_AUTH_FAILED"
      );

      assert.equal(
        authFailure
          .status,
        "failed"
      );

      globalThis.fetch =
        async () =>
          new Response(
            JSON.stringify({
              message:
                "No enabled device to send from",
            }),
            {
              status:
                400,
            }
          );

      const gatewayFailure =
        await sendSms({
          to:
            "+639171234567",

          message:
            "Test",

          idempotencyKey:
            "gateway-failure",

          alertType:
            "TEST_SMS",
        });

      assert.equal(
        gatewayFailure
          .errorCode,
        "TEXTBEE_GATEWAY_UNAVAILABLE"
      );

      assert.equal(
        gatewayFailure
          .status,
        "failed"
      );
    } finally {
      globalThis.fetch =
        originalFetch;

      if (
        previousProvider ===
        undefined
      ) {
        delete process.env
          .SMS_PROVIDER;
      } else {
        process.env
          .SMS_PROVIDER =
          previousProvider;
      }

      if (
        previousKey ===
        undefined
      ) {
        delete process.env
          .TEXTBEE_API_KEY;
      } else {
        process.env
          .TEXTBEE_API_KEY =
          previousKey;
      }

      if (
        previousDevice ===
        undefined
      ) {
        delete process.env
          .TEXTBEE_DEVICE_ID;
      } else {
        process.env
          .TEXTBEE_DEVICE_ID =
          previousDevice;
      }
    }
  }
);