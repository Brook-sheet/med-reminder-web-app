/* Read-only evaluation of a locally supplied, de-identified real-record export.
 * Input: { logs: PredictionLog[], target: {scheduledDate, scheduledTime},
 *          asOf: ISO timestamp, timeZone: IANA zone }.
 * Never inserts records or sends notifications. stdout contains summary only.
 */
import fs from 'node:fs';
import { predictAdherence } from '../.next/test-build/lib/prediction/adherencePrediction.js';
const inputPath = process.argv[2];
if (!inputPath) throw new Error('Usage: npm run evaluate:adherence -- /path/to/real-records.json');
const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
if (!Array.isArray(input.logs) || !input.asOf || !input.timeZone || !Number.isFinite(+new Date(input.asOf))) {
  throw new Error('Provide logs, a valid asOf timestamp, and timeZone.');
}
const patients = new Set(input.logs.map(log => log.userId).filter(Boolean).map(String));
if (patients.size > 1) throw new Error('Supply exactly one patient’s history per evaluation.');
console.log(JSON.stringify(predictAdherence(input.logs, input.target ?? null, new Date(input.asOf), input.timeZone), null, 2));