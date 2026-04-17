import React from 'react'
import UpcomingItem from './UpcomingItem'

const UpcomingList = () => {
  return (
    <div className="space-y-4">
      <UpcomingItem name="Medication A" time="10:00 AM" date="2023-10-15" status="Upcoming" />
    </div>
  )
}

export default UpcomingList
