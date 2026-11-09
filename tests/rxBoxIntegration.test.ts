
import assert from "node:assert/strict";
import test from "node:test";

import {
  authorizeRxBoxCredentials,
  RxBoxSecurityError,
  validateRxBoxConfiguration,
} from "../lib/rxBoxSecurityCore";

import {
  buildRxBoxDailyPlan,
  isValidRxBoxChamberId,
  rxBoxEventIdentity,
  uniqueRxBoxLogIds,
  type RxBoxDoseInput,
} from "../lib/rxBoxPlanCore";

import {
  buildFourChamberRows,
} from "../lib/rxBoxUi";

const OPTIONS = {
  deviceId: "box_1",
  date: "2026-08-25",
  timezone: "Asia/Manila",
};

function dose(
  logId: string,
  medicineName: string,
  scheduledTime: string,
  chamberIds: number[],
  overrides: Partial<RxBoxDoseInput> = {}
): RxBoxDoseInput {
  return {
    logId,
    medicineId: `medicine-${logId}`,
    medicineName,
    dosage: "1mg",
    scheduledTime,
    pillsPerDose: 1,
    medicineCreatedAt:
      "2026-08-20T00:00:00.000Z",
    logStatus: "pending",
    chamberIds,
    ...overrides,
  };
}

test(
  "uses manually selected chambers instead of automatic time order",
  () => {
    const plan = buildRxBoxDailyPlan(
      [
        dose(
          "1",
          "Metformin",
          "8:00 AM",
          [3]
        ),
        dose(
          "2",
          "Losartan",
          "9:00 AM",
          [1]
        ),
        dose(
          "3",
          "Amlodipine",
          "8:00 PM",
          [4]
        ),
      ],
      OPTIONS
    );

    assert.equal(
      plan.hardwareDispensingEnabled,
      true
    );

    assert.deepEqual(
      plan.loadingPlan.map(
        (item) => [
          item.chamberId,
          item.medicineName,
        ]
      ),
      [
        [3, "Metformin"],
        [1, "Losartan"],
        [4, "Amlodipine"],
      ]
    );
  }
);

test(
  "keeps four physical chamber rows",
  () => {
    const plan = buildRxBoxDailyPlan(
      [
        dose(
          "1",
          "Metformin",
          "8:00 AM",
          [1]
        ),
        dose(
          "2",
          "Losartan",
          "9:00 AM",
          [2]
        ),
        dose(
          "3",
          "Amlodipine",
          "8:00 PM",
          [3]
        ),
      ],
      OPTIONS
    );

    const rows = buildFourChamberRows(
      plan.loadingPlan
    );

    assert.equal(rows.length, 4);
    assert.equal(rows[3], null);
  }
);

test(
  "allows two medicines at the same time to share one chamber",
  () => {
    const plan = buildRxBoxDailyPlan(
      [
        dose(
          "1",
          "Metformin",
          "8:00 AM",
          [2]
        ),
        dose(
          "2",
          "Losartan",
          "8:00 AM",
          [2]
        ),
      ],
      OPTIONS
    );

    assert.equal(
      plan.hardwareDispensingEnabled,
      true
    );

    assert.equal(
      plan.capacity.required,
      1
    );

    assert.equal(
      plan.loadingPlan.length,
      2
    );

    assert.deepEqual(
      plan.groups[0].chamberIds,
      [2]
    );

    assert.deepEqual(
      plan.groups[0].logIds,
      ["1", "2"]
    );
  }
);

test(
  "allows multiple pills in one manually assigned chamber",
  () => {
    const plan = buildRxBoxDailyPlan(
      [
        dose(
          "one-log",
          "Metformin",
          "8:00 AM",
          [1],
          {
            pillsPerDose: 2,
          }
        ),
      ],
      OPTIONS
    );

    assert.equal(
      plan.hardwareDispensingEnabled,
      true
    );

    assert.equal(
      plan.capacity.required,
      1
    );

    assert.deepEqual(
      plan.loadingPlan.map(
        (item) => item.chamberId
      ),
      [1]
    );

    assert.deepEqual(
      plan.groups[0].logIds,
      ["one-log"]
    );
  }
);

test(
  "supports one scheduled dose using multiple chambers",
  () => {
    const plan = buildRxBoxDailyPlan(
      [
        dose(
          "one-log",
          "Metformin",
          "8:00 AM",
          [1, 3],
          {
            pillsPerDose: 2,
          }
        ),
      ],
      OPTIONS
    );

    assert.equal(
      plan.hardwareDispensingEnabled,
      true
    );

    assert.deepEqual(
      plan.groups[0].chamberIds,
      [1, 3]
    );

    assert.deepEqual(
      plan.groups[0].logIds,
      ["one-log"]
    );
  }
);

test(
  "rejects one chamber assigned to different dispensing times",
  () => {
    const plan = buildRxBoxDailyPlan(
      [
        dose(
          "1",
          "Metformin",
          "8:00 AM",
          [1]
        ),
        dose(
          "2",
          "Losartan",
          "9:00 AM",
          [1]
        ),
      ],
      OPTIONS
    );

    assert.equal(
      plan.capacity.exceeded,
      true
    );

    assert.equal(
      plan.hardwareDispensingEnabled,
      false
    );

    assert.deepEqual(
      plan.loadingPlan,
      []
    );

    assert.deepEqual(
      plan.groups,
      []
    );
  }
);

test(
  "rejects a dose without a manual chamber assignment",
  () => {
    const plan = buildRxBoxDailyPlan(
      [
        dose(
          "1",
          "Metformin",
          "8:00 AM",
          []
        ),
      ],
      OPTIONS
    );

    assert.equal(
      plan.hardwareDispensingEnabled,
      false
    );

    assert.equal(
      plan.capacity.exceeded,
      true
    );

    assert.deepEqual(
      plan.groups,
      []
    );
  }
);

test(
  "rejects invalid chamber numbers",
  () => {
    const plan = buildRxBoxDailyPlan(
      [
        dose(
          "1",
          "Metformin",
          "8:00 AM",
          [5]
        ),
      ],
      OPTIONS
    );

    assert.equal(
      plan.hardwareDispensingEnabled,
      false
    );

    assert.deepEqual(
      plan.loadingPlan,
      []
    );
  }
);

test(
  "rejects different scheduled times sharing Chamber 4",
  () => {
    const plan = buildRxBoxDailyPlan(
      [
        dose(
          "1",
          "Metformin",
          "8:00 AM",
          [4]
        ),
        dose(
          "2",
          "Losartan",
          "8:00 PM",
          [4]
        ),
      ],
      OPTIONS
    );

    assert.equal(
      plan.hardwareDispensingEnabled,
      false
    );

    assert.deepEqual(
      plan.groups,
      []
    );
  }
);

test(
  "groups multiple medicines into one dispensing event",
  () => {
    const plan = buildRxBoxDailyPlan(
      [
        dose(
          "1",
          "Metformin",
          "8:00 AM",
          [1]
        ),
        dose(
          "2",
          "Losartan",
          "8:00 AM",
          [2]
        ),
        dose(
          "3",
          "Amlodipine",
          "8:00 AM",
          [2]
        ),
      ],
      OPTIONS
    );

    assert.equal(
      plan.groups.length,
      1
    );

    assert.deepEqual(
      plan.groups[0].chamberIds,
      [1, 2]
    );

    assert.deepEqual(
      plan.groups[0].logIds,
      ["1", "2", "3"]
    );
  }
);

test(
  "uses the same chamber assignments regardless of medicine input order",
  () => {
    const doses = [
      dose(
        "2",
        "Losartan",
        "8:00 AM",
        [3]
      ),
      dose(
        "1",
        "Metformin",
        "8:00 AM",
        [1]
      ),
    ];

    const first = buildRxBoxDailyPlan(
      doses,
      OPTIONS
    );

    const second = buildRxBoxDailyPlan(
      [...doses].reverse(),
      OPTIONS
    );

    assert.equal(
      first.planId,
      second.planId
    );

    assert.deepEqual(
      first.loadingPlan,
      second.loadingPlan
    );

    assert.deepEqual(
      first.groups,
      second.groups
    );
  }
);

test(
  "changing a manual chamber assignment changes the plan ID",
  () => {
    const first = buildRxBoxDailyPlan(
      [
        dose(
          "1",
          "Metformin",
          "8:00 AM",
          [1]
        ),
      ],
      OPTIONS
    );

    const second = buildRxBoxDailyPlan(
      [
        dose(
          "1",
          "Metformin",
          "8:00 AM",
          [3]
        ),
      ],
      OPTIONS
    );

    assert.notEqual(
      first.planId,
      second.planId
    );
  }
);

test(
  "a completed dose remains completed in the generated plan",
  () => {
    const plan = buildRxBoxDailyPlan(
      [
        dose(
          "1",
          "Metformin",
          "8:00 AM",
          [1],
          {
            logStatus: "taken",
          }
        ),
      ],
      OPTIONS
    );

    assert.equal(
      plan.groups[0].status,
      "taken"
    );
  }
);

test(
  "a dispensed group is not pending after ESP32 restart",
  () => {
    const plan = buildRxBoxDailyPlan(
      [
        dose(
          "1",
          "Metformin",
          "8:00 AM",
          [1],
          {
            logStatus: "dispensed",
          }
        ),
      ],
      OPTIONS
    );

    assert.equal(
      plan.groups[0].status,
      "dispensed"
    );
  }
);

test(
  "rejects an unknown device even when the sensor key is correct",
  () => {
    assert.throws(
      () =>
        authorizeRxBoxCredentials(
          {
            sensorApiKey: "correct-secret",
            configuredDeviceId: "box_1",
            mappedUserId:
              "507f1f77bcf86cd799439011",
          },
          "correct-secret",
          "box_2"
        ),
      (error) =>
        error instanceof RxBoxSecurityError &&
        error.code ===
          "RX_BOX_UNKNOWN_DEVICE"
    );
  }
);

test(
  "rejects missing or invalid sensor keys",
  () => {
    assert.throws(
      () =>
        validateRxBoxConfiguration({
          RX_BOX_DEVICE_ID: "box_1",
          DEFAULT_DEVICE_USER_ID:
            "507f1f77bcf86cd799439011",
        }),
      (error) =>
        error instanceof RxBoxSecurityError &&
        error.code ===
          "RX_BOX_SENSOR_KEY_NOT_CONFIGURED"
    );

    assert.throws(
      () =>
        authorizeRxBoxCredentials(
          {
            sensorApiKey: "correct-secret",
            configuredDeviceId: "box_1",
            mappedUserId:
              "507f1f77bcf86cd799439011",
          },
          "wrong-secret",
          "box_1"
        ),
      (error) =>
        error instanceof RxBoxSecurityError &&
        error.code ===
          "RX_BOX_UNAUTHORIZED"
    );
  }
);

test(
  "a missing patient mapping fails closed",
  () => {
    assert.throws(
      () =>
        validateRxBoxConfiguration({
          SENSOR_API_KEY: "correct-secret",
          RX_BOX_DEVICE_ID: "box_1",
          DEFAULT_DEVICE_USER_ID: "",
        }),
      (error) =>
        error instanceof RxBoxSecurityError &&
        error.code ===
          "RX_BOX_PATIENT_MAPPING_INVALID"
    );
  }
);

test(
  "duplicate event IDs produce the same identity",
  () => {
    assert.equal(
      rxBoxEventIdentity(
        "box_1",
        "event-123"
      ),
      rxBoxEventIdentity(
        "box_1",
        "event-123"
      )
    );

    assert.notEqual(
      rxBoxEventIdentity(
        "box_1",
        "event-123"
      ),
      rxBoxEventIdentity(
        "box_1",
        "event-124"
      )
    );
  }
);

test(
  "one pickup group contains unique medication log IDs",
  () => {
    assert.deepEqual(
      uniqueRxBoxLogIds([
        "log-1",
        "log-2",
        "log-1",
        "log-2",
      ]),
      ["log-1", "log-2"]
    );
  }
);

test(
  "only physical chamber IDs 1 to 4 are valid",
  () => {
    assert.deepEqual(
      [1, 2, 3, 4].map(
        isValidRxBoxChamberId
      ),
      [true, true, true, true]
    );

    assert.equal(
      isValidRxBoxChamberId(0),
      false
    );

    assert.equal(
      isValidRxBoxChamberId(5),
      false
    );
  }
);
