'use client';

import { useState } from 'react';
import type { DailyAdherence } from '@/hooks/useAdherence';

export default function AdherenceHistoryChart({
  days,
  historyLabel = 'Full history',
}: {
  days: DailyAdherence[];
  historyLabel?: string;
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const selected = days.find((day) => day.date === selectedDate);

  if (!days.some((day) => day.adherenceRate !== null)) {
    return (
      <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
        No eligible medication history is available yet.
      </p>
    );
  }

  const width = Math.max(480, 80 + (days.length - 1) * 32);
  const height = 240;
  const left = 48;
  const right = width - 32;
  const top = 20;
  const bottom = 180;

  const x = (index: number) =>
    days.length === 1
      ? (left + right) / 2
      : left + (index / (days.length - 1)) * (right - left);

  const y = (rate: number) =>
    bottom - (rate / 100) * (bottom - top);

  const labelEvery = Math.max(
    1,
    Math.ceil(
      110 / ((right - left) / Math.max(days.length - 1, 1)),
    ),
  );

  // Missing days break the line. They are never treated as 0% adherence.
  const segments: string[] = [];
  let segment: string[] = [];

  days.forEach((day, index) => {
    if (day.adherenceRate === null) {
      if (segment.length) {
        segments.push(segment.join(' '));
      }

      segment = [];
    } else {
      segment.push(`${x(index)},${y(day.adherenceRate)}`);
    }
  });

  if (segment.length) {
    segments.push(segment.join(' '));
  }

  return (
    <div className="mt-4 min-w-0">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {historyLabel} · {days[0].label} – {days[days.length - 1].label}
      </p>

      <div
        className="mt-2 w-full min-w-0 overflow-x-auto rounded-lg focus-visible:outline-2 focus-visible:outline-blue-500"
        tabIndex={0}
        role="region"
        aria-label="Historical adherence chart. Scroll horizontally to view all dates."
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{
            width: '100%',
            minWidth: width,
            height,
          }}
          className="text-gray-500 dark:text-gray-400"
          aria-label={`Daily adherence percentage: ${historyLabel}`}
        >
          <title>Historical daily adherence</title>

          <desc>
            Dates run from oldest to newest. The vertical axis runs from 0 to
            100 percent. Gaps mean no eligible doses. Focus or tap a point
            for details.
          </desc>

          {[0, 25, 50, 75, 100].map((rate) => (
            <g key={rate}>
              <line
                x1={left}
                x2={right}
                y1={y(rate)}
                y2={y(rate)}
                stroke="currentColor"
                strokeOpacity={0.15}
                strokeDasharray="4 4"
              />

              <text
                x={left - 8}
                y={y(rate) + 4}
                textAnchor="end"
                fill="currentColor"
                fontSize={11}
              >
                {rate}%
              </text>
            </g>
          ))}

          {segments.map((points, index) => (
            <polyline
              key={index}
              points={points}
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              className="text-blue-600 dark:text-blue-400"
            />
          ))}

          {days.map((day, index) => (
            <g key={day.date}>
              {index % labelEvery === 0 && (
                <text
                  x={x(index)}
                  y={bottom + 24}
                  textAnchor="middle"
                  fill="currentColor"
                  fontSize={10}
                >
                  {day.date}
                </text>
              )}

              {day.adherenceRate !== null && (
                <circle
                  cx={x(index)}
                  cy={y(day.adherenceRate)}
                  r={selectedDate === day.date ? 5 : 3.5}
                  fill="currentColor"
                  stroke="transparent"
                  strokeWidth={18}
                  className="cursor-pointer text-blue-600 outline-none focus:fill-blue-900 dark:text-blue-400"
                  tabIndex={0}
                  role="button"
                  aria-label={`${day.label}: ${day.adherenceRate}% adherence, ${day.taken} taken of ${day.eligible} eligible doses`}
                  onPointerEnter={() => setSelectedDate(day.date)}
                  onFocus={() => setSelectedDate(day.date)}
                  onClick={() => setSelectedDate(day.date)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedDate(day.date);
                    }
                  }}
                >
                  <title>
                    {`${day.label}: ${day.adherenceRate}%`}
                  </title>
                </circle>
              )}
            </g>
          ))}

          <text
            x={(left + right) / 2}
            y={height - 10}
            textAnchor="middle"
            fill="currentColor"
            fontSize={11}
          >
            Scheduled date
          </text>
        </svg>
      </div>

      <p
        className="mt-2 min-h-8 text-xs text-gray-600 dark:text-gray-300"
        aria-live="polite"
      >
        {selected
          ? `${selected.label}: ${selected.adherenceRate}% adherence · ${selected.taken} taken / ${selected.eligible} eligible doses.`
          : 'Tap or focus a point for details. Scroll horizontally to explore all dates.'}
      </p>

      <p className="text-[11px] text-gray-500 dark:text-gray-400">
        Daily score uses the existing adherence calculation. Gaps indicate
        days without eligible doses. Upcoming and active-window pending
        doses are excluded.
      </p>
    </div>
  );
}