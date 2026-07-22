"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus } from "lucide-react";
import MedicineCard from "@/components/dashboard/medicines/MedicineCard";
import MedicineModal from "@/components/dashboard/medicines/MedicineModal";
import Toast from "@/components/ui/Toast";
import type { Medicine } from "@/lib/interfaces/data/Medicine";
import type { ToastProps } from "@/components/ui/Toast";

const Medicines = () => {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  type SortOption = "recent" | "oldest" | "az" | "za";
  const [sortOption, setSortOption] = useState<SortOption>("recent");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<Omit<ToastProps, "onClose"> | null>(null);

  const fetchMedicines = useCallback(async () => {
    try {
      const res = await fetch("/api/medicines");
      const data = await res.json();
      if (data.success) setMedicines(data.data);
    } catch (err) {
      console.error("Failed to fetch medicines:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMedicines();
  }, [fetchMedicines]);

  const handleAdd = () => {
    setEditingMedicine(null);
    setModalOpen(true);
  };

  const sortedMedicines = useMemo(() => {
    const copy = [...medicines];
    const getTime = (m: Medicine) => {
      const maybe = m as unknown as { createdAt?: string | Date };
      if (maybe.createdAt) return new Date(maybe.createdAt).getTime();
      // Fallback to ObjectId timestamp if available
      try {
        const hex = String(m._id).slice(0, 8);
        return Number.parseInt(hex, 16) * 1000;
      } catch {
        return 0;
      }
    };

    switch (sortOption) {
      case "recent":
        return copy.sort((a, b) => getTime(b) - getTime(a));
      case "oldest":
        return copy.sort((a, b) => getTime(a) - getTime(b));
      case "az":
        return copy.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      case "za":
        return copy.sort((a, b) => (b.name || "").localeCompare(a.name || ""));
      default:
        return copy;
    }
  }, [medicines, sortOption]);

  const handleEdit = (medicine: Medicine) => {
    setEditingMedicine(medicine);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this medicine?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/medicines/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setMedicines((prev) => prev.filter((m) => m._id !== id));
        setToast({ type: "success", message: "Medicine deleted successfully" });
        window.dispatchEvent(new Event('medicineScheduleChanged'));
      } else {
        setToast({ type: "error", message: data.error || "Failed to delete medicine." });
      }
    } catch {
      setToast({ type: "error", message: "Network error. Please try again." });
    } finally {
      setDeletingId(null);
    }
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setEditingMedicine(null);
  };

  const handleModalSave = async (
    formData: Omit<Medicine, "_id" | "userId" | "createdAt" | "updatedAt" | "isActive">
  ) => {
    const isEdit = !!editingMedicine;
    const url = isEdit ? `/api/medicines/${editingMedicine._id}` : "/api/medicines";
    const method = isEdit ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      // Handle non-200 status codes
      if (!res.ok) {
        const contentType = res.headers.get("content-type");
        let errorMessage = "Failed to save medicine.";

        // Try to parse error response
        if (contentType?.includes("application/json")) {
          try {
            const errorData = await res.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch (parseErr) {
            console.error("Failed to parse error response:", parseErr);
          }
        } else {
          // Got HTML or other non-JSON response
          errorMessage = `Server error (${res.status}): ${res.statusText}`;
        }

        throw new Error(errorMessage);
      }

      // Parse successful response
      let data;
      try {
        data = await res.json();
      } catch (parseErr) {
        console.error("Failed to parse response JSON:", parseErr);
        throw new Error("Server returned invalid JSON response");
      }

      if (!data.success) {
        throw new Error(data.error || data.message || "Failed to save medicine.");
      }

      // Success: refresh all dependent components
      await fetchMedicines();
      handleModalClose();

      // Trigger adherence recalculation by invalidating the cache
      if (typeof window !== "undefined" && window.invalidateAdherence) {
        window.invalidateAdherence();
      }

      // Dispatch event to notify all components of schedule change
      window.dispatchEvent(new Event("medicineScheduleChanged"));

      // Also trigger dashboard refresh
      window.dispatchEvent(new Event("dashboardRefresh"));

      setToast({
        type: "success",
        message: isEdit ? "Medicine updated successfully" : "Medicine created successfully",
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save medicine. Please try again.";
      console.error("Medicine save error:", err);
      throw new Error(errorMessage);
    }
  };

  let medicineContent;
  if (loading) {
    medicineContent = (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="bg-card border border-border/80 rounded-[28px] p-6 shadow-sm shadow-slate-900/10 animate-pulse">
            <div className="flex gap-4">
              <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  } else if (medicines.length === 0) {
    medicineContent = (
      <div className="bg-card border border-border/80 rounded-[28px] p-12 text-center shadow-sm shadow-slate-900/10">
        <p className="text-gray-500 dark:text-gray-400 text-lg mb-4">No medicines added yet.</p>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 transition-colors font-medium mx-auto"
        >
          <Plus className="w-5 h-5" />
          Add Your First Medicine
        </button>
      </div>
    );
    } else {
    medicineContent = (
      <div className="space-y-4">
        {sortedMedicines.map((medicine) => (
          <MedicineCard
            key={medicine._id}
            name={medicine.name}
            dosage={medicine.dosage}
            frequency={medicine.frequency}
            scheduledTimes={medicine.scheduledTimes}
            notes={medicine.notes}
            startDate={medicine.startDate}
            endDate={medicine.endDate}
            onEdit={() => handleEdit(medicine)}
            onDelete={() => handleDelete(medicine._id!)}
            isDeleting={deletingId === medicine._id}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Medicines</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">Manage your medication schedule</p>
        </div>

        <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <button
            onClick={handleAdd}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            Add New Medicine
          </button>

          <div className="ml-0 sm:ml-auto w-full sm:w-auto flex items-center gap-2">
            <label htmlFor="sort" className="hidden sm:block text-sm text-gray-600 dark:text-gray-300">
              Sort:
            </label>
            <select
              id="sort"
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="w-full sm:w-auto px-3 py-2 bg-card border border-border/60 rounded-lg text-sm"
            >
              <option value="recent">Recently Added</option>
              <option value="oldest">Oldest Added</option>
              <option value="az">Alphabetical (A–Z)</option>
              <option value="za">Alphabetical (Z–A)</option>
            </select>
          </div>
        </div>

        {medicineContent}
      </div>

      <MedicineModal
        isOpen={modalOpen}
        onClose={handleModalClose}
        onSave={handleModalSave}
        initialData={editingMedicine}
      />

      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default Medicines;
