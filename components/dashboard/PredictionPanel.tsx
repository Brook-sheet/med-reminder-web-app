import { formatMedicationDateLabel } from '@/lib/medicationTime';
import type { PredictionResult } from '@/lib/prediction/adherencePrediction';

const emptyMessages = {
  insufficient_data: 'More recorded doses are needed to make a prediction.',
  no_upcoming_schedule: 'There is no upcoming medication group to predict.',
  unavailable: 'The prediction is temporarily unavailable.',
};

export default function PredictionPanel({ prediction }: { prediction?: PredictionResult }) {
  if (!prediction) return null;

  const { probability, riskLevel, status, target } = prediction;
  const factors = prediction.factors.slice(0, 3);

  return (
    <section className="rounded-xl border border-border/50 bg-background/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-foreground">Next medication prediction</h3>
        {status === 'preliminary' && (
          <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
            Preliminary estimate
          </span>
        )}
      </div>

      {probability !== null ? (
        <>
          <p className="mt-2 text-base font-semibold text-foreground">
            {riskLevel} predicted risk · {Math.round(probability * 100)}%
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Estimated chance of a missed or delayed medication group.
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          {status in emptyMessages
            ? emptyMessages[status as keyof typeof emptyMessages]
            : 'A prediction is not available yet.'}
        </p>
      )}

      {target && (
        <p className="mt-2 text-sm text-foreground">
          <span className="font-medium">Next medication group</span>{' '}
          {formatMedicationDateLabel(target.scheduledDate, { month: 'short', day: 'numeric' })}
          {' at '}{target.scheduledTime}
        </p>
      )}

      {probability !== null && factors.length > 0 && (
        <div className="mt-3 border-t border-border/50 pt-3">
          <p className="text-xs font-semibold text-foreground">What influenced the estimate</p>
          <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
            {factors.map(factor => (
              <li key={factor.name}>
                {factor.name} {factor.direction === 'increases' ? 'raised' : 'lowered'} the estimate.
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}