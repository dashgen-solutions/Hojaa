"use client";

import { useState, useRef, useEffect } from "react";
import {
  PaperAirplaneIcon,
  SparklesIcon,
  CheckIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import { MicrophoneIcon, StopIcon } from "@heroicons/react/24/outline";
import ChatMessage from "./ChatMessage";
import LoadingDots from "./LoadingDots";
import {
  startChat,
  sendMessage,
  confirmChat,
  transcribeAudio,
} from "@/lib/api";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

interface ChatInterfaceProps {
  sessionId: string;
  selectedNodeId?: string | null;
  contextMessage?: string;
  onClose?: () => void;
  readOnly?: boolean;
}

export default function ChatInterface({
  sessionId,
  selectedNodeId,
  contextMessage,
  onClose,
  readOnly = false,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
              setInputMessage(result.text);
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
      const timer = setTimeout(() => {
        processAudio();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [audioBlob, isRecording, isTranscribing]);

  useEffect(() => {
    const initChat = async () => {
      if (selectedNodeId && sessionId) {
        try {
          setIsLoading(true);
          setError(null);

          const response = await startChat(sessionId, selectedNodeId);

          setConversationId(response.conversation_id);

          setMessages([
            {
              id: "context-" + selectedNodeId,
              role: "system",
              content: `Now exploring: **${response.context}**`,
              timestamp: new Date(),
            },
            {
              id: "first-q-" + selectedNodeId,
              role: "assistant",
              content: response.first_question,
              timestamp: new Date(),
            },
          ]);

          setSuggestions(response.suggestions || []);
        } catch (err: any) {
          setError(err.response?.data?.error || "Failed to start chat");
          console.error("Error starting chat:", err);
        } finally {
          setIsLoading(false);
        }
      }
    };

    initChat();
  }, [selectedNodeId, sessionId]);

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isLoading || !conversationId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setSuggestions([]);
    setIsLoading(true);
    setError(null);

    try {
      const response = await sendMessage(conversationId, content.trim());

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.message,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setSuggestions(response.suggestions || []);

      if (response.is_complete) {
        const completeMessage: Message = {
          id: (Date.now() + 2).toString(),
          role: "system",
          content:
            "Conversation complete! You can now confirm to add these details to the tree.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, completeMessage]);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to send message");
      console.error("Error sending message:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmRequirements = async () => {
    if (!conversationId) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await confirmChat(conversationId);

      const successMessage: Message = {
        id: Date.now().toString(),
        role: "system",
        content: `${response.message} - ${response.new_children.length} new nodes added to the tree!`,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, successMessage]);

      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to confirm chat");
      console.error("Error confirming chat:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion);
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputMessage);
    }
  };

  if (!selectedNodeId) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <div className="text-center max-w-md px-6 animate-fade-in">
          <div className="w-16 h-16 bg-neutral-100 rounded-md flex items-center justify-center mx-auto mb-4">
            <SparklesIcon className="w-8 h-8 text-neutral-400" />
          </div>
          <h3 className="text-lg font-semibold text-neutral-900 mb-2">
            Select a feature to expand
          </h3>
          <p className="text-sm text-neutral-500">
            Click the + button on any feature node in the tree to start
            exploring it in detail through AI-powered conversation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* Chat Header */}
      <div className="flex-shrink-0 border-b border-neutral-200/60 p-4 bg-white relative z-10">
        <div className="bg-warning-50 border border-warning-200 rounded-md p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-warning-700 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-md bg-warning-100 flex items-center justify-center flex-shrink-0">
                <SparklesIcon className="w-4 h-4" />
              </div>
              <span className="text-sm font-semibold truncate">
                Feature Exploration Active
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {messages.length > 2 && !readOnly && (
                <button
                  onClick={handleConfirmRequirements}
                  disabled={isLoading}
                  className="btn bg-success-600 hover:bg-success-700 text-white text-xs py-2 px-3 disabled:opacity-50"
                >
                  <CheckIcon className="w-4 h-4" />
                  <span className="hidden md:inline">Confirm & Add</span>
                  <span className="md:hidden">Add</span>
                </button>
              )}
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-danger-50 text-neutral-500 hover:text-danger-600 rounded-md transition-all border border-transparent hover:border-danger-200"
                  title="Close chat"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-3 p-3 bg-danger-50 border border-danger-200 rounded-md text-danger-700 text-sm animate-fade-in">
            {error}
          </div>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4">
        <div className="py-4 md:py-6 space-y-4 md:space-y-6">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}

          {isLoading && (
            <div className="flex items-start gap-3 animate-fade-in">
              <div className="flex-none w-9 h-9 rounded-md bg-neutral-50 flex items-center justify-center">
                <span className="text-neutral-900 font-bold text-xs">M</span>
              </div>
              <div className="flex-1 max-w-[75%]">
                <div className="inline-block bg-neutral-100 px-4 py-3 rounded-md border border-neutral-200">
                  <LoadingDots />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Suggestions */}
      {!isLoading && suggestions.length > 0 && (
        <div className="flex-none bg-neutral-50 border-t border-neutral-200/60 px-4 py-3">
          <div className="text-xs font-medium text-neutral-500 mb-2">
            Quick suggestions:
          </div>
          <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(suggestion)}
                className="inline-flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-md bg-white hover:bg-neutral-100 border border-neutral-200 hover:border-neutral-200 transition-all duration-200"
              >
                <SparklesIcon className="w-3.5 h-3.5 text-primary-500" />
                <span className="text-neutral-700">{suggestion}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      {readOnly ? (
        <div className="flex-none bg-neutral-50 border-t border-neutral-200/60 px-4 py-3">
          <div className="flex items-center gap-2 text-neutral-400 text-sm justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            View-only mode — chat is disabled
          </div>
        </div>
      ) : (
      <div className="flex-none bg-white border-t border-neutral-200/60 px-4 py-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(inputMessage);
          }}
          className="w-full"
        >
          <div className="flex items-end gap-2 bg-neutral-50 rounded-md border border-neutral-200 p-3 focus-within:border-neutral-400 focus-within:ring-2 focus-within:ring-neutral-100 transition-all">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your answer here... (Enter to send)"
              disabled={isLoading || isTranscribing}
              className="flex-1 bg-transparent text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none resize-none min-h-[44px] max-h-[120px]"
              rows={2}
            />
            <button
              type="button"
              onClick={handleAudioRecord}
              disabled={isLoading || isProcessing || isTranscribing}
              className={`flex-shrink-0 w-10 h-10 rounded-md border-2 transition-all duration-200 flex items-center justify-center ${
                isRecording
                  ? "bg-danger-500 border-danger-600 text-white animate-pulse"
                  : "bg-white border-neutral-200 text-neutral-500 hover:border-neutral-200 hover:text-neutral-900"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
              title={isRecording ? "Stop recording" : "Start voice recording"}
            >
              {isRecording ? (
                <StopIcon className="w-5 h-5" />
              ) : (
                <MicrophoneIcon className="w-5 h-5" />
              )}
            </button>
            <button
              type="submit"
              disabled={!inputMessage.trim() || isLoading || isTranscribing}
              className="flex-shrink-0 w-10 h-10 bg-neutral-900 text-white rounded-md hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center shadow-sm hover:shadow"
              title="Send message"
            >
              <PaperAirplaneIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Recording/Transcribing Status */}
          {(isRecording || isProcessing || isTranscribing) && (
            <div className="flex items-center gap-2 mt-2 px-1">
              {isRecording && (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-danger-50 border border-danger-200 rounded-md text-danger-700 text-xs font-medium">
                  <span className="w-2 h-2 bg-danger-500 rounded-full animate-pulse"></span>
                  Recording... Speak now
                </span>
              )}
              {isProcessing && (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-md text-neutral-700 text-xs font-medium">
                  <div className="w-3 h-3 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin"></div>
                  Processing audio...
                </span>
              )}
              {isTranscribing && (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-md text-neutral-700 text-xs font-medium">
                  <div className="w-3 h-3 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin"></div>
                  Transcribing...
                </span>
              )}
            </div>
          )}

          {/* Audio Error */}
          {audioError && (
            <div className="mt-2 p-3 bg-danger-50 border border-danger-200 rounded-md">
              <p className="text-xs text-danger-700 font-medium mb-1">
                Recording Error
              </p>
              <p className="text-xs text-danger-600">{audioError}</p>
              <p className="text-xs text-danger-500 mt-1">
                Make sure you've allowed microphone access in your browser.
              </p>
            </div>
          )}

          {/* Hint Text */}
          <div className="flex items-center justify-between mt-2 px-1">
            <p className="text-xs text-neutral-400">
              Answer the AI's questions to build detailed requirements
            </p>
            {conversationId && (
              <p className="text-xs text-neutral-400">
                {messages.filter((m) => m.role === "user").length} responses
              </p>
            )}
          </div>
        </form>
      </div>
      )}
    </div>
  );
}
