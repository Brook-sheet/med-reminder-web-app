import React from 'react';
import { Edit2, Trash2, Clock } from 'lucide-react';

interface MedicineCardProps {
  name: string;
  dosage: string;
  frequency: string;
  scheduledTimes: string[];
  onEdit?: () => void;
  onDelete?: () => void;
}

const MedicineCard: React.FC<MedicineCardProps> = ({
  name,
  dosage,
  frequency,
  scheduledTimes,
  onEdit,
  onDelete,
}) => {
  // Generate a color based on the first letter
  const getAvatarColor = (letter: string) => {
    const colors: { [key: string]: string } = {
      A: 'bg-blue-500',
      B: 'bg-purple-500',
      C: 'bg-pink-500',
      D: 'bg-green-500',
      E: 'bg-orange-500',
      F: 'bg-red-500',
      G: 'bg-indigo-500',
      H: 'bg-teal-500',
      I: 'bg-cyan-500',
      J: 'bg-lime-500',
      K: 'bg-rose-500',
      L: 'bg-amber-500',
      M: 'bg-violet-500',
      N: 'bg-fuchsia-500',
      O: 'bg-emerald-500',
      P: 'bg-sky-500',
      Q: 'bg-blue-400',
      R: 'bg-purple-400',
      S: 'bg-pink-400',
      T: 'bg-green-400',
      U: 'bg-orange-400',
      V: 'bg-red-400',
      W: 'bg-indigo-400',
      X: 'bg-teal-400',
      Y: 'bg-cyan-400',
      Z: 'bg-lime-400',
    };
    return colors[letter.toUpperCase()] || 'bg-gray-400';
  };

  const firstLetter = name.charAt(0).toUpperCase();
  const avatarColor = getAvatarColor(firstLetter);

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        {/* Left Side - Avatar and Medicine Info */}
        <div className="flex items-start gap-4 flex-1">
          {/* Avatar */}
          <div
            className={`flex items-center justify-center w-12 h-12 rounded-lg ${avatarColor} text-white font-bold text-lg shrink-0`}
          >
            {firstLetter}
          </div>

          {/* Medicine Info */}
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900">{name}</h3>
            <p className="text-sm text-gray-500">{dosage}</p>
          </div>
        </div>

        {/* Right Side - Action Buttons */}
        <div className="flex gap-2 ml-4">
          <button
            onClick={onEdit}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Edit medicine"
          >
            <Edit2 className="w-5 h-5 text-gray-600 hover:text-gray-900" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Delete medicine"
          >
            <Trash2 className="w-5 h-5 text-gray-600 hover:text-red-600" />
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-gray-100 mb-4" />

      {/* Medicine Details */}
      <div className="space-y-4">
        {/* Frequency Section */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Frequency
          </p>
          <p className="text-sm text-gray-700">{frequency}</p>
        </div>

        {/* Scheduled Times Section */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Scheduled Times
          </p>
          <div className="flex flex-wrap gap-2">
            {scheduledTimes.map((time, index) => (
              <div
                key={index}
                className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium border border-blue-100"
              >
                <Clock className="w-4 h-4" />
                {time}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MedicineCard;
