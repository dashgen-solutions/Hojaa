"use client";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  // System messages (context indicators)
  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="px-4 py-2 bg-warning-100 text-warning-800 rounded-full text-xs font-medium border border-warning-200">
          {message.content}
        </div>
      </div>
    );
  }

  // User messages
  if (isUser) {
    return (
      <div className="flex flex-col items-end gap-2">
        <div className="px-4 py-3 bg-primary-600 text-white rounded-2xl w-fit max-w-[75%] text-sm">
          {message.content}
        </div>
      </div>
    );
  }

  // Assistant messages
  return (
    <div className="flex items-start gap-3">
      <div className="flex-none bg-secondary-100 rounded-full flex items-center justify-center w-10 h-10">
        <div className="w-6 h-6 bg-gradient-to-br from-primary-600 to-primary-400 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-xs">M</span>
        </div>
      </div>

      <div className="flex-1 max-w-[75%]">
        <div className="bg-secondary-50 border border-secondary-200 rounded-lg px-4 py-3 text-sm">
          <p className="text-secondary-900 whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    </div>
  );
}
