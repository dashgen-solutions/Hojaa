"use client";

import { useState, useRef, useEffect } from "react";
import {
  PaperAirplaneIcon,
  SparklesIcon,
  CheckIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import ChatMessage from "./ChatMessage";
import LoadingDots from "./LoadingDots";
import { startChat, sendMessage, confirmChat } from "@/lib/api";

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
}

export default function ChatInterface({ sessionId, selectedNodeId, contextMessage, onClose }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Start chat when node is selected
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
              content: `🎯 Now exploring: **${response.context}**`,
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
      
      // Check if conversation is complete
      if (response.is_complete) {
        const completeMessage: Message = {
          id: (Date.now() + 2).toString(),
          role: "system",
          content: "✅ Conversation complete! You can now confirm to add these details to the tree.",
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
        content: `✅ ${response.message} - ${response.new_children.length} new nodes added to the tree!`,
        timestamp: new Date(),
      };
      
      setMessages((prev) => [...prev, successMessage]);
      
      // Refresh the page to show updated tree
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputMessage);
    }
  };

  if (!selectedNodeId) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 bg-secondary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <SparklesIcon className="w-8 h-8 text-secondary-400" />
          </div>
          <h3 className="text-lg font-semibold text-secondary-900 mb-2">
            Select a feature to expand
          </h3>
          <p className="text-sm text-secondary-600">
            Click the ➕ button on any feature node in the tree to start exploring it in detail through AI-powered conversation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* Chat Header - Fixed at top */}
      <div className="flex-shrink-0 border-b border-secondary-200 p-4 bg-white relative z-10">
        <div className="bg-warning-50 border border-warning-200 rounded-lg p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-warning-700 min-w-0 flex-1">
              <SparklesIcon className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-semibold truncate">
                Feature Exploration Active
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {messages.length > 2 && (
                <button
                  onClick={handleConfirmRequirements}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 bg-success-600 text-white px-3 py-2 rounded-lg text-xs font-medium hover:bg-success-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                >
                  <CheckIcon className="w-4 h-4 flex-shrink-0" />
                  <span className="hidden md:inline">Confirm & Add</span>
                  <span className="md:hidden">Add</span>
                </button>
              )}
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-red-50 text-gray-600 hover:text-red-600 rounded-lg transition-colors border border-transparent hover:border-red-200 flex-shrink-0"
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
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 scrollbar-thin">
        <div className="py-4 md:py-6 space-y-4 md:space-y-6">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}

          {isLoading && (
            <div className="flex items-start gap-3">
              <div className="flex-none bg-secondary-100 rounded-full flex items-center justify-center w-10 h-10">
                <div className="w-6 h-6 bg-gradient-to-br from-primary-600 to-primary-400 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-xs">M</span>
                </div>
              </div>
              <div className="flex-1 max-w-[75%]">
                <div className="inline-block bg-secondary-100 px-4 py-3 rounded-2xl border border-secondary-200">
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
        <div className="flex-none bg-secondary-50 border-t border-secondary-200 px-4 py-3">
          <div className="text-xs font-medium text-secondary-600 mb-2">
            Quick suggestions:
          </div>
          <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(suggestion)}
                className="flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-lg bg-white hover:bg-primary-50 border border-secondary-200 hover:border-primary-300 transition-all"
              >
                <SparklesIcon className="w-3.5 h-3.5 text-primary-500" />
                <span className="text-secondary-700">{suggestion}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="flex-none bg-white border-t border-secondary-200 px-4 py-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(inputMessage);
          }}
          className="w-full"
        >
          <div className="flex items-end gap-3 bg-secondary-50 rounded-xl border border-secondary-200 p-3 focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100 transition-all">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your answer here... (Press Enter to send, Shift+Enter for new line)"
              disabled={isLoading}
              className="flex-1 bg-transparent text-sm text-secondary-900 placeholder:text-secondary-400 focus:outline-none resize-none min-h-[44px] max-h-[120px]"
              rows={2}
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || isLoading}
              className="flex-shrink-0 bg-primary-600 text-white p-2.5 rounded-lg hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              title="Send message"
            >
              <PaperAirplaneIcon className="w-5 h-5" />
            </button>
          </div>
          
          {/* Hint Text */}
          <div className="flex items-center justify-between mt-2 px-1">
            <p className="text-xs text-secondary-500">
              Answer the AI's questions to build detailed requirements
            </p>
            {conversationId && (
              <p className="text-xs text-secondary-400">
                {messages.filter(m => m.role === 'user').length} responses given
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
