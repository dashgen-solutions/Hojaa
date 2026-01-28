"use client";

import {
  XMarkIcon,
  SparklesIcon,
  CubeIcon,
  DocumentCheckIcon,
} from "@heroicons/react/24/outline";

interface NodeDetailsModalProps {
  node: {
    id: string;
    question: string;
    answer?: string;
    type: "root" | "feature" | "detail";
  } | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function NodeDetailsModal({
  node,
  isOpen,
  onClose,
}: NodeDetailsModalProps) {
  if (!isOpen || !node) return null;

  const getNodeStyle = () => {
    switch (node.type) {
      case "root":
        return {
          gradient: "from-primary-500 to-primary-600",
          icon: CubeIcon,
          iconColor: "text-primary-600",
          iconBg: "bg-primary-100",
          badge: "Project Root",
          badgeColor: "bg-primary-600 text-white",
        };
      case "feature":
        return {
          gradient: "from-warning-500 to-warning-600",
          icon: SparklesIcon,
          iconColor: "text-warning-600",
          iconBg: "bg-warning-100",
          badge: "Feature",
          badgeColor: "bg-warning-600 text-white",
        };
      case "detail":
        return {
          gradient: "from-success-500 to-success-600",
          icon: DocumentCheckIcon,
          iconColor: "text-success-600",
          iconBg: "bg-success-100",
          badge: "Requirement",
          badgeColor: "bg-success-600 text-white",
        };
      default:
        return {
          gradient: "from-neutral-500 to-neutral-600",
          icon: DocumentCheckIcon,
          iconColor: "text-neutral-600",
          iconBg: "bg-neutral-100",
          badge: "Item",
          badgeColor: "bg-neutral-600 text-white",
        };
    }
  };

  const style = getNodeStyle();
  const Icon = style.icon;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm z-40 animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white rounded-2xl shadow-soft-xl max-w-2xl w-full max-h-[80vh] overflow-hidden animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header gradient */}
          <div className={`h-1.5 bg-gradient-to-r ${style.gradient}`} />

          <div className="p-6">
            {/* Top Section */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-start gap-4 flex-1">
                {/* Icon */}
                <div
                  className={`${style.iconBg} rounded-xl p-3 flex-shrink-0`}
                >
                  <Icon className={`w-7 h-7 ${style.iconColor}`} />
                </div>

                {/* Badge and Title */}
                <div className="flex-1 min-w-0">
                  <span
                    className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${style.badgeColor} mb-3`}
                  >
                    {style.badge}
                  </span>
                  <h2 className="text-xl font-bold text-neutral-900 leading-tight">
                    {node.question}
                  </h2>
                </div>
              </div>

              {/* Close button */}
              <button
                onClick={onClose}
                className="flex-shrink-0 p-2 hover:bg-neutral-100 rounded-xl transition-colors"
                aria-label="Close"
              >
                <XMarkIcon className="w-5 h-5 text-neutral-500" />
              </button>
            </div>

            {/* Content */}
            <div className="space-y-4">
              {node.answer ? (
                <div>
                  <h3 className="section-title mb-3">Description</h3>
                  <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-100">
                    <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">
                      {node.answer}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-neutral-100 mb-4">
                    <DocumentCheckIcon className="w-7 h-7 text-neutral-400" />
                  </div>
                  <p className="text-neutral-500 text-sm">
                    No additional details available
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-6 pt-6 border-t border-neutral-100 flex justify-end">
              <button onClick={onClose} className="btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
