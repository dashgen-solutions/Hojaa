"use client";

import { useState } from "react";
import { ChevronDownIcon, ChevronRightIcon, PencilIcon, TrashIcon, EllipsisVerticalIcon } from "@heroicons/react/24/outline";
import { 
  SparklesIcon, 
  CubeIcon, 
  DocumentCheckIcon,
  PlusIcon
} from "@heroicons/react/24/solid";
import { updateNode, deleteNode, addNode } from "@/lib/api";

interface TreeNodeData {
  id: string;
  question: string;
  answer?: string;
  type: "root" | "feature" | "detail";
  depth: number;
  children?: TreeNodeData[];
  isExpanded?: boolean;
  canExpand?: boolean;
}

interface TreeNodeProps {
  node: TreeNodeData;
  sessionId?: string;
  onToggle: () => void;
  onExpand?: () => void;
  onUpdate?: () => void;
}

export default function TreeNode({ node, sessionId, onToggle, onExpand, onUpdate }: TreeNodeProps) {
  const hasChildren = node.children && node.children.length > 0;
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editQuestion, setEditQuestion] = useState(node.question);
  const [editAnswer, setEditAnswer] = useState(node.answer || "");
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [newChildQuestion, setNewChildQuestion] = useState("");
  const [newChildAnswer, setNewChildAnswer] = useState("");

  const handleSaveEdit = async () => {
    if (!sessionId) return;
    try {
      await updateNode(node.id, {
        question: editQuestion,
        answer: editAnswer,
      });
      setIsEditing(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error("Error updating node:", error);
      alert("Failed to update node");
    }
  };

  const handleDeleteNode = async (cascade: boolean) => {
    if (!sessionId) return;
    const message = cascade
      ? "Delete this node and all its children?"
      : "Delete this node but keep its children?";
    if (!confirm(message)) return;

    try {
      await deleteNode(node.id, cascade);
      setShowMenu(false);
      if (onUpdate) onUpdate();
    } catch (error: any) {
      console.error("Error deleting node:", error);
      // Extract error message from API response
      const errorMessage = error?.response?.data?.detail || error?.message || "Failed to delete node";
      alert(errorMessage);
    }
  };

  const handleAddChild = async () => {
    if (!sessionId || !newChildQuestion.trim()) return;
    try {
      await addNode({
        session_id: sessionId,
        parent_id: node.id,
        question: newChildQuestion,
        answer: newChildAnswer || undefined,
      });
      setNewChildQuestion("");
      setNewChildAnswer("");
      setIsAddingChild(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error("Error adding child node:", error);
      alert("Failed to add child node");
    }
  };

  const getNodeStyle = () => {
    switch (node.type) {
      case "root":
        return {
          border: "border-blue-200",
          bg: "bg-gradient-to-br from-blue-50 to-indigo-50",
          icon: CubeIcon,
          iconColor: "text-blue-600",
          iconBg: "bg-blue-100",
          badge: "Project Root",
          badgeColor: "bg-blue-100 text-blue-700 border-blue-200"
        };
      case "feature":
        return {
          border: "border-amber-200",
          bg: "bg-gradient-to-br from-amber-50 to-orange-50",
          icon: SparklesIcon,
          iconColor: "text-amber-600",
          iconBg: "bg-amber-100",
          badge: "Feature",
          badgeColor: "bg-amber-100 text-amber-700 border-amber-200"
        };
      case "detail":
        return {
          border: "border-emerald-200",
          bg: "bg-gradient-to-br from-emerald-50 to-teal-50",
          icon: DocumentCheckIcon,
          iconColor: "text-emerald-600",
          iconBg: "bg-emerald-100",
          badge: "Requirement",
          badgeColor: "bg-emerald-100 text-emerald-700 border-emerald-200"
        };
      default:
        return {
          border: "border-gray-200",
          bg: "bg-white",
          icon: DocumentCheckIcon,
          iconColor: "text-gray-600",
          iconBg: "bg-gray-100",
          badge: "Item",
          badgeColor: "bg-gray-100 text-gray-700 border-gray-200"
        };
    }
  };

  const style = getNodeStyle();
  const Icon = style.icon;

  if (isEditing) {
    return (
      <div className="p-4 border-2 border-primary-500 rounded-lg bg-primary-50 space-y-3 mb-3">
        <div>
          <label className="text-xs font-medium text-secondary-700 mb-1 block">
            Node Title
          </label>
          <input
            type="text"
            value={editQuestion}
            onChange={(e) => setEditQuestion(e.target.value)}
            className="w-full px-3 py-2 border border-secondary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-secondary-700 mb-1 block">
            Description
          </label>
          <textarea
            value={editAnswer}
            onChange={(e) => setEditAnswer(e.target.value)}
            className="w-full px-3 py-2 border border-secondary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            rows={3}
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSaveEdit}
            className="flex-1 bg-success-600 hover:bg-success-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Save Changes
          </button>
          <button
            onClick={() => setIsEditing(false)}
            className="px-4 py-2 border border-secondary-300 rounded-lg text-secondary-700 hover:bg-secondary-50 text-sm font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (isAddingChild) {
    return (
      <div className="p-4 border-2 border-success-500 rounded-lg bg-success-50 space-y-3 mb-3">
        <div>
          <label className="text-xs font-medium text-secondary-700 mb-1 block">
            New Child Node Title
          </label>
          <input
            type="text"
            value={newChildQuestion}
            onChange={(e) => setNewChildQuestion(e.target.value)}
            placeholder="Enter node title..."
            className="w-full px-3 py-2 border border-secondary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-success-500"
            autoFocus
          />
        </div>
        <div>
          <label className="text-xs font-medium text-secondary-700 mb-1 block">
            Description (optional)
          </label>
          <textarea
            value={newChildAnswer}
            onChange={(e) => setNewChildAnswer(e.target.value)}
            placeholder="Enter description..."
            className="w-full px-3 py-2 border border-secondary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-success-500 resize-none"
            rows={2}
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleAddChild}
            disabled={!newChildQuestion.trim()}
            className="flex-1 bg-success-600 hover:bg-success-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
          >
            <PlusIcon className="w-4 h-4" />
            Add Child Node
          </button>
          <button
            onClick={() => {
              setIsAddingChild(false);
              setNewChildQuestion("");
              setNewChildAnswer("");
            }}
            className="px-4 py-2 border border-secondary-300 rounded-lg text-secondary-700 hover:bg-secondary-50 text-sm font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group">
      <div
        className={`
          relative border-2 ${style.border} ${style.bg} rounded-xl p-5
          shadow-sm hover:shadow-lg transition-all duration-200
          ${hasChildren || node.canExpand ? "cursor-pointer" : ""}
        `}
        onClick={hasChildren ? onToggle : undefined}
      >
        {/* Card Header */}
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className={`${style.iconBg} rounded-lg p-2.5 flex-shrink-0`}>
            <Icon className={`w-6 h-6 ${style.iconColor}`} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Title Row */}
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${style.badgeColor}`}>
                    {style.badge}
                  </span>
                  {hasChildren && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-secondary-100 text-secondary-600 border border-secondary-200">
                      {node.children!.length} {node.children!.length === 1 ? 'item' : 'items'}
                    </span>
                  )}
                </div>
                <h3 className="text-base font-semibold text-gray-900 leading-snug">
                  {node.question}
                </h3>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Node Management Menu */}
                {sessionId && node.type !== "root" && (
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(!showMenu);
                      }}
                      className="p-2 text-secondary-600 hover:text-primary-600 hover:bg-white/50 rounded-lg transition-colors"
                      title="Node actions"
                    >
                      <EllipsisVerticalIcon className="w-5 h-5" />
                    </button>

                    {showMenu && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-secondary-200 z-20">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsEditing(true);
                            setShowMenu(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-secondary-700 hover:bg-secondary-50 flex items-center gap-2 rounded-t-lg"
                        >
                          <PencilIcon className="w-4 h-4" />
                          Edit Node
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsAddingChild(true);
                            setShowMenu(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-secondary-700 hover:bg-secondary-50 flex items-center gap-2"
                        >
                          <PlusIcon className="w-4 h-4" />
                          Add Child
                        </button>
                        <hr className="my-1 border-secondary-200" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteNode(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-orange-600 hover:bg-orange-50 flex items-center gap-2"
                        >
                          <TrashIcon className="w-4 h-4" />
                          Delete (Keep Children)
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteNode(true);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 rounded-b-lg"
                        >
                          <TrashIcon className="w-4 h-4" />
                          Delete (With Children)
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Expand Button for Features */}
                {node.canExpand && !hasChildren && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onExpand) onExpand();
                    }}
                    className="group/btn relative p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all duration-200 hover:scale-105 shadow-sm hover:shadow-md"
                    title="Explore this feature"
                  >
                    <PlusIcon className="w-5 h-5" />
                    <span className="absolute -top-8 right-0 opacity-0 group-hover/btn:opacity-100 transition-opacity bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                      Explore feature
                    </span>
                  </button>
                )}

                {/* Collapse/Expand Icon */}
                {hasChildren && (
                  <button 
                    className="p-1.5 rounded-lg hover:bg-white/50 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggle();
                    }}
                  >
                    {node.isExpanded ? (
                      <ChevronDownIcon className="w-5 h-5 text-gray-700" />
                    ) : (
                      <ChevronRightIcon className="w-5 h-5 text-gray-700" />
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Answer/Description */}
            {node.answer && (
              <div className="mt-3 p-3 bg-white/80 backdrop-blur-sm rounded-lg border border-gray-200 shadow-sm">
                <p className="text-sm text-gray-700 leading-relaxed">
                  {node.answer}
                </p>
              </div>
            )}

            {/* Expandable Hint */}
            {node.canExpand && !hasChildren && (
              <div className="mt-3 flex items-center gap-2 text-xs text-amber-700">
                <SparklesIcon className="w-4 h-4" />
                <span className="font-medium">Click + to explore this feature in detail</span>
              </div>
            )}
          </div>
        </div>

        {/* Depth Indicator Line */}
        {node.depth > 0 && (
          <div 
            className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
            style={{
              background: node.type === 'root' ? '#3b82f6' : 
                         node.type === 'feature' ? '#f59e0b' : '#10b981'
            }}
          />
        )}
      </div>
    </div>
  );
}
