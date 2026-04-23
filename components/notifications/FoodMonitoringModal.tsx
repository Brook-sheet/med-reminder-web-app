"use client";
// components/notifications/FoodMonitoringModal.tsx
import React, { useState } from 'react';
import { X, ChevronRight, CheckCircle } from 'lucide-react';
import { FOOD_QUESTIONS, getQuestionsForCondition } from '@/lib/foodMonitoring';
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
  const [result, setResult] = useState<{ riskLevel: string; normalizedScore: number } | null>(null);

  if (!isOpen) return null;
  if (questions.length === 0) return null;

  const currentQ = questions[currentIndex];
  const selectedAnswer = answers[currentQ.id];
  const isLast = currentIndex === questions.length - 1;

  const handleSelect = (value: string, score: number) => {
    setAnswers(prev => ({ ...prev, [currentQ.id]: { answer: value, score } }));
  };

  const handleNext = async () => {
    if (!selectedAnswer) return;
    if (!isLast) {
      setCurrentIndex(prev => prev + 1);
      return;
    }
    // Submit all answers
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
        };
        setResult(riskResult);
        setDone(true);
        onComplete(riskResult);
      }
    } catch (err) {
      console.error('Food monitoring submit failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const riskColor = result?.riskLevel === 'High'
    ? 'text-red-600 bg-red-50 border-red-200'
    : result?.riskLevel === 'Moderate'
    ? 'text-yellow-700 bg-yellow-50 border-yellow-200'
    : 'text-green-700 bg-green-50 border-green-200';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-t-2xl">
          <div>
            <h2 className="font-bold text-base">🥗 Food Intake Check</h2>
            <p className="text-xs opacity-80 mt-0.5">Help us assess your dietary habits</p>
          </div>
          <button onClick={onClose} className="hover:text-teal-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {done && result ? (
            // ── Result view ──
            <div className="text-center py-4">
              <CheckCircle className="w-14 h-14 text-teal-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">Thank you!</h3>
              <p className="text-gray-500 text-sm mb-4">Your food intake has been recorded.</p>
              <div className={`rounded-xl border p-4 mb-4 ${riskColor}`}>
                <p className="text-sm font-medium mb-1">Current Dietary Risk Level</p>
                <p className="text-2xl font-bold">{result.riskLevel} Risk</p>
                <p className="text-sm mt-1">Score: {result.normalizedScore}/100</p>
              </div>
              <p className="text-xs text-gray-400 mb-4">
                Based on WHO nutrition guidelines and your recent dietary behavior.
              </p>
              <button
                onClick={onClose}
                className="w-full py-2.5 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            // ── Question view ──
            <>
              {/* Progress */}
              <div className="flex items-center gap-2 mb-4">
                {questions.map((_, i) => (
                  <div
                    key={i}
                    className={`flex-1 h-1.5 rounded-full transition-colors ${
                      i < currentIndex
                        ? 'bg-teal-500'
                        : i === currentIndex
                        ? 'bg-teal-400'
                        : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-gray-400 mb-1">
                Question {currentIndex + 1} of {questions.length}
              </p>

              {/* Question */}
              <p className="text-sm font-semibold text-gray-800 mb-4 leading-relaxed">
                {currentQ.question}
              </p>

              {/* Options */}
              <div className="space-y-2 mb-6">
                {currentQ.options.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => handleSelect(opt.value, opt.score)}
                    className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm transition-all leading-snug ${
                      selectedAnswer?.answer === opt.value
                        ? 'border-teal-500 bg-teal-50 text-teal-800 font-medium'
                        : 'border-gray-200 text-gray-700 hover:border-teal-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-0.5 w-3.5 h-3.5 rounded-full border-2 shrink-0 ${
                          selectedAnswer?.answer === opt.value
                            ? 'border-teal-500 bg-teal-500'
                            : 'border-gray-400'
                        }`}
                      />
                      {opt.label}
                    </div>
                  </button>
                ))}
              </div>

              {/* Next / Submit */}
              <div className="flex justify-end">
                <button
                  onClick={handleNext}
                  disabled={!selectedAnswer || submitting}
                  className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Submitting...' : isLast ? 'Submit' : 'Next'}
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