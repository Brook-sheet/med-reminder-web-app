import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import {
  buildTour,
  homeFor,
} from "../components/onboarding/tour-config";
import { isProductTourReadOnly } from "../lib/productTourReadOnly";
import User from "../models/User";

test(
  "general tours include account access and exclude standalone report generation",
  () => {
    for (
      const role of ["patient", "family"] as const
    ) {
      const steps = buildTour(role);

      assert(steps.length <= 8);

      assert(
        steps.some(
          (step) =>
            step.id === "account" &&
            step.openAccount,
        ),
      );

      assert(
        steps.some(
          (step) => step.route === "/profile",
        ),
      );

      assert(
        steps.some(
          (step) => step.route === "/settings",
        ),
      );

      assert(
        steps.every(
          (step) =>
            !step.route.startsWith("/reports"),
        ),
      );

      assert.equal(
        new Set(
          steps.map((step) => step.id),
        ).size,
        steps.length,
      );
    }
  },
);

test(
  "patient dashboard and medicines have detailed walkthroughs",
  () => {
    assert.deepEqual(
      buildTour(
        "patient",
        undefined,
        "dashboard",
      ).map((step) => step.id),
      [
        "overview",
        "loading-order",
        "schedule",
        "upcoming",
        "analysis",
        "insights",
        "notifications",
      ],
    );

    const medicines = buildTour(
      "patient",
      undefined,
      "medicines",
    );

    for (
      const id of [
        "add",
        "sort",
        "details",
        "times",
        "dose",
        "notes",
        "edit",
      ]
    ) {
      assert(
        medicines.some(
          (step) => step.id === id,
        ),
      );
    }

    assert(
      medicines.find(
        (step) => step.id === "notes",
      )?.optional,
    );
  },
);

test(
  "history is page-specific and never highlights Generate Report",
  () => {
    const steps = buildTour(
      "patient",
      undefined,
      "history",
    );

    assert(steps.length >= 5);

    assert(
      steps.every(
        (step) => step.route === "/history",
      ),
    );

    assert(
      !JSON.stringify(steps).includes(
        "Generate Report",
      ),
    );
  },
);

test(
  "page tours enforce role boundaries",
  () => {
    for (
      const id of [
        "dashboard",
        "medicines",
        "history",
      ] as const
    ) {
      assert.deepEqual(
        buildTour("family", undefined, id),
        [],
      );
    }

    for (
      const id of [
        "monitoring",
        "reports",
      ] as const
    ) {
      assert.deepEqual(
        buildTour("patient", undefined, id),
        [],
      );
    }

    assert.equal(
      homeFor("family"),
      "/monitor",
    );
  },
);

test(
  "family patient details require a connection and encode its ID",
  () => {
    assert.deepEqual(
      buildTour(
        "family",
        undefined,
        "reports",
      ),
      [],
    );

    const steps = buildTour(
      "family",
      "PT /example?",
      "reports",
    );

    assert(
      steps.every(
        (step) =>
          step.route ===
          "/reports/medication?patientID=PT%20%2Fexample%3F",
      ),
    );

    assert(
      buildTour(
        "family",
        "PT /example?",
        "monitoring",
      ).some(
        (step) =>
          step.route ===
          "/monitor/PT%20%2Fexample%3F",
      ),
    );

    assert(
      buildTour(
        "family",
        undefined,
        "monitoring",
      ).every(
        (step) =>
          step.route === "/monitor",
      ),
    );
  },
);

test(
  "page maintenance hint is scoped to the authenticated account",
  () => {
    const request = new NextRequest(
      "https://example.com/api/dashboard",
      {
        headers: {
          cookie: "rx_product_tour=patient-a",
        },
      },
    );

    assert.equal(
      isProductTourReadOnly(
        request,
        "patient-a",
      ),
      true,
    );

    assert.equal(
      isProductTourReadOnly(
        request,
        "patient-b",
      ),
      false,
    );

    assert.equal(
      isProductTourReadOnly(
        new NextRequest(
          "https://example.com/api/dashboard",
        ),
        "patient-a",
      ),
      false,
    );
  },
);

test(
  "new and legacy user documents default both tours without changing profile onboarding",
  () => {
    const user = new User({
      email: "test@example.com",
      role: "patient",
      onboardingCompleted: true,
    });

    assert.equal(
      user.onboardingCompleted,
      true,
    );

    assert.equal(
      user.productTour.patient,
      "not_started",
    );

    assert.equal(
      user.productTour.family,
      "not_started",
    );

    const legacy = User.hydrate({
      email: "legacy@example.com",
      role: "family",
    });

    assert.equal(
      legacy.productTour.family,
      "not_started",
    );

    user.productTour.patient = "completed";

    assert.equal(
      user.productTour.family,
      "not_started",
    );

    user.productTour.family = "invalid";

    assert(
      user.validateSync()?.errors[
        "productTour.family"
      ],
    );
  },
);