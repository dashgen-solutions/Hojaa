"use client";

import { useState } from "react";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon,
  CubeIcon,
  SparklesIcon,
  DocumentCheckIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  ClockIcon,
  ArrowPathIcon,
  StarIcon,
  DocumentDuplicateIcon,
} from "@heroicons/react/24/outline";
import { updateNode, deleteNode, addNode, updateNodeStatus } from "@/lib/api";

interface TreeNodeData {
  id: string;
  question: string;
  answer?: string;
  type: "root" | "feature" | "detail";
  depth: number;
  children?: TreeNodeData[];
  isExpanded?: boolean;
  canExpand?: boolean;
  status?: string;
  deferred_reason?: string;
  completed_at?: string;
  source_name?: string;
  source_type?: string;
}

interface RelationshipTreeNodeProps {
  node: TreeNodeData;
  sessionId?: string;
  onToggle: (nodeId: string) => void;
  onExpand?: (nodeId: string) => void;
  onNodeClick?: (node: TreeNodeData) => void;
  onUpdate?: () => void;
  isRoot?: boolean;
  selectedNodeId?: string | null;
  readOnly?: boolean;
}

export default function RelationshipTreeNode({
  node,
  sessionId,
  onToggle,
  onExpand,
  onNodeClick,
  onUpdate,
  isRoot = false,
  selectedNodeId,
  readOnly = false,
}: RelationshipTreeNodeProps) {
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedNodeId === node.id;
  const hasAnswer = node.answer && node.answer.trim().length > 0;

  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editQuestion, setEditQuestion] = useState(node.question);
  const [editAnswer, setEditAnswer] = useState(node.answer || "");
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [newChildQuestion, setNewChildQuestion] = useState("");
  const [newChildAnswer, setNewChildAnswer] = useState("");
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [deferredReason, setDeferredReason] = useState("");
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);

  const getNodeStyle = () => {
    switch (node.type) {
      case "root":
        return {
          gradient: "from-primary-500 to-primary-600",
          border: "border-primary-300",
          bg: "bg-primary-50/50",
          hoverBg: "hover:bg-primary-50",
          icon: CubeIcon,
          iconColor: "text-primary-600",
          iconBg: "bg-primary-100",
          badge: "Project",
          badgeColor: "bg-primary-600 text-white",
          accentColor: "#8b5cf6",
        };
      case "feature":
        return {
          gradient: "from-warning-500 to-warning-600",
          border: "border-warning-300",
          bg: "bg-warning-50/50",
          hoverBg: "hover:bg-warning-50",
          icon: SparklesIcon,
          iconColor: "text-warning-600",
          iconBg: "bg-warning-100",
          badge: "Feature",
          badgeColor: "bg-warning-600 text-white",
          accentColor: "#f59e0b",
        };
      case "detail":
        return {
          gradient: "from-success-500 to-success-600",
          border: "border-success-300",
          bg: "bg-success-50/50",
          hoverBg: "hover:bg-success-50",
          icon: DocumentCheckIcon,
          iconColor: "text-success-600",
          iconBg: "bg-success-100",
          badge: "Requirement",
          badgeColor: "bg-success-600 text-white",
          accentColor: "#10b981",
        };
      default:
        return {
          gradient: "from-neutral-500 to-neutral-600",
          border: "border-neutral-300",
          bg: "bg-neutral-50/50",
          hoverBg: "hover:bg-neutral-50",
          icon: DocumentCheckIcon,
          iconColor: "text-neutral-600",
          iconBg: "bg-neutral-100",
          badge: "Item",
          badgeColor: "bg-neutral-600 text-white",
          accentColor: "#6b7280",
        };
    }
  };

  const getStatusIndicator = () => {
    switch (node.status) {
      case "new":
        return {
          ringClass: "ring-2 ring-green-400 ring-offset-1",
          opacityClass: "",
          badgeLabel: "New",
          badgeBg: "bg-green-100 text-green-700 border-green-200",
          BadgeIcon: StarIcon,
          dotColor: "bg-green-500",
        };
      case "modified":
        return {
          ringClass: "ring-2 ring-blue-400 ring-offset-1",
          opacityClass: "",
          badgeLabel: "Modified",
          badgeBg: "bg-blue-100 text-blue-700 border-blue-200",
          BadgeIcon: ArrowPathIcon,
          dotColor: "bg-blue-500",
        };
      case "deferred":
        return {
          ringClass: "ring-1 ring-neutral-300",
          opacityClass: "opacity-60",
          badgeLabel: "Deferred",
          badgeBg: "bg-neutral-200 text-neutral-600 border-neutral-300",
          BadgeIcon: ClockIcon,
          dotColor: "bg-neutral-400",
        };
      case "completed":
        return {
          ringClass: "ring-2 ring-emerald-400 ring-offset-1",
          opacityClass: "",
          badgeLabel: "Completed",
          badgeBg: "bg-emerald-100 text-emerald-700 border-emerald-200",
          BadgeIcon: CheckCircleIcon,
          dotColor: "bg-emerald-500",
        };
      default:
        return null;
    }
  };

  const style = getNodeStyle();
  const Icon = style.icon;
  const statusIndicator = getStatusIndicator();

  const [showTooltip, setShowTooltip] = useState(false);

  const handleNodeClick = () => {
    if (onNodeClick && hasAnswer) {
      onNodeClick(node);
    }
  };

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
      const errorMessage =
        error?.response?.data?.detail ||
        error?.message ||
        "Failed to delete node";
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

  const handleStatusChange = async (newStatus: string, reason?: string) => {
    try {
      await updateNodeStatus(node.id, newStatus, reason);
      setShowStatusDropdown(false);
      setPendingStatus(null);
      setDeferredReason("");
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error("Error changing node status:", error);
      alert("Failed to change status");
    }
  };

  const STATUS_OPTIONS = [
    { value: "active", label: "Active", bg: "bg-primary-50 text-primary-700 hover:bg-primary-100" },
    { value: "new", label: "New", bg: "bg-green-50 text-green-700 hover:bg-green-100" },
    { value: "modified", label: "Modified", bg: "bg-blue-50 text-blue-700 hover:bg-blue-100" },
    { value: "deferred", label: "Deferred", bg: "bg-neutral-100 text-neutral-600 hover:bg-neutral-200" },
    { value: "completed", label: "Completed", bg: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" },
  ];

  // Render edit form
  if (isEditing) {
    return (
      <div className="card p-4 border-2 border-primary-400 shadow-soft-md space-y-3 min-w-[280px] max-w-[380px] mb-4 animate-fade-in">
        <div>
          <label className="text-xs font-medium text-neutral-700 mb-1.5 block">
            Node Title
          </label>
          <input
            type="text"
            value={editQuestion}
            onChange={(e) => setEditQuestion(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-neutral-700 mb-1.5 block">
            Description
          </label>
          <textarea
            value={editAnswer}
            onChange={(e) => setEditAnswer(e.target.value)}
            className="input resize-none"
            rows={3}
          />
        </div>
        <div className="flex gap-2">
          <button onClick={handleSaveEdit} className="btn-primary flex-1 py-2">
            Save
          </button>
          <button
            onClick={() => setIsEditing(false)}
            className="btn-secondary py-2"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Render add child form
  if (isAddingChild) {
    return (
      <div className="card p-4 border-2 border-success-400 shadow-soft-md space-y-3 min-w-[280px] max-w-[380px] mb-4 animate-fade-in">
        <div>
          <label className="text-xs font-medium text-neutral-700 mb-1.5 block">
            New Child Node Title
          </label>
          <input
            type="text"
            value={newChildQuestion}
            onChange={(e) => setNewChildQuestion(e.target.value)}
            placeholder="Enter node title..."
            className="input"
            autoFocus
          />
        </div>
        <div>
          <label className="text-xs font-medium text-neutral-700 mb-1.5 block">
            Description (optional)
          </label>
          <textarea
            value={newChildAnswer}
            onChange={(e) => setNewChildAnswer(e.target.value)}
            placeholder="Enter description..."
            className="input resize-none"
            rows={2}
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleAddChild}
            disabled={!newChildQuestion.trim()}
            className="btn bg-success-600 hover:bg-success-700 disabled:opacity-50 text-white flex-1 py-2"
          >
            <PlusIcon className="w-4 h-4" />
            Add Child
          </button>
          <button
            onClick={() => {
              setIsAddingChild(false);
              setNewChildQuestion("");
              setNewChildAnswer("");
            }}
            className="btn-secondary py-2 px-3"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      {/* Connection line to this node from parent */}
      {!isRoot && (
        <div
          className="relative w-full flex justify-center"
          style={{ height: "50px", marginBottom: "10px" }}
        >
          <div
            className="w-0.5 bg-neutral-300 absolute left-1/2 -translate-x-1/2"
            style={{ height: "50px", top: "0px" }}
          />
          <div
            className="absolute left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-neutral-400 border-2 border-white shadow-sm z-10"
            style={{ top: "0px" }}
          />
        </div>
      )}

      {/* Node Card */}
      <div className="relative group z-20">
        {/* Glow effect on hover */}
        {!isSelected && (
          <div
            className="absolute -inset-1 opacity-0 group-hover:opacity-20 blur-lg transition-opacity duration-500 rounded-2xl"
            style={{
              background: `linear-gradient(135deg, ${style.accentColor}40, ${style.accentColor}20)`,
            }}
          />
        )}

        {/* Selected glow effect */}
        {isSelected && (
          <div className="absolute -inset-2 bg-gradient-to-r from-primary-400 to-primary-500 opacity-30 blur-xl animate-pulse rounded-2xl" />
        )}

        <div
          className={`
            relative bg-white border-2 ${
              isSelected
                ? "border-primary-500 shadow-soft-lg"
                : style.border + " shadow-soft"
            }
            rounded-2xl ${style.hoverBg} hover:shadow-soft-md
            transform hover:-translate-y-0.5 transition-all duration-300 ease-smooth
            ${isRoot ? "min-w-[320px]" : "min-w-[280px]"} max-w-[380px]
            overflow-visible ${hasAnswer ? "cursor-pointer" : ""}
            ${statusIndicator?.ringClass ?? ""}
            ${statusIndicator?.opacityClass ?? ""}
          `}
          onClick={handleNodeClick}
          onMouseEnter={() => statusIndicator && setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          {/* Top gradient bar */}
          <div
            className={`h-1 bg-gradient-to-r ${style.gradient} rounded-t-xl`}
          />

          {/* Selected badge */}
          {isSelected && (
            <div className="absolute -top-2.5 -right-2.5 z-10">
              <div className="relative">
                <div className="absolute inset-0 bg-primary-500 blur-md animate-pulse" />
                <div className="relative bg-gradient-to-br from-primary-500 to-primary-600 text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-soft-sm flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                  <span>Active</span>
                </div>
              </div>
            </div>
          )}

          {/* Card Content */}
          <div className="p-4">
            <div className="flex items-center gap-3">
              {/* Icon */}
              <div
                className={`${style.iconBg} rounded-xl p-2 flex-shrink-0 transform group-hover:scale-105 transition-all duration-300`}
              >
                <Icon className={`w-5 h-5 ${style.iconColor}`} />
              </div>

              {/* Title and badges */}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-neutral-900 leading-tight truncate">
                  {node.question}
                </h3>

                {/* Inline badges */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {node.type === "root" && (
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${style.badgeColor}`}
                    >
                      {style.badge}
                    </span>
                  )}

                  {hasChildren && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200 flex items-center gap-1">
                      <CheckCircleIcon className="w-3 h-3" />
                      {node.children!.length}
                    </span>
                  )}

                  {hasAnswer && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 border border-primary-100 flex items-center gap-1">
                      <InformationCircleIcon className="w-3 h-3" />
                      Details
                    </span>
                  )}

                  {/* Source badge — shows which source added this node */}
                  {node.source_name && (
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200 flex items-center gap-1"
                      title={`Added from: ${node.source_name} (${node.source_type || 'source'})`}
                    >
                      <DocumentDuplicateIcon className="w-3 h-3" />
                      {node.source_name.length > 18 ? node.source_name.substring(0, 16) + '…' : node.source_name}
                    </span>
                  )}

                  {/* Status badge — clickable to change status */}
                  {statusIndicator && sessionId && !isRoot ? (
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowStatusDropdown(!showStatusDropdown);
                        }}
                        className={`text-xs font-medium px-2 py-0.5 rounded-full border flex items-center gap-1 cursor-pointer transition-colors ${statusIndicator.badgeBg}`}
                        title="Change status"
                      >
                        <statusIndicator.BadgeIcon className="w-3 h-3" />
                        {statusIndicator.badgeLabel}
                      </button>

                      {showStatusDropdown && (
                        <div
                          className="absolute left-0 top-full mt-1 w-44 bg-white rounded-xl shadow-soft-lg border border-neutral-200 z-50 overflow-hidden animate-fade-in"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {pendingStatus === "deferred" ? (
                            <div className="p-3 space-y-2">
                              <p className="text-xs font-medium text-neutral-700">Reason for deferring:</p>
                              <input
                                type="text"
                                placeholder="Optional reason…"
                                value={deferredReason}
                                onChange={(e) => setDeferredReason(e.target.value)}
                                className="w-full text-xs px-2 py-1.5 border border-neutral-200 rounded-lg"
                                autoFocus
                              />
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => handleStatusChange("deferred", deferredReason || undefined)}
                                  className="flex-1 text-xs px-2 py-1 bg-neutral-600 text-white rounded-lg hover:bg-neutral-700"
                                >
                                  Defer
                                </button>
                                <button
                                  onClick={() => { setPendingStatus(null); setDeferredReason(""); }}
                                  className="text-xs px-2 py-1 text-neutral-500 hover:text-neutral-700"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            STATUS_OPTIONS
                              .filter((opt) => opt.value !== node.status)
                              .map((opt) => (
                                <button
                                  key={opt.value}
                                  onClick={() => {
                                    if (opt.value === "deferred") {
                                      setPendingStatus("deferred");
                                    } else {
                                      handleStatusChange(opt.value);
                                    }
                                  }}
                                  className={`w-full px-3 py-2 text-left text-xs font-medium transition-colors ${opt.bg}`}
                                >
                                  {opt.label}
                                </button>
                              ))
                          )}
                        </div>
                      )}
                    </div>
                  ) : statusIndicator ? (
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full border flex items-center gap-1 ${statusIndicator.badgeBg}`}
                    >
                      <statusIndicator.BadgeIcon className="w-3 h-3" />
                      {statusIndicator.badgeLabel}
                    </span>
                  ) : null}

                  {/* Standalone status dropdown for nodes with no visible badge (e.g. active) */}
                  {!statusIndicator && showStatusDropdown && sessionId && !isRoot && (
                    <div className="relative">
                      <div
                        className="absolute left-0 top-0 mt-1 w-44 bg-white rounded-xl shadow-soft-lg border border-neutral-200 z-50 overflow-hidden animate-fade-in"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {pendingStatus === "deferred" ? (
                          <div className="p-3 space-y-2">
                            <p className="text-xs font-medium text-neutral-700">Reason for deferring:</p>
                            <input
                              type="text"
                              placeholder="Optional reason…"
                              value={deferredReason}
                              onChange={(e) => setDeferredReason(e.target.value)}
                              className="w-full text-xs px-2 py-1.5 border border-neutral-200 rounded-lg"
                              autoFocus
                            />
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => handleStatusChange("deferred", deferredReason || undefined)}
                                className="flex-1 text-xs px-2 py-1 bg-neutral-600 text-white rounded-lg hover:bg-neutral-700"
                              >
                                Defer
                              </button>
                              <button
                                onClick={() => { setPendingStatus(null); setDeferredReason(""); }}
                                className="text-xs px-2 py-1 text-neutral-500 hover:text-neutral-700"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          STATUS_OPTIONS
                            .filter((opt) => opt.value !== (node.status || "active"))
                            .map((opt) => (
                              <button
                                key={opt.value}
                                onClick={() => {
                                  if (opt.value === "deferred") {
                                    setPendingStatus("deferred");
                                  } else {
                                    handleStatusChange(opt.value);
                                  }
                                }}
                                className={`w-full px-3 py-2 text-left text-xs font-medium transition-colors ${opt.bg}`}
                              >
                                {opt.label}
                              </button>
                            ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col gap-1.5 flex-shrink-0">
                {/* Node Management Menu */}
                {sessionId && !isRoot && !readOnly && (
                  <div className="relative z-50">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(!showMenu);
                      }}
                      className="p-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-500 transition-all duration-200"
                      title="Node actions"
                    >
                      <EllipsisVerticalIcon className="w-4 h-4" />
                    </button>

                    {showMenu && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-soft-lg border border-neutral-200 z-50 overflow-hidden animate-fade-in">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsEditing(true);
                            setShowMenu(false);
                          }}
                          className="w-full px-4 py-2.5 text-left text-sm text-neutral-700 hover:bg-neutral-50 flex items-center gap-2 transition-colors"
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
                          className="w-full px-4 py-2.5 text-left text-sm text-neutral-700 hover:bg-neutral-50 flex items-center gap-2 transition-colors"
                        >
                          <PlusIcon className="w-4 h-4" />
                          Add Child
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowMenu(false);
                            setShowStatusDropdown(true);
                          }}
                          className="w-full px-4 py-2.5 text-left text-sm text-neutral-700 hover:bg-neutral-50 flex items-center gap-2 transition-colors"
                        >
                          <ArrowPathIcon className="w-4 h-4" />
                          Change Status
                        </button>
                        <div className="border-t border-neutral-100 my-1" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteNode(false);
                          }}
                          className="w-full px-4 py-2.5 text-left text-sm text-warning-600 hover:bg-warning-50 flex items-center gap-2 transition-colors"
                        >
                          <TrashIcon className="w-4 h-4" />
                          Delete (Keep Children)
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteNode(true);
                          }}
                          className="w-full px-4 py-2.5 text-left text-sm text-danger-600 hover:bg-danger-50 flex items-center gap-2 transition-colors"
                        >
                          <TrashIcon className="w-4 h-4" />
                          Delete (With Children)
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Explore button */}
                {node.canExpand && !readOnly && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onExpand) onExpand(node.id);
                    }}
                    className="p-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-all duration-200 shadow-soft-sm hover:shadow-soft"
                    title="Explore this node further"
                  >
                    <PlusIcon className="w-4 h-4" />
                  </button>
                )}

                {/* Expand/Collapse button */}
                {hasChildren && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggle(node.id);
                    }}
                    className={`
                      p-2 rounded-lg transition-all duration-200 shadow-soft-sm hover:shadow-soft
                      ${
                        node.isExpanded
                          ? "bg-primary-600 hover:bg-primary-700 text-white"
                          : "bg-neutral-700 hover:bg-neutral-800 text-white"
                      }
                    `}
                    title={node.isExpanded ? "Collapse" : "Expand"}
                  >
                    {node.isExpanded ? (
                      <ChevronDownIcon className="w-4 h-4" />
                    ) : (
                      <ChevronRightIcon className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Expandable hint */}
            {node.canExpand && !hasChildren && (
              <div className="mt-3 flex items-center gap-2 text-xs font-medium text-warning-700 bg-warning-50 px-2.5 py-1.5 rounded-lg border border-warning-100">
                <SparklesIcon className="w-3.5 h-3.5" />
                <span>Click + to explore this node</span>
              </div>
            )}
          </div>

          {/* Status hover tooltip */}
          {showTooltip && statusIndicator && (
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 translate-y-full z-50 animate-fade-in">
              <div className="bg-neutral-900 text-white text-xs rounded-xl px-3 py-2 shadow-lg min-w-[160px] max-w-[240px]">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`w-2 h-2 rounded-full ${statusIndicator.dotColor}`} />
                  <span className="font-semibold">{statusIndicator.badgeLabel}</span>
                </div>
                {node.deferred_reason && (
                  <p className="text-neutral-300 leading-snug">
                    Reason: {node.deferred_reason}
                  </p>
                )}
                {node.completed_at && (
                  <p className="text-neutral-400 mt-0.5">
                    Completed: {new Date(node.completed_at).toLocaleDateString()}
                  </p>
                )}
                <div className="absolute left-1/2 -translate-x-1/2 -top-1 w-2 h-2 bg-neutral-900 rotate-45" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Children */}
      {node.isExpanded && hasChildren && (
        <div className="relative mt-8 animate-fade-in">
          {/* Vertical trunk */}
          <div
            className="absolute left-1/2 -translate-x-1/2 w-0.5 bg-neutral-300 z-0"
            style={{ top: "0px", height: "40px" }}
          />

          {/* Connection point */}
          <div
            className="absolute left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-neutral-400 border-2 border-white shadow-sm z-10"
            style={{ top: "-2px" }}
          />

          {/* Horizontal distribution line */}
          {node.children!.length > 1 ? (
            <div
              className="absolute left-1/2 -translate-x-1/2 h-0.5 bg-neutral-300 z-0"
              style={{
                top: "40px",
                width: `${(node.children!.length - 1) * 320 + 80}px`,
              }}
            />
          ) : (
            <div
              className="absolute left-1/2 -translate-x-1/2 w-0.5 bg-neutral-300 z-0"
              style={{
                top: "40px",
                height: "60px",
              }}
            />
          )}

          {/* Junction dots */}
          {node.children!.length > 1 ? (
            <>
              {node.children!.map((child, index) => {
                const totalWidth = (node.children!.length - 1) * 320 + 80;
                const spacing =
                  node.children!.length > 1
                    ? totalWidth / (node.children!.length - 1)
                    : 0;
                const leftPosition =
                  index === 0
                    ? 0
                    : index === node.children!.length - 1
                    ? totalWidth
                    : spacing * index;

                return (
                  <div
                    key={`junction-${child.id}`}
                    className="absolute w-2.5 h-2.5 rounded-full bg-neutral-400 border-2 border-white shadow-sm z-10"
                    style={{
                      top: "38.5px",
                      left: `calc(50% - ${totalWidth / 2}px + ${leftPosition}px - 5px)`,
                    }}
                  />
                );
              })}
            </>
          ) : (
            <div
              className="absolute left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-neutral-400 border-2 border-white shadow-sm z-10"
              style={{ top: "98.5px" }}
            />
          )}

          {/* Children Nodes */}
          <div
            className="flex items-start justify-center gap-10"
            style={{ marginTop: "100px" }}
          >
            {node.children!.map((child, index) => (
              <div
                key={child.id}
                className="relative animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <RelationshipTreeNode
                  node={child}
                  sessionId={sessionId}
                  onToggle={onToggle}
                  onExpand={onExpand}
                  onNodeClick={onNodeClick}
                  onUpdate={onUpdate}
                  selectedNodeId={selectedNodeId}
                  isRoot={false}
                  readOnly={readOnly}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
