"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Plus } from "lucide-react";
import MedicineCard from "@/components/dashboard/medicines/MedicineCard";
import MedicineModal from "@/components/dashboard/medicines/MedicineModal";
import type { Medicine } from "@/lib/interfaces/data/Medicine";

const Medicines = () => {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
      } else {
        alert(data.error || "Failed to delete medicine.");
      }
    } catch {
      alert("Network error. Please try again.");
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

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    const data = await res.json();

    if (!data.success) throw new Error(data.error || "Failed to save medicine.");

    await fetchMedicines();
    handleModalClose();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Medicines</h1>
          <p className="text-gray-600 mt-2">Manage your medication schedule</p>
        </div>

        <div className="mb-6">
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            Add New Medicine
          </button>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white rounded-lg border p-6 animate-pulse">
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/3" />
                    <div className="h-3 bg-gray-200 rounded w-1/4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : medicines.length === 0 ? (
          <div className="bg-white rounded-lg border p-12 text-center">
            <p className="text-gray-500 text-lg mb-4">No medicines added yet.</p>
            <button
              onClick={handleAdd}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium mx-auto"
            >
              <Plus className="w-5 h-5" />
              Add Your First Medicine
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {medicines.map((medicine) => (
              <MedicineCard
                key={medicine._id}
                name={medicine.name}
                dosage={medicine.dosage}
                frequency={medicine.frequency}
                scheduledTimes={medicine.scheduledTimes}
                startDate={medicine.startDate}
                endDate={medicine.endDate}
                onEdit={() => handleEdit(medicine)}
                onDelete={() => handleDelete(medicine._id!)}
                isDeleting={deletingId === medicine._id}
              />
            ))}
          </div>
        )}
      </div>

      <MedicineModal
        isOpen={modalOpen}
        onClose={handleModalClose}
        onSave={handleModalSave}
        initialData={editingMedicine}
      />
    </div>
  );
};

export default Medicines;
