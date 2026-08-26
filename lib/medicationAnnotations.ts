import mongoose from 'mongoose';

import MedicationLog, {
  type IMedicationAnnotation,
  type MedicationAnnotationType,
} from '@/models/MedicationLog';

import MonitoringRequest from '@/models/MonitoringRequest';
import User from '@/models/User';

export interface PublicMedicationAnnotation {
  _id: string;
  type: MedicationAnnotationType;
  text: string;
  authorRole: 'patient' | 'family';
  authorName: string;
  createdAt: string;
}

export interface AddAnnotationResult {
  duplicate: boolean;
  annotation: PublicMedicationAnnotation;
}

const FINAL_STATUSES = [
  'taken',
  'late',
  'missed',
] as const;

function userDisplayName(user: {
  firstName?: string;
  middleName?: string;
  lastName?: string;
}): string {
  return [
    user.firstName,
    user.middleName,
    user.lastName,
  ]
    .map(
      (part) =>
        part?.trim()
    )
    .filter(Boolean)
    .join(' ') || 'User';
}

export function normalizeAnnotationText(
  value: unknown
): string {
  if (
    typeof value !==
    'string'
  ) {
    return '';
  }

  const text =
    value.trim();

  if (
    text.length >
    500
  ) {
    throw new Error(
      'Annotation text must not exceed 500 characters.'
    );
  }

  return text;
}

export function serializeAnnotations(
  annotations:
    | Array<
        Partial<IMedicationAnnotation>
      >
    | null
    | undefined
): PublicMedicationAnnotation[] {
  return (
    annotations ??
    []
  ).map(
    (annotation) => ({
      _id:
        annotation._id
          ?.toString() ??
        '',

      type:
        annotation.type as
          MedicationAnnotationType,

      text:
        annotation.text ??
        '',

      authorRole:
        annotation.authorRole ===
        'family'
          ? 'family'
          : 'patient',

      authorName:
        annotation.authorName ??
        'User',

      createdAt:
        annotation.createdAt instanceof
        Date
          ? annotation.createdAt.toISOString()
          : new Date(
              annotation.createdAt ??
                Date.now()
            ).toISOString(),
    })
  );
}

export async function appendPatientAnnotation(
  input: {
    patientId: string;
    logId: string;

    type:
      | 'patient_note'
      | 'missed_explanation';

    text: unknown;
  }
): Promise<PublicMedicationAnnotation> {
  if (
    !mongoose.isValidObjectId(
      input.logId
    )
  ) {
    throw new Error(
      'A valid medication log ID is required.'
    );
  }

  const text =
    normalizeAnnotationText(
      input.text
    );

  if (!text) {
    throw new Error(
      'Please enter a note or explanation.'
    );
  }

  const patient =
    await User.findOne({
      _id:
        input.patientId,

      role:
        'patient',

      isDeleted: {
        $ne:
          true,
      },
    })
      .select(
        'firstName middleName lastName'
      )
      .lean();

  if (!patient) {
    throw new Error(
      'Patient account was not found.'
    );
  }

  const requiredStatuses =
    input.type ===
    'missed_explanation'
      ? [
          'missed',
        ]
      : [
          'taken',
          'late',
        ];

  const annotation = {
    _id:
      new mongoose.Types.ObjectId(),

    type:
      input.type,

    text,

    authorId:
      new mongoose.Types.ObjectId(
        input.patientId
      ),

    authorRole:
      'patient' as const,

    authorName:
      userDisplayName(
        patient
      ),

    createdAt:
      new Date(),
  };

  const updated =
    await MedicationLog.updateOne(
      {
        _id:
          input.logId,

        userId:
          input.patientId,

        status: {
          $in:
            requiredStatuses,
        },
      },
      {
        $push: {
          annotations:
            annotation,
        },
      }
    );

  if (
    updated.matchedCount ===
    0
  ) {
    throw new Error(
      input.type ===
      'missed_explanation'
        ? 'A missed-dose explanation can only be added to your finalized missed medication record.'
        : 'A patient note can only be added to your finalized taken or late medication record.'
    );
  }

  return serializeAnnotations(
    [
      annotation,
    ]
  )[0];
}

export async function appendFamilyAcknowledgment(
  input: {
    familyId: string;
    logId: string;
    text: unknown;
  }
): Promise<AddAnnotationResult> {
  if (
    !mongoose.isValidObjectId(
      input.logId
    )
  ) {
    throw new Error(
      'A valid medication log ID is required.'
    );
  }

  const text =
    normalizeAnnotationText(
      input.text
    );

  const family =
    await User.findOne({
      _id:
        input.familyId,

      role:
        'family',

      isDeleted: {
        $ne:
          true,
      },
    })
      .select(
        'firstName middleName lastName'
      )
      .lean();

  if (!family) {
    throw new Error(
      'Family account was not found.'
    );
  }

  const log =
    await MedicationLog.findOne({
      _id:
        input.logId,

      status: {
        $in:
          FINAL_STATUSES,
      },
    })
      .select(
        'userId annotations'
      )
      .lean();

  if (!log) {
    throw new Error(
      'Only a finalized taken, late, or missed record can be acknowledged.'
    );
  }

  const approved =
    await MonitoringRequest.exists(
      {
        patientId:
          log.userId,

        familyId:
          input.familyId,

        status:
          'approved',
      }
    );

  if (!approved) {
    throw new Error(
      'You do not have active monitoring access to this patient.'
    );
  }

  const existing =
    (
      log.annotations ??
      []
    ).find(
      (annotation) =>
        annotation.type ===
          'family_acknowledgment' &&
        annotation.authorId
          ?.toString() ===
          input.familyId
    );

  if (existing) {
    return {
      duplicate:
        true,

      annotation:
        serializeAnnotations(
          [
            existing,
          ]
        )[0],
    };
  }

  const annotation = {
    _id:
      new mongoose.Types.ObjectId(),

    type:
      'family_acknowledgment' as const,

    text,

    authorId:
      new mongoose.Types.ObjectId(
        input.familyId
      ),

    authorRole:
      'family' as const,

    authorName:
      userDisplayName(
        family
      ),

    createdAt:
      new Date(),
  };

  const updated =
    await MedicationLog.findOneAndUpdate(
      {
        _id:
          input.logId,

        userId:
          log.userId,

        status: {
          $in:
            FINAL_STATUSES,
        },

        annotations: {
          $not: {
            $elemMatch: {
              type:
                'family_acknowledgment',

              authorId:
                new mongoose.Types.ObjectId(
                  input.familyId
                ),
            },
          },
        },
      },
      {
        $push: {
          annotations:
            annotation,
        },
      },
      {
        new:
          true,
      }
    );

  if (!updated) {
    const duplicateLog =
      await MedicationLog.findById(
        input.logId
      )
        .select(
          'annotations'
        )
        .lean();

    const duplicate =
      (
        duplicateLog
          ?.annotations ??
        []
      ).find(
        (item) =>
          item.type ===
            'family_acknowledgment' &&
          item.authorId
            ?.toString() ===
            input.familyId
      );

    if (duplicate) {
      return {
        duplicate:
          true,

        annotation:
          serializeAnnotations(
            [
              duplicate,
            ]
          )[0],
      };
    }

    throw new Error(
      'This medication record could not be acknowledged.'
    );
  }

  return {
    duplicate:
      false,

    annotation:
      serializeAnnotations(
        [
          annotation,
        ]
      )[0],
  };
}