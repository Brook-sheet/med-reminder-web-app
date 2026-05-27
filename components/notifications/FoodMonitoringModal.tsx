"use client";
// components/notifications/FoodMonitoringModal.tsx
import React, { useState } from 'react';
import { X, ChevronRight, CheckCircle, Brain, Shield } from 'lucide-react';
import { getQuestionsForCondition } from '@/lib/foodMonitoring';
import type { FoodQuestion } from '@/lib/foodMonitoring';

interface FoodMonitoringModalProps {
  isOpen: boolean;
  onClose: () => void;
  condition: string;
  medicationLogId?: string;
  onComplete: (riskResult: { riskLevel: string; normalizedScore: number }) => void;
}

const FoodMonitoringModal: React.FC<FoodMonitoringModalProps> = ({
  isOpen,
  onClose,
  condition,
  medicationLogId,
  onComplete,
}) => {
  const questions: FoodQuestion[] = getQuestionsForCondition(condition);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { answer: string; score: number }>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [result, setResult] = useState<{
    riskLevel: string;
    normalizedScore: number;
    mlRiskLevel?: string;
    mlConfidence?: number;
    finalRiskLevel?: string;
  } | null>(null);

  if (!isOpen) return null;
  if (questions.length === 0) return null;

  const currentQ = questions[currentIndex];
  const selectedAnswer = answers[currentQ.id];
  const isLast = currentIndex === questions.length - 1;
  const progress = ((currentIndex + (selectedAnswer ? 1 : 0)) / questions.length) * 100;

  const conditionLabel = condition === 'Both'
    ? 'Diabetes & Hypertension'
    : condition;

  const handleSelect = (value: string, score: number) => {
    setAnswers(prev => ({ ...prev, [currentQ.id]: { answer: value, score } }));
  };

  const handleNext = async () => {
    if (!selectedAnswer) return;
    if (!isLast) {
      setCurrentIndex(prev => prev + 1);
      return;
    }

    setSubmitting(true);
    try {
      const responses = Object.entries(answers).map(([questionId, { answer, score }]) => ({
        questionId,
        answer,
        score,
      }));

      const res = await fetch('/api/food-monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses, medicationLogId }),
      });
      const data = await res.json();
      if (data.success) {
        const riskResult = {
          riskLevel: data.data.riskLevel,
          normalizedScore: data.data.normalizedScore,
          mlRiskLevel: data.data.mlRiskLevel,
          mlConfidence: data.data.mlConfidence,
          finalRiskLevel: data.data.finalRiskLevel,
        };
        setResult(riskResult);
        setDone(true);
        onComplete({
          riskLevel: data.data.finalRiskLevel || data.data.riskLevel,
          normalizedScore: data.data.normalizedScore,
        });
      }
    } catch (err) {
      console.error('Food monitoring submit failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
  };

  const displayRisk = result?.finalRiskLevel || result?.riskLevel || 'Low';

  const riskConfig = {
    Low: {
      color: 'text-green-700 dark:text-green-300',
      bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700',
      label: 'Low Risk',
      message: 'Your dietary habits are well-aligned with guidelines for your condition. Keep maintaining these healthy choices.',
    },
    Moderate: {
      color: 'text-yellow-700 dark:text-yellow-300',
      bg: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700',
      label: 'Moderate Risk',
      message: 'Some dietary improvements can help better manage your condition. Consider the food guidance provided with your reminders.',
    },
    High: {
      color: 'text-red-700 dark:text-red-300',
      bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700',
      label: 'High Risk',
      message: 'Your recent dietary pattern may be affecting your condition management. Please consult your healthcare provider about dietary adjustments.',
    },
  };

  const cfg = riskConfig[displayRisk as keyof typeof riskConfig] || riskConfig.Low;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-t-2xl">
          <div>
            <h2 className="font-bold text-base">Food Intake Assessment</h2>
            <p className="text-xs opacity-80 mt-0.5">{conditionLabel} — Dietary Risk Check</p>
          </div>
          <button onClick={onClose} className="hover:text-teal-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {done && result ? (
            // ── Results View ──
            <div className="space-y-4">
              <div className="text-center py-2">
                <CheckCircle className="w-12 h-12 text-teal-500 mx-auto mb-2" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Assessment Complete</h3>
                <p className="text-gray-500 dark:text-gray-300 text-sm mt-1">
                  Your dietary response has been recorded and analyzed.
                </p>
              </div>

              {/* Final Risk */}
              <div className={`rounded-xl border p-4 ${cfg.bg}`}>
                <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${cfg.color}`}>
                  Overall Dietary Risk
                </p>
                <p className={`text-2xl font-bold ${cfg.color}`}>{cfg.label}</p>
                <p className="text-xs mt-1 text-gray-600 dark:text-gray-400">
                  Dietary Score: {result.normalizedScore}/100
                </p>
                <p className={`text-xs mt-2 leading-relaxed ${cfg.color}`}>
                  {cfg.message}
                </p>
              </div>

              {/* ML Analysis */}
              {result.mlRiskLevel && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border/50 bg-gray-50 dark:bg-gray-800/50 p-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Shield className="w-3.5 h-3.5 text-blue-500" />
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                        Rule-Based
                      </span>
                    </div>
                    <p className={`text-sm font-bold ${
                      result.riskLevel === 'Low' ? 'text-green-600 dark:text-green-400' :
                      result.riskLevel === 'Moderate' ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-red-600 dark:text-red-400'
                    }`}>
                      {result.riskLevel} Risk
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      WHO guideline basis
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/50 bg-gray-50 dark:bg-gray-800/50 p-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Brain className="w-3.5 h-3.5 text-purple-500" />
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                        ML Model
                      </span>
                    </div>
                    <p className={`text-sm font-bold ${
                      result.mlRiskLevel === 'Low' ? 'text-green-600 dark:text-green-400' :
                      result.mlRiskLevel === 'Moderate' ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-red-600 dark:text-red-400'
                    }`}>
                      {result.mlRiskLevel} Risk
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {result.mlConfidence}% confidence
                    </p>
                  </div>
                </div>
              )}

              <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                Analysis based on evidence-based nutritional guidelines and behavioral pattern detection.
              </p>

              <button
                onClick={onClose}
                className="w-full py-2.5 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            // ── Question View ──
            <>
              {/* Progress */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    Question {currentIndex + 1} of {questions.length}
                  </span>
                  <span className="text-xs font-semibold text-teal-600 dark:text-teal-400">
                    {currentQ.category}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 rounded-full bg-teal-500 transition-all duration-300"
                    style={{ width: `${Math.max(((currentIndex) / questions.length) * 100, 5)}%` }}
                  />
                </div>
                {/* Step dots */}
                <div className="flex gap-1 mt-2">
                  {questions.map((_, i) => (
                    <div
                      key={i}
                      className={`flex-1 h-1 rounded-full transition-colors ${
                        i < currentIndex ? 'bg-teal-500' :
                        i === currentIndex ? 'bg-teal-400' :
                        'bg-gray-200 dark:bg-gray-700'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Weight indicator */}
              {currentQ.weight === 3 && (
                <div className="mb-3 flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                  <span className="text-xs text-orange-700 dark:text-orange-300 font-medium">
                    ⚠ High clinical significance for {conditionLabel}
                  </span>
                </div>
              )}

              {/* Question */}
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4 leading-relaxed">
                {currentQ.question}
              </p>

              {/* Options */}
              <div className="space-y-2 mb-5">
                {currentQ.options.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => handleSelect(opt.value, opt.score)}
                    className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm transition-all leading-snug ${
                      selectedAnswer?.answer === opt.value
                        ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/10 text-teal-800 dark:text-teal-200 font-medium'
                        : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:border-teal-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                          selectedAnswer?.answer === opt.value
                            ? 'border-teal-500 bg-teal-500'
                            : 'border-gray-400 dark:border-gray-500'
                        }`}
                      >
                        {selectedAnswer?.answer === opt.value && (
                          <span className="w-1.5 h-1.5 bg-white rounded-full" />
                        )}
                      </span>
                      <span>{opt.label}</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Navigation */}
              <div className="flex gap-2">
                {currentIndex > 0 && (
                  <button
                    onClick={handleBack}
                    className="px-4 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    Back
                  </button>
                )}
                <button
                  onClick={handleNext}
                  disabled={!selectedAnswer || submitting}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Analyzing...' : isLast ? 'Submit & Analyze' : 'Next'}
                  {!isLast && !submitting && <ChevronRight className="w-4 h-4" />}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FoodMonitoringModal;