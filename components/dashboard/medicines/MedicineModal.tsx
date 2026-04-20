"use client";
import React, { useState, useEffect } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import TimePicker from "@/components/ui/TimePicker";
import type { Medicine } from "@/lib/interfaces/data/Medicine";

interface MedicineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    data: Omit<Medicine, "_id" | "userId" | "createdAt" | "updatedAt" | "isActive">
  ) => Promise<void>;
  initialData?: Medicine | null;
}

const FREQUENCY_OPTIONS = [
  "Once daily",
  "Twice daily",
  "Three times daily",
  "Every 4 hours",
  "Every 6 hours",
  "Every 8 hours",
  "Weekly",
  "As needed",
];

const MedicineModal: React.FC<MedicineModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("Once daily");
  const [scheduledTimes, setScheduledTimes] = useState<string[]>(["8:00 AM"]);
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setDosage(initialData.dosage);
      setFrequency(initialData.frequency);
      setScheduledTimes(
        initialData.scheduledTimes.length > 0 ? initialData.scheduledTimes : ["8:00 AM"]
      );
      setStartDate(initialData.startDate || new Date().toISOString().split("T")[0]);
      setEndDate(initialData.endDate || "");
      setNotes(initialData.notes || "");
    } else {
      setName("");
      setDosage("");
      setFrequency("Once daily");
      setScheduledTimes(["8:00 AM"]);
      setStartDate(new Date().toISOString().split("T")[0]);
      setEndDate("");
      setNotes("");
    }
    setError("");
  }, [initialData, isOpen]);

  const addTime = () => setScheduledTimes((prev) => [...prev, "8:00 AM"]);
  const removeTime = (i: number) =>
    setScheduledTimes((prev) => prev.filter((_, idx) => idx !== i));
  const updateTime = (i: number, val: string) =>
    setScheduledTimes((prev) => prev.map((t, idx) => (idx === i ? val : t)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) { setError("Medicine name is required."); return; }
    if (!dosage.trim()) { setError("Dosage is required."); return; }
    if (!startDate) { setError("Start date is required."); return; }
    if (endDate && endDate < startDate) {
      setError("End date cannot be before start date.");
      return;
    }
    if (scheduledTimes.length === 0) {
      setError("At least one scheduled time is required.");
      return;
    }

    setSaving(true);
    try {
      await onSave({ name, dosage, frequency, scheduledTimes, startDate, endDate: endDate || undefined, notes });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-gray-900">
            {initialData ? "Edit Medicine" : "Add New Medicine"}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Medicine Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Aspirin"
              disabled={saving}
              className="w-full h-9 rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dosage <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={dosage}
              onChange={(e) => setDosage(e.target.value)}
              placeholder="e.g. 100mg"
              disabled={saving}
              className="w-full h-9 rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={saving}
              className="w-full h-9 rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 disabled:opacity-50"
            />
            <p className="text-xs text-gray-500 mt-1">Reminders will begin from this date</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date <span className="text-gray-400 text-xs font-normal">(optional)</span>
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              disabled={saving}
              className="w-full h-9 rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 disabled:opacity-50"
            />
            <p className="text-xs text-gray-500 mt-1">Leave blank if the medicine has no end date</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              disabled={saving}
              className="w-full h-9 rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 disabled:opacity-50"
            >
              {FREQUENCY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Scheduled Times <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {scheduledTimes.map((time, index) => (
                <div key={index} className="flex items-center gap-2">
                  <TimePicker
                    value={time}
                    onChange={(val) => updateTime(index, val)}
                    disabled={saving}
                  />
                  {scheduledTimes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTime(index)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      disabled={saving}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addTime}
              disabled={saving}
              className="mt-2 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <Plus className="w-4 h-4" /> Add another time
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Take with food"
              disabled={saving}
              rows={2}
              className="w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 text-sm shadow-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 resize-none disabled:opacity-50"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium text-sm"
            >
              Cancel
            </button>
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? "Saving..." : initialData ? "Save Changes" : "Add Medicine"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MedicineModal;
