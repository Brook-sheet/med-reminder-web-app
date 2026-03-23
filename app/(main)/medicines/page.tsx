'use client';

import React from 'react';
import { Plus } from 'lucide-react';
import MedicineCard from '@/components/dashboard/medicines/MedicineCard';

const Medicines = () => {
  const medicines = [
    {
      id: 1,
      name: 'Aspirin',
      dosage: '100mg',
      frequency: 'Once daily',
      scheduledTimes: ['8:00 AM'],
    },
    {
      id: 2,
      name: 'Lisinopril',
      dosage: '10mg',
      frequency: 'Once daily',
      scheduledTimes: ['12:00 PM'],
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Medicines</h1>
            <p className="text-gray-600 mt-2">Manage your medication schedule</p>
          </div>
        </div>

        {/* Add Medicine Button */}
        <div className="mb-6">
          <button
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            Add New Medicine
          </button>
        </div>

        {/* Medicine Cards Grid */}
        <div className="space-y-4">
          {medicines.map((medicine) => (
            <MedicineCard
              key={medicine.id}
              name={medicine.name}
              dosage={medicine.dosage}
              frequency={medicine.frequency}
              scheduledTimes={medicine.scheduledTimes}
              onEdit={() => {}}
              onDelete={() => {}}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Medicines;
