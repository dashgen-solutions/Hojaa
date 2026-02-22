"use client";

import { useState, useEffect } from "react";
import { CheckCircleIcon, SparklesIcon } from "@heroicons/react/24/solid";
import {
  PencilIcon,
  TrashIcon,
  PlusIcon,
  XMarkIcon,
  MicrophoneIcon,
  StopIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import {
  getQuestions,
  submitAnswers,
  addQuestion,
  deleteQuestion,
  updateQuestion,
  transcribeAudio,
} from "@/lib/api";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";

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

export default function InitialQuestions({
  sessionId,
  onComplete,
}: InitialQuestionsProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState("");
  const [currentAnswerText, setCurrentAnswerText] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);

  const {
    isRecording,
    isProcessing,
    audioBlob,
    error: audioError,
    startRecording,
    stopRecording,
    clearRecording,
    getAudioFile,
  } = useAudioRecorder();

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
    if (!answer.trim()) return;

    const updatedQuestions = [...questions];
    updatedQuestions[currentIndex].answer_text = answer;
    updatedQuestions[currentIndex].is_answered = true;
    setQuestions(updatedQuestions);
    setCurrentAnswerText("");

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleAudioRecord = async () => {
    try {
      if (isRecording) {
        stopRecording();
      } else {
        clearRecording();
        await startRecording();
      }
    } catch (error) {
      setError("Failed to start/stop recording. Please try again.");
    }
  };

  useEffect(() => {
    const processAudio = async () => {
      if (!isRecording && !isTranscribing && audioBlob) {
        const audioFile = getAudioFile();
        if (audioFile) {
          try {
            setIsTranscribing(true);
            setError(null);
            const result = await transcribeAudio(audioFile);
            if (result.text) {
              setCurrentAnswerText(result.text);
              handleAnswer(result.text);
            } else {
              setError("No text was transcribed. Please try speaking again.");
            }
          } catch (err: any) {
            setError(
              err.response?.data?.detail ||
                err.message ||
                "Failed to transcribe audio"
            );
          } finally {
            setIsTranscribing(false);
            clearRecording();
          }
        }
      }
    };

    if (audioBlob && !isRecording) {
      processAudio();
    }
  }, [audioBlob, isRecording, isTranscribing]);

  const handleComplete = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      const answers = questions.map((q) => ({
        question_id: q.id,
        answer_text: q.answer_text || "",
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
  const progress = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

  if (isLoading) {
    return (
      <div className="max-w-2xl w-full animate-fade-in-up">
        <div className="card p-12 text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-neutral-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
            <SparklesIcon className="w-8 h-8 text-primary-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <h2 className="text-xl font-bold text-neutral-900 mb-2">
            Analyzing your document...
          </h2>
          <p className="text-neutral-500">
            Generating questions based on your requirements
          </p>
        </div>
      </div>
    );
  }

  if (error && questions.length === 0) {
    return (
      <div className="max-w-2xl w-full animate-fade-in-up">
        <div className="bg-danger-50 border border-danger-200 rounded-2xl p-12 text-center">
          <h2 className="text-xl font-bold text-danger-900 mb-2">
            Error Loading Questions
          </h2>
          <p className="text-danger-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl w-full animate-fade-in-up">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary-100 text-primary-700 rounded-full text-sm font-medium mb-4">
          <SparklesIcon className="w-4 h-4" />
          Step 2 of 3
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-neutral-900 mb-3">
          Let's refine your requirements
        </h1>
        <p className="text-neutral-500 text-base max-w-md mx-auto">
          Answer these questions to help us understand your project better
        </p>
      </div>

      {/* Progress Bar */}
      <div className="card p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-neutral-700">Progress</span>
          <span className="text-sm font-semibold text-primary-600">
            {answeredCount} of {questions.length} answered
          </span>
        </div>
        <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all duration-500 ease-smooth rounded-full"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-danger-50 border border-danger-200 rounded-xl text-danger-700 text-sm animate-fade-in">
          {error}
        </div>
      )}

      {/* Add Question Button */}
      {!isAddingQuestion && (
        <button
          onClick={() => setIsAddingQuestion(true)}
          className="w-full mb-4 py-3 px-4 border-2 border-dashed border-primary-200 rounded-xl text-primary-600 hover:bg-primary-50/50 hover:border-primary-300 transition-all duration-200 flex items-center justify-center gap-2 text-sm font-medium"
        >
          <PlusIcon className="w-5 h-5" />
          Add Custom Question
        </button>
      )}

      {/* Add Question Form */}
      {isAddingQuestion && (
        <div className="card p-4 mb-4 border-2 border-primary-200 animate-fade-in">
          <input
            type="text"
            value={newQuestionText}
            onChange={(e) => setNewQuestionText(e.target.value)}
            placeholder="Enter your custom question..."
            className="input mb-3"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={handleAddQuestion}
              disabled={!newQuestionText.trim()}
              className="btn-primary flex-1"
            >
              <CheckCircleIcon className="w-4 h-4" />
              Add Question
            </button>
            <button
              onClick={() => {
                setIsAddingQuestion(false);
                setNewQuestionText("");
              }}
              className="btn-secondary px-3"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Questions List */}
      <div className="space-y-3 mb-6 max-h-[calc(100vh-420px)] overflow-y-auto pr-1">
        {questions.map((q, idx) => (
          <div
            key={q.id}
            className={`card p-4 transition-all duration-300 ${
              idx === currentIndex && !q.is_answered
                ? "border-2 border-primary-400 shadow-soft-md bg-white"
                : q.is_answered
                ? "border border-success-200 bg-success-50/30"
                : "border border-neutral-200 bg-white hover:border-neutral-300"
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Status Indicator */}
              <div className="flex-shrink-0 mt-0.5">
                {q.is_answered ? (
                  <div className="w-7 h-7 rounded-full bg-success-100 flex items-center justify-center">
                    <CheckCircleIcon className="w-5 h-5 text-success-600" />
                  </div>
                ) : idx === currentIndex ? (
                  <div className="w-7 h-7 rounded-full bg-primary-100 border-2 border-primary-500 flex items-center justify-center">
                    <div className="w-2.5 h-2.5 bg-primary-500 rounded-full animate-pulse"></div>
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-full border-2 border-neutral-200 bg-neutral-50"></div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                {editingId === q.id ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="input"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveEdit(q.id)}
                        className="btn-primary text-sm py-2"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="btn-secondary text-sm py-2"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium text-neutral-900">
                        <span className="text-neutral-400 mr-1.5">
                          {idx + 1}.
                        </span>
                        {q.question_text}
                      </h3>
                      {!q.is_answered && (
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleEditQuestion(q)}
                            className="p-1.5 text-neutral-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
                            title="Edit question"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteQuestion(q.id)}
                            className="p-1.5 text-neutral-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-all"
                            title="Delete question"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {q.category === "custom" && (
                      <span className="badge-primary mt-2 inline-block">
                        Custom
                      </span>
                    )}
                  </>
                )}

                {/* Answer Input for Current Question */}
                {idx === currentIndex && !q.is_answered && editingId !== q.id && (
                  <div className="mt-4 animate-fade-in">
                    <div className="flex gap-2 mb-2">
                      <textarea
                        autoFocus
                        value={currentAnswerText}
                        onChange={(e) => setCurrentAnswerText(e.target.value)}
                        placeholder="Type your answer here..."
                        className="input min-h-[100px] resize-none flex-1"
                        onKeyDown={(e) => {
                          if (
                            e.key === "Enter" &&
                            e.ctrlKey &&
                            e.currentTarget.value.trim()
                          ) {
                            handleAnswer(e.currentTarget.value);
                          }
                        }}
                      />
                      <button
                        onClick={handleAudioRecord}
                        disabled={isProcessing || isTranscribing}
                        className={`flex-shrink-0 w-12 h-12 rounded-xl border-2 transition-all duration-200 flex items-center justify-center ${
                          isRecording
                            ? "bg-danger-500 border-danger-600 text-white shadow-soft animate-pulse"
                            : "bg-white border-neutral-200 text-neutral-500 hover:border-primary-300 hover:text-primary-600 hover:bg-primary-50"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                        title={
                          isRecording ? "Stop recording" : "Start voice recording"
                        }
                      >
                        {isRecording ? (
                          <StopIcon className="w-5 h-5" />
                        ) : (
                          <MicrophoneIcon className="w-5 h-5" />
                        )}
                      </button>
                    </div>

                    {/* Recording Status */}
                    {(isRecording || isProcessing || isTranscribing) && (
                      <div className="flex items-center gap-2 mb-2">
                        {isRecording && (
                          <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-danger-50 border border-danger-200 rounded-lg text-danger-700 text-xs font-medium">
                            <span className="w-2 h-2 bg-danger-500 rounded-full animate-pulse"></span>
                            Recording... Speak now
                          </span>
                        )}
                        {isProcessing && (
                          <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary-50 border border-primary-200 rounded-lg text-primary-700 text-xs font-medium">
                            <div className="w-3 h-3 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
                            Processing audio...
                          </span>
                        )}
                        {isTranscribing && (
                          <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary-50 border border-primary-200 rounded-lg text-primary-700 text-xs font-medium">
                            <div className="w-3 h-3 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
                            Transcribing...
                          </span>
                        )}
                      </div>
                    )}

                    {/* Audio Error */}
                    {audioError && (
                      <div className="mb-2 p-3 bg-danger-50 border border-danger-200 rounded-xl">
                        <p className="text-xs text-danger-700 font-medium mb-1">
                          Recording Error
                        </p>
                        <p className="text-xs text-danger-600">{audioError}</p>
                        <p className="text-xs text-danger-500 mt-1">
                          Make sure you've allowed microphone access in your
                          browser.
                        </p>
                      </div>
                    )}

                    <p className="text-xs text-neutral-400">
                      Press{" "}
                      <kbd className="px-1.5 py-0.5 bg-neutral-100 rounded text-neutral-600 font-mono text-[10px]">
                        Ctrl
                      </kbd>{" "}
                      +{" "}
                      <kbd className="px-1.5 py-0.5 bg-neutral-100 rounded text-neutral-600 font-mono text-[10px]">
                        Enter
                      </kbd>{" "}
                      to submit
                    </p>
                  </div>
                )}

                {/* Answered State */}
                {q.is_answered && (
                  <div className="mt-3 p-3 bg-white rounded-xl border border-neutral-100">
                    <p className="text-sm text-neutral-700">{q.answer_text}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Complete Button */}
      {answeredCount === questions.length && questions.length > 0 && (
        <div className="sticky bottom-0 pt-4 pb-2 bg-gradient-to-t from-neutral-50 via-neutral-50 to-transparent animate-fade-in">
          <button
            onClick={handleComplete}
            disabled={isSubmitting}
            className="w-full btn bg-gradient-to-r from-success-500 to-success-600 hover:from-success-600 hover:to-success-700 text-white py-4 text-base font-semibold shadow-soft-md hover:shadow-soft-lg transition-all duration-300"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Generating Requirements Tree...
              </>
            ) : (
              <>
                Generate Requirements Tree
                <ArrowRightIcon className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
