import type {
  BehavioralInsight,
  DailyAdherence,
  MedicationPattern,
  RiskLevel,
  TimePattern,
  TrendDirection,
} from '@/lib/adherenceEngine';

export type MedicationReportStatus =
  | 'taken'
  | 'late'
  | 'missed'
  | 'due'
  | 'upcoming'
  | 'unverified'
  | 'incorrect_chamber'
  | 'audit';

export interface MedicationReportAnnotation {
  _id: string;
  type:
    | 'patient_note'
    | 'missed_explanation'
    | 'family_acknowledgment';
  text: string;
  authorRole: 'patient' | 'family';
  authorName: string;
  createdAt: string;
}

export interface MedicationReportRegimenItem {
  medicineKey: string;
  name: string;
  dosage: string;
  scheduledTimes: string[];
  pillsPerDose: number;
  startDate: string;
  endDate: string | null;
  currentlyActive: boolean;
  notes: string;
}

export interface MedicationReportPerformanceItem {
  medicineKey: string;
  medicineName: string;
  dosage: string;
  schedule: string;
  totalEligible: number;
  takenOnTime: number;
  takenLate: number;
  missed: number;
  verificationIssues: number;
  adherencePercentage: number | null;
}

export interface MedicationReportActivityItem {
  rowKey: string;
  medicineName: string;
  dosage: string;
  scheduledDate: string;
  scheduledTime: string;
  finalStatus: MedicationReportStatus;
  verifiedAt: string | null;
  delayMinutes: number | null;
  source: 'Manual' | 'Rx Box Sensor' | 'System';
  verificationNote: string;
  expectedChamberIds: number[];
  annotations: MedicationReportAnnotation[];
  patientNotes: MedicationReportAnnotation[];
  missedExplanations: MedicationReportAnnotation[];
  familyAcknowledgments: MedicationReportAnnotation[];
}

export interface PatientMedicationReportData {
  title: 'Rx Box: Patient Medication Adherence Report';
  referenceId: string;
  timeZone: string;
  generatedAt: string;
  disclaimer: string;
  patient: {
    name: string;
    patientId: string;
    condition: string;
  };
  period: {
    from: string;
    to: string;
    numberOfDays: number;
  };
  regimen: MedicationReportRegimenItem[];
  summary: {
    totalEligible: number;
    takenOnTime: number;
    takenLate: number;
    missed: number;
    duePending: number;
    upcoming: number;
    incorrectChamber: number;
    unverified: number;
    totalVerificationIssues: number;
    adherencePercentage: number | null;
    recentAdherencePercentage: number | null;
    previousAdherencePercentage: number | null;
    trend: TrendDirection;
    trendAvailable: boolean;
    consecutiveMissed: number;
    averageDelayMinutes: number;
    riskLevel: RiskLevel;
    riskReasons: string[];
    insight: string;
    recommendation: string;
    hasSufficientData: boolean;
  };
  performance: MedicationReportPerformanceItem[];
  activity: MedicationReportActivityItem[];
  behavioral: {
    hasSufficientData: boolean;
    dailyTrend: DailyAdherence[];
    timeOfDay: TimePattern[];
    byMedication: MedicationPattern[];
    insights: BehavioralInsight[];
    riskReasons: string[];
    recommendation: string;
  };
  foodMonitoring: {
    completedAssessments: number;
    latestRiskLevel: RiskLevel;
    resultCounts: Record<RiskLevel, number>;
    conditionSpecificSummary: string;
    latestRecommendation: string;
    latestAssessedAt: string;
  } | null;
}