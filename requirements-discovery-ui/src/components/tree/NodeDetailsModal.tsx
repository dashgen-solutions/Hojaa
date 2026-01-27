"use client";

import { XMarkIcon, SparklesIcon, CubeIcon, DocumentCheckIcon } from "@heroicons/react/24/outline";

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

export default function NodeDetailsModal({ node, isOpen, onClose }: NodeDetailsModalProps) {
  if (!isOpen || !node) return null;

  const getNodeStyle = () => {
    switch (node.type) {
      case "root":
        return {
          gradient: "from-blue-500 via-indigo-500 to-purple-600",
          icon: CubeIcon,
          iconColor: "text-blue-600",
          iconBg: "bg-gradient-to-br from-blue-100 to-indigo-100",
          badge: "Project Root",
          badgeColor: "bg-blue-600 text-white",
          borderColor: "border-blue-500"
        };
      case "feature":
        return {
          gradient: "from-amber-500 via-orange-500 to-red-500",
          icon: SparklesIcon,
          iconColor: "text-amber-600",
          iconBg: "bg-gradient-to-br from-amber-100 to-orange-100",
          badge: "Feature",
          badgeColor: "bg-amber-600 text-white",
          borderColor: "border-amber-500"
        };
      case "detail":
        return {
          gradient: "from-emerald-500 via-teal-500 to-cyan-600",
          icon: DocumentCheckIcon,
          iconColor: "text-emerald-600",
          iconBg: "bg-gradient-to-br from-emerald-100 to-teal-100",
          badge: "Requirement",
          badgeColor: "bg-emerald-600 text-white",
          borderColor: "border-emerald-500"
        };
      default:
        return {
          gradient: "from-gray-500 to-gray-600",
          icon: DocumentCheckIcon,
          iconColor: "text-gray-600",
          iconBg: "bg-gradient-to-br from-gray-100 to-slate-100",
          badge: "Item",
          badgeColor: "bg-gray-600 text-white",
          borderColor: "border-gray-500"
        };
    }
  };

  const style = getNodeStyle();
  const Icon = style.icon;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-fade-in"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div 
          className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with gradient */}
          <div className={`h-2 bg-gradient-to-r ${style.gradient}`} />
          
          <div className="p-6">
            {/* Top Section */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-start gap-4 flex-1">
                {/* Icon */}
                <div className={`${style.iconBg} rounded-xl p-3 flex-shrink-0`}>
                  <Icon className={`w-8 h-8 ${style.iconColor}`} />
                </div>
                
                {/* Badge and Title */}
                <div className="flex-1 min-w-0">
                  <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full ${style.badgeColor} mb-3`}>
                    {style.badge}
                  </span>
                  <h2 className="text-2xl font-bold text-gray-900 leading-tight">
                    {node.question}
                  </h2>
                </div>
              </div>
              
              {/* Close button */}
              <button
                onClick={onClose}
                className="flex-shrink-0 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Close"
              >
                <XMarkIcon className="w-6 h-6 text-gray-600" />
              </button>
            </div>
            
            {/* Content */}
            <div className="space-y-4">
              {node.answer ? (
                <>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Description
                    </h3>
                    <div className="prose prose-sm max-w-none">
                      <p className="text-base text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {node.answer}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                    <DocumentCheckIcon className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 text-sm">No additional details available</p>
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="mt-6 pt-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-gradient-to-r from-gray-100 to-slate-100 hover:from-gray-200 hover:to-slate-200 text-gray-700 font-semibold rounded-xl transition-all duration-200 shadow-sm hover:shadow-md"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
