"use client";

import React, { useState, useEffect } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { IMedicine } from "@/types";

interface MedicineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    data: Omit<IMedicine, "_id" | "userId" | "createdAt" | "updatedAt" | "isActive">
  ) => Promise<void>;
  initialData?: IMedicine | null;
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
  const [scheduledTimes, setScheduledTimes] = useState<string[]>(["08:00 AM"]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Populate form when editing
  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setDosage(initialData.dosage);
      setFrequency(initialData.frequency);
      setScheduledTimes(
        initialData.scheduledTimes.length > 0 ? initialData.scheduledTimes : ["08:00 AM"]
      );
      setNotes(initialData.notes || "");
    } else {
      setName("");
      setDosage("");
      setFrequency("Once daily");
      setScheduledTimes(["08:00 AM"]);
      setNotes("");
    }
    setError("");
  }, [initialData, isOpen]);

  const addTime = () => setScheduledTimes((prev) => [...prev, "12:00 PM"]);
  const removeTime = (index: number) =>
    setScheduledTimes((prev) => prev.filter((_, i) => i !== index));
  const updateTime = (index: number, value: string) =>
    setScheduledTimes((prev) => prev.map((t, i) => (i === index ? value : t)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) { setError("Medicine name is required."); return; }
    if (!dosage.trim()) { setError("Dosage is required."); return; }
    if (scheduledTimes.length === 0) { setError("At least one scheduled time is required."); return; }

    setSaving(true);
    try {
      await onSave({ name, dosage, frequency, scheduledTimes, notes });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save. Please try again.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">
            {initialData ? "Edit Medicine" : "Add New Medicine"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {/* Medicine Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Medicine Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Aspirin"
              disabled={saving}
            />
          </div>

          {/* Dosage */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dosage <span className="text-red-500">*</span>
            </label>
            <Input
              value={dosage}
              onChange={(e) => setDosage(e.target.value)}
              placeholder="e.g. 100mg"
              disabled={saving}
            />
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Frequency
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              disabled={saving}
              className="w-full h-9 rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {FREQUENCY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* Scheduled Times */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Scheduled Times <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {scheduledTimes.map((time, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={time}
                    onChange={(e) => updateTime(index, e.target.value)}
                    placeholder="e.g. 8:00 AM"
                    disabled={saving}
                    className="flex-1"
                  />
                  {scheduledTimes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTime(index)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
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
              <Plus className="w-4 h-4" />
              Add another time
            </button>
          </div>

          {/* Notes */}
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
              className="w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 resize-none"
            />
          </div>

          {/* Actions */}
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
