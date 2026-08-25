import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import MonitoringRequest from '@/models/MonitoringRequest';
import MedicationLog from '@/models/MedicationLog';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import type { ApiResponse } from '@/lib/interfaces/data/Api';
import {
  analyzeAdherence,
  evaluateMedicationLog,
  type RawLog,
} from '@/lib/adherenceEngine';
import {
  ensureMedicationLogsForRange,
  finalizeExpiredMedicationLogs,
} from '@/lib/medicationVerification';
import {
  addDaysToMedicationDateKey,
  getMedicationDateKey,
  resolveMedicationTimeZone,
} from '@/lib/medicationTime';

export const dynamic = 'force-dynamic';

async function getAuthUser(
  request: NextRequest,
) {
  const token =
    getTokenFromRequest(request);

  if (!token) return null;

  return verifyToken(token);
}

export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      patientID: string;
    }>;
  },
) {
  try {
    const auth =
      await getAuthUser(request);

    if (!auth) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'Unauthorized',
        },
        {
          status: 401,
        },
      );
    }

    await connectDB();

    const currentUser =
      await User.findById(
        auth.userId,
      ).select(
        'role monitoredPatients isDeleted',
      );

    if (!currentUser) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'User not found',
        },
        {
          status: 404,
        },
      );
    }

    if (
      currentUser.isDeleted ||
      currentUser.role !== 'family'
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,

          error:
            'Only Family accounts can view Patient monitoring data.',
        },
        {
          status: 403,
        },
      );
    }

    const { patientID } =
      await params;

    const normalizedId =
      patientID
        ?.trim()
        .toUpperCase();

    if (!normalizedId) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'Patient ID is required',
        },
        {
          status: 400,
        },
      );
    }

    const patient =
      await User.findOne({
        patientId:
          normalizedId,

        role:
          'patient',

        isDeleted: {
          $ne:
            true,
        },
      }).select(
        'firstName lastName condition patientId createdAt',
      );

    if (!patient) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'Patient not found',
        },
        {
          status: 404,
        },
      );
    }

    const relationship =
      await MonitoringRequest.findOne({
        patientId:
          patient._id,

        familyId:
          currentUser._id,
      });

    if (
      relationship &&
      relationship.status !==
        'approved'
    ) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,

          error:
            'Access denied. Monitoring approval is not active.',
        },
        {
          status: 403,
        },
      );
    }

    if (!relationship) {
      const monitoredNormalized =
        currentUser.monitoredPatients.map(
          (id: string) =>
            id
              .trim()
              .toUpperCase(),
        );

      if (
        !monitoredNormalized.includes(
          normalizedId,
        )
      ) {
        return NextResponse.json<ApiResponse>(
          {
            success: false,

            error:
              'Access denied. You are not authorized to monitor this Patient.',
          },
          {
            status: 403,
          },
        );
      }

      await MonitoringRequest.findOneAndUpdate(
        {
          patientId:
            patient._id,

          familyId:
            currentUser._id,
        },
        {
          $setOnInsert: {
            status:
              'approved',

            respondedAt:
              new Date(),
          },
        },
        {
          upsert:
            true,

          runValidators:
            true,
        },
      );
    }

    const now = new Date();

    const timeZone =
      resolveMedicationTimeZone();

    const today =
      getMedicationDateKey(
        now,
        timeZone,
      );

    const range =
      request.nextUrl.searchParams.get(
        'range',
      ) || 'week';

    const from =
      range === 'today'
        ? today
        : addDaysToMedicationDateKey(
            today,
            range === 'month'
              ? -29
              : -6,
          );

    await ensureMedicationLogsForRange(
      patient._id.toString(),
      from,
      today,
    );

    await finalizeExpiredMedicationLogs(
      patient._id.toString(),
      now,
    );

    const logs =
      await MedicationLog.find({
        userId:
          patient._id,

        scheduledDate: {
          $gte:
            from,

          $lte:
            today,
        },
      })
        .sort({
          scheduledDate:
            -1,

          scheduledTime:
            -1,
        })
        .lean();

    const rawLogs:
      RawLog[] =
        logs.map((log) => ({
          id:
            log._id.toString(),

          medicineId:
            log.medicineId
              ?.toString() ?? null,

          medicineName:
            log.medicineName,

          status:
            String(log.status),

          scheduledDate:
            String(
              log.scheduledDate,
            ),

          scheduledTime:
            String(
              log.scheduledTime,
            ),

          takenAt:
            log.takenAt ?? null,

          lateAfterMinutes:
            log.lateAfterMinutes,

          windowAfterMinutes:
            log.windowAfterMinutes,

          expectedChamberId:
            log.expectedChamberId ??
            null,

          detectedChamberId:
            log.detectedChamberId ??
            null,

          countsTowardAdherence:
            log.countsTowardAdherence !==
            false,
        }));

    const analysis =
      analyzeAdherence(
        rawLogs,
        now,
        timeZone,
      );

    const evaluatedById =
      new Map(
        rawLogs.map(
          (log) => [
            log.id,

            evaluateMedicationLog(
              log,
              now,
              timeZone,
            ),
          ],
        ),
      );

    const logsByScheduledTime =
      [...logs].sort(
        (first, second) =>
          (
            evaluatedById.get(
              second._id.toString(),
            )?.scheduledAt.getTime() ??
            0
          ) -
          (
            evaluatedById.get(
              first._id.toString(),
            )?.scheduledAt.getTime() ??
            0
          ),
      );

    const recentLogs =
      logsByScheduledTime
        .slice(0, 30)
        .map((log) => ({
          medicineName:
            log.medicineName,

          scheduledDate:
            log.scheduledDate,

          scheduledTime:
            log.scheduledTime,

          status:
            log.status,

          takenAt:
            log.takenAt,

          dosage:
            log.dosage,

          source:
            log.source === 'auto'
              ? 'system'
              : log.source,

          expectedChamberId:
            log.expectedChamberId ??
            null,

          detectedChamberId:
            log.detectedChamberId ??
            null,

          expectedChamberIds:
            log.expectedChamberIds ??
            [],

          verificationNote:
            log.verificationNote ??
            '',

          lifecycle:
            evaluatedById.get(
              log._id.toString(),
            )?.lifecycle ??
            'audit',
        }));

    const adherenceLogs =
      logs.filter(
        (log) =>
          log.countsTowardAdherence !==
          false,
      );

    const eligibleLogs =
      adherenceLogs.filter(
        (log) =>
          evaluatedById.get(
            log._id.toString(),
          )?.eligible,
      );

    const todayEligible =
      eligibleLogs.filter(
        (log) =>
          log.scheduledDate ===
          today,
      );

    const verifiedStatuses = [
      'taken',
      'late',
    ];

    const reportSummary = {
      range,
      from,
      to:
        today,

      scheduled:
        eligibleLogs.length,

      verified:
        eligibleLogs.filter(
          (log) =>
            verifiedStatuses.includes(
              log.status,
            ),
        ).length,

      missed:
        eligibleLogs.filter(
          (log) =>
            evaluatedById.get(
              log._id.toString(),
            )?.lifecycle ===
            'missed',
        ).length,

      late:
        eligibleLogs.filter(
          (log) =>
            evaluatedById.get(
              log._id.toString(),
            )?.lifecycle ===
            'late',
        ).length,

      incorrectChamber:
        logs.filter(
          (log) =>
            log.status ===
            'incorrect_chamber',
        ).length,

      unverified:
        logs.filter(
          (log) =>
            log.status ===
            'unverified',
        ).length,

      today: {
        scheduled:
          todayEligible.length,

        verified:
          todayEligible.filter(
            (log) =>
              verifiedStatuses.includes(
                log.status,
              ),
          ).length,

        missed:
          todayEligible.filter(
            (log) =>
              evaluatedById.get(
                log._id.toString(),
              )?.lifecycle ===
              'missed',
          ).length,

        late:
          todayEligible.filter(
            (log) =>
              evaluatedById.get(
                log._id.toString(),
              )?.lifecycle ===
              'late',
          ).length,

        incorrectChamber:
          logs.filter(
            (log) =>
              log.scheduledDate ===
                today &&
              log.status ===
                'incorrect_chamber',
          ).length,
      },
    };

    return NextResponse.json<ApiResponse>({
      success:
        true,

      data: {
        patient: {
          patientId:
            patient.patientId,

          name:
            `${patient.firstName} ${patient.lastName}`,

          condition:
            patient.condition,

          memberSince:
            patient.createdAt,
        },

        adherence: {
          hasSufficientData:
            analysis.features
              .hasSufficientData,

          riskLevel:
            analysis.finalRiskLevel,

          adherenceRate:
            analysis.features
              .adherenceRate,

          totalScheduled:
            analysis.features
              .totalDue,

          totalTaken:
            analysis.features
              .totalTaken,

          totalMissed:
            analysis.features
              .missedDoses,

          totalPending:
            analysis.features
              .duePending,

          totalUpcoming:
            analysis.features
              .upcomingDoses,

          consecutiveMissed:
            analysis.features
              .consecutiveMissed,

          delayedDoses:
            analysis.features
              .delayedDoses,

          avgDelayMinutes:
            analysis.features
              .avgDelayMinutes,

          recentRate:
            analysis.features
              .recentAdherenceRate,

          weeklyTrend:
            analysis.features
              .trend,

          trendAvailable:
            analysis.features
              .trendAvailable,

          previousRate:
            analysis.features
              .previousAdherenceRate,

          incorrectChamberEvents:
            analysis.features
              .incorrectChamberEvents,

          riskReasons:
            analysis.riskReasons,

          behavioral:
            analysis.behavioral,

          insight:
            analysis.insight,

          recommendation:
            analysis.recommendation,
        },

        recentLogs,

        reportSummary,

        readOnly:
          true,
      },
    });
  } catch (error) {
    console.error(
      '[GET /api/patient/monitor/[patientID]/dashboard]',
      error,
    );

    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: 'Internal server error',
      },
      {
        status: 500,
      },
    );
  }
}