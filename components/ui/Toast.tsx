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

  const bgColor =
    type === "success"
      ? "bg-green-500"
      : "bg-red-500";

  const icon =
    type === "success" ? (
      <CheckCircle className="w-5 h-5 text-white" />
    ) : (
      <AlertCircle className="w-5 h-5 text-white" />
    );

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 ${bgColor} text-white px-4 py-3 rounded-lg shadow-lg animate-in fade-in slide-in-from-right-10 duration-300`}
    >
      {icon}
      <span className="text-sm font-medium">{message}</span>
      <button
        onClick={onClose}
        className="ml-2 hover:opacity-80 transition-opacity"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default Toast;
