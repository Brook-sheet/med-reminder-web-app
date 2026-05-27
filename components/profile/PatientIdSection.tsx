'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Copy, Check, Users, Plus, Trash2, Eye,
  ChevronDown, ChevronUp, AlertCircle, Loader2, Shield,
} from 'lucide-react';

interface MonitoredPatient {
  patientId: string;
  name: string;
  condition: string;
}

export default function PatientIdSection() {
  const router = useRouter();

  // Own patient ID
  const [myPatientId, setMyPatientId] = useState<string>('');
  const [myName, setMyName] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [loadingId, setLoadingId] = useState(true);

  // Monitor panel
  const [showMonitorPanel, setShowMonitorPanel] = useState(false);
  const [inputId, setInputId] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [linkSuccess, setLinkSuccess] = useState('');

  // Monitored patients list
  const [monitoredPatients, setMonitoredPatients] = useState<MonitoredPatient[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Fetch my patient ID
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/patient/my-id');
        const json = await res.json();
        if (json.success) {
          setMyPatientId(json.data.patientId);
          setMyName(json.data.name);
        }
      } catch {}
      finally { setLoadingId(false); }
    })();
  }, []);

  // Fetch monitored patients list
  const fetchMonitored = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch('/api/patient/monitor');
      const json = await res.json();
      if (json.success) setMonitoredPatients(json.data);
    } catch {}
    finally { setLoadingList(false); }
  }, []);

  useEffect(() => {
    if (showMonitorPanel) fetchMonitored();
  }, [showMonitorPanel, fetchMonitored]);

  // Copy patient ID
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(myPatientId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  // Link a patient
  const handleLink = async () => {
    if (!inputId.trim()) return;
    setLinking(true);
    setLinkError('');
    setLinkSuccess('');
    try {
      const res = await fetch('/api/patient/monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: inputId.trim() }),
      });
      const json = await res.json();
      if (!json.success) {
        setLinkError(json.error || 'Failed to link patient');
      } else {
        setLinkSuccess(`Successfully linked to ${json.data.name}`);
        setInputId('');
        fetchMonitored();
      }
    } catch {
      setLinkError('Network error. Please try again.');
    } finally {
      setLinking(false);
    }
  };

  // Remove a monitored patient
  const handleRemove = async (patientId: string) => {
    setRemovingId(patientId);
    try {
      const res = await fetch(
        `/api/patient/monitor?patientId=${encodeURIComponent(patientId)}`,
        { method: 'DELETE' }
      );
      const json = await res.json();
      if (json.success) {
        setMonitoredPatients((prev) => prev.filter((p) => p.patientId !== patientId));
      }
    } catch {}
    finally { setRemovingId(null); }
  };

  // Open monitor dashboard
  const handleViewDashboard = (patientId: string) => {
    router.push(`/monitor/${patientId}`);
  };

  return (
    <div className="space-y-4">

      {/* ── My Patient ID ── */}
      <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-500" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            Your Patient ID
          </h3>
        </div>

        {loadingId ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading your Patient ID...
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-gray-50 dark:bg-gray-800 border border-border/50 rounded-xl px-4 py-3">
                <p className="text-lg font-mono font-bold tracking-widest text-gray-900 dark:text-white">
                  {myPatientId}
                </p>
              </div>
              <button
                onClick={handleCopy}
                className={`flex items-center gap-1.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                  copied
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700'
                    : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40'
                }`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Share this ID with a caregiver, family member, or healthcare provider to allow
              them to monitor your medication adherence and health analytics in read-only mode.
              They will not be able to edit or modify any of your data.
            </p>
          </>
        )}
      </div>

      {/* ── Monitor a Patient ── */}
      <div className="rounded-2xl border border-border/70 bg-card shadow-sm overflow-hidden">
        {/* Toggle Header */}
        <button
          onClick={() => setShowMonitorPanel(!showMonitorPanel)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-500" />
            <span className="text-base font-semibold text-gray-900 dark:text-white">
              Monitor a Patient
            </span>
            {monitoredPatients.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-semibold border border-indigo-200 dark:border-indigo-800">
                {monitoredPatients.length}
              </span>
            )}
          </div>
          {showMonitorPanel
            ? <ChevronUp className="w-5 h-5 text-gray-400" />
            : <ChevronDown className="w-5 h-5 text-gray-400" />
          }
        </button>

        {showMonitorPanel && (
          <div className="px-5 pb-5 space-y-4 border-t border-border/50">

            {/* Link Input */}
            <div className="pt-4 space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Enter a patient ID to connect to their dashboard in read-only monitoring mode.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputId}
                  onChange={(e) => {
                    setInputId(e.target.value.toUpperCase());
                    setLinkError('');
                    setLinkSuccess('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleLink()}
                  placeholder="e.g. PT-8X4K2Q"
                  maxLength={9}
                  className="flex-1 bg-gray-50 dark:bg-gray-800 border border-border/50 rounded-xl px-4 py-2.5 text-sm font-mono tracking-wider text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
                <button
                  onClick={handleLink}
                  disabled={linking || !inputId.trim()}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
                >
                  {linking ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  {linking ? 'Linking...' : 'Connect'}
                </button>
              </div>

              {/* Feedback messages */}
              {linkError && (
                <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {linkError}
                </div>
              )}
              {linkSuccess && (
                <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  {linkSuccess}
                </div>
              )}
            </div>

            {/* Monitored Patients List */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Connected Patients
              </p>

              {loadingList ? (
                <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading...
                </div>
              ) : monitoredPatients.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 py-2">
                  No patients connected yet.
                </p>
              ) : (
                monitoredPatients.map((patient) => (
                  <div
                    key={patient.patientId}
                    className="flex items-center justify-between px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-border/40"
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {patient.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {patient.patientId} · {patient.condition}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewDashboard(patient.patientId)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-semibold border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View
                      </button>
                      <button
                        onClick={() => handleRemove(patient.patientId)}
                        disabled={removingId === patient.patientId}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-xs font-semibold border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50"
                      >
                        {removingId === patient.patientId
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />
                        }
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}