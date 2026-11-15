'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { formatMedicationDateLabel } from '@/lib/medicationTime';

interface Dose {
  id: string;
  name: string;
  minute: number;
  chambers: number[];
  endDate: string | null;
  status: string;
}

interface Schedule {
  date: string;
  patients: { patientId: string; doses: Dose[] }[];
}

type ScheduleState =
  | { schedule: Schedule; error?: never }
  | { schedule?: never; error: string }
  | null;

export function useTodayMedicationSchedule(patientId?: string, enabled = true) {
  const [result, setResult] = useState<{ url: string; state: ScheduleState } | null>(null);
  const url = '/api/patient/monitor/schedule' +
    (patientId ? `?patientId=${encodeURIComponent(patientId)}` : '');

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    let source: EventSource | undefined;
    let live = false;
    let fetching = false;

    const update = (state: ScheduleState) => {
      if (!controller.signal.aborted) setResult({ url, state });
    };

    async function refresh() {
      if (live || fetching || document.hidden) return;

      fetching = true;

      try {
        const response = await fetch(url, {
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!response.ok) throw new Error('Unable to load today’s schedule.');

        const schedule: Schedule = await response.json();

        if (!live) update({ schedule });
      } catch {
        if (!live) update({ error: 'Unable to load today’s schedule.' });
      } finally {
        fetching = false;
      }
    }

    if (typeof EventSource !== 'undefined') {
      source = new EventSource(`${url}${patientId ? '&' : '?'}stream=1`);

      source.onmessage = ({ data }) => {
        try {
          const schedule = JSON.parse(data) as Schedule;
          live = true;
          update({ schedule });
        } catch {
          live = false;
          void refresh();
        }
      };

      source.onerror = () => {
        live = false;
        void refresh();
      };
    }

    void refresh();

    const fallback = window.setInterval(() => void refresh(), 5_000);
    const refreshWhenVisible = () => void refresh();

    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('focus', refreshWhenVisible);

    return () => {
      controller.abort();
      source?.close();
      window.clearInterval(fallback);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('focus', refreshWhenVisible);
    };
  }, [enabled, patientId, url]);

  return enabled && result?.url === url ? result.state : null;
}

const statusLabels: Record<string, string> = {
  awaiting_status: 'Awaiting status',
  upcoming: 'Upcoming',
  due: 'Due',
  dispensed: 'Dispensed',
  taken: 'Verified',
  late: 'Late',
  missed: 'Missed',
  incorrect_chamber: 'Wrong chamber',
  unverified: 'Unverified',
};

function formatTime(minute: number) {
  const hour = Math.floor(minute / 60);
  return `${hour % 12 || 12}:${String(minute % 60).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}

function formatChambers(chambers: number[]) {
  if (chambers.length === 0) return 'Unassigned';

  return `${chambers.length === 1 ? 'Chamber' : 'Chambers'} ${chambers.join(', ')}`;
}

export function TodayMedicationSchedule({
  patientId,
  state,
  preview = false,
}: {
  patientId: string;
  state: ScheduleState;
  preview?: boolean;
}) {
  const doses = state?.schedule?.patients.find(
    (patient) => patient.patientId === patientId.trim().toUpperCase(),
  )?.doses;
  const rows = preview ? doses?.slice(0, 3) : doses;
  const message = !state
    ? 'Loading today’s schedule…'
    : state.error ?? (doses ? 'No medicines scheduled today.' : 'Schedule unavailable for this connection.');

  return (
    <div
      id={preview ? undefined : 'today-medication-schedule'}
      className="mt-4 scroll-mt-24 border-t border-border/70 pt-4"
    >
      <h3 className="text-sm font-semibold text-foreground">
        {preview ? 'Today’s Schedule' : 'Scheduled Doses'}
      </h3>

      {rows?.length ? (
        <ul className="mt-2 divide-y divide-border/60">
          {!preview && (
            <li
              aria-hidden="true"
              className="hidden grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))] gap-3 py-2 text-xs font-medium text-muted-foreground md:grid"
            >
              <span>Medicine</span>
              <span>Scheduled time</span>
              <span>Assigned chamber</span>
              <span>Scheduled through</span>
              <span>Status</span>
            </li>
          )}

          {rows.map((dose) => (
            <li
              key={dose.id}
              className={`grid gap-x-3 gap-y-1 py-2.5 text-sm ${
                preview
                  ? 'grid-cols-[auto_minmax(0,1fr)] sm:grid-cols-[auto_minmax(0,1fr)_auto]'
                  : 'grid-cols-2 md:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))]'
              }`}
            >
              <span className={`whitespace-nowrap tabular-nums text-muted-foreground ${preview ? '' : 'md:order-2'}`}>
                {formatTime(dose.minute)}
              </span>

              <span className={`min-w-0 break-words font-medium text-foreground ${preview ? '' : 'md:order-1'}`}>
                {dose.name}
              </span>

              <span className={`text-muted-foreground ${preview ? 'col-start-2 sm:col-start-auto' : 'md:order-3'}`}>
                {formatChambers(dose.chambers)}
              </span>

              {!preview && (
                <>
                  <span className="text-muted-foreground md:order-4">
                    {dose.endDate
                      ? `Through ${formatMedicationDateLabel(dose.endDate, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}`
                      : 'No end date'}
                  </span>

                  <span className="md:order-5">
                    <span className="inline-block rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                      {statusLabels[dose.status] ?? 'Awaiting status'}
                    </span>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground" role={state?.error ? 'alert' : undefined}>
          {message}
        </p>
      )}

      {preview && doses && doses.length > 3 && (
        <Link
          href={`/monitor/${encodeURIComponent(patientId)}#today-medication-schedule`}
          className="mt-2 inline-block text-sm font-medium text-blue-700 hover:underline dark:text-blue-300"
        >
          View all {doses.length} doses
        </Link>
      )}
    </div>
  );
}

export default function PatientTodayMedicationSchedule({ patientId }: { patientId: string }) {
  const state = useTodayMedicationSchedule(patientId, Boolean(patientId));

  useEffect(() => {
    if (window.location.hash === '#today-medication-schedule') {
      document.getElementById('today-medication-schedule')?.scrollIntoView();
    }
  }, [patientId]);

  return <TodayMedicationSchedule patientId={patientId} state={state} />;
}