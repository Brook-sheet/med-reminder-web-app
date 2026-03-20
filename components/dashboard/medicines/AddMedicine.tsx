'use client';

import React, { useState } from 'react';
import { X, Plus, Clock } from 'lucide-react';

interface AddMedicineProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (medicine: MedicineData) => void;
}

export interface MedicineData {
  name: string;
  dosage: string;
  frequency: string;
  scheduledTimes: string[];
}

interface FormErrors {
  name?: string;
  dosage?: string;
  scheduledTimes?: string;
}

const AddMedicine: React.FC<AddMedicineProps> = ({ isOpen, onClose, onSave }) => {
  const [formData, setFormData] = useState<MedicineData>({
    name: '',
    dosage: '',
    frequency: 'Once daily',
    scheduledTimes: [''],
  });

  const [errors, setErrors] = useState<FormErrors>({});

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for this field
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[name as keyof FormErrors];
      return newErrors;
    });
  };

  const handleTimeChange = (index: number, value: string) => {
    const newTimes = [...formData.scheduledTimes];
    newTimes[index] = value;
    setFormData((prev) => ({
      ...prev,
      scheduledTimes: newTimes,
    }));
  };

  const handleAddTime = () => {
    setFormData((prev) => ({
      ...prev,
      scheduledTimes: [...prev.scheduledTimes, ''],
    }));
  };

  const handleRemoveTime = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      scheduledTimes: prev.scheduledTimes.filter((_, i) => i !== index),
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Medicine name is required';
    }
    if (!formData.dosage.trim()) {
      newErrors.dosage = 'Dosage is required';
    }
    if (formData.scheduledTimes.some((time) => !time.trim())) {
      newErrors.scheduledTimes = 'All scheduled times must be filled';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (validateForm()) {
      onSave(formData);
      setFormData({
        name: '',
        dosage: '',
        frequency: 'Once daily',
        scheduledTimes: [''],
      });
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Add New Medicine</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Medicine Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-semibold text-gray-900 mb-2">
              Medicine Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="e.g., Aspirin"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
          </div>

          {/* Dosage */}
          <div>
            <label htmlFor="dosage" className="block text-sm font-semibold text-gray-900 mb-2">
              Dosage
            </label>
            <input
              type="text"
              id="dosage"
              name="dosage"
              value={formData.dosage}
              onChange={handleInputChange}
              placeholder="e.g., 100mg"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {errors.dosage && <p className="text-red-500 text-sm mt-1">{errors.dosage}</p>}
          </div>

          {/* Frequency */}
          <div>
            <label htmlFor="frequency" className="block text-sm font-semibold text-gray-900 mb-2">
              Frequency
            </label>
            <select
              id="frequency"
              name="frequency"
              value={formData.frequency}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="Once daily">Once daily</option>
              <option value="Twice daily">Twice daily</option>
              <option value="Three times daily">Three times daily</option>
              <option value="Four times daily">Four times daily</option>
              <option value="As needed">As needed</option>
              <option value="Every other day">Every other day</option>
              <option value="Weekly">Weekly</option>
            </select>
          </div>

          {/* Scheduled Times */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Scheduled Times
            </label>
            <div className="space-y-2">
              {formData.scheduledTimes.map((time, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => handleTimeChange(index, e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {formData.scheduledTimes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveTime(index)}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                      aria-label="Remove time"
                    >
                      <X className="w-4 h-4 text-red-600" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {errors.scheduledTimes && (
              <p className="text-red-500 text-sm mt-1">{errors.scheduledTimes}</p>
            )}
            <button
              type="button"
              onClick={handleAddTime}
              className="mt-3 flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Another Time
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Save Medicine
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddMedicine;
