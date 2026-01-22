"use client";

import { useState, useEffect } from "react";
import { CheckCircleIcon, SparklesIcon } from "@heroicons/react/24/solid";
import { PencilIcon, TrashIcon, PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { getQuestions, submitAnswers, addQuestion, deleteQuestion, updateQuestion } from "@/lib/api";

interface InitialQuestionsProps {
  sessionId: string;
  onComplete: () => void;
}

interface Question {
  id: string;
  question_text: string;
  answer_text: string;
  is_answered: boolean;
  order_index?: number;
  category?: string;
}

export default function InitialQuestions({ sessionId, onComplete }: InitialQuestionsProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState("");

  const fetchQuestions = async () => {
    try {
      setIsLoading(true);
      const data = await getQuestions(sessionId);
      setQuestions(data.questions || []);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load questions");
      console.error("Error fetching questions:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, [sessionId]);

  const handleAnswer = (answer: string) => {
    const updatedQuestions = [...questions];
    updatedQuestions[currentIndex].answer_text = answer;
    updatedQuestions[currentIndex].is_answered = true;
    setQuestions(updatedQuestions);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleComplete = async () => {
    try {
      setIsSubmitting(true);
      setError(null);
      
      const answers = questions.map(q => ({
        question_id: q.id,
        answer_text: q.answer_text || ""
      }));
      
      await submitAnswers(sessionId, answers);
      onComplete();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to submit answers");
      console.error("Error submitting answers:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditQuestion = (question: Question) => {
    setEditingId(question.id);
    setEditText(question.question_text);
  };

  const handleSaveEdit = async (questionId: string) => {
    try {
      await updateQuestion(questionId, { question_text: editText });
      setEditingId(null);
      fetchQuestions();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to update question");
      console.error("Error updating question:", err);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm("Are you sure you want to delete this question?")) return;
    
    try {
      await deleteQuestion(questionId);
      fetchQuestions();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to delete question");
      console.error("Error deleting question:", err);
    }
  };

  const handleAddQuestion = async () => {
    if (!newQuestionText.trim()) return;
    
    try {
      await addQuestion(sessionId, newQuestionText, "custom");
      setNewQuestionText("");
      setIsAddingQuestion(false);
      fetchQuestions();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to add question");
      console.error("Error adding question:", err);
    }
  };

  const answeredCount = questions.filter((q) => q.is_answered).length;
  const progress = (answeredCount / questions.length) * 100;

  if (isLoading) {
    return (
      <div className="max-w-3xl w-full p-8 text-center">
        <div className="bg-white rounded-xl p-12 border border-secondary-200">
          <SparklesIcon className="w-16 h-16 mx-auto text-primary-600 mb-4 animate-pulse" />
          <h2 className="text-2xl font-bold text-secondary-900 mb-2">
            Analyzing your document...
          </h2>
          <p className="text-secondary-600">
            Generating 10 most relevant questions based on your requirements
          </p>
        </div>
      </div>
    );
  }

  if (error && questions.length === 0) {
    return (
      <div className="max-w-3xl w-full p-8 text-center">
        <div className="bg-red-50 rounded-xl p-12 border border-red-200">
          <h2 className="text-2xl font-bold text-red-900 mb-2">
            Error Loading Questions
          </h2>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl w-full px-4 md:px-8">
      {/* Progress Header */}
      <div className="mb-6 sticky top-0 bg-secondary-50 pb-4 z-10">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold text-secondary-900">
            Initial Discovery Questions
          </h2>
          <span className="text-sm font-medium text-secondary-600">
            {answeredCount} / {questions.length}
          </span>
        </div>
        <div className="w-full h-2 bg-secondary-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-600 transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Add Question Button */}
      {!isAddingQuestion && (
        <button
          onClick={() => setIsAddingQuestion(true)}
          className="w-full mb-4 py-3 px-4 border-2 border-dashed border-primary-300 rounded-lg text-primary-600 hover:bg-primary-50 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
        >
          <PlusIcon className="w-5 h-5" />
          Add Custom Question
        </button>
      )}

      {/* Add Question Form */}
      {isAddingQuestion && (
        <div className="mb-4 p-4 border-2 border-primary-500 rounded-lg bg-primary-50">
          <input
            type="text"
            value={newQuestionText}
            onChange={(e) => setNewQuestionText(e.target.value)}
            placeholder="Enter your custom question..."
            className="w-full px-3 py-2 border border-secondary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-3"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={handleAddQuestion}
              disabled={!newQuestionText.trim()}
              className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
            >
              <CheckCircleIcon className="w-4 h-4" />
              Add Question
            </button>
            <button
              onClick={() => {
                setIsAddingQuestion(false);
                setNewQuestionText("");
              }}
              className="px-4 py-2 border border-secondary-300 rounded-lg text-secondary-700 hover:bg-secondary-50 text-sm font-medium"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Questions List */}
      <div className="space-y-3 mb-6 max-h-[calc(100vh-300px)] overflow-y-auto pr-2">
        {questions.map((q, idx) => (
          <div
            key={q.id}
            className={`border rounded-lg p-4 transition-all ${
              idx === currentIndex
                ? "border-primary-500 bg-primary-50 shadow-md"
                : q.isAnswered
                ? "border-success-300 bg-success-50"
                : "border-secondary-200 bg-white"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-1">
                {q.is_answered ? (
                  <CheckCircleIcon className="w-6 h-6 text-success-600" />
                ) : idx === currentIndex ? (
                  <div className="w-6 h-6 rounded-full border-2 border-primary-600 flex items-center justify-center">
                    <div className="w-3 h-3 bg-primary-600 rounded-full"></div>
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full border-2 border-secondary-300"></div>
                )}
              </div>

              <div className="flex-1">
                {editingId === q.id ? (
                  // Edit Mode
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full px-3 py-2 border border-secondary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveEdit(q.id)}
                        className="flex-1 bg-success-600 hover:bg-success-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 border border-secondary-300 rounded-lg text-secondary-700 hover:bg-secondary-50 text-xs font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium text-secondary-900 mb-2">
                        {idx + 1}. {q.question_text}
                      </h3>
                      {/* Edit/Delete buttons */}
                      {!q.is_answered && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEditQuestion(q)}
                            className="p-1.5 text-secondary-600 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                            title="Edit question"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteQuestion(q.id)}
                            className="p-1.5 text-secondary-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete question"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                    {q.category === "custom" && (
                      <span className="inline-block mb-2 px-2 py-0.5 bg-primary-100 text-primary-700 text-xs font-medium rounded">
                        Custom
                      </span>
                    )}
                  </>
                )}

                {idx === currentIndex && !q.is_answered && editingId !== q.id && (
                  <div className="mt-3">
                    <textarea
                      autoFocus
                      placeholder="Type your answer here..."
                      className="w-full px-4 py-3 border border-secondary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                      rows={3}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && e.ctrlKey && e.currentTarget.value.trim()) {
                          handleAnswer(e.currentTarget.value);
                          e.currentTarget.value = "";
                        }
                      }}
                      onBlur={(e) => {
                        if (e.target.value.trim()) {
                          handleAnswer(e.target.value);
                        }
                      }}
                    />
                    <p className="text-xs text-secondary-500 mt-1">
                      Press Ctrl+Enter or click outside to submit
                    </p>
                  </div>
                )}

                {q.is_answered && (
                  <div className="mt-2 p-3 bg-white rounded-lg border border-secondary-200">
                    <p className="text-sm text-secondary-700">{q.answer_text}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Complete Button */}
      {answeredCount === questions.length && (
        <div className="text-center animate-fade-in sticky bottom-0 bg-secondary-50 pt-4 pb-2">
          <button
            onClick={handleComplete}
            disabled={isSubmitting}
            className="bg-success-600 hover:bg-success-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3 rounded-lg font-semibold text-base md:text-lg transition-colors shadow-lg flex items-center gap-2 mx-auto"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Generating Tree...
              </>
            ) : (
              "Generate Requirements Tree →"
            )}
          </button>
        </div>
      )}
    </div>
  );
}
