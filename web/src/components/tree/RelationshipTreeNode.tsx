"use client";

import { useState, useEffect, useRef } from "react";
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
import { updateNode, deleteNode, addNode, updateNodeStatus, assignNode, unassignNode } from "@/lib/api";

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
  assignee?: { id: string; name: string; avatar_color?: string } | null;
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
  teamMembers?: { id: string; name: string; avatar_color?: string }[];
}

const NODE_BASE_WIDTH = 400; // Width of a single node card slot
const NODE_GAP = 24; // Gap between sibling subtrees

/**
 * Recursively compute how many "leaf slots" a subtree occupies.
 * A collapsed or childless node = 1 slot.
 * An expanded node = sum of its children's slots.
 */
function getSubtreeSlots(node: TreeNodeData): number {
  if (!node.isExpanded || !node.children || node.children.length === 0) {
    return 1;
  }
  return node.children.reduce((sum, child) => sum + getSubtreeSlots(child), 0);
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
  teamMembers = [],
}: RelationshipTreeNodeProps) {
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedNodeId === node.id;
  const hasAnswer = node.answer && node.answer.trim().length > 0;
  const nodeRef = useRef<HTMLDivElement>(null);

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
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);

  const getNodeStyle = () => {
    switch (node.type) {
      case "root":
        return {
          accentColor: "#171717",
          border: "border-neutral-200 dark:border-neutral-700",
          icon: CubeIcon,
          iconColor: "text-neutral-700",
          iconBg: "bg-neutral-100 dark:bg-neutral-800",
          badge: "Project",
          badgeColor: "bg-neutral-900 text-white",
        };
      case "feature":
        return {
          accentColor: "#f0ad4e",
          border: "border-neutral-200 dark:border-neutral-700",
          icon: SparklesIcon,
          iconColor: "text-warning-600",
          iconBg: "bg-warning-50 dark:bg-warning-900/30",
          badge: "Feature",
          badgeColor: "bg-warning-50 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400",
        };
      case "detail":
        return {
          accentColor: "#28a745",
          border: "border-neutral-200 dark:border-neutral-700",
          icon: DocumentCheckIcon,
          iconColor: "text-success-600",
          iconBg: "bg-success-50 dark:bg-success-900/30",
          badge: "Requirement",
          badgeColor: "bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-400",
        };
      default:
        return {
          accentColor: "#7c7c7c",
          border: "border-neutral-200 dark:border-neutral-700",
          icon: DocumentCheckIcon,
          iconColor: "text-neutral-600",
          iconBg: "bg-neutral-100 dark:bg-neutral-800",
          badge: "Item",
          badgeColor: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
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
          badgeBg: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
          BadgeIcon: StarIcon,
          dotColor: "bg-green-500",
        };
      case "modified":
        return {
          ringClass: "ring-2 ring-blue-400 ring-offset-1",
          opacityClass: "",
          badgeLabel: "Modified",
          badgeBg: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
          BadgeIcon: ArrowPathIcon,
          dotColor: "bg-blue-500",
        };
      case "deferred":
        return {
          ringClass: "ring-1 ring-neutral-300",
          opacityClass: "opacity-60",
          badgeLabel: "Deferred",
          badgeBg: "bg-neutral-200 text-neutral-600 border-neutral-300 dark:bg-neutral-700 dark:text-neutral-400 dark:border-neutral-600",
          BadgeIcon: ClockIcon,
          dotColor: "bg-neutral-400",
        };
      case "completed":
        return {
          ringClass: "ring-2 ring-emerald-400 ring-offset-1",
          opacityClass: "",
          badgeLabel: "Completed",
          badgeBg: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
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

  // Close menus/dropdowns on outside click
  useEffect(() => {
    if (!showMenu && !showStatusDropdown && !showAssignDropdown) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (nodeRef.current && !nodeRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setShowStatusDropdown(false);
        setShowAssignDropdown(false);
        setPendingStatus(null);
        setDeferredReason("");
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowMenu(false);
        setShowStatusDropdown(false);
        setShowAssignDropdown(false);
        setPendingStatus(null);
        setDeferredReason("");
      }
    };

    // Use a slight delay so the click that opened the menu doesn't immediately close it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    document.addEventListener('keydown', handleEscape);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showMenu, showStatusDropdown, showAssignDropdown]);

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

  const handleDeleteNode = async () => {
    if (!sessionId) return;
    const hasChildren = (node.children || []).length > 0;
    const message = hasChildren
      ? `This node has ${node.children!.length} child${node.children!.length > 1 ? 'ren' : ''} that will also be deleted. Continue?`
      : "Delete this node?";
    if (!confirm(message)) return;

    try {
      await deleteNode(node.id, true);
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

  const handleAssignNode = async (teamMemberId: string) => {
    try {
      await assignNode(node.id, teamMemberId);
      setShowAssignDropdown(false);
      setShowMenu(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error("Error assigning node:", error);
      alert("Failed to assign node");
    }
  };

  const handleUnassignNode = async () => {
    try {
      await unassignNode(node.id);
      setShowMenu(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error("Error unassigning node:", error);
      alert("Failed to unassign node");
    }
  };

  const STATUS_OPTIONS = [
    { value: "active", label: "Active", bg: "bg-neutral-50 text-neutral-700 hover:bg-neutral-100 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700" },
    { value: "new", label: "New", bg: "bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50" },
    { value: "modified", label: "Modified", bg: "bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50" },
    { value: "deferred", label: "Deferred", bg: "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-600" },
    { value: "completed", label: "Completed", bg: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50" },
  ];

  // Render edit form
  if (isEditing) {
    return (
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 p-3 space-y-2.5 min-w-[280px] max-w-[380px] mb-4 animate-fade-in" style={{ borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
        <div>
          <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1 block uppercase tracking-wide">
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
          <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1 block uppercase tracking-wide">
            Description
          </label>
          <textarea
            value={editAnswer}
            onChange={(e) => setEditAnswer(e.target.value)}
            className="input resize-none"
            style={{ height: "auto" }}
            rows={3}
          />
        </div>
        <div className="flex gap-1.5">
          <button onClick={handleSaveEdit} className="btn-primary flex-1">
            Save
          </button>
          <button
            onClick={() => setIsEditing(false)}
            className="btn-secondary"
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
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 p-3 space-y-2.5 min-w-[280px] max-w-[380px] mb-4 animate-fade-in" style={{ borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
        <div>
          <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1 block uppercase tracking-wide">
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
          <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1 block uppercase tracking-wide">
            Description (optional)
          </label>
          <textarea
            value={newChildAnswer}
            onChange={(e) => setNewChildAnswer(e.target.value)}
            placeholder="Enter description..."
            className="input resize-none"
            style={{ height: "auto" }}
            rows={2}
          />
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={handleAddChild}
            disabled={!newChildQuestion.trim()}
            className="btn-primary disabled:opacity-50 flex-1"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            Add Child
          </button>
          <button
            onClick={() => {
              setIsAddingChild(false);
              setNewChildQuestion("");
              setNewChildAnswer("");
            }}
            className="btn-secondary px-2"
          >
            <XMarkIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      {/* Node Card */}
      <div ref={nodeRef} className="relative group z-20">
        <div
          className={`
            relative bg-white dark:bg-neutral-900 border ${
              isSelected
                ? "border-primary-500 shadow-md"
                : style.border + " shadow-sm"
            }
            hover:shadow-md
            transition-all duration-150
            ${isRoot ? "min-w-[320px]" : "min-w-[280px]"} max-w-[380px]
            overflow-visible ${hasAnswer ? "cursor-pointer" : ""}
            ${statusIndicator?.opacityClass ?? ""}
          `}
          style={{ borderRadius: "8px" }}
          onClick={handleNodeClick}
          onMouseEnter={() => statusIndicator && setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          {/* Top connection handle */}
          {!isRoot && (
            <div
              className="absolute -top-[4px] left-1/2 -translate-x-1/2 w-[8px] h-[8px] rounded-full bg-white dark:bg-neutral-900 border-[1.5px] z-30"
              style={{ borderColor: style.accentColor }}
            />
          )}

          {/* Left accent strip */}
          <div
            className="absolute left-0 top-0 bottom-0 w-[3px]"
            style={{ backgroundColor: style.accentColor, borderRadius: "8px 0 0 8px" }}
          />

          {/* Selected badge */}
          {isSelected && (
            <div className="absolute -top-2 -right-2 z-10">
              <div className="bg-neutral-900 text-white text-[11px] font-medium px-2 py-0.5 rounded flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-primary-400 rounded-full" />
                <span>Active</span>
              </div>
            </div>
          )}

          {/* Card Content */}
          <div className="p-3 pl-4">
            <div className="flex items-center gap-2.5">
              {/* Icon */}
              <div
                className={`${style.iconBg} rounded p-1.5 flex-shrink-0`}
              >
                <Icon className={`w-4 h-4 ${style.iconColor}`} />
              </div>

              {/* Title and badges */}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 leading-tight truncate">
                  {node.question}
                </h3>

                {/* Inline badges */}
                <div className="flex flex-wrap items-center gap-1 mt-1.5">
                  {node.type === "root" && (
                    <span
                      className={`text-[11px] font-medium px-1.5 py-0.5 ${style.badgeColor}`}
                      style={{ borderRadius: "4px" }}
                    >
                      {style.badge}
                    </span>
                  )}

                  {hasChildren && (
                    <span className="text-[11px] font-medium px-1.5 py-0.5 bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 flex items-center gap-1" style={{ borderRadius: "4px" }}>
                      <CheckCircleIcon className="w-3 h-3" />
                      {node.children!.length}
                    </span>
                  )}

                  {hasAnswer && (
                    <span className="text-[11px] font-medium px-1.5 py-0.5 bg-info-50 text-primary-700 dark:bg-info-900/30 dark:text-brand-lime flex items-center gap-1" style={{ borderRadius: "4px" }}>
                      <InformationCircleIcon className="w-3 h-3" />
                      Details
                    </span>
                  )}

                  {/* Source badge */}
                  {node.source_name && (
                    <span
                      className="text-[11px] font-medium px-1.5 py-0.5 bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 flex items-center gap-1"
                      style={{ borderRadius: "4px" }}
                      title={`Added from: ${node.source_name} (${node.source_type || 'source'})`}
                    >
                      <DocumentDuplicateIcon className="w-3 h-3" />
                      {node.source_name.length > 18 ? node.source_name.substring(0, 16) + '...' : node.source_name}
                    </span>
                  )}

                  {/* Assignee badge (DEC-1.3) */}
                  {node.assignee && (
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full border flex items-center gap-1.5"
                      style={{
                        backgroundColor: (node.assignee.avatar_color || '#6366f1') + '18',
                        borderColor: (node.assignee.avatar_color || '#6366f1') + '40',
                        color: node.assignee.avatar_color || '#6366f1',
                      }}
                      title={`Assigned to: ${node.assignee.name}`}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0"
                        style={{ backgroundColor: node.assignee.avatar_color || '#6366f1' }}
                      >
                        {node.assignee.name.charAt(0).toUpperCase()}
                      </span>
                      {node.assignee.name.length > 12 ? node.assignee.name.substring(0, 10) + '…' : node.assignee.name}
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
                          className="absolute left-0 top-full mt-1 w-40 bg-white dark:bg-neutral-800 rounded-md border border-neutral-200 dark:border-neutral-700 z-50 overflow-hidden animate-fade-in"
                          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {pendingStatus === "deferred" ? (
                            <div className="p-2.5 space-y-2">
                              <p className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400">Reason for deferring:</p>
                              <input
                                type="text"
                                placeholder="Optional reason..."
                                value={deferredReason}
                                onChange={(e) => setDeferredReason(e.target.value)}
                                className="w-full text-[12px] px-2 py-1 border border-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 rounded"
                                autoFocus
                              />
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => handleStatusChange("deferred", deferredReason || undefined)}
                                  className="flex-1 text-[12px] px-2 py-1 bg-neutral-900 text-white dark:bg-brand-lime dark:text-neutral-900 rounded hover:bg-neutral-800"
                                >
                                  Defer
                                </button>
                                <button
                                  onClick={() => { setPendingStatus(null); setDeferredReason(""); }}
                                  className="text-[12px] px-2 py-1 text-neutral-500 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-300"
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
                                  className={`w-full px-3 py-1.5 text-left text-[12px] font-medium transition-colors ${opt.bg}`}
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
                        className="absolute left-0 top-0 mt-1 w-40 bg-white dark:bg-neutral-800 rounded-md border border-neutral-200 dark:border-neutral-700 z-50 overflow-hidden animate-fade-in"
                        style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {pendingStatus === "deferred" ? (
                          <div className="p-2.5 space-y-2">
                            <p className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400">Reason for deferring:</p>
                            <input
                              type="text"
                              placeholder="Optional reason..."
                              value={deferredReason}
                              onChange={(e) => setDeferredReason(e.target.value)}
                              className="w-full text-[12px] px-2 py-1 border border-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 rounded"
                              autoFocus
                            />
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => handleStatusChange("deferred", deferredReason || undefined)}
                                className="flex-1 text-[12px] px-2 py-1 bg-neutral-900 text-white dark:bg-brand-lime dark:text-neutral-900 rounded hover:bg-neutral-800"
                              >
                                Defer
                              </button>
                              <button
                                onClick={() => { setPendingStatus(null); setDeferredReason(""); }}
                                className="text-[12px] px-2 py-1 text-neutral-500 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-300"
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
                                className={`w-full px-3 py-1.5 text-left text-[12px] font-medium transition-colors ${opt.bg}`}
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

              {/* Assign team member dropdown (DEC-1.3) */}
              {showAssignDropdown && teamMembers.length > 0 && (
                <div className="mt-1.5">
                  <div
                    className="bg-white dark:bg-neutral-800 rounded-md border border-neutral-200 dark:border-neutral-700 p-1.5 animate-fade-in"
                    style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="text-[11px] font-medium text-neutral-500 px-2 mb-1">Assign to:</p>
                    <div className="max-h-32 overflow-y-auto space-y-0.5">
                      {teamMembers.map((member) => (
                        <button
                          key={member.id}
                          onClick={() => handleAssignNode(member.id)}
                          className="w-full px-2 py-1 text-left text-[12px] text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-700 rounded flex items-center gap-2 transition-colors"
                        >
                          <span
                            className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0"
                            style={{ backgroundColor: member.avatar_color || '#525252' }}
                          >
                            {member.name.charAt(0).toUpperCase()}
                          </span>
                          {member.name}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setShowAssignDropdown(false)}
                      className="w-full mt-1 px-2 py-0.5 text-[11px] text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-col gap-1 flex-shrink-0">
                {/* Node Management Menu */}
                {sessionId && !isRoot && !readOnly && (
                  <div className="relative z-50">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(!showMenu);
                      }}
                      className="p-1 rounded bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-500 transition-colors"
                      title="Node actions"
                    >
                      <EllipsisVerticalIcon className="w-3.5 h-3.5" />
                    </button>

                    {showMenu && (
                      <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-neutral-800 rounded-md border border-neutral-200 dark:border-neutral-700 z-50 overflow-hidden animate-fade-in" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsEditing(true);
                            setShowMenu(false);
                          }}
                          className="w-full px-3 py-2 text-left text-[13px] text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-700 flex items-center gap-2 transition-colors"
                        >
                          <PencilIcon className="w-3.5 h-3.5" />
                          Edit Node
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsAddingChild(true);
                            setShowMenu(false);
                          }}
                          className="w-full px-3 py-2 text-left text-[13px] text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-700 flex items-center gap-2 transition-colors"
                        >
                          <PlusIcon className="w-3.5 h-3.5" />
                          Add Child
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowMenu(false);
                            setShowStatusDropdown(true);
                          }}
                          className="w-full px-3 py-2 text-left text-[13px] text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-700 flex items-center gap-2 transition-colors"
                        >
                          <ArrowPathIcon className="w-3.5 h-3.5" />
                          Change Status
                        </button>
                        {teamMembers.length > 0 && !node.assignee && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowMenu(false);
                              setShowAssignDropdown(true);
                            }}
                            className="w-full px-3 py-2 text-left text-[13px] text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-700 flex items-center gap-2 transition-colors"
                          >
                            <PlusIcon className="w-3.5 h-3.5" />
                            Assign Member
                          </button>
                        )}
                        {node.assignee && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUnassignNode();
                            }}
                            className="w-full px-3 py-2 text-left text-[13px] text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-700 flex items-center gap-2 transition-colors"
                          >
                            <XMarkIcon className="w-3.5 h-3.5" />
                            Unassign {node.assignee.name}
                          </button>
                        )}
                        <div className="border-t border-neutral-200 dark:border-neutral-700 my-0.5" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteNode();
                          }}
                          className="w-full px-3 py-2 text-left text-[13px] text-danger-600 hover:bg-danger-50 flex items-center gap-2 transition-colors"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                          Delete
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
                    className="p-1 rounded bg-neutral-900 text-white dark:bg-brand-lime dark:text-neutral-900 hover:bg-neutral-800 transition-colors"
                    title="Explore this node further"
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
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
                      p-1.5 rounded transition-colors
                      ${
                        node.isExpanded
                          ? "bg-neutral-900 hover:bg-neutral-800 text-white"
                          : "bg-neutral-200 hover:bg-neutral-300 text-neutral-700 dark:bg-neutral-700 dark:hover:bg-neutral-600 dark:text-neutral-300"
                      }
                    `}
                    title={node.isExpanded ? "Collapse" : "Expand"}
                  >
                    {node.isExpanded ? (
                      <ChevronDownIcon className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRightIcon className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Answer preview */}
            {hasAnswer && (
              <p className="text-[11px] text-neutral-500 mt-2 line-clamp-1 leading-relaxed">
                {node.answer}
              </p>
            )}

            {/* Expandable hint */}
            {node.canExpand && !hasChildren && (
              <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-warning-700 bg-warning-50 dark:bg-warning-900/30 dark:text-warning-400 px-2 py-1 rounded" style={{ borderRadius: "4px" }}>
                <SparklesIcon className="w-3 h-3" />
                <span>Click + to explore this node</span>
              </div>
            )}
          </div>

          {/* Status hover tooltip */}
          {showTooltip && statusIndicator && (
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 translate-y-full z-50 animate-fade-in">
              <div className="bg-neutral-900 text-white text-[11px] rounded-md px-2.5 py-1.5 min-w-[140px] max-w-[220px]" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${statusIndicator.dotColor}`} />
                  <span className="font-medium">{statusIndicator.badgeLabel}</span>
                </div>
                {node.deferred_reason && (
                  <p className="text-neutral-300 text-[10px] leading-snug">
                    Reason: {node.deferred_reason}
                  </p>
                )}
                {node.completed_at && (
                  <p className="text-neutral-400 text-[10px] mt-0.5">
                    Completed: {new Date(node.completed_at).toLocaleDateString()}
                  </p>
                )}
                <div className="absolute left-1/2 -translate-x-1/2 -top-1 w-2 h-2 bg-neutral-900 rotate-45" />
              </div>
            </div>
          )}

          {/* Bottom connection handle */}
          {hasChildren && (
            <div
              className="absolute -bottom-[4px] left-1/2 -translate-x-1/2 w-[8px] h-[8px] rounded-full bg-white dark:bg-neutral-900 border-[1.5px] z-30"
              style={{ borderColor: style.accentColor }}
            />
          )}
        </div>
      </div>

      {/* Collapsed children count */}
      {hasChildren && !node.isExpanded && (
        <div className="mt-1.5 flex justify-center animate-fade-in">
          <span className="text-[10px] text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded" style={{ borderRadius: "4px" }}>
            {node.children!.length} {node.children!.length === 1 ? 'child' : 'children'}
          </span>
        </div>
      )}

      {/* Children */}
      {node.isExpanded && hasChildren && (
        <div className="relative mt-6 animate-fade-in-up">
          {/* SVG Orthogonal Connectors */}
          {(() => {
            const children = node.children!;
            const childCount = children.length;
            const lineColor = "#e2e2e2";
            const svgHeight = 56;
            const midY = 22;
            const r = 8;

            // Compute per-child widths based on subtree size
            const childSlots = children.map(getSubtreeSlots);
            const childWidths = childSlots.map(
              (slots) => slots * NODE_BASE_WIDTH + (slots - 1) * NODE_GAP
            );
            const totalWidth = childWidths.reduce((a, b) => a + b, 0) + (childCount - 1) * NODE_GAP;

            if (childCount === 1) {
              return (
                <svg
                  className="absolute left-1/2 z-0 pointer-events-none"
                  style={{ top: 0, width: 2, height: svgHeight, marginLeft: -1 }}
                  overflow="visible"
                >
                  <line
                    x1={1} y1={0} x2={1} y2={svgHeight}
                    stroke={lineColor}
                    strokeWidth="1.5"
                  />
                </svg>
              );
            }

            // Calculate center-X of each child within the total width
            const childCenters: number[] = [];
            let cursor = 0;
            for (let i = 0; i < childCount; i++) {
              childCenters.push(cursor + childWidths[i] / 2);
              cursor += childWidths[i] + NODE_GAP;
            }
            const centerX = totalWidth / 2;

            return (
              <svg
                className="absolute left-1/2 z-0 pointer-events-none"
                style={{
                  top: 0,
                  width: totalWidth,
                  height: svgHeight,
                  marginLeft: -totalWidth / 2,
                }}
                overflow="visible"
              >
                {/* Parent stem */}
                <line
                  x1={centerX} y1={0} x2={centerX} y2={midY}
                  stroke={lineColor}
                  strokeWidth="1.5"
                />

                {/* Child branches */}
                {children.map((child, index) => {
                  const childX = childCenters[index];
                  const dx = childX - centerX;

                  if (Math.abs(dx) < 1) {
                    return (
                      <line
                        key={`branch-${child.id}`}
                        x1={childX} y1={midY} x2={childX} y2={svgHeight}
                        stroke={lineColor}
                        strokeWidth="1.5"
                      />
                    );
                  }

                  const dir = dx > 0 ? 1 : -1;
                  const clampedR = Math.min(r, Math.abs(dx), svgHeight - midY);

                  return (
                    <path
                      key={`branch-${child.id}`}
                      d={[
                        `M ${centerX} ${midY}`,
                        `L ${childX - dir * clampedR} ${midY}`,
                        `Q ${childX} ${midY} ${childX} ${midY + clampedR}`,
                        `L ${childX} ${svgHeight}`,
                      ].join(" ")}
                      stroke={lineColor}
                      strokeWidth="1.5"
                      fill="none"
                    />
                  );
                })}
              </svg>
            );
          })()}

          {/* Children Nodes */}
          {(() => {
            const children = node.children!;
            const childSlots = children.map(getSubtreeSlots);
            const childWidths = childSlots.map(
              (slots) => slots * NODE_BASE_WIDTH + (slots - 1) * NODE_GAP
            );
            const totalWidth = childWidths.reduce((a, b) => a + b, 0) + (children.length - 1) * NODE_GAP;

            return (
              <div
                className="flex items-start"
                style={{ width: `${totalWidth}px`, marginTop: `${56}px`, gap: `${NODE_GAP}px` }}
              >
                {children.map((child, index) => (
                  <div
                    key={child.id}
                    className="relative animate-fade-in-up flex justify-center flex-shrink-0"
                    style={{ width: `${childWidths[index]}px`, animationDelay: `${index * 80}ms` }}
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
                      teamMembers={teamMembers}
                    />
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
