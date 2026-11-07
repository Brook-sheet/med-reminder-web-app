import type { PredictionResult } from '@/lib/prediction/adherencePrediction';

export default function PredictionPanel({ prediction }: { prediction?: PredictionResult }) {
  if (!prediction) return null;
  const hasEstimate = prediction.probability !== null;
  return (
    <div className="rounded-xl border border-border/50 bg-background/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">Next medication prediction</h3>
        <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
          {prediction.status === 'validated' ? 'Initial validation passed' : prediction.status === 'preliminary' ? 'Preliminary estimate' : prediction.status === 'insufficient_data' ? 'Insufficient training data' : prediction.status === 'no_upcoming_schedule' ? 'No upcoming schedule' : 'Unavailable'}
        </span>
      </div>
      {hasEstimate && (
        <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
          {prediction.riskLevel} predicted risk · {Math.round(prediction.probability! * 100)}% estimated chance of a missed or delayed group
        </p>
      )}
      {prediction.target && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Next group: {prediction.target.scheduledDate} at {prediction.target.scheduledTime}</p>}
      <p className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-gray-300">{prediction.reason}</p>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        {prediction.eligibleGroups} usable groups · {prediction.trainingExamples} training examples · {prediction.excludedRecords} excluded records
      </p>
      {hasEstimate && (
        <details className="mt-3 text-xs text-gray-600 dark:text-gray-300">
          <summary className="cursor-pointer font-semibold">Why this prediction and how it was checked</summary>
          <p className="mt-2">Factors show learned contributions relative to this patient’s training average. They describe associations, not causes.</p>
          <ul className="mt-2 space-y-1">
            {prediction.factors.map(factor => <li key={factor.name}>{factor.name}: {factor.direction} this estimate.</li>)}
          </ul>
          <p className="mt-2">Risk bands: Low below 30%, Moderate 30–59%, High 60% or above. These are project notification thresholds, not clinical cutoffs.</p>
          {prediction.evaluation ? (
            <p className="mt-2">
              Chronological holdout: {prediction.evaluation.count} groups ({prediction.evaluation.positives} missed or delayed).
              {' '}Brier loss {prediction.evaluation.brier.toFixed(3)} versus baseline {prediction.evaluation.baselineBrier.toFixed(3)} (lower is better).
              {' '}Precision {prediction.evaluation.precision === null ? 'unavailable' : `${Math.round(prediction.evaluation.precision * 100)}%`}; recall {prediction.evaluation.recall === null ? 'unavailable' : `${Math.round(prediction.evaluation.recall * 100)}%`}.
              {' '}This is a small retrospective check, not clinical validation.
            </p>
          ) : <p className="mt-2">Not enough temporally separated examples for a holdout evaluation.</p>}
          <p className="mt-2">Model: {prediction.modelVersion}. Recent 180-day history. A recorded pickup does not confirm swallowing. Existing observed-risk scores and medication SMS remain separate.</p>
        </details>
      )}
    </div>
  );
}