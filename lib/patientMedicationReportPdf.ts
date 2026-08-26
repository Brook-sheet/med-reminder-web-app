import PDFDocument from 'pdfkit';
import type { PatientMedicationReportData } from '@/lib/interfaces/data/PatientMedicationReport';

type TableColumn = {
  label: string;
  width: number;
};

const COLORS = {
  ink: '#0F172A',
  muted: '#64748B',
  line: '#CBD5E1',
  soft: '#F8FAFC',
  blue: '#2563EB',
  blueSoft: '#EFF6FF',
  green: '#15803D',
  amber: '#B45309',
  red: '#B91C1C',
};

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

function dateTimeLabel(value: string | null): string {
  if (!value) return '—';

  return new Date(value).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function statusLabel(value: string): string {
  const labels: Record<string, string> = {
    taken: 'Taken',
    late: 'Taken Late',
    missed: 'Missed / Not Taken',
    due: 'Pending',
    upcoming: 'Upcoming',
    unverified: 'Unverified',
    incorrect_chamber: 'Incorrect Chamber',
  };

  return labels[value] ?? value;
}

function annotationText(
  row: PatientMedicationReportData['activity'][number],
): string {
  const lines: string[] = [];

  if (row.verificationNote) {
    lines.push(`System: ${row.verificationNote}`);
  }

  for (const annotation of row.annotations) {
    const type =
      annotation.type === 'patient_note'
        ? 'Patient note'
        : annotation.type === 'missed_explanation'
          ? 'Missed explanation'
          : 'Family acknowledgment';

    const text = annotation.text
      ? `: ${annotation.text}`
      : '';

    lines.push(
      `${type}${text} — ${annotation.authorName}, ` +
        dateTimeLabel(annotation.createdAt),
    );
  }

  if (lines.length === 0) {
    return '—';
  }

  return lines.join('\n');
}

export function medicationReportPdfFilename(
  report: PatientMedicationReportData,
): string {
  const patientId = report.patient.patientId
    .replace(/[^A-Za-z0-9_-]/g, '_')
    .slice(0, 40);

  return (
    `RxBox_Medication_Report_${patientId}_` +
    `${report.period.from}_${report.period.to}.pdf`
  );
}

export async function generatePatientMedicationReportPdf(
  report: PatientMedicationReportData,
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margins: {
      top: 42,
      right: 36,
      bottom: 48,
      left: 36,
    },
    bufferPages: true,
    info: {
      Title: report.title,
      Author: 'Rx Box',
      Subject:
        `Medication adherence report for ` +
        report.patient.patientId,
      Keywords:
        'Rx Box, medication adherence, patient report',
      CreationDate: new Date(report.generatedAt),
    },
  });

  const chunks: Buffer[] = [];

  doc.on('data', (chunk: Buffer) => {
    chunks.push(chunk);
  });

  const finished = new Promise<Buffer>(
    (resolve, reject) => {
      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });

      doc.on('error', reject);
    },
  );

  const contentWidth =
    doc.page.width -
    doc.page.margins.left -
    doc.page.margins.right;

  const contentBottom = () =>
    doc.page.height -
    doc.page.margins.bottom -
    20;

  const ensureSpace = (height: number) => {
    if (doc.y + height > contentBottom()) {
      doc.addPage();
    }
  };

  const sectionTitle = (title: string) => {
    ensureSpace(34);

    doc
      .moveDown(0.5)
      .font('Helvetica-Bold')
      .fontSize(13)
      .fillColor(COLORS.ink)
      .text(title);

    doc
      .moveDown(0.2)
      .strokeColor(COLORS.blue)
      .lineWidth(1.5)
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(
        doc.page.margins.left + contentWidth,
        doc.y,
      )
      .stroke();

    doc.moveDown(0.55);
  };

  const paragraph = (
    text: string,
    options?: PDFKit.Mixins.TextOptions,
  ) => {
    ensureSpace(24);

    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(COLORS.ink)
      .text(text, {
        width: contentWidth,
        lineGap: 2,
        ...options,
      });

    doc.moveDown(0.35);
  };

  const table = (
    columns: TableColumn[],
    rows: string[][],
  ) => {
    const totalWidth = columns.reduce(
      (sum, column) => sum + column.width,
      0,
    );

    const scale = contentWidth / totalWidth;

    const widths = columns.map(
      (column) => column.width * scale,
    );

    const padding = 4;

    const drawHeader = () => {
      const headerHeight = 24;

      ensureSpace(headerHeight + 8);

      let x = doc.page.margins.left;
      const y = doc.y;

      columns.forEach((column, index) => {
        doc
          .save()
          .fillColor(COLORS.blueSoft)
          .rect(
            x,
            y,
            widths[index],
            headerHeight,
          )
          .fill()
          .restore();

        doc
          .strokeColor(COLORS.line)
          .lineWidth(0.5)
          .rect(
            x,
            y,
            widths[index],
            headerHeight,
          )
          .stroke();

        doc
          .font('Helvetica-Bold')
          .fontSize(7.5)
          .fillColor(COLORS.ink)
          .text(
            column.label,
            x + padding,
            y + 6,
            {
              width:
                widths[index] - padding * 2,
              height: headerHeight - 8,
            },
          );

        x += widths[index];
      });

      doc.y = y + headerHeight;
    };

    drawHeader();

    if (rows.length === 0) {
      const y = doc.y;

      doc
        .fillColor(COLORS.soft)
        .rect(
          doc.page.margins.left,
          y,
          contentWidth,
          28,
        )
        .fill();

      doc
        .font('Helvetica-Oblique')
        .fontSize(8)
        .fillColor(COLORS.muted)
        .text(
          'No records were available for this section.',
          doc.page.margins.left + 6,
          y + 9,
        );

      doc.y = y + 34;

      return;
    }

    rows.forEach((row, rowIndex) => {
      const textHeights = row.map(
        (cell, index) =>
          doc
            .font('Helvetica')
            .fontSize(7.2)
            .heightOfString(cell || '—', {
              width:
                widths[index] - padding * 2,
              lineGap: 1,
            }),
      );

      const rowHeight = Math.max(
        24,
        ...textHeights.map(
          (height) =>
            height + padding * 2,
        ),
      );

      if (doc.y + rowHeight > contentBottom()) {
        doc.addPage();
        drawHeader();
      }

      let x = doc.page.margins.left;
      const y = doc.y;

      const background =
        rowIndex % 2 === 0
          ? '#FFFFFF'
          : COLORS.soft;

      row.forEach((cell, index) => {
        doc
          .save()
          .fillColor(background)
          .rect(
            x,
            y,
            widths[index],
            rowHeight,
          )
          .fill()
          .restore();

        doc
          .strokeColor(COLORS.line)
          .lineWidth(0.4)
          .rect(
            x,
            y,
            widths[index],
            rowHeight,
          )
          .stroke();

        doc
          .font('Helvetica')
          .fontSize(7.2)
          .fillColor(COLORS.ink)
          .text(
            cell || '—',
            x + padding,
            y + padding,
            {
              width:
                widths[index] - padding * 2,
              height:
                rowHeight - padding * 2,
              lineGap: 1,
            },
          );

        x += widths[index];
      });

      doc.y = y + rowHeight;
    });

    doc.moveDown(0.6);
  };

  doc
    .font('Helvetica-Bold')
    .fontSize(23)
    .fillColor(COLORS.blue)
    .text('Rx Box', {
      align: 'center',
    });

  doc
    .font('Helvetica-Bold')
    .fontSize(17)
    .fillColor(COLORS.ink)
    .text(
      'Patient Medication Adherence Report',
      {
        align: 'center',
      },
    );

  doc
    .moveDown(0.35)
    .font('Helvetica')
    .fontSize(9)
    .fillColor(COLORS.muted)
    .text(
      `${dateLabel(report.period.from)} – ` +
        `${dateLabel(report.period.to)} · ` +
        'Asia/Manila',
      {
        align: 'center',
      },
    );

  doc.moveDown(0.8);

  table(
    [
      {
        label: 'Patient',
        width: 150,
      },
      {
        label: 'Patient ID',
        width: 90,
      },
      {
        label: 'Condition',
        width: 100,
      },
      {
        label: 'Generated',
        width: 150,
      },
      {
        label: 'Reference',
        width: 90,
      },
    ],
    [
      [
        report.patient.name,
        report.patient.patientId,
        report.patient.condition,
        dateTimeLabel(report.generatedAt),
        report.referenceId,
      ],
    ],
  );

  sectionTitle('Medication Regimen');

  table(
    [
      {
        label: 'Medicine',
        width: 115,
      },
      {
        label: 'Dosage',
        width: 70,
      },
      {
        label: 'Schedule',
        width: 100,
      },
      {
        label: 'Pills / dose',
        width: 55,
      },
      {
        label: 'Duration',
        width: 115,
      },
      {
        label: 'Current status',
        width: 70,
      },
      {
        label: 'Instructions / notes',
        width: 160,
      },
    ],
    report.regimen.map((medicine) => [
      medicine.name,
      medicine.dosage,
      medicine.scheduledTimes.join(', '),
      String(medicine.pillsPerDose),
      `${dateLabel(medicine.startDate)} – ${
        medicine.endDate
          ? dateLabel(medicine.endDate)
          : 'Ongoing'
      }`,
      medicine.currentlyActive
        ? 'Active'
        : 'Inactive',
      medicine.notes || '—',
    ]),
  );

  sectionTitle('Adherence Summary');

  table(
    [
      {
        label: 'Eligible',
        width: 55,
      },
      {
        label: 'On time',
        width: 55,
      },
      {
        label: 'Late',
        width: 45,
      },
      {
        label: 'Missed',
        width: 50,
      },
      {
        label: 'Pending',
        width: 55,
      },
      {
        label: 'Upcoming',
        width: 55,
      },
      {
        label: 'Incorrect chamber',
        width: 75,
      },
      {
        label: 'Unverified',
        width: 60,
      },
      {
        label: 'Adherence',
        width: 60,
      },
      {
        label: 'Risk',
        width: 55,
      },
      {
        label: 'Trend',
        width: 60,
      },
    ],
    [
      [
        String(report.summary.totalEligible),
        String(report.summary.takenOnTime),
        String(report.summary.takenLate),
        String(report.summary.missed),
        String(report.summary.duePending),
        String(report.summary.upcoming),
        String(report.summary.incorrectChamber),
        String(report.summary.unverified),
        report.summary.adherencePercentage == null
          ? '—'
          : `${report.summary.adherencePercentage}%`,
        report.summary.riskLevel,
        report.summary.trendAvailable
          ? report.summary.trend
          : 'Not available',
      ],
    ],
  );

  paragraph(
    `Risk reasons: ` +
      report.summary.riskReasons.join(' '),
  );

  paragraph(
    `System-generated insight: ` +
      report.summary.insight,
  );

  paragraph(
    `System-generated recommendation: ` +
      report.summary.recommendation,
  );

  sectionTitle('Medication Performance');

  table(
    [
      {
        label: 'Medicine',
        width: 115,
      },
      {
        label: 'Dosage / schedule',
        width: 125,
      },
      {
        label: 'Eligible',
        width: 55,
      },
      {
        label: 'On time',
        width: 55,
      },
      {
        label: 'Late',
        width: 45,
      },
      {
        label: 'Missed',
        width: 50,
      },
      {
        label: 'Verification issues',
        width: 75,
      },
      {
        label: 'Adherence',
        width: 65,
      },
    ],
    report.performance.map((item) => [
      item.medicineName,
      `${item.dosage || '—'} · ` +
        `${item.schedule || '—'}`,
      String(item.totalEligible),
      String(item.takenOnTime),
      String(item.takenLate),
      String(item.missed),
      String(item.verificationIssues),
      item.adherencePercentage == null
        ? '—'
        : `${item.adherencePercentage}%`,
    ]),
  );

  sectionTitle('Detailed Medication Activity');

  table(
    [
      {
        label: 'Date / scheduled',
        width: 85,
      },
      {
        label: 'Medicine',
        width: 95,
      },
      {
        label: 'Dosage',
        width: 55,
      },
      {
        label: 'Final status',
        width: 75,
      },
      {
        label: 'Verified / delay',
        width: 95,
      },
      {
        label: 'Source',
        width: 70,
      },
      {
        label: 'Chamber(s)',
        width: 60,
      },
      {
        label:
          'Notes / explanation / acknowledgment',
        width: 210,
      },
    ],
    report.activity.map((row) => [
      `${dateLabel(row.scheduledDate)}\n` +
        row.scheduledTime,
      row.medicineName,
      row.dosage || '—',
      statusLabel(row.finalStatus),
      `${dateTimeLabel(row.verifiedAt)}${
        row.delayMinutes != null
          ? `\nDelay: ${row.delayMinutes} min`
          : ''
      }`,
      row.source,
      row.expectedChamberIds.join(', ') || '—',
      annotationText(row),
    ]),
  );

  sectionTitle(
    'Behavioral Adherence Analysis',
  );

  if (!report.behavioral.hasSufficientData) {
    paragraph(
      'Insufficient completed medication activity is available to identify a reliable behavioral pattern.',
    );
  } else {
    paragraph(
      'The following results are system-generated adherence-support information and are not a medical diagnosis.',
    );

    table(
      [
        {
          label: 'Time of day',
          width: 100,
        },
        {
          label: 'Eligible',
          width: 65,
        },
        {
          label: 'Taken',
          width: 65,
        },
        {
          label: 'Late',
          width: 65,
        },
        {
          label: 'Missed',
          width: 65,
        },
        {
          label: 'Adherence',
          width: 75,
        },
      ],
      report.behavioral.timeOfDay.map((item) => [
        item.period,
        String(item.eligible),
        String(item.taken),
        String(item.late),
        String(item.missed),
        `${item.adherenceRate}%`,
      ]),
    );

    table(
      [
        {
          label: 'Detected pattern',
          width: 170,
        },
        {
          label: 'Details',
          width: 430,
        },
      ],
      report.behavioral.insights.map(
        (item) => [
          item.title,
          item.detail,
        ],
      ),
    );
  }

  if (report.foodMonitoring) {
    sectionTitle('Food Monitoring Summary');

    table(
      [
        {
          label: 'Assessments',
          width: 70,
        },
        {
          label: 'Latest risk',
          width: 70,
        },
        {
          label: 'Low',
          width: 45,
        },
        {
          label: 'Moderate',
          width: 55,
        },
        {
          label: 'High',
          width: 45,
        },
        {
          label: 'Latest assessment',
          width: 125,
        },
        {
          label: 'Condition-specific summary',
          width: 260,
        },
      ],
      [
        [
          String(
            report.foodMonitoring.completedAssessments,
          ),
          report.foodMonitoring.latestRiskLevel,
          String(
            report.foodMonitoring.resultCounts.Low,
          ),
          String(
            report.foodMonitoring.resultCounts.Moderate,
          ),
          String(
            report.foodMonitoring.resultCounts.High,
          ),
          dateTimeLabel(
            report.foodMonitoring.latestAssessedAt,
          ),
          report.foodMonitoring
            .conditionSpecificSummary,
        ],
      ],
    );

    paragraph(
      `Recommendation: ` +
        report.foodMonitoring.latestRecommendation,
    );
  }

  sectionTitle('Important Disclaimer');

  paragraph(report.disclaimer);

  const pageRange = doc.bufferedPageRange();

  for (
    let pageIndex = pageRange.start;
    pageIndex <
    pageRange.start + pageRange.count;
    pageIndex += 1
  ) {
    doc.switchToPage(pageIndex);

    const footerY = doc.page.height - 28;

    doc
      .strokeColor(COLORS.line)
      .lineWidth(0.5)
      .moveTo(
        doc.page.margins.left,
        footerY - 6,
      )
      .lineTo(
        doc.page.width -
          doc.page.margins.right,
        footerY - 6,
      )
      .stroke();

    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(COLORS.muted)
      .text(
        `Rx Box · ${report.referenceId}`,
        doc.page.margins.left,
        footerY,
        {
          width: contentWidth / 2,
          align: 'left',
          lineBreak: false,
        },
      )
      .text(
        `Page ${
          pageIndex - pageRange.start + 1
        } of ${pageRange.count}`,
        doc.page.margins.left +
          contentWidth / 2,
        footerY,
        {
          width: contentWidth / 2,
          align: 'right',
          lineBreak: false,
        },
      );
  }

  doc.end();

  return finished;
}