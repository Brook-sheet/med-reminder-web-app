import mongoose from 'mongoose';
import {
  NextRequest,
} from 'next/server';

import {
  getTokenFromRequest,
  verifyToken,
} from '@/lib/auth';

import {
  connectDB,
} from '@/lib/mongodb';

import {
  getApprovedPatientIdsForMonitor,
} from '@/lib/monitoringAuthorization';

import {
  serializeAlert,
} from '@/lib/alertSerializer';

import Alert from '@/models/Alert';
import Medicine from '@/models/Medicine';
import MedicationLog from '@/models/MedicationLog';
import User from '@/models/User';

export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';

function sseEvent(
  event: string,
  data: unknown
): Uint8Array {
  return new TextEncoder().encode(
    `event: ${event}\ndata: ${JSON.stringify(
      data
    )}\n\n`
  );
}

export async function GET(
  request: NextRequest
) {
  const token =
    getTokenFromRequest(
      request
    );

  const auth =
    token
      ? await verifyToken(
          token
        )
      : null;

  if (
    !auth ||
    auth.role !==
      'family'
  ) {
    return new Response(
      'Access denied.',
      {
        status:
          403,
      }
    );
  }

  await connectDB();

  let patientIds =
    await getApprovedPatientIdsForMonitor(
      auth.userId
    );

  const afterParam =
    request.nextUrl
      .searchParams
      .get(
        'after'
      );

  const parsedAfter =
    afterParam
      ? new Date(
          afterParam
        )
      : new Date();

  let cursor =
    Number.isNaN(
      parsedAfter.getTime()
    )
      ? new Date()
      : parsedAfter;

  let cursorId:
    mongoose.Types.ObjectId | null =
    null;

  let pollTimer:
    ReturnType<
      typeof setInterval
    > | null =
    null;

  let heartbeatTimer:
    ReturnType<
      typeof setInterval
    > | null =
    null;

  let maximumTimer:
    ReturnType<
      typeof setTimeout
    > | null =
    null;

  let polling =
    false;

  let closed =
    false;

  const stream =
    new ReadableStream<Uint8Array>({
      start(
        controller
      ) {
        const close =
          () => {
            if (
              closed
            ) {
              return;
            }

            closed =
              true;

            if (
              pollTimer
            ) {
              clearInterval(
                pollTimer
              );
            }

            if (
              heartbeatTimer
            ) {
              clearInterval(
                heartbeatTimer
              );
            }

            if (
              maximumTimer
            ) {
              clearTimeout(
                maximumTimer
              );
            }

            try {
              controller.close();
            } catch {
              /*
               * The browser may already have
               * closed the connection.
               */
            }
          };

        const poll =
          async () => {
            if (
              polling ||
              closed
            ) {
              return;
            }

            polling =
              true;

            try {
              patientIds =
                await getApprovedPatientIdsForMonitor(
                  auth.userId
                );

              const cursorQuery =
                cursorId
                  ? {
                      $or: [
                        {
                          createdAt: {
                            $gt:
                              cursor,
                          },
                        },

                        {
                          createdAt:
                            cursor,

                          _id: {
                            $gt:
                              cursorId,
                          },
                        },
                      ],
                    }
                  : {
                      createdAt: {
                        $gt:
                          cursor,
                      },
                    };

              const alerts =
                await Alert.find(
                  {
                    monitorId:
                      auth.userId,

                    patientId: {
                      $in:
                        patientIds,
                    },

                    ...cursorQuery,
                  }
                )
                  .populate({
                    path:
                      'patientId',

                    model:
                      User,

                    select:
                      'firstName lastName patientId',
                  })
                  .populate({
                    path:
                      'medicationId',

                    model:
                      Medicine,

                    select:
                      'name dosage',
                  })
                  .populate({
                    path:
                      'medicationLogId',

                    model:
                      MedicationLog,

                    select:
                      'annotations',
                  })
                  .sort({
                    createdAt:
                      1,

                    _id:
                      1,
                  })
                  .limit(
                    20
                  )
                  .lean();

              for (
                const alert
                of alerts
              ) {
                controller.enqueue(
                  sseEvent(
                    'alert',

                    serializeAlert(
                      alert
                    )
                  )
                );

                const createdAt =
                  new Date(
                    alert.createdAt
                  );

                cursor =
                  createdAt;

                cursorId =
                  alert._id;
              }

              if (
                alerts.length >
                0
              ) {
                const unreadCount =
                  await Alert.countDocuments(
                    {
                      monitorId:
                        auth.userId,

                      patientId: {
                        $in:
                          patientIds,
                      },

                      isRead:
                        false,
                    }
                  );

                controller.enqueue(
                  sseEvent(
                    'unread',
                    {
                      unreadCount,
                    }
                  )
                );
              }
            } catch (error) {
              console.error(
                '[Alert SSE] Poll failed:',
                error
              );

              if (
                !closed
              ) {
                controller.enqueue(
                  sseEvent(
                    'server-error',
                    {
                      message:
                        'Temporary alert stream error.',
                    }
                  )
                );
              }
            } finally {
              polling =
                false;
            }
          };

        controller.enqueue(
          sseEvent(
            'connected',
            {
              connectedAt:
                new Date()
                  .toISOString(),
            }
          )
        );

        pollTimer =
          setInterval(
            () =>
              void poll(),
            2_000
          );

        heartbeatTimer =
          setInterval(
            () => {
              if (
                !closed
              ) {
                controller.enqueue(
                  new TextEncoder().encode(
                    ': heartbeat\n\n'
                  )
                );
              }
            },
            15_000
          );

        maximumTimer =
          setTimeout(
            close,
            25 *
              60_000
          );

        request.signal
          .addEventListener(
            'abort',
            close,
            {
              once:
                true,
            }
          );

        void poll();
      },

      cancel() {
        closed =
          true;

        if (
          pollTimer
        ) {
          clearInterval(
            pollTimer
          );
        }

        if (
          heartbeatTimer
        ) {
          clearInterval(
            heartbeatTimer
          );
        }

        if (
          maximumTimer
        ) {
          clearTimeout(
            maximumTimer
          );
        }
      },
    });

  return new Response(
    stream,
    {
      headers: {
        'Content-Type':
          'text/event-stream',

        'Cache-Control':
          'no-cache, no-transform',

        Connection:
          'keep-alive',

        'X-Accel-Buffering':
          'no',
      },
    }
  );
}