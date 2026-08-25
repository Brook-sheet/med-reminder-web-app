// tests/rxBoxIntegration.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  authorizeRxBoxCredentials,
  RxBoxSecurityError,
  validateRxBoxConfiguration,
} from '../lib/rxBoxSecurityCore';

import {
  buildRxBoxDailyPlan,
  isValidRxBoxChamberId,
  rxBoxEventIdentity,
  uniqueRxBoxLogIds,
  type RxBoxDoseInput,
} from '../lib/rxBoxPlanCore';

import {
  buildFourChamberRows,
} from '../lib/rxBoxUi';

const OPTIONS = {
  deviceId:
    'box_1',

  date:
    '2026-08-25',

  timezone:
    'Asia/Manila',
};

function dose(
  logId: string,
  medicineName: string,
  scheduledTime: string,
  overrides:
    Partial<RxBoxDoseInput> = {}
): RxBoxDoseInput {
  return {
    logId,

    medicineId:
      `medicine-${logId}`,

    medicineName,

    dosage:
      '1mg',

    scheduledTime,

    pillsPerDose:
      1,

    medicineCreatedAt:
      `2026-08-20T00:00:0${
        logId.slice(-1) ||
        '0'
      }.000Z`,

    logStatus:
      'pending',

    ...overrides,
  };
}

test(
  'maps 8 AM, 9 AM, and 8 PM medicines to Chambers 1, 2, and 3',
  () => {
    const plan =
      buildRxBoxDailyPlan(
        [
          dose(
            '1',
            'Metformin',
            '8:00 AM'
          ),

          dose(
            '2',
            'Losartan',
            '9:00 AM'
          ),

          dose(
            '3',
            'Amlodipine',
            '8:00 PM'
          ),
        ],
        OPTIONS
      );

    assert.deepEqual(
      plan.loadingPlan.map(
        (item) => [
          item.chamberId,
          item.medicineName,
        ]
      ),
      [
        [
          1,
          'Metformin',
        ],

        [
          2,
          'Losartan',
        ],

        [
          3,
          'Amlodipine',
        ],
      ]
    );
  }
);

test(
  'the loading-order UI always contains four rows and leaves Chamber 4 unassigned',
  () => {
    const plan =
      buildRxBoxDailyPlan(
        [
          dose(
            '1',
            'Metformin',
            '8:00 AM'
          ),

          dose(
            '2',
            'Losartan',
            '9:00 AM'
          ),

          dose(
            '3',
            'Amlodipine',
            '8:00 PM'
          ),
        ],
        OPTIONS
      );

    const rows =
      buildFourChamberRows(
        plan.loadingPlan
      );

    assert.equal(
      rows.length,
      4
    );

    assert.equal(
      rows[3],
      null
    );
  }
);

test(
  'groups two different medicines at 8 AM with sequential chambers',
  () => {
    const plan =
      buildRxBoxDailyPlan(
        [
          dose(
            '1',
            'Metformin',
            '8:00 AM'
          ),

          dose(
            '2',
            'Losartan',
            '8:00 AM'
          ),
        ],
        OPTIONS
      );

    assert.equal(
      plan.groups.length,
      1
    );

    assert.deepEqual(
      plan.groups[0]
        .chamberIds,
      [
        1,
        2,
      ]
    );

    assert.deepEqual(
      plan.groups[0]
        .logIds,
      [
        '1',
        '2',
      ]
    );
  }
);

test(
  'a two-pill dose consumes two chambers but remains one adherence log',
  () => {
    const plan =
      buildRxBoxDailyPlan(
        [
          dose(
            'one-log',
            'Metformin',
            '8:00 AM',
            {
              pillsPerDose:
                2,
            }
          ),
        ],
        OPTIONS
      );

    assert.deepEqual(
      plan.loadingPlan.map(
        (item) =>
          item.chamberId
      ),
      [
        1,
        2,
      ]
    );

    assert.deepEqual(
      plan.groups[0]
        .logIds,
      [
        'one-log',
      ]
    );
  }
);

test(
  'more than four pills disables hardware with no partial loading plan',
  () => {
    const plan =
      buildRxBoxDailyPlan(
        [
          dose(
            '1',
            'A',
            '8:00 AM',
            {
              pillsPerDose:
                4,
            }
          ),

          dose(
            '2',
            'B',
            '9:00 AM'
          ),
        ],
        OPTIONS
      );

    assert.equal(
      plan.capacity.required,
      5
    );

    assert.equal(
      plan.capacity.maximum,
      4
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

    assert.equal(
      plan
        .proposedLoadingItems
        .length,
      5
    );
  }
);

test(
  'rejects an unknown device even when the sensor key is correct',
  () => {
    assert.throws(
      () =>
        authorizeRxBoxCredentials(
          {
            sensorApiKey:
              'correct-secret',

            configuredDeviceId:
              'box_1',

            mappedUserId:
              '507f1f77bcf86cd799439011',
          },

          'correct-secret',

          'box_2'
        ),

      (error) =>
        error instanceof
          RxBoxSecurityError &&
        error.code ===
          'RX_BOX_UNKNOWN_DEVICE'
    );
  }
);

test(
  'rejects missing or invalid sensor keys without a development fallback',
  () => {
    assert.throws(
      () =>
        validateRxBoxConfiguration({
          RX_BOX_DEVICE_ID:
            'box_1',

          DEFAULT_DEVICE_USER_ID:
            '507f1f77bcf86cd799439011',
        }),

      (error) =>
        error instanceof
          RxBoxSecurityError &&
        error.code ===
          'RX_BOX_SENSOR_KEY_NOT_CONFIGURED'
    );

    assert.throws(
      () =>
        authorizeRxBoxCredentials(
          {
            sensorApiKey:
              'correct-secret',

            configuredDeviceId:
              'box_1',

            mappedUserId:
              '507f1f77bcf86cd799439011',
          },

          'wrong-secret',

          'box_1'
        ),

      (error) =>
        error instanceof
          RxBoxSecurityError &&
        error.code ===
          'RX_BOX_UNAUTHORIZED'
    );
  }
);

test(
  'a missing patient mapping fails closed instead of permitting an all-user query',
  () => {
    assert.throws(
      () =>
        validateRxBoxConfiguration({
          SENSOR_API_KEY:
            'correct-secret',

          RX_BOX_DEVICE_ID:
            'box_1',

          DEFAULT_DEVICE_USER_ID:
            '',
        }),

      (error) =>
        error instanceof
          RxBoxSecurityError &&
        error.code ===
          'RX_BOX_PATIENT_MAPPING_INVALID'
    );
  }
);

test(
  'duplicate event IDs resolve to the same idempotency identity',
  () => {
    assert.equal(
      rxBoxEventIdentity(
        'box_1',
        'event-123'
      ),

      rxBoxEventIdentity(
        'box_1',
        'event-123'
      )
    );

    assert.notEqual(
      rxBoxEventIdentity(
        'box_1',
        'event-123'
      ),

      rxBoxEventIdentity(
        'box_1',
        'event-124'
      )
    );
  }
);

test(
  'one pickup group targets every unique medication log exactly once',
  () => {
    assert.deepEqual(
      uniqueRxBoxLogIds([
        'log-1',
        'log-2',
        'log-1',
        'log-2',
      ]),

      [
        'log-1',
        'log-2',
      ]
    );
  }
);

test(
  'all four physical chamber IDs pass validation',
  () => {
    assert.deepEqual(
      [
        1,
        2,
        3,
        4,
      ].map(
        isValidRxBoxChamberId
      ),

      [
        true,
        true,
        true,
        true,
      ]
    );

    assert.equal(
      isValidRxBoxChamberId(
        0
      ),
      false
    );

    assert.equal(
      isValidRxBoxChamberId(
        5
      ),
      false
    );
  }
);

test(
  'repeated polling produces the same plan and group IDs without reordering',
  () => {
    const doses = [
      dose(
        '2',
        'Losartan',
        '8:00 AM'
      ),

      dose(
        '1',
        'Metformin',
        '8:00 AM'
      ),
    ];

    const first =
      buildRxBoxDailyPlan(
        doses,
        OPTIONS
      );

    const second =
      buildRxBoxDailyPlan(
        [
          ...doses,
        ].reverse(),
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
  'a backend-dispensed group is non-pending after an ESP32 restart',
  () => {
    const plan =
      buildRxBoxDailyPlan(
        [
          dose(
            '1',
            'Metformin',
            '8:00 AM',
            {
              logStatus:
                'dispensed',
            }
          ),
        ],
        OPTIONS
      );

    assert.equal(
      plan.groups[0]
        .status,
      'dispensed'
    );
  }
);