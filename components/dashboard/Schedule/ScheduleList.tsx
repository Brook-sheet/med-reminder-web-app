import React from 'react';
import ScheduleItem from './ScheduleItem';

const ScheduleList: React.FC = () => {
  // Sample data - replace with actual data from your backend
  const medications = [
    { name: 'Aspirin 100mg', time: '8:00 AM', status: 'Upcoming' as const },
    
  ];

  return (
    <div className="space-y-4">
      {medications.map((med, index) => (
        <ScheduleItem
          key={index}
          name={med.name}
          time={med.time}
          status={med.status}
        />
      ))}
    </div>
  );
};

export default ScheduleList;
