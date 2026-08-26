import mongoose from 'mongoose';
import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import {
  getTokenFromRequest,
  verifyToken,
} from '@/lib/auth';
import MedicationLog from '@/models/MedicationLog';
import MonitoringRequest from '@/models/MonitoringRequest';
import User from '@/models/User';

export type MedicationLogAnnotationType =
  | 'patient_note'
  | 'missed_explanation'
  | 'family_acknowledgment';

type AnnotationInput = {
  type?: string;
  annotationType?: string;
  noteType?: string;
  text?: string;
};

type StoredAnnotation = {
  _id?: {
    toString(): string;
  } | string;
  type: MedicationLogAnnotationType;
  text: string;
  authorId?: {
    toString(): string;
  } | string;
  authorRole: 'patient' | 'family';
  authorName: string;
  createdAt: Date | string;
};

type MedicationLogRecord = {
  _id: {
    toString(): string;
  };
  userId: {
    toString(): string;
  } | string;
  status: string;
  annotations?: StoredAnnotation[];
};

export class MedicationLogAnnotationError extends Error {
  status: number;

  constructor(
    message: string,
    status = 400,
  ) {
    super(message);
    this.name =
      'MedicationLogAnnotationError';
    this.status = status;
  }
}

async function getAuthenticatedUser(
  request: NextRequest,
) {
  const token =
    getTokenFromRequest(request);

  const auth = token
    ? await verifyToken(token)
    : null;

  if (!auth) {
    throw new MedicationLogAnnotationError(
      'Unauthorized.',
      401,
    );
  }

  return auth;
}

function serializeAnnotations(
  values: StoredAnnotation[] | undefined,
) {
  return (values ?? [])
    .map((annotation) => ({
      _id:
        annotation._id?.toString() ??
        '',
      type: annotation.type,
      text: annotation.text,
      authorId:
        annotation.authorId?.toString() ??
        '',
      authorRole:
        annotation.authorRole,
      authorName:
        annotation.authorName,
      createdAt: new Date(
        annotation.createdAt,
      ).toISOString(),
    }))
    .sort(
      (first, second) =>
        new Date(
          first.createdAt,
        ).getTime() -
        new Date(
          second.createdAt,
        ).getTime(),
    );
}

async function findAuthorizedLog(
  request: NextRequest,
  logId: string,
) {
  if (!mongoose.isValidObjectId(logId)) {
    throw new MedicationLogAnnotationError(
      'Invalid medication log ID.',
      400,
    );
  }

  const auth =
    await getAuthenticatedUser(request);

  await connectDB();

  const rawLog =
    await MedicationLog.findById(logId)
      .select(
        '_id userId status annotations',
      )
      .lean();

  const log =
    rawLog as unknown as
      | MedicationLogRecord
      | null;

  if (!log) {
    throw new MedicationLogAnnotationError(
      'Medication log not found.',
      404,
    );
  }

  const patientObjectId =
    log.userId.toString();

  if (auth.role === 'patient') {
    if (
      patientObjectId !== auth.userId
    ) {
      throw new MedicationLogAnnotationError(
        'Access denied.',
        403,
      );
    }
  } else {
    const approvedRelationship =
      await MonitoringRequest.exists({
        patientId: patientObjectId,
        familyId: auth.userId,
        status: 'approved',
      });

    if (!approvedRelationship) {
      throw new MedicationLogAnnotationError(
        'An active approved monitoring relationship is required.',
        403,
      );
    }
  }

  return {
    auth,
    log,
    patientObjectId,
  };
}

function resolveAnnotationType(
  input: AnnotationInput,
): MedicationLogAnnotationType {
  const type =
    input.type ||
    input.annotationType ||
    input.noteType ||
    '';

  if (
    type !== 'patient_note' &&
    type !== 'missed_explanation' &&
    type !== 'family_acknowledgment'
  ) {
    throw new MedicationLogAnnotationError(
      'Invalid annotation type.',
      400,
    );
  }

  return type;
}

function validateAnnotationPermission(
  role: 'patient' | 'family',
  type: MedicationLogAnnotationType,
  status: string,
) {
  const finalizedStatuses = new Set([
    'taken',
    'late',
    'missed',
    'unverified',
    'incorrect_chamber',
  ]);

  if (!finalizedStatuses.has(status)) {
    throw new MedicationLogAnnotationError(
      'Notes can only be added after the medication activity is finalized.',
      409,
    );
  }

  if (
    role === 'patient' &&
    type === 'family_acknowledgment'
  ) {
    throw new MedicationLogAnnotationError(
      'Patients cannot add family acknowledgments.',
      403,
    );
  }

  if (
    role === 'family' &&
    type !== 'family_acknowledgment'
  ) {
    throw new MedicationLogAnnotationError(
      'Family accounts may only add family acknowledgments.',
      403,
    );
  }

  if (
    type === 'missed_explanation' &&
    status !== 'missed'
  ) {
    throw new MedicationLogAnnotationError(
      'A missed-dose explanation can only be added to a missed medication.',
      409,
    );
  }

  if (
    type === 'patient_note' &&
    status === 'missed'
  ) {
    throw new MedicationLogAnnotationError(
      'Use a missed-dose explanation for a missed medication.',
      409,
    );
  }
}

export async function readMedicationLogAnnotations(
  request: NextRequest,
  logId: string,
) {
  const { log } =
    await findAuthorizedLog(
      request,
      logId,
    );

  return {
    _id: log._id.toString(),
    status: log.status,
    annotations:
      serializeAnnotations(
        log.annotations,
      ),
  };
}

export async function appendMedicationLogAnnotation(
  request: NextRequest,
  logId: string,
  input: AnnotationInput,
) {
  const {
    auth,
    log,
    patientObjectId,
  } = await findAuthorizedLog(
    request,
    logId,
  );

  const type =
    resolveAnnotationType(input);

  validateAnnotationPermission(
    auth.role,
    type,
    log.status,
  );

  const text = String(
    input.text ?? '',
  ).trim();

  if (
    type !==
      'family_acknowledgment' &&
    !text
  ) {
    throw new MedicationLogAnnotationError(
      'A note is required.',
      400,
    );
  }

  if (text.length > 500) {
    throw new MedicationLogAnnotationError(
      'The note cannot exceed 500 characters.',
      400,
    );
  }

  const author = await User.findOne({
    _id: auth.userId,
    role: auth.role,
    isDeleted: {
      $ne: true,
    },
  })
    .select(
      'firstName middleName lastName',
    )
    .lean();

  if (!author) {
    throw new MedicationLogAnnotationError(
      'User not found.',
      404,
    );
  }

  const authorName = [
    author.firstName,
    author.middleName,
    author.lastName,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  const annotation = {
    type,
    text:
      type ===
        'family_acknowledgment' &&
      !text
        ? 'Acknowledged'
        : text,
    authorId:
      new mongoose.Types.ObjectId(
        auth.userId,
      ),
    authorRole: auth.role,
    authorName:
      authorName ||
      (auth.role === 'patient'
        ? 'Patient'
        : 'Family member'),
    createdAt: new Date(),
  };

  /*
   * Only annotations are appended.
   *
   * This does not change status, takenAt,
   * source, hardware state, or alert state.
   */
  const rawUpdated =
    await MedicationLog.findOneAndUpdate(
      {
        _id: logId,
        userId: patientObjectId,
        status: log.status,
      },
      {
        $push: {
          annotations: annotation,
        },
      },
      {
        new: true,
        runValidators: true,
      },
    )
      .select(
        '_id userId status annotations',
      )
      .lean();

  const updated =
    rawUpdated as unknown as
      | MedicationLogRecord
      | null;

  if (!updated) {
    throw new MedicationLogAnnotationError(
      'The medication activity changed. Refresh and try again.',
      409,
    );
  }

  const annotations =
    serializeAnnotations(
      updated.annotations,
    );

  return {
    _id: updated._id.toString(),
    status: updated.status,
    annotations,
    annotation:
      annotations.at(-1) ?? null,
  };
}