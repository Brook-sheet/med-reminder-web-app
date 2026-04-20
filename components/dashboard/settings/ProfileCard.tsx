"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";

const ProfileCard = () => {
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [patientId, setPatientId] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/profile");
      const data = await res.json();
      if (data.success) {
        setFirstName(data.data.firstName || "");
        setMiddleName(data.data.middleName || "");
        setLastName(data.data.lastName || "");
        setPatientId(data.data.patientId || "");
        setEmail(data.data.email || "");
      }
    } catch (err) {
      console.error("Failed to fetch profile:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, middleName, lastName, patientId, email }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: "Profile updated successfully!" });
      } else {
        setMessage({ type: "error", text: data.error || "Failed to update profile." });
      }
    } catch {
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  if (loading) {
    return (
      <Card className="w-full mx-auto shadow-lg animate-pulse">
        <CardHeader className="flex items-center space-x-2 pb-4">
          <div className="h-5 w-5 bg-gray-200 rounded" />
          <div className="h-5 w-40 bg-gray-200 rounded" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1">
              <div className="h-3 w-20 bg-gray-200 rounded" />
              <div className="h-9 bg-gray-100 rounded" />
            </div>
          ))}
          <div className="h-10 bg-gray-200 rounded mt-6" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full mx-auto shadow-lg">
      <CardHeader className="flex items-center space-x-2 pb-4">
        <User className="h-5 w-5 text-gray-600" />
        <CardTitle className="text-lg font-semibold">Profile Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {message && (
          <div
            className={`text-sm rounded-lg px-4 py-3 border ${
              message.type === "success"
                ? "bg-green-50 border-green-200 text-green-700"
                : "bg-red-50 border-red-200 text-red-700"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* First Name */}
        <div>
          <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
            First Name
          </label>
          <Input
            id="firstName"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Enter your first name"
            className="bg-gray-50 border-gray-300 rounded-lg"
            disabled={saving}
          />
        </div>

        {/* Middle Name */}
        <div>
          <label htmlFor="middleName" className="block text-sm font-medium text-gray-700 mb-1">
            Middle Name{" "}
            <span className="text-gray-400 text-xs font-normal">(optional)</span>
          </label>
          <Input
            id="middleName"
            type="text"
            value={middleName}
            onChange={(e) => setMiddleName(e.target.value)}
            placeholder="Enter your middle name"
            className="bg-gray-50 border-gray-300 rounded-lg"
            disabled={saving}
          />
        </div>

        {/* Last Name */}
        <div>
          <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
            Last Name
          </label>
          <Input
            id="lastName"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Enter your last name"
            className="bg-gray-50 border-gray-300 rounded-lg"
            disabled={saving}
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            className="bg-gray-50 border-gray-300 rounded-lg"
            disabled={saving}
          />
        </div>

        {/* Patient ID */}
        <div>
          <label htmlFor="patientId" className="block text-sm font-medium text-gray-700 mb-1">
            Patient ID{" "}
            <span className="text-gray-400 text-xs font-normal">(optional)</span>
          </label>
          <Input
            id="patientId"
            type="text"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            placeholder="Enter your patient ID"
            className="bg-gray-50 border-gray-300 rounded-lg"
            disabled={saving}
          />
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full mt-6 rounded-lg"
        >
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </CardContent>
    </Card>
  );
};

export default ProfileCard;

