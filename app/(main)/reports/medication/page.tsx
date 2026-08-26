'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  useRouter,
  useSearchParams,
} from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  FileText,
  Loader2,
  Printer,
} from 'lucide-react';
import type { PatientMedicationReportData } from '@/lib/interfaces/data/PatientMedicationReport';

type RangeChoice = '7' | '30' | 'custom';

const STATUS_LABELS: Record<string, string> = {
  taken: 'Taken',
  late: 'Taken Late',
  missed: 'Missed / Not Taken',
  due: 'Pending',
  upcoming: 'Upcoming',
  unverified: 'Unverified',
  incorrect_chamber: 'Incorrect Chamber',
};

function manilaToday(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const value = Object.fromEntries(
    parts.map((part) => [
      part.type,
      part.value,
    ]),
  );

  return `${value.year}-${value.month}-${value.day}`;
}

function addDays(
  date: string,
  amount: number,
): string {
  const value = new Date(
    `${date}T00:00:00.000Z`,
  );

  value.setUTCDate(
    value.getUTCDate() + amount,
  );

  return value.toISOString().slice(0, 10);
}

function dateLabel(value: string): string {
  return new Date(
    `${value}T00:00:00+08:00`,
  ).toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function dateTimeLabel(
  value: string | null,
): string {
  if (!value) return '—';

  return new Date(value).toLocaleString(
    'en-PH',
    {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    },
  );
}

function annotationLabel(
  type: string,
): string {
  if (type === 'missed_explanation') {
    return 'Missed-dose explanation';
  }

  if (type === 'family_acknowledgment') {
    return 'Family acknowledgment';
  }

  return 'Patient note';
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="report-section rounded-[24px] border border-border/70 bg-card p-5 shadow-sm sm:p-6">
      <h2 className="border-b border-border/70 pb-3 text-lg font-bold text-gray-900 dark:text-white">
        {title}
      </h2>

      <div className="mt-4">
        {children}
      </div>
    </section>
  );
}

function EmptyRow({
  columns,
  message,
}: {
  columns: number;
  message: string;
}) {
  return (
    <tr>
      <td
        colSpan={columns}
        className="px-3 py-8 text-center text-sm text-gray-400"
      >
        {message}
      </td>
    </tr>
  );
}

const th =
  'whitespace-nowrap border-b border-border bg-gray-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-300';

const td =
  'border-b border-border/60 px-3 py-3 align-top text-sm text-gray-700 dark:text-gray-300';

export default function MedicationReportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const patientID =
    searchParams.get('patientID')?.trim() || '';

  const today = useMemo(
    manilaToday,
    [],
  );

  const [range, setRange] =
    useState<RangeChoice>('30');

  const [from, setFrom] = useState(
    () => addDays(today, -29),
  );

  const [to, setTo] = useState(today);

  const [report, setReport] =
    useState<PatientMedicationReportData | null>(
      null,
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const apiBase = patientID
    ? `/api/patient/monitor/${encodeURIComponent(
        patientID,
      )}/report`
    : '/api/reports/medication';

  const selectRange = (
    choice: RangeChoice,
  ) => {
    setRange(choice);

    if (choice === '7') {
      setFrom(addDays(today, -6));
      setTo(today);
    }

    if (choice === '30') {
      setFrom(addDays(today, -29));
      setTo(today);
    }
  };

  const fetchReport = useCallback(
    async () => {
      if (!from || !to || from > to) {
        setError(
          'Select a valid start and end date.',
        );

        return;
      }

      setLoading(true);
      setError('');

      try {
        const query = new URLSearchParams({
          from,
          to,
        });

        const response = await fetch(
          `${apiBase}?${query.toString()}`,
          {
            cache: 'no-store',
          },
        );

        const json = await response.json();

        if (!response.ok || !json.success) {
          throw new Error(
            json.error ||
              'Unable to generate the report.',
          );
        }

        setReport(
          json.data as PatientMedicationReportData,
        );
      } catch (fetchError) {
        setReport(null);

        setError(
          fetchError instanceof Error
            ? fetchError.message
            : 'Unable to generate the report.',
        );
      } finally {
        setLoading(false);
      }
    },
    [apiBase, from, to],
  );

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  const downloadUrl = report
    ? `${apiBase}/pdf?${new URLSearchParams({
        from: report.period.from,
        to: report.period.to,
      }).toString()}`
    : '#';

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 12mm;
          }

          body {
            background: white !important;
          }

          body * {
            visibility: hidden !important;
          }

          #medication-report,
          #medication-report * {
            visibility: visible !important;
          }

          #medication-report {
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 100% !important;
            color: #111827 !important;
            background: white !important;
          }

          #medication-report .report-section {
            break-inside: avoid-page;
            box-shadow: none !important;
            background: white !important;
          }

          #medication-report table {
            font-size: 8pt !important;
          }

          #medication-report tr {
            break-inside: avoid !important;
          }

          .report-actions {
            display: none !important;
          }
        }
      `}</style>

      <div className="mx-auto max-w-7xl space-y-5">
        <div className="report-actions flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!report}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              <Printer className="h-4 w-4" />
              Print Report
            </button>

            <a
              href={downloadUrl}
              aria-disabled={!report}
              onClick={(event) => {
                if (!report) {
                  event.preventDefault();
                }
              }}
              className={`inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white ${
                report
                  ? 'hover:bg-blue-700'
                  : 'pointer-events-none opacity-50'
              }`}
            >
              <Download className="h-4 w-4" />
              Download PDF
            </a>
          </div>
        </div>

        <div className="report-actions rounded-[20px] border border-border/70 bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['7', 'Last 7 days'],
                  ['30', 'Last 30 days'],
                  ['custom', 'Custom range'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    selectRange(value)
                  }
                  className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                    range === value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {range === 'custom' && (
              <>
                <label className="text-xs font-semibold text-gray-500">
                  Start date

                  <input
                    type="date"
                    value={from}
                    max={to || today}
                    onChange={(event) =>
                      setFrom(event.target.value)
                    }
                    className="mt-1 block rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </label>

                <label className="text-xs font-semibold text-gray-500">
                  End date

                  <input
                    type="date"
                    value={to}
                    min={from}
                    max={today}
                    onChange={(event) =>
                      setTo(event.target.value)
                    }
                    className="mt-1 block rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </label>

                <button
                  type="button"
                  onClick={() =>
                    void fetchReport()
                  }
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Generate
                </button>
              </>
            )}
          </div>
        </div>

        {loading && (
          <div className="flex min-h-80 items-center justify-center rounded-[24px] border border-border bg-card">
            <div className="text-center">
              <Loader2 className="mx-auto h-9 w-9 animate-spin text-blue-600" />

              <p className="mt-3 text-sm text-gray-500">
                Generating read-only report…
              </p>
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-[24px] border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-5 w-5" />
              Unable to generate report
            </div>

            <p className="mt-2 text-sm">
              {error}
            </p>
          </div>
        )}

        {!loading && report && (
          <article
            id="medication-report"
            className="space-y-5 rounded-[28px] bg-background print:space-y-4 print:bg-white"
          >
            <header className="rounded-[28px] border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-6 text-center shadow-sm dark:border-blue-800 dark:from-blue-950/30 dark:to-card print:border-gray-300 print:bg-white print:shadow-none">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white">
                <FileText className="h-6 w-6" />
              </div>

              <p className="mt-3 text-sm font-bold uppercase tracking-[0.2em] text-blue-600">
                Rx Box
              </p>

              <h1 className="mt-1 text-2xl font-bold text-gray-950 dark:text-white print:text-black">
                Patient Medication Adherence Report
              </h1>

              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                {dateLabel(report.period.from)}
                {' – '}
                {dateLabel(report.period.to)}
                {' · Asia/Manila'}
              </p>
            </header>

            <Section title="Patient Information">
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  [
                    'Patient',
                    report.patient.name,
                  ],
                  [
                    'Patient ID',
                    report.patient.patientId,
                  ],
                  [
                    'Condition',
                    report.patient.condition,
                  ],
                  [
                    'Generated',
                    dateTimeLabel(
                      report.generatedAt,
                    ),
                  ],
                  [
                    'Reference',
                    report.referenceId,
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                      {label}
                    </dt>

                    <dd className="mt-1 text-sm font-semibold text-gray-900 dark:text-white print:text-black">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </Section>

            <Section title="Medication Regimen">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] border-collapse">
                  <thead>
                    <tr>
                      {[
                        'Medicine',
                        'Dosage',
                        'Schedule',
                        'Pills per dose',
                        'Duration',
                        'Current status',
                        'Instructions / notes',
                      ].map((item) => (
                        <th
                          key={item}
                          className={th}
                        >
                          {item}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {report.regimen.length === 0 ? (
                      <EmptyRow
                        columns={7}
                        message="No medicine regimen was active in this period."
                      />
                    ) : (
                      report.regimen.map(
                        (medicine) => (
                          <tr
                            key={
                              medicine.medicineKey
                            }
                          >
                            <td className={td}>
                              {medicine.name}
                            </td>

                            <td className={td}>
                              {medicine.dosage}
                            </td>

                            <td className={td}>
                              {medicine.scheduledTimes.join(
                                ', ',
                              )}
                            </td>

                            <td className={td}>
                              {
                                medicine.pillsPerDose
                              }
                            </td>

                            <td className={td}>
                              {dateLabel(
                                medicine.startDate,
                              )}
                              {' – '}
                              {medicine.endDate
                                ? dateLabel(
                                    medicine.endDate,
                                  )
                                : 'Ongoing'}
                            </td>

                            <td className={td}>
                              {medicine.currentlyActive
                                ? 'Active'
                                : 'Inactive'}
                            </td>

                            <td className={td}>
                              {medicine.notes ||
                                '—'}
                            </td>
                          </tr>
                        ),
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section title="Adherence Summary">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  [
                    'Eligible',
                    report.summary.totalEligible,
                  ],
                  [
                    'On time',
                    report.summary.takenOnTime,
                  ],
                  [
                    'Taken late',
                    report.summary.takenLate,
                  ],
                  [
                    'Missed',
                    report.summary.missed,
                  ],
                  [
                    'Pending',
                    report.summary.duePending,
                  ],
                  [
                    'Upcoming',
                    report.summary.upcoming,
                  ],
                  [
                    'Incorrect chamber',
                    report.summary
                      .incorrectChamber,
                  ],
                  [
                    'Unverified',
                    report.summary.unverified,
                  ],
                  [
                    'Verification issues',
                    report.summary
                      .totalVerificationIssues,
                  ],
                  [
                    'Adherence',
                    report.summary
                      .adherencePercentage == null
                      ? '—'
                      : `${report.summary.adherencePercentage}%`,
                  ],
                  [
                    'Average delay',
                    `${report.summary.averageDelayMinutes} min`,
                  ],
                  [
                    'Risk',
                    report.summary.riskLevel,
                  ],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-border/60 bg-background/60 p-3 text-center print:bg-white"
                  >
                    <p className="text-xs text-gray-500">
                      {label}
                    </p>

                    <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white print:text-black">
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-border/60 p-4">
                  <p className="text-xs font-bold uppercase text-gray-400">
                    System-generated insight
                  </p>

                  <p className="mt-2 text-sm">
                    {report.summary.insight}
                  </p>
                </div>

                <div className="rounded-xl border border-border/60 p-4">
                  <p className="text-xs font-bold uppercase text-gray-400">
                    Recommendation
                  </p>

                  <p className="mt-2 text-sm">
                    {
                      report.summary
                        .recommendation
                    }
                  </p>
                </div>
              </div>

              <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-gray-600 dark:text-gray-300">
                {report.summary.riskReasons.map(
                  (reason) => (
                    <li key={reason}>
                      {reason}
                    </li>
                  ),
                )}
              </ul>
            </Section>

            <Section title="Medication Performance">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse">
                  <thead>
                    <tr>
                      {[
                        'Medicine',
                        'Dosage / schedule',
                        'Eligible',
                        'On time',
                        'Late',
                        'Missed',
                        'Verification issues',
                        'Adherence',
                      ].map((item) => (
                        <th
                          key={item}
                          className={th}
                        >
                          {item}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {report.performance.length ===
                    0 ? (
                      <EmptyRow
                        columns={8}
                        message="No medication performance data is available."
                      />
                    ) : (
                      report.performance.map(
                        (item) => (
                          <tr
                            key={
                              item.medicineKey
                            }
                          >
                            <td className={td}>
                              {
                                item.medicineName
                              }
                            </td>

                            <td className={td}>
                              {item.dosage ||
                                '—'}
                              {' · '}
                              {item.schedule ||
                                '—'}
                            </td>

                            <td className={td}>
                              {
                                item.totalEligible
                              }
                            </td>

                            <td className={td}>
                              {
                                item.takenOnTime
                              }
                            </td>

                            <td className={td}>
                              {item.takenLate}
                            </td>

                            <td className={td}>
                              {item.missed}
                            </td>

                            <td className={td}>
                              {
                                item.verificationIssues
                              }
                            </td>

                            <td className={td}>
                              {item.adherencePercentage ==
                              null
                                ? '—'
                                : `${item.adherencePercentage}%`}
                            </td>
                          </tr>
                        ),
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section title="Detailed Medication Activity">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1200px] border-collapse">
                  <thead>
                    <tr>
                      {[
                        'Date',
                        'Medicine',
                        'Dosage',
                        'Scheduled',
                        'Final status',
                        'Verified / delay',
                        'Source',
                        'System note',
                        'Notes / explanations / acknowledgments',
                      ].map((item) => (
                        <th
                          key={item}
                          className={th}
                        >
                          {item}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {report.activity.length ===
                    0 ? (
                      <EmptyRow
                        columns={9}
                        message="No medication activity exists in this reporting period."
                      />
                    ) : (
                      report.activity.map(
                        (row) => (
                          <tr
                            key={row.rowKey}
                          >
                            <td className={td}>
                              {dateLabel(
                                row.scheduledDate,
                              )}
                            </td>

                            <td className={td}>
                              {
                                row.medicineName
                              }
                            </td>

                            <td className={td}>
                              {row.dosage ||
                                '—'}
                            </td>

                            <td className={td}>
                              {
                                row.scheduledTime
                              }
                            </td>

                            <td className={td}>
                              {STATUS_LABELS[
                                row.finalStatus
                              ] ??
                                row.finalStatus}
                            </td>

                            <td className={td}>
                              {dateTimeLabel(
                                row.verifiedAt,
                              )}

                              {row.delayMinutes !=
                                null && (
                                <div className="text-xs text-gray-400">
                                  Delay:{' '}
                                  {
                                    row.delayMinutes
                                  }{' '}
                                  min
                                </div>
                              )}
                            </td>

                            <td className={td}>
                              {row.source}
                            </td>

                            <td className={td}>
                              {row.verificationNote ||
                                '—'}
                            </td>

                            <td className={td}>
                              {row.annotations
                                .length === 0 ? (
                                '—'
                              ) : (
                                <div className="space-y-2">
                                  {row.annotations.map(
                                    (
                                      annotation,
                                    ) => (
                                      <div
                                        key={
                                          annotation._id ||
                                          `${annotation.type}-${annotation.createdAt}`
                                        }
                                      >
                                        <b>
                                          {annotationLabel(
                                            annotation.type,
                                          )}
                                          :
                                        </b>{' '}
                                        {annotation.text ||
                                          'Acknowledged'}

                                        <div className="text-xs text-gray-400">
                                          {
                                            annotation.authorName
                                          }
                                          {' · '}
                                          {dateTimeLabel(
                                            annotation.createdAt,
                                          )}
                                        </div>
                                      </div>
                                    ),
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        ),
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section title="Behavioral Adherence Analysis">
              {!report.behavioral
                .hasSufficientData ? (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                  Insufficient completed
                  medication activity is
                  available to identify a
                  reliable behavioral pattern.
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">
                    System-generated adherence
                    analysis; this is not a
                    medical diagnosis.
                  </p>

                  <div className="grid gap-3 md:grid-cols-3">
                    {report.behavioral.timeOfDay.map(
                      (item) => (
                        <div
                          key={item.period}
                          className="rounded-xl border border-border/60 p-4"
                        >
                          <div className="flex justify-between">
                            <b>
                              {item.period}
                            </b>

                            <b className="text-blue-600">
                              {item.eligible
                                ? `${item.adherenceRate}%`
                                : '—'}
                            </b>
                          </div>

                          <p className="mt-2 text-xs text-gray-500">
                            {item.eligible}{' '}
                            eligible ·{' '}
                            {item.late} late ·{' '}
                            {item.missed}{' '}
                            missed
                          </p>
                        </div>
                      ),
                    )}
                  </div>

                  <div className="space-y-2">
                    {report.behavioral.insights
                      .length === 0 ? (
                      <p className="text-sm text-gray-500">
                        No repeated negative
                        behavior was detected.
                      </p>
                    ) : (
                      report.behavioral.insights.map(
                        (item) => (
                          <div
                            key={item.id}
                            className="rounded-xl border border-border/60 p-4"
                          >
                            <b className="text-sm">
                              {item.title}
                            </b>

                            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                              {item.detail}
                            </p>
                          </div>
                        ),
                      )
                    )}
                  </div>
                </div>
              )}
            </Section>

            {report.foodMonitoring && (
              <Section title="Food Monitoring Summary">
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {[
                    [
                      'Assessments',
                      report.foodMonitoring
                        .completedAssessments,
                    ],
                    [
                      'Latest risk',
                      report.foodMonitoring
                        .latestRiskLevel,
                    ],
                    [
                      'Low',
                      report.foodMonitoring
                        .resultCounts.Low,
                    ],
                    [
                      'Moderate',
                      report.foodMonitoring
                        .resultCounts.Moderate,
                    ],
                    [
                      'High',
                      report.foodMonitoring
                        .resultCounts.High,
                    ],
                    [
                      'Latest assessment',
                      dateTimeLabel(
                        report.foodMonitoring
                          .latestAssessedAt,
                      ),
                    ],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-xl border border-border/60 p-3"
                    >
                      <p className="text-xs text-gray-400">
                        {label}
                      </p>

                      <p className="mt-1 font-bold">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                <p className="mt-4 text-sm">
                  {
                    report.foodMonitoring
                      .conditionSpecificSummary
                  }
                </p>

                <p className="mt-3 text-sm">
                  <b>Recommendation:</b>{' '}
                  {
                    report.foodMonitoring
                      .latestRecommendation
                  }
                </p>
              </Section>
            )}

            <Section title="Important Disclaimer">
              <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300 print:text-gray-800">
                {report.disclaimer}
              </p>
            </Section>
          </article>
        )}
      </div>
    </div>
  );
}