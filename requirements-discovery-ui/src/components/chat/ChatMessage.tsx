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
      <div className="flex justify-center animate-fade-in">
        <div className="px-4 py-2 bg-primary-50 text-primary-700 rounded-full text-xs font-medium border border-primary-100">
          {message.content}
        </div>
      </div>
    );
  }

  // User messages
  if (isUser) {
    return (
      <div className="flex flex-col items-end gap-2 animate-fade-in">
        <div className="px-4 py-3 bg-primary-600 text-white rounded-2xl rounded-tr-md w-fit max-w-[75%] text-sm shadow-soft-sm">
          {message.content}
        </div>
      </div>
    );
  }

  // Assistant messages
  return (
    <div className="flex items-start gap-3 animate-fade-in">
      <div className="flex-none w-9 h-9 rounded-xl bg-primary-100 flex items-center justify-center">
        <span className="text-primary-600 font-bold text-xs">M</span>
      </div>

      <div className="flex-1 max-w-[75%]">
        <div className="bg-neutral-50 border border-neutral-200 rounded-2xl rounded-tl-md px-4 py-3 text-sm">
          <p className="text-neutral-800 whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    </div>
  );
}
