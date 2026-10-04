import assert from "node:assert/strict";
import test, { beforeEach, afterEach } from "node:test";
import { NextRequest } from "next/server";
import { isTourPreferenceOriginAllowed } from "../lib/tourPreferenceOrigin";

let previousAppUrl: string | undefined;

beforeEach(() => {
  previousAppUrl = process.env.APP_URL;
  process.env.APP_URL = "https://rxbox.example";
});

afterEach(() => {
  if (previousAppUrl === undefined) {
    delete process.env.APP_URL;
  } else {
    process.env.APP_URL = previousAppUrl;
  }
});

test(
  "tour preference saves accept public app origins behind a proxy",
  () => {
    const request = new NextRequest(
      "http://localhost:3000/api/onboarding",
      {
        headers: {
          origin: "https://rxbox.example",
          "sec-fetch-site": "same-origin",
        },
      },
    );

    assert.equal(
      isTourPreferenceOriginAllowed(request),
      true,
    );
  },
);

test(
  "tour preference saves reject foreign and malformed origins",
  () => {
    for (const origin of [
      "https://attacker.example",
      "null",
      "not-a-url",
      "https://rxbox.example/path",
    ]) {
      const request = new NextRequest(
        "https://rxbox.example/api/onboarding",
        {
          headers: { origin },
        },
      );

      assert.equal(
        isTourPreferenceOriginAllowed(request),
        false,
      );
    }
  },
);

test(
  "tour preference saves accept direct origins and non-browser clients",
  () => {
    for (const headers of [
      { origin: "http://localhost:3000" },
      undefined,
    ]) {
      const request = new NextRequest(
        "http://localhost:3000/api/onboarding",
        { headers },
      );

      assert.equal(
        isTourPreferenceOriginAllowed(request),
        true,
      );
    }

    const crossSiteRequest = new NextRequest(
      "https://rxbox.example/api/onboarding",
      {
        headers: {
          origin: "https://rxbox.example",
          "sec-fetch-site": "cross-site",
        },
      },
    );

    assert.equal(
      isTourPreferenceOriginAllowed(crossSiteRequest),
      false,
    );
  },
);