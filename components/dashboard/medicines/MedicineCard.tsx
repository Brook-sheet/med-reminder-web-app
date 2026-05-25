// components/dashboard/medicines/MedicineCard.tsx
import React from "react";
import { Edit2, Trash2, Clock, Calendar } from "lucide-react";

interface MedicineCardProps {
  name: string;
  dosage: string;
  frequency: string;
  scheduledTimes: string[];
  startDate?: string;
  endDate?: string;
  notes?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
}

const MedicineCard: React.FC<MedicineCardProps> = ({
  name,
  dosage,
  frequency,
  scheduledTimes,
  startDate,
  endDate,
  notes,
  onEdit,
  onDelete,
  isDeleting = false,
}) => {
  const getAvatarColor = (letter: string) => {
    const colors: { [key: string]: string } = {
      A: "bg-blue-500", B: "bg-purple-500", C: "bg-pink-500", D: "bg-green-500",
      E: "bg-orange-500", F: "bg-red-500", G: "bg-indigo-500", H: "bg-teal-500",
      I: "bg-cyan-500", J: "bg-lime-500", K: "bg-rose-500", L: "bg-amber-500",
      M: "bg-violet-500", N: "bg-fuchsia-500", O: "bg-emerald-500", P: "bg-sky-500",
      Q: "bg-blue-400", R: "bg-purple-400", S: "bg-pink-400", T: "bg-green-400",
      U: "bg-orange-400", V: "bg-red-400", W: "bg-indigo-400", X: "bg-teal-400",
      Y: "bg-cyan-400", Z: "bg-lime-400",
    };
    return colors[letter.toUpperCase()] || "bg-gray-400";
  };

  // Format "YYYY-MM-DD" → "Apr 19, 2026"
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const firstLetter = name.charAt(0).toUpperCase();
  const avatarColor = getAvatarColor(firstLetter);

  return (
    <div
      className={`rounded-[28px] border border-border/70 bg-card p-6 shadow-lg shadow-slate-900/5 transition-all duration-200 ${
        isDeleting ? "opacity-50 pointer-events-none" : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div className="flex min-w-0 items-start gap-4 flex-1">
          <div
            className={`flex items-center justify-center w-12 h-12 rounded-lg ${avatarColor} text-white font-bold text-lg shrink-0`}
          >
            {firstLetter}
          </div>
          <div className="min-w-0 space-y-1">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white wrap-break-word line-clamp-2">
              {name}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{dosage}</p>
          </div>
        </div>

        <div className="flex gap-2 ml-0 sm:ml-4 shrink-0">
          <button
            onClick={onEdit}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Edit medicine"
          >
            <Edit2 className="w-5 h-5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white" />
          </button>
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            aria-label="Delete medicine"
          >
            <Trash2 className="w-5 h-5 text-gray-600 dark:text-gray-400 hover:text-red-600" />
          </button>
        </div>
      </div>

      <div className="h-px bg-gray-100 dark:bg-gray-700 mb-4" />

      <div className="space-y-3">
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
            Frequency
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300">{frequency}</p>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            Scheduled Times
          </p>
          <div className="flex flex-wrap gap-2">
            {scheduledTimes.map((time) => (
              <div
                key={time}
                className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full text-sm font-medium border border-blue-100 dark:border-blue-800"
              >
                <Clock className="w-3.5 h-3.5" />
                {time}
              </div>
            ))}
          </div>
        </div>

        {notes && (
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Notes
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">
              {notes}
            </p>
          </div>
        )}

        {/* Date range */}
        {(startDate || endDate) && (
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Duration
            </p>
            <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
              <Calendar className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
              <span>
                {startDate ? formatDate(startDate) : "—"}{" "}
                {endDate ? `→ ${formatDate(endDate)}` : "(no end date)"}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MedicineCard;

