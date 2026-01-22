"use client";

export default function LoadingDots() {
  return (
    <div className="flex items-center gap-1">
      <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
      <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
      <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
    </div>
  );
}
