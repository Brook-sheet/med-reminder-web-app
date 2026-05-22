"use client";

import React, { useEffect } from "react";
import { CheckCircle, AlertCircle, X } from "lucide-react";

export interface ToastProps {
  type: "success" | "error";
  message: string;
  duration?: number;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({
  type,
  message,
  duration = 4000,
  onClose,
}) => {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  // Mobbin / Radix style: dark background with bright icons
  const bgColor = type === "success" ? "bg-gray-900" : "bg-red-600";
  const iconColor = type === "success" ? "text-green-400" : "text-white";

  const icon =
    type === "success" ? (
      <CheckCircle className={`w-5 h-5 ${iconColor}`} />
    ) : (
      <AlertCircle className={`w-5 h-5 ${iconColor}`} />
    );

  return (
    <div
      className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 ${bgColor} text-white px-5 py-3 rounded-full shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-300`}
    >
      {icon}
      <span className="text-sm font-medium">{message}</span>
      <button
        onClick={onClose}
        className="ml-2 text-gray-400 hover:text-white transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default Toast;
