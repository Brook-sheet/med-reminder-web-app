import type {
  AlertAnnotationData,
  AlertAnnotationType,
  AlertData,
} from '@/lib/interfaces/data/Alert';

interface PopulatedReference {
  _id: {
    toString(): string;
  };

  patientId?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  dosage?: string;
}

interface RawAnnotation {
  _id?:
    | {
        toString(): string;
      }
    | string;

  type?: string;
  text?: string;
  authorRole?: string;
  authorName?: string;
  createdAt?: Date | string;
}

interface PopulatedMedicationLogReference {
  _id: {
    toString(): string;
  };

  annotations?: RawAnnotation[];
}

interface PopulatedAlert {
  _id: {
    toString(): string;
  };

  patientId: PopulatedReference;
  medicationId?: PopulatedReference | null;

  medicationLogId?:
    | {
        toString(): string;
      }
    | PopulatedMedicationLogReference
    | null;

  eventType: AlertData['eventType'];
  severity: AlertData['severity'];
  title: string;
  message: string;
  status: AlertData['status'];
  isRead: boolean;
  occurredAt: Date;
  readAt?: Date | null;
  acknowledgedAt?: Date | null;
  channels: AlertData['channels'];
  createdAt: Date;
}

const ANNOTATION_TYPES =
  new Set<AlertAnnotationType>([
    'patient_note',
    'missed_explanation',
    'family_acknowledgment',
  ]);

function isPopulatedMedicationLog(
  value: PopulatedAlert['medicationLogId'],
): value is PopulatedMedicationLogReference {
  return Boolean(
    value &&
      typeof value === 'object' &&
      '_id' in value,
  );
}

function serializeAnnotations(
  values: RawAnnotation[] | undefined,
): AlertAnnotationData[] {
  return (values ?? [])
    .filter(
      (annotation) =>
        ANNOTATION_TYPES.has(
          annotation.type as AlertAnnotationType,
        ) &&
        (annotation.authorRole === 'patient' ||
          annotation.authorRole === 'family'),
    )
    .map((annotation) => ({
      _id: annotation._id?.toString() ?? '',

      type:
        annotation.type as AlertAnnotationType,

      text: String(annotation.text ?? ''),

      authorRole:
        annotation.authorRole as
          | 'patient'
          | 'family',

      authorName:
        String(
          annotation.authorName ?? '',
        ).trim() ||
        (annotation.authorRole === 'patient'
          ? 'Patient'
          : 'Family member'),

      createdAt: new Date(
        annotation.createdAt ?? Date.now(),
      ).toISOString(),
    }))
    .sort(
      (first, second) =>
        new Date(first.createdAt).getTime() -
        new Date(second.createdAt).getTime(),
    );
}

export function serializeAlert(
  value: unknown,
): AlertData {
  const alert =
    value as PopulatedAlert;

  const patientName =
    `${alert.patientId.firstName || ''} ${
      alert.patientId.lastName || ''
    }`.trim();

  const populatedMedicationLog =
    isPopulatedMedicationLog(
      alert.medicationLogId,
    )
      ? alert.medicationLogId
      : null;

  return {
    _id:
      alert._id.toString(),

    patient: {
      _id:
        alert.patientId._id.toString(),

      patientId:
        alert.patientId.patientId,

      name:
        patientName || 'Patient',
    },

    medication:
      alert.medicationId
        ? {
            _id:
              alert.medicationId._id.toString(),

            name:
              alert.medicationId.name ||
              'Medication',

            dosage:
              alert.medicationId.dosage,
          }
        : null,

    medicationLogId:
      populatedMedicationLog
        ? populatedMedicationLog._id.toString()
        : alert.medicationLogId?.toString() ??
          null,

    annotations:
      serializeAnnotations(
        populatedMedicationLog?.annotations,
      ),

    eventType:
      alert.eventType,

    severity:
      alert.severity,

    title:
      alert.title,

    message:
      alert.message,

    status:
      alert.status,

    isRead:
      alert.isRead,

    occurredAt:
      new Date(
        alert.occurredAt,
      ).toISOString(),

    readAt:
      alert.readAt
        ? new Date(
            alert.readAt,
          ).toISOString()
        : null,

    acknowledgedAt:
      alert.acknowledgedAt
        ? new Date(
            alert.acknowledgedAt,
          ).toISOString()
        : null,

    channels:
      alert.channels,

    createdAt:
      new Date(
        alert.createdAt,
      ).toISOString(),
  };
}