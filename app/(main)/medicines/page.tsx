"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { AlertTriangle, Plus } from "lucide-react";
import MedicineCard from "@/components/dashboard/medicines/MedicineCard";
import MedicineModal from "@/components/dashboard/medicines/MedicineModal";
import Toast from "@/components/ui/Toast";
import { invalidateAdherence } from "@/hooks/useAdherence";
import type { Medicine } from "@/lib/interfaces/data/Medicine";
import type { ToastProps } from "@/components/ui/Toast";

interface DeleteMedicineDialogProps {
  medicineName: string;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const DeleteMedicineDialog = ({
  medicineName,
  deleting,
  onCancel,
  onConfirm,
}: DeleteMedicineDialogProps) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !deleting) onCancel();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleting, onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <button
        type="button"
        aria-label="Cancel medicine deletion"
        onClick={onCancel}
        disabled={deleting}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-medicine-title"
        aria-describedby="delete-medicine-description"
        className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-150 dark:bg-gray-800"
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>

          <h3
            id="delete-medicine-title"
            className="text-lg font-bold text-gray-900 dark:text-white"
          >
            Delete Medicine?
          </h3>
        </div>

        <p
          id="delete-medicine-description"
          className="mb-6 text-sm leading-relaxed text-gray-600 dark:text-gray-300"
        >
          Are you sure you want to permanently delete{" "}
          <strong className="font-semibold text-gray-900 dark:text-white">
            {medicineName}
          </strong>
          ? This action cannot be undone.
        </p>

        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 rounded-xl border-2 border-gray-300 py-2.5 font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 rounded-xl bg-red-600 py-2.5 font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-red-700 dark:hover:bg-red-800"
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
};

const Medicines = () => {
  type SortOption = "recent" | "oldest" | "az" | "za";

  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [sortOption, setSortOption] = useState<SortOption>("recent");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] =
    useState<Medicine | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [medicineToDelete, setMedicineToDelete] =
    useState<Medicine | null>(null);
  const [toast, setToast] =
    useState<Omit<ToastProps, "onClose"> | null>(null);

  const deleteRequestInFlight = useRef(false);

  const fetchMedicines = useCallback(async () => {
    try {
      const res = await fetch("/api/medicines");
      const data = await res.json();

      if (data.success) {
        setMedicines(data.data);
      }
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

    const getTime = (medicine: Medicine) => {
      const medicineWithCreatedAt = medicine as unknown as {
        createdAt?: string | Date;
      };

      if (medicineWithCreatedAt.createdAt) {
        return new Date(medicineWithCreatedAt.createdAt).getTime();
      }

      try {
        const hex = String(medicine._id).slice(0, 8);
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
        return copy.sort((a, b) =>
          (a.name || "").localeCompare(b.name || "")
        );

      case "za":
        return copy.sort((a, b) =>
          (b.name || "").localeCompare(a.name || "")
        );

      default:
        return copy;
    }
  }, [medicines, sortOption]);

  const handleEdit = (medicine: Medicine) => {
    setEditingMedicine(medicine);
    setModalOpen(true);
  };

  const handleDelete = async () => {
    if (!medicineToDelete?._id || deleteRequestInFlight.current) {
      return;
    }

    const id = medicineToDelete._id;

    deleteRequestInFlight.current = true;
    setDeletingId(id);

    try {
      const res = await fetch(`/api/medicines/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (data.success) {
        setMedicines((previousMedicines) =>
          previousMedicines.filter((medicine) => medicine._id !== id)
        );

        setMedicineToDelete(null);

        setToast({
          type: "success",
          message: "Medicine deleted successfully.",
        });

        window.dispatchEvent(new Event("medicineScheduleChanged"));
      } else {
        setToast({
          type: "error",
          message: data.error || "Failed to delete medicine.",
        });
      }
    } catch {
      setToast({
        type: "error",
        message: "Network error. Please try again.",
      });
    } finally {
      deleteRequestInFlight.current = false;
      setDeletingId(null);
    }
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setEditingMedicine(null);
  };

  const handleModalSave = async (
    formData: Omit<
      Medicine,
      "_id" | "userId" | "createdAt" | "updatedAt" | "isActive"
    >
  ) => {
    const isEdit = Boolean(editingMedicine);
    const url = isEdit
      ? `/api/medicines/${editingMedicine?._id}`
      : "/api/medicines";
    const method = isEdit ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const contentType = res.headers.get("content-type");
        let errorMessage = "Failed to save medicine.";

        if (contentType?.includes("application/json")) {
          try {
            const errorData = await res.json();

            errorMessage =
              errorData.error || errorData.message || errorMessage;
          } catch (parseError) {
            console.error(
              "Failed to parse error response:",
              parseError
            );
          }
        } else {
          errorMessage = `Server error (${res.status}): ${res.statusText}`;
        }

        throw new Error(errorMessage);
      }

      let data;

      try {
        data = await res.json();
      } catch (parseError) {
        console.error("Failed to parse response JSON:", parseError);
        throw new Error("Server returned invalid JSON response");
      }

      if (!data.success) {
        throw new Error(
          data.error || data.message || "Failed to save medicine."
        );
      }

      await fetchMedicines();
      handleModalClose();

      invalidateAdherence();

      window.dispatchEvent(new Event("medicineScheduleChanged"));
      window.dispatchEvent(new Event("dashboardRefresh"));

      setToast({
        type: "success",
        message: isEdit
          ? "Medicine updated successfully"
          : "Medicine created successfully",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to save medicine. Please try again.";

      console.error("Medicine save error:", error);
      throw new Error(errorMessage);
    }
  };

  let medicineContent;

  if (loading) {
    medicineContent = (
      <div className="space-y-4">
        {[1, 2].map((item) => (
          <div
            key={item}
            className="rounded-[28px] border border-border/80 bg-card p-6 shadow-sm shadow-slate-900/10 animate-pulse"
          >
            <div className="flex gap-4">
              <div className="h-12 w-12 rounded-lg bg-gray-200 dark:bg-gray-700" />

              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/3 rounded bg-gray-200 dark:bg-gray-700" />
                <div className="h-3 w-1/4 rounded bg-gray-200 dark:bg-gray-700" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  } else if (medicines.length === 0) {
    medicineContent = (
      <div className="rounded-[28px] border border-border/80 bg-card p-12 text-center shadow-sm shadow-slate-900/10">
        <p className="mb-4 text-lg text-gray-500 dark:text-gray-400">
          No medicines added yet.
        </p>

        <button
          type="button"
          onClick={handleAdd}
          className="mx-auto flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800"
        >
          <Plus className="h-5 w-5" />
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
            chamberId={medicine.chamberId}
            notes={medicine.notes}
            startDate={medicine.startDate}
            endDate={medicine.endDate}
            onEdit={() => handleEdit(medicine)}
            onDelete={() => setMedicineToDelete(medicine)}
            isDeleting={deletingId === medicine._id}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            My Medicines
          </h1>

          <p className="mt-2 text-gray-600 dark:text-gray-300">
            Manage your medication schedule
          </p>
        </div>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={handleAdd}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 sm:w-auto dark:bg-blue-700 dark:hover:bg-blue-800"
          >
            <Plus className="h-5 w-5" />
            Add New Medicine
          </button>

          <div className="ml-0 flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
            <label
              htmlFor="sort"
              className="hidden text-sm text-gray-600 sm:block dark:text-gray-300"
            >
              Sort:
            </label>

            <select
              id="sort"
              value={sortOption}
              onChange={(event) =>
                setSortOption(event.target.value as SortOption)
              }
              className="w-full rounded-lg border border-border/60 bg-card px-3 py-2 text-sm sm:w-auto"
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

      {medicineToDelete && (
        <DeleteMedicineDialog
          medicineName={medicineToDelete.name}
          deleting={deletingId === medicineToDelete._id}
          onCancel={() => {
            if (!deletingId) {
              setMedicineToDelete(null);
            }
          }}
          onConfirm={handleDelete}
        />
      )}

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