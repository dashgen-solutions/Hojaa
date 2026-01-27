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
  XMarkIcon
} from "@heroicons/react/24/outline";
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

interface RelationshipTreeNodeProps {
  node: TreeNodeData;
  sessionId?: string;
  onToggle: (nodeId: string) => void;
  onExpand?: (nodeId: string) => void;
  onNodeClick?: (node: TreeNodeData) => void;
  onUpdate?: () => void;
  isRoot?: boolean;
  selectedNodeId?: string | null;
}

export default function RelationshipTreeNode({ 
  node, 
  sessionId,
  onToggle, 
  onExpand,
  onNodeClick,
  onUpdate,
  isRoot = false,
  selectedNodeId
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

  const getNodeStyle = () => {
    switch (node.type) {
      case "root":
        return {
          gradient: "from-blue-500 via-indigo-500 to-purple-600",
          border: "border-blue-400",
          bg: "bg-gradient-to-br from-blue-50 to-indigo-50",
          hoverBg: "hover:from-blue-100 hover:to-indigo-100",
          icon: CubeIcon,
          iconColor: "text-blue-600",
          iconBg: "bg-gradient-to-br from-blue-100 to-indigo-100",
          badge: "Project",
          badgeColor: "bg-blue-600 text-white",
          accentColor: "#3b82f6"
        };
      case "feature":
        return {
          gradient: "from-amber-500 via-orange-500 to-red-500",
          border: "border-amber-400",
          bg: "bg-gradient-to-br from-amber-50 to-orange-50",
          hoverBg: "hover:from-amber-100 hover:to-orange-100",
          icon: SparklesIcon,
          iconColor: "text-amber-600",
          iconBg: "bg-gradient-to-br from-amber-100 to-orange-100",
          badge: "Feature",
          badgeColor: "bg-amber-600 text-white",
          accentColor: "#f59e0b"
        };
      case "detail":
        return {
          gradient: "from-emerald-500 via-teal-500 to-cyan-600",
          border: "border-emerald-400",
          bg: "bg-gradient-to-br from-emerald-50 to-teal-50",
          hoverBg: "hover:from-emerald-100 hover:to-teal-100",
          icon: DocumentCheckIcon,
          iconColor: "text-emerald-600",
          iconBg: "bg-gradient-to-br from-emerald-100 to-teal-100",
          badge: "Requirement",
          badgeColor: "bg-emerald-600 text-white",
          accentColor: "#10b981"
        };
      default:
        return {
          gradient: "from-gray-500 to-gray-600",
          border: "border-gray-400",
          bg: "bg-gradient-to-br from-gray-50 to-slate-50",
          hoverBg: "hover:from-gray-100 hover:to-slate-100",
          icon: DocumentCheckIcon,
          iconColor: "text-gray-600",
          iconBg: "bg-gradient-to-br from-gray-100 to-slate-100",
          badge: "Item",
          badgeColor: "bg-gray-600 text-white",
          accentColor: "#6b7280"
        };
    }
  };

  const style = getNodeStyle();
  const Icon = style.icon;

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

  // Render edit form if editing
  if (isEditing) {
    return (
      <div className="p-4 border-2 border-primary-500 rounded-lg bg-white shadow-lg space-y-3 min-w-[280px] max-w-[380px] mb-4">
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
            Save
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

  // Render add child form if adding
  if (isAddingChild) {
    return (
      <div className="p-4 border-2 border-success-500 rounded-lg bg-white shadow-lg space-y-3 min-w-[280px] max-w-[380px] mb-4">
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
            Add Child
          </button>
          <button
            onClick={() => {
              setIsAddingChild(false);
              setNewChildQuestion("");
              setNewChildAnswer("");
            }}
            className="px-4 py-2 border border-secondary-300 rounded-lg text-secondary-700 hover:bg-secondary-50 text-sm font-medium flex items-center justify-center"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      {/* Connection line TO this node from parent (if not root) */}
      {!isRoot && (
        <div className="relative w-full flex justify-center" style={{ height: '50px', marginBottom: '10px' }}>
          {/* Vertical line coming down to this node - BLACK, stops BEFORE the card */}
          <div className="w-1 bg-black absolute left-1/2 -translate-x-1/2" style={{ height: '50px', top: '0px' }} />
          
          {/* Connection dot at top where line starts */}
          <div className="absolute left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-black border-2 border-white shadow-md z-10" style={{ top: '0px' }} />
        </div>
      )}

      {/* Compact Node Card - Now with proper z-index */}
      <div className="relative group z-20">
        {/* Glow effect on hover */}
        {!isSelected && (
          <div 
            className="absolute -inset-1 bg-gradient-to-r opacity-0 group-hover:opacity-30 blur-lg transition-opacity duration-500 rounded-2xl"
            style={{ background: `linear-gradient(135deg, ${style.accentColor}40, ${style.accentColor}20)` }}
          />
        )}

        {/* Selected glow effect */}
        {isSelected && (
          <div 
            className="absolute -inset-2 bg-gradient-to-r from-blue-400 to-purple-400 opacity-50 blur-xl animate-pulse rounded-2xl"
          />
        )}

        <div
          className={`
            relative bg-white border-2 ${isSelected ? 'border-blue-500 shadow-2xl' : style.border + ' shadow-lg'}
            rounded-2xl ${style.hoverBg} hover:shadow-2xl 
            transform hover:-translate-y-1 transition-all duration-300 ease-out
            ${isRoot ? 'min-w-[320px]' : 'min-w-[280px]'} max-w-[380px]
            overflow-visible ${hasAnswer ? 'cursor-pointer' : ''}
          `}
          onClick={handleNodeClick}
        >
          {/* Animated top gradient bar */}
          <div className={`h-1.5 bg-gradient-to-r ${style.gradient} relative overflow-hidden`}>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-40 group-hover:translate-x-full transition-all duration-1000 ease-out" 
                 style={{ animation: isSelected ? 'shimmer 2s infinite' : 'none' }} />
          </div>
          
          {/* Selected badge */}
          {isSelected && (
            <div className="absolute -top-3 -right-3 z-10">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500 blur-md animate-pulse" />
                <div className="relative bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-white rounded-full animate-ping absolute" />
                  <div className="w-2 h-2 bg-white rounded-full" />
                  <span>Active</span>
                </div>
              </div>
            </div>
          )}
          
          {/* Compact Card Content */}
          <div className="p-4">
            {/* Header row */}
            <div className="flex items-center gap-3">
              {/* Icon */}
              <div className={`${style.iconBg} rounded-xl p-2 flex-shrink-0 transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300`}>
                <Icon className={`w-5 h-5 ${style.iconColor}`} />
              </div>
              
              {/* Title and badges */}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-gray-900 leading-tight tracking-tight truncate">
                  {node.question}
                </h3>
                
                {/* Inline badges */}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {/* Only show type badge for root node (Project) */}
                  {node.type === "root" && (
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${style.badgeColor}`}>
                      {style.badge}
                    </span>
                  )}
                  
                  {hasChildren && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gradient-to-r from-gray-100 to-slate-100 text-gray-700 border border-gray-200 flex items-center gap-1">
                      <CheckCircleIcon className="w-3 h-3" />
                      {node.children!.length}
                    </span>
                  )}
                  
                  {hasAnswer && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 flex items-center gap-1">
                      <InformationCircleIcon className="w-3 h-3" />
                      Details
                    </span>
                  )}
                </div>
              </div>

              {/* Action buttons column */}
              <div className="flex flex-col gap-2 flex-shrink-0">
                {/* Node Management Menu - Show for all non-root nodes */}
                {sessionId && !isRoot && (
                  <div className="relative z-50">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(!showMenu);
                      }}
                      className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 transition-all duration-300 hover:scale-110 shadow-sm hover:shadow-md"
                      title="Node actions"
                    >
                      <EllipsisVerticalIcon className="w-4 h-4" />
                    </button>

                    {showMenu && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-secondary-200 z-50 max-h-64 overflow-y-auto">
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

                {/* Explore button - Show on ALL nodes that can expand */}
                {node.canExpand && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onExpand) onExpand(node.id);
                    }}
                    className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 transition-all duration-300 hover:scale-110 hover:rotate-12 shadow-md hover:shadow-xl group/btn"
                    title="Explore this node further"
                  >
                    <PlusIcon className="w-4 h-4 group-hover/btn:rotate-90 transition-transform duration-300" />
                  </button>
                )}
                
                {/* Expand/Collapse button - More prominent */}
                {hasChildren && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggle(node.id);
                    }}
                    className={`
                      p-2.5 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl 
                      hover:scale-110 border-2 group/toggle
                      ${node.isExpanded 
                        ? 'bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 border-indigo-400 text-white' 
                        : 'bg-gradient-to-br from-slate-700 to-gray-800 hover:from-slate-800 hover:to-gray-900 border-slate-600 text-white'
                      }
                    `}
                    title={node.isExpanded ? "Collapse children" : "Expand children"}
                  >
                    {node.isExpanded ? (
                      <ChevronDownIcon className="w-5 h-5 group-hover/toggle:scale-110 transition-transform" />
                    ) : (
                      <ChevronRightIcon className="w-5 h-5 group-hover/toggle:scale-110 transition-transform" />
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Expandable hint - Show only if node has no children yet */}
            {node.canExpand && !hasChildren && (
              <div className="mt-3 flex items-center gap-2 text-xs font-medium text-amber-700 bg-gradient-to-r from-amber-50 to-orange-50 px-2.5 py-1.5 rounded-lg border border-amber-200">
                <SparklesIcon className="w-3.5 h-3.5" />
                <span>Click + to explore this node</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Children with connection system - lines BEHIND nodes */}
      {node.isExpanded && hasChildren && (
        <div className="relative mt-8 animate-fade-in">
          {/* Main vertical trunk from this node going down - BLACK, behind everything */}
          <div 
            className="absolute left-1/2 -translate-x-1/2 w-1 bg-black z-0" 
            style={{ top: '0px', height: '40px' }} 
          />
          
          {/* Connection point at top of this section - BLACK */}
          <div 
            className="absolute left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-black border-2 border-white shadow-lg z-10"
            style={{ top: '-2px' }}
          />
          
          {/* Horizontal distribution line connecting all children - BLACK, behind nodes */}
          {node.children!.length > 1 ? (
            <div 
              className="absolute left-1/2 -translate-x-1/2 h-1 bg-black z-0"
              style={{ 
                top: '40px',
                width: `${(node.children!.length - 1) * 320 + 80}px`
              }}
            />
          ) : (
            /* Single child - just extend the vertical line down */
            <div 
              className="absolute left-1/2 -translate-x-1/2 w-1 bg-black z-0"
              style={{ 
                top: '40px',
                height: '60px'
              }}
            />
          )}

          {/* Junction dots where horizontal meets verticals - BLACK */}
          {node.children!.length > 1 ? (
            <>
              {node.children!.map((child, index) => {
                const totalWidth = (node.children!.length - 1) * 320 + 80;
                const spacing = node.children!.length > 1 ? totalWidth / (node.children!.length - 1) : 0;
                const leftPosition = index === 0 ? 0 : 
                                   index === node.children!.length - 1 ? totalWidth :
                                   spacing * index;
                
                return (
                  <div 
                    key={`junction-${child.id}`}
                    className="absolute w-3 h-3 rounded-full bg-black border-2 border-white shadow-md z-10"
                    style={{ 
                      top: '38.5px',
                      left: `calc(50% - ${totalWidth / 2}px + ${leftPosition}px - 6px)`
                    }}
                  />
                );
              })}
            </>
          ) : (
            /* Single child - dot at end of vertical line */
            <div 
              className="absolute left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-black border-2 border-white shadow-md z-10"
              style={{ top: '98.5px' }}
            />
          )}

          {/* Children Nodes - each will render their own incoming connection */}
          <div className="flex items-start justify-center gap-10" style={{ marginTop: '100px' }}>
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
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
