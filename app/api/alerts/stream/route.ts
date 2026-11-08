import mongoose from 'mongoose';
import { NextRequest } from 'next/server';

import {
  getTokenFromRequest,
  verifyToken,
} from '@/lib/auth';

import { connectDB } from '@/lib/mongodb';

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

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
) {
  const token =
    getTokenFromRequest(request);

  const auth = token
    ? await verifyToken(token)
    : null;

  if (
    !auth ||
    auth.role !== 'family'
  ) {
    return new Response(
      'Access denied.',
      { status: 403 },
    );
  }

  await connectDB();

  const value =
    request.nextUrl.searchParams.get(
      'after',
    );

  const parsed = value
    ? new Date(value)
    : new Date();

  let cursor =
    Number.isNaN(parsed.getTime())
      ? new Date()
      : parsed;

  let cursorId:
    mongoose.Types.ObjectId | null =
      null;

  let stop = () => {};

  const stream =
    new ReadableStream<Uint8Array>({
      start(controller) {
        let closed = false;
        let busy = false;

        const encoder =
          new TextEncoder();

        const emit = (
          event: string,
          data: unknown,
        ) => {
          if (!closed) {
            controller.enqueue(
              encoder.encode(
                `event: ${event}\ndata: ${
                  JSON.stringify(data)
                }\n\n`,
              ),
            );
          }
        };

        const poll = async () => {
          if (busy || closed) {
            return;
          }

          busy = true;

          try {
            const patientIds =
              await getApprovedPatientIdsForMonitor(
                auth.userId,
              );

            const scope = {
              monitorId: auth.userId,

              patientId: {
                $in: patientIds,
              },
            };

            const cursorQuery =
              cursorId
                ? {
                    $or: [
                      {
                        createdAt: {
                          $gt: cursor,
                        },
                      },
                      {
                        createdAt: cursor,

                        _id: {
                          $gt: cursorId,
                        },
                      },
                    ],
                  }
                : {
                    createdAt: {
                      $gt: cursor,
                    },
                  };

            const alerts =
              await Alert.find({
                ...scope,
                ...cursorQuery,
              })
                .populate({
                  path: 'patientId',
                  model: User,
                  select:
                    'firstName lastName patientId',
                })
                .populate({
                  path: 'medicationId',
                  model: Medicine,
                  select: 'name dosage',
                })
                .populate({
                  path: 'medicationLogId',
                  model: MedicationLog,
                  select: 'annotations',
                })
                .sort({
                  createdAt: 1,
                  _id: 1,
                })
                .limit(20)
                .lean();

            if (closed) {
              return;
            }

            for (
              const alert of alerts
            ) {
              emit(
                'alert',
                serializeAlert(alert),
              );

              cursor =
                new Date(
                  alert.createdAt,
                );

              cursorId =
                alert._id;
            }

            /*
             * Send the saved count even when no new
             * alerts arrive. Reads in another session
             * must also update the bell badge.
             */
            const unreadCount =
              await Alert.countDocuments({
                ...scope,
                isRead: false,
              });

            emit('unread', {
              unreadCount,
            });
          } catch (error) {
            console.error(
              '[Alert SSE] Poll failed:',
              error,
            );

            emit('server-error', {
              message:
                'Temporary alert stream error.',
            });
          } finally {
            busy = false;
          }
        };

        const timer = setInterval(
          () => void poll(),
          2_000,
        );

        const heartbeat =
          setInterval(
            () => {
              if (!closed) {
                controller.enqueue(
                  encoder.encode(
                    ': heartbeat\n\n',
                  ),
                );
              }
            },
            15_000,
          );

        const maximum =
          setTimeout(
            () => stop(),
            25 * 60_000,
          );

        stop = () => {
          if (closed) {
            return;
          }

          closed = true;

          clearInterval(timer);
          clearInterval(heartbeat);
          clearTimeout(maximum);

          request.signal.removeEventListener(
            'abort',
            stop,
          );

          try {
            controller.close();
          } catch {
            // Already disconnected.
          }
        };

        request.signal.addEventListener(
          'abort',
          stop,
          { once: true },
        );

        if (
          request.signal.aborted
        ) {
          stop();
          return;
        }

        emit('connected', {
          connectedAt:
            new Date().toISOString(),
        });

        void poll();
      },

      cancel() {
        stop();
      },
    });

  return new Response(stream, {
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
  });
}