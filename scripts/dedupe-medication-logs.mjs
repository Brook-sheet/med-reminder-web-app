// scripts/dedupe-medication-logs.mjs
//
// ONE-TIME CLEANUP SCRIPT.
//
// Run this ONCE, before restarting the server after pulling the
// new unique index on MedicationLog (userId, medicineId,
// scheduledDate, scheduledTime).
//
// Why this is needed: the duplicate-medicine bug (two
// MedicationLog documents created for the same medicine's dose
// slot on the same day, caused by a race between
// ensureMedicationLogsForDate() and the medicine-edit route's
// own log resync) has already been happening in the live
// database. MongoDB will REFUSE to build a unique index on a
// collection that already contains values violating it - so any
// existing duplicates must be removed first, or the app will
// fail to start / the index will silently fail to build.
//
// What it does:
//   1. Groups all MedicationLog documents by
//      (userId, medicineId, scheduledDate, scheduledTime).
//   2. For any group with more than one document, keeps exactly
//      one and deletes the rest.
//   3. The kept document is chosen by:
//        - preferring the most "resolved" status, since a
//          duplicate that was actually taken/missed carries real
//          adherence history that must not be thrown away, and
//        - tie-breaking by earliest createdAt (the original,
//          first-created record) when statuses are equally
//          resolved.
//   4. Only touches documents where medicineId is a real
//      ObjectId - manual/free-form log entries (medicineId:
//      null) are never affected, matching the partial unique
//      index's scope exactly.
//
// Usage:
//   node scripts/dedupe-medication-logs.mjs
//
// It is safe to run multiple times - once there are no
// duplicates left, it does nothing.

import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local');

  if (!fs.existsSync(envPath)) {
    return;
  }

  const contents = fs.readFileSync(envPath, 'utf8');

  for (const rawLine of contents.split('\n')) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const equalsIndex = line.indexOf('=');
    if (equalsIndex === -1) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();

    // Strip surrounding quotes if present.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // Don't overwrite a variable already set in the real
    // environment (e.g. by the shell or CI).
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

// Resolution priority: higher number = more resolved / more
// important to keep over a plain pending duplicate.
const STATUS_PRIORITY = {
  taken: 5,
  late: 4,
  missed: 3,
  dispensed: 2,
  reminder: 1,
  pending: 0,
  unverified: 0,
  incorrect_chamber: 0,
};

function pickDocumentToKeep(docs) {
  return [...docs].sort((first, second) => {
    const firstPriority = STATUS_PRIORITY[first.status] ?? 0;
    const secondPriority = STATUS_PRIORITY[second.status] ?? 0;

    if (firstPriority !== secondPriority) {
      // Higher priority (more resolved) first.
      return secondPriority - firstPriority;
    }

    // Tie-break: earliest created first.
    const firstCreated = new Date(first.createdAt).getTime();
    const secondCreated = new Date(second.createdAt).getTime();

    return firstCreated - secondCreated;
  })[0];
}

async function main() {
  loadEnvLocal();

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error(
      'MONGODB_URI is not set (checked process.env and .env.local). Aborting.'
    );
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('Connected.');

  const MedicationLog = mongoose.connection.collection('medicationlogs');

  const duplicateGroups = await MedicationLog.aggregate([
    {
      $match: {
        medicineId: { $type: 'objectId' },
      },
    },
    {
      $group: {
        _id: {
          userId: '$userId',
          medicineId: '$medicineId',
          scheduledDate: '$scheduledDate',
          scheduledTime: '$scheduledTime',
        },
        docs: {
          $push: {
            _id: '$_id',
            status: '$status',
            createdAt: '$createdAt',
          },
        },
        count: { $sum: 1 },
      },
    },
    {
      $match: {
        count: { $gt: 1 },
      },
    },
  ]).toArray();

  if (duplicateGroups.length === 0) {
    console.log('No duplicate medication logs found. Nothing to do.');
    await mongoose.disconnect();
    return;
  }

  console.log(
    `Found ${duplicateGroups.length} duplicate group(s). Cleaning up...`
  );

  let totalDeleted = 0;

  for (const group of duplicateGroups) {
    const keep = pickDocumentToKeep(group.docs);

    const idsToDelete = group.docs
      .map((doc) => doc._id)
      .filter((id) => String(id) !== String(keep._id));

    if (idsToDelete.length === 0) {
      continue;
    }

    const result = await MedicationLog.deleteMany({
      _id: { $in: idsToDelete },
    });

    totalDeleted += result.deletedCount ?? 0;

    console.log(
      `  medicineId=${group._id.medicineId} date=${group._id.scheduledDate} time=${group._id.scheduledTime}: ` +
      `kept 1 (status=${keep.status}), deleted ${idsToDelete.length}`
    );
  }

  console.log(
    `Done. Deleted ${totalDeleted} duplicate document(s) across ${duplicateGroups.length} group(s).`
  );

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('Cleanup script failed:', error);
  process.exit(1);
});