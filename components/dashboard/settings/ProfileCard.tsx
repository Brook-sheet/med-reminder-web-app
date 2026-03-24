"use client";

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { User } from 'lucide-react';

const ProfileCard = () => {
  const [fullName, setFullName] = useState('');
  const [patientId, setPatientId] = useState('');
  const [email, setEmail] = useState('');

  const handleSave = () => {
    // TODO: Implement backend save logic
    console.log('Saving profile:', { fullName, patientId, email });
  };

  return (
    <Card className="w-full mx-auto shadow-lg">
      <CardHeader className="flex items-center space-x-2 pb-4">
        <User className="h-5 w-5 text-gray-600" />
        <CardTitle className="text-lg font-semibold">Profile Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
            Full Name
          </label>
          <Input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="name"
            className="bg-gray-50 border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label htmlFor="patientId" className="block text-sm font-medium text-gray-700 mb-1">
            Patient ID
          </label>
          <Input
            id="patientId"
            type="text"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            placeholder="Enter patient ID"
            className="bg-gray-50 border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email"
            className="bg-gray-50 border-gray-300 rounded-lg"
          />
        </div>
        <Button onClick={handleSave} className="w-full mt-6 rounded-lg">
          Save Changes
        </Button>
      </CardContent>
    </Card>
  );
};

export default ProfileCard;
