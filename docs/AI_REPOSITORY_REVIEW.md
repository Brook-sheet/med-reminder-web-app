# Rx Box repository assessment and predictive adherence implementation

Reviewed base: `a56bfe588ae7567aa5842cb4b7bc9485d77e0d1a` on `main`, 7 November 2026.

## Finding

The reviewed medication system does **not** contain a trained adherence model. It has useful descriptive statistics, fixed risk rules, hardware event verification, and notification automation. Those are not evidence of machine learning. The food module explicitly simulated a Random Forest with handwritten trees. No training pipeline, learned parameter artifact, real-data evaluation, or prospective medication prediction was found in the tracked source inventory.

This change adds an actual supervised learning implementation. Its coefficients are fitted from a patient's eligible stored records at runtime. No model has been trained on production patient records during this review: the database, real patient dataset, deployed environment, SMS gateway, and physical device were not accessed. No real-patient performance claims are justified yet.

## Architecture and existing capabilities

| Area | Source and behavior | Assessment |
|---|---|---|
| Web/backend | Next.js App Router, React 19, TypeScript, Tailwind; package lock resolves Next 16.2.4. `app/api` handles application services. | Existing architecture retained. |
| Database | Mongoose/MongoDB, not relational SQL tables. `User` owns `Medicine` and `MedicationLog`; references connect logs, alerts, sensors, food responses, and monitoring requests. | Schemas inspected; actual collection contents/counts were not available. |
| Authentication | JWT cookies and bearer tokens, email verification, Google login, patient/family roles, middleware and route checks. | Implemented; unchanged. |
| Family access | `MonitoringRequest` stores patient/family approval. Monitoring dashboard validates family access with a legacy monitoredPatients fallback. Alerts query approved requests and active family users. | Existing authorization retained for predictions. |
| Schedules | `Medicine` holds times, active dates, per-dose windows and pillsPerDose. `medicationVerification` creates dose slots, verifies events and expires unresolved slots. | Rule-based scheduling, not ML. |
| Log integrity | Unique medicine/user/date/time dose-slot index; annotations live on logs; final-state updates use status guards. | Existing idempotency reused. |
| IoT | `esp32/sched`, `esp32/event`, device mapping/key checks, deterministic plans/groups, event IDs, SensorData records. Four chronological chambers; multi-pill doses use multiple chambers and one log. Simultaneous medicines share a pickup group. | Implemented backend contract. No `.ino` firmware is in this repository, so sensor accuracy and servo behavior cannot be verified here. |
| Detection | Dispensed is distinct from taken/late/missed. Tray pickup maps to confirmation; hardware can report missed before the general window expires. Other routes support manual/legacy access events and audit outcomes. | Event interpretation, not AI. A pickup does not establish swallowing. |
| Hardware aliases | `/api/hardware` and `/api/sensor` compatibility paths; separate `server/server.js` legacy server has its own schemas/matching logic. | Canonical Next.js path retained. Standalone server is not upgraded by this work. |
| SMS | `alertEngine`, `sms/delivery`, TextBee/Twilio providers; consent, phone validation, per-recipient deduplication. `sms/dispensed` handles dispensing separately. | Existing event SMS preserved. Acceptance by a gateway is not proof of handset receipt. |
| Background processing | Protected cron route runs reminder delivery and overdue finalization with lease/retry logic for reminders. | Root `vercel.json` has no cron schedule. Nested cron configuration alone does not register the root deployment's cron. External/deployment scheduler must be verified. |
| Dashboard/history | Patient and family dashboards, full-history adherence line chart, weekly comparisons, by-time and by-medicine breakdowns, PDF/report exports. | Descriptive analysis retained. Reports continue to describe observed behavior, not a forecast. |
| Other features | Chat/contact/request/attachment models and routes, profile/settings, onboarding, notifications, push tokens/subscriptions, reset/delete flows. | Present in source; not redesigned or changed. No live end-to-end verification. |

## AI-related classification before changes

| Functionality | Classification | Evidence/limitation |
|---|---|---|
| Eligible-dose adherence | Descriptive statistic | `(onTime + 0.5 * late) / eligible`; this is a custom weighted score, not simply the proportion picked up. |
| Weekly trend, period/medicine summaries | Descriptive statistics | Counts/rates and a fixed five-point change threshold. |
| Low/Moderate/High medication risk | Rule-based classification | `ruleBasedClassify`: 80% and 50% bands plus missed streak, delay, incorrect-access and trend overrides. |
| Repeated misses/delays insights | Rule-based pattern summaries | Minimum counts and thresholds trigger prepared text. |
| Adaptive intervention | Rule-based recommendations | Handwritten reminder/escalation settings and messages. No trained Random Forest exists behind the ML-named parameters. |
| Intervention confidence | Heuristic score | Sample-count arithmetic supplied to the intervention layer; not calibrated model confidence. The API now returns null with an explanation. |
| Food Random Forest | Simulated/manual rule ensemble | Fixed tree functions vote; no bootstrap fitting or learned splits. Display now says rule ensemble/agreement. Legacy API names remain compatible. |
| SMS, dispensing, reminders | Traditional automation | Events, timers, consent rules and deduplication. |
| Future missed/delayed dose probability | Missing | No temporal training labels, holdout evaluation or future target in the original system. |

## Important weaknesses found

1. **Historical backfill:** dashboard reads can generate past schedules and finalize them as missed. They are stored records, but cannot be treated as observed prospective monitoring without checking provenance. Prediction excludes slots created after their scheduled time.
2. **Outcome timing:** `updatedAt` changes with annotations, plan refreshes and other updates. New final outcomes receive `outcomeRecordedAt`; historical rows use updatedAt conservatively. No historical timestamps are invented or migrated. This can leave older datasets with too few usable examples, which is preferable to leakage.
3. **Correlated doses:** simultaneous medicines may share the same pickup. Counting them as independent training events exaggerates sample size. Prediction groups them by scheduled instant and requires every included medication in that group to have a valid final outcome.
4. **Insufficient data:** original hasSufficientData means more than zero eligible doses. It is not a training sufficiency test. The new predictor uses separate sample, class and temporal checks.
5. **Observed vs predicted risk:** original risk describes past behavior. It remains labeled observed; the learned next-group estimate has a separate panel, response field and alert type.
6. **Known original lifecycle edge cases:** the existing evaluator checks taken/late before its future-time guard; explicitly missed hardware events can still appear due until the general window closes. These pre-existing display semantics were not changed. The predictive path independently excludes future records and uses final persisted statuses with conservative availability timing.
7. **Deployment/security follow-ups outside this change:** root cron scheduling must be checked; JWT helpers contain a fallback secret; the legacy standalone server has a development key fallback; MongoDB connection logging includes a URI prefix. Configure secrets and review those paths before public deployment. This audit does not certify the entire application secure.
8. **Measurement limitations:** no ingestion ground truth; offline hardware or missing records can be mistaken for missed pickup. No device-availability variable is currently part of training. Predictions concern recorded behavior only.

## Implemented approach

A deterministic, L2-regularized **binary logistic regression**, trained separately per patient, estimates whether the **next scheduled group has at least one recorded missed or delayed medication outcome**. It does not estimate medical deterioration, diagnose disease, or guarantee medication intake.

Why this model: a small interpretable model suits limited data, requires no new Python service or hosted AI API, supports probability estimates, and fits within the current TypeScript architecture. Logistic regression is both a statistical model and supervised machine learning when its coefficients are fitted to labeled examples. There is no claim that a handcrafted score became AI merely by changing its label.

### Data and labels

- Read-only query: current patient's last 180 calendar days, respecting dataResetAt; 5,000-record safety limit (exceeding it yields unavailable, not silent truncation).
- Only final `taken`, `late`, `missed` records with valid schedule and receipt timestamps, created no later than the schedule. Pending, reminder, dispensed, audit, unverified, incorrect access, future, duplicated and retrospectively created examples are excluded.
- Taken requires a usable takenAt. Delay uses the stored lateAfterMinutes. The binary outcome is 1 for any missed/delayed medication in the simultaneous group and 0 when all are on time.
- Known time is no earlier than final receipt, pickup time and (for missed records) the window end. This intentionally delays early hardware-missed examples until their window ends.
- Fourteen prior known groups are required to construct an example. Features never read the target's own outcome or an outcome that was not yet available.
- Current schedules supply the next future target without inserting future or historical logs. The predictor never writes MedicationLog.

### Inputs

Eight bounded features: missed fraction over the last seven groups; delayed fraction over seven; problem fraction over 28; recent-minus-previous seven-group problem fraction; current missed streak capped/scaled at seven; scheduled hour sine and cosine; weekend indicator. These are event-count windows, not claims of seven/28 calendar days. Existing calendar-day descriptive charts remain unchanged.

### Training and evaluation

Minimum: 60 labeled examples after context, spanning 14 days, with at least 10 examples of each class. These are conservative project engineering requirements, not clinically established sample-size guarantees.

Training minimizes mean binary log loss plus L2 regularization (`0.02`), using 600 deterministic full-batch gradient steps at learning rate `0.3`. Features are centered using training-only means. Intercept is unpenalized. No oversampling or class reweighting changes the prevalence used for probability estimates. Class support and class-sensitive metrics are checked explicitly.

The earliest 75% of examples form training candidates; the latest 25% are holdout. Training labels not yet available at the split are purged. A validation fit uses only the earlier examples. Holdout features may include previous holdout outcomes only when already available before the prediction time, as in sequential deployment; holdout labels never update that fit. No random split, future aggregate feature, synthetic label, or fitted-on-test preprocessing is used.

Evaluation reports support counts, confusion matrix, precision, recall, specificity, F1, balanced accuracy, ROC-AUC, Brier loss and log loss. Undefined metrics remain null. The comparator predicts the training adverse-outcome prevalence for every holdout group.

Initial validation passes only with at least 40 training and 20 holdout examples; training supports at least five of each class, holdout at least five of each; model Brier and log loss both beat the prevalence baseline; AUC >= 0.60; precision and recall at the 0.60 alert threshold >= 0.50. After evaluation, a separate fit on all usable examples generates the current prediction. Holdout metrics describe the earlier validation fit, not an independent test of the refit.

Risk bands are transparent application policy applied to the learned probability: Low <0.30; Moderate 0.30–<0.60; High >=0.60. They are not medical thresholds. Top centered coefficient contributions explain what raises/lowers the prediction relative to the training mean; these are associations, not causes.

### States and refresh

- Insufficient data: trained=false; probability and predicted risk=null.
- Preliminary: actually fitted, but validation is absent/failed or recent outcome knowledge is older than 14 days. No automated family risk alert.
- Validated: passed the initial retrospective gate. This is **not clinical validation** and does not imply external calibration.
- No upcoming schedule / unavailable: no invented forecast.

Fits are rebuilt from current records on prediction requests and scheduler runs. There is no global cross-patient model, disk cache, or stale model surviving a data reset. Version is `personal-logistic-v1`. Changes to data update predictions on the existing next dashboard refresh or scheduler invocation, not on the hardware response's critical path.

## Integration and notifications

Patient `/api/adherence` and authorized family monitoring responses gain a separate prediction field. Shared PredictionPanel preserves the existing styling, charts and counts. Existing risk remains observed risk. No new public prediction endpoint or authorization bypass is added.

The existing reminder scheduler calls the predictor after routine reminders. Eligible High predictions for a group in the next 24 hours can emit `PREDICTED_ADHERENCE_RISK` through the existing approved-family alert engine. The alert is in-app/push, uses a separate key with at most one risk alert per patient/local day/recipient, stores model context in Alert metadata, and explicitly says it is not a confirmed missed dose. Risk alerts do **not** send SMS. Existing dispensed/taken/late/missed SMS continue through their existing paths.

A minor schema extension adds an Alert event enum and nullable MedicationLog.outcomeRecordedAt. There is no new collection or mandatory migration. Predictions and delivery errors cannot finalize doses or roll back medication outcomes. Existing alert duplicate handling also means failed risk pushes do not automatically retry that day's alert; this inherits existing alert delivery behavior and is not an exactly-once handset-delivery guarantee.

## Validation and limits

- Original regression suite: 51 tests passed before adding prediction tests.
- Final unit/integration suite: **65 passed, 0 failed**.
- `npm run build`: passed (Next.js 16.2.4); existing middleware-convention deprecation warning remains.
- `npx tsc --noEmit`: passed.
- Targeted ESLint for all new predictor, panel, test and evaluation-command code: passed.
- `git diff --check`: passed.
- New tests cover learned weights, deterministic predictions, known-value metrics, single-class/short/no-history data, future/backfilled/unresolved/audit records, same-time grouping, duplicate/incomplete groups, delay labels, temporal leakage, data updates, stale history, stable outcome receipts, alert gates and daily keys.
- Mocked integration tests execute the real alert engine with isolated dependencies: approved active-family lookup, duplicate suppression, no predictive SMS, and continued confirmed-event SMS. They also verify prediction-service patient/reset scoping and read-only access.
- Test fixtures are explicitly artificial software-test inputs only. They are never persisted as patient history, shipped as model weights, or presented as model-accuracy evidence.
- No actual patient dataset was supplied. Real precision/recall/AUC/calibration/clinical benefit are **not available**. Live MongoDB, ESP32 motion/pickup accuracy, deployed UI sessions and real gateway delivery remain untested.

## Operational evaluation

Use `npm run evaluate:adherence -- /secure/path/patient-records.json` for an authorized, de-identified single-patient export. Input is `{ "logs": [...], "target": { "scheduledDate": "YYYY-MM-DD", "scheduledTime": "HH:mm" }, "asOf": "ISO timestamp", "timeZone": "Asia/Manila" }`. Logs use PredictionLog's flat date strings (convert MongoDB extended JSON dates), stable pseudonymous medicine IDs, original createdAt/updatedAt and outcomeRecordedAt when present. Keep the source export outside git. The command only reads the file and prints summary/prediction metrics; it does not connect to the database or send alerts.

Before claiming validated research results, evaluate authorized real data; inspect excluded records, class balance, missing-device periods and calibration; collect a subsequent untouched prospective period; report metrics with uncertainty and compare false alerts against missed-risk detections. A single reused holdout on one patient cannot establish generalization to other patients. Hyperparameters/gates are fixed project defaults, not values optimized on this holdout.

Background notifications require the existing cron endpoint to be invoked by an authorized scheduler with `Authorization: Bearer CRON_SECRET`. Verify deployment-plan scheduling support before adding a root Vercel cron entry. No scheduling frequency or hosting charge was silently changed by this implementation.

## Modified/new files

New: `lib/prediction/model.ts`, `adherencePrediction.ts`, `service.ts`, `alertPolicy.ts`, `notifications.ts`; `components/dashboard/PredictionPanel.tsx`; `tests/adherencePrediction.test.ts`, `predictionIntegration.test.ts`; `scripts/evaluate-adherence.mjs`; this report.

Modified:
- `app/api/adherence/route.ts`, `app/api/patient/monitor/[patientID]/dashboard/route.ts`: attach prediction; do not replace historical summaries.
- `hooks/useAdherence.ts`, `components/dashboard/AdherenceCard.tsx`, `app/(main)/monitor/[patientID]/page.tsx`: prediction types/panel and observed-risk wording.
- `lib/medicationReminderScheduler.ts`: isolated predictive family-alert step.
- `lib/alertEngine.ts`, `models/Alert.ts`, `lib/interfaces/data/Alert.ts`: distinct prediction event, existing recipient/deduplication flow, SMS disabled for predictions.
- `models/MedicationLog.ts`, `lib/medicationVerification.ts`: final outcome receipt timestamp without changing status logic.
- `lib/adaptiveIntervention.ts`, `lib/foodMonitoring.ts`, `components/notifications/FoodMonitoringModal.tsx`: accurate rule-based terminology; existing food results preserved.
- `package.json`: read-only evaluation command.
- `README.md`: current ML capability and report link.

## Alignment with the research title

The implemented capability goes beyond relabeled rules: historical outcomes train coefficients, pre-outcome behavior supplies features, a future scheduled group is the explicit target, and later unseen examples are used for evaluation. Explanations and gated approved-family alerts support risk prevention. The defensible statement is that Rx Box **implements supervised predictive adherence modeling with data-sufficiency and initial-validation safeguards**. It is not yet defensible to claim a proven accurate deployed model, clinical effectiveness, or verified ingestion.

Technical references: [regularized logistic regression](https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.LogisticRegression.html), [Brier loss](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.brier_score_loss.html). These explain the methods; they are not evidence of Rx Box performance.