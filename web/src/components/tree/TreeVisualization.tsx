"use client";

import { useState, useEffect } from "react";
import RelationshipTreeNode from "./RelationshipTreeNode";
import NodeDetailsModal from "./NodeDetailsModal";
import DeferredItemsList from "./DeferredItemsList";
import {
  DocumentTextIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  FunnelIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { getTree, getPlanningBoard } from "@/lib/api";

interface TreeNodeData {
  id: string;
  question: string;
  answer?: string;
  node_type?: string;
  type: "root" | "feature" | "detail";
  status?: string;
  deferred_reason?: string;
  completed_at?: string;
  depth: number;
  children?: TreeNodeData[];
  isExpanded?: boolean;
  is_expanded?: boolean;
  canExpand?: boolean;
  can_expand?: boolean;
  order_index?: number;
  source_name?: string;
  source_type?: string;
  assignee?: { id: string; name: string; avatar_color?: string } | null;
}

interface TreeVisualizationProps {
  sessionId: string;
  onNodeSelect?: (nodeId: string) => void;
  selectedNodeId?: string | null;
  refreshKey?: number;
  readOnly?: boolean;
}

export default function TreeVisualization({
  sessionId,
  onNodeSelect,
  selectedNodeId,
  refreshKey,
  readOnly = false,
}: TreeVisualizationProps) {
  const [treeData, setTreeData] = useState<TreeNodeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [selectedNodeForModal, setSelectedNodeForModal] =
    useState<TreeNodeData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showDeferred, setShowDeferred] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string; avatar_color?: string }[]>([]);
  const [treeStats, setTreeStats] = useState<{
    total_nodes: number;
    max_depth: number;
    depth_warning: string | null;
    recommend_collapse_depth: number | null;
  } | null>(null);
  const [depthDismissed, setDepthDismissed] = useState(false);

  const fetchTree = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await getTree(sessionId);

      // Tree is still being built — show nothing yet
      if (response.pending) {
        setTreeData(null);
        return;
      }

      const convertNode = (node: any, depth: number = 0): TreeNodeData => ({
        id: node.id,
        question: node.question,
        answer: node.answer,
        status: node.status || "active",
        deferred_reason: node.deferred_reason,
        completed_at: node.completed_at,
        source_name: node.source_name || undefined,
        source_type: node.source_type || undefined,
        assignee: node.assignee || null,
        type:
          node.node_type === "ROOT"
            ? "root"
            : node.node_type === "FEATURE"
            ? "feature"
            : "detail",
        depth: node.depth,
        isExpanded: depth === 0,
        canExpand: node.can_expand,
        children: node.children
          ? node.children.map((child: any) => convertNode(child, depth + 1))
          : [],
      });

      const convertedTree = convertNode(response.tree, 0);
      setTreeData(convertedTree);

      // RISK-2.1C — capture depth stats for warning banner
      if (response.tree_stats) {
        setTreeStats(response.tree_stats);
        // Reset dismissed state when stats change significantly
        if (response.tree_stats.depth_warning && !treeStats?.depth_warning) {
          setDepthDismissed(false);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load tree");
      console.error("Error fetching tree:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (sessionId) {
      fetchTree();
      // Fetch team members for node assignment (DEC-1.3)
      getPlanningBoard(sessionId).then((data) => {
        setTeamMembers((data.team_members || []).map((m: any) => ({
          id: m.id, name: m.name, avatar_color: m.avatar_color,
        })));
      }).catch(() => {}); // team members may not exist yet
    }
  }, [sessionId, refreshKey]);

  const toggleNode = (nodeId: string) => {
    const toggleInTree = (node: TreeNodeData): TreeNodeData => {
      if (node.id === nodeId) {
        return { ...node, isExpanded: !node.isExpanded };
      }
      if (node.children) {
        return {
          ...node,
          children: node.children.map(toggleInTree),
        };
      }
      return node;
    };
    setTreeData(toggleInTree(treeData!));
  };

  const handleExpandNode = (nodeId: string) => {
    if (onNodeSelect) {
      onNodeSelect(nodeId);
    }
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(150, prev + 10));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(50, prev - 10));
  };

  const handleZoomReset = () => {
    setZoom(100);
  };

  const handleNodeClick = (node: TreeNodeData) => {
    setSelectedNodeForModal(node);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTimeout(() => setSelectedNodeForModal(null), 300);
  };

  /** Collect unique source names from the tree for the filter dropdown. */
  const collectSources = (node: TreeNodeData): string[] => {
    const sources: string[] = [];
    if (node.source_name) sources.push(node.source_name);
    (node.children || []).forEach((c) => sources.push(...collectSources(c)));
    return sources;
  };
  const uniqueSources = treeData
    ? Array.from(new Set(collectSources(treeData))).sort()
    : [];

  /** Recursively filter tree, keeping a node if it or any descendant matches. */
  const filterTree = (node: TreeNodeData): TreeNodeData | null => {
    const statusMatch =
      statusFilter === "all" || node.type === "root" || node.status === statusFilter;
    const searchMatch =
      !searchQuery ||
      node.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (node.answer || "").toLowerCase().includes(searchQuery.toLowerCase());
    const sourceMatch =
      !sourceFilter || node.type === "root" || node.source_name === sourceFilter;

    const filteredChildren = (node.children || [])
      .map(filterTree)
      .filter(Boolean) as TreeNodeData[];

    // Keep this node if it directly matches, or if any child survived the filter
    if ((statusMatch && searchMatch && sourceMatch) || filteredChildren.length > 0) {
      return { ...node, children: filteredChildren };
    }
    return null;
  };

  const filteredTree =
    treeData && (statusFilter !== "all" || searchQuery || sourceFilter)
      ? filterTree(treeData)
      : treeData;

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-neutral-50">
        <div className="text-center animate-fade-in">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-neutral-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-neutral-900 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-neutral-600 font-medium">
            Loading requirements map...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-neutral-50 p-8">
        <div className="text-center max-w-md animate-fade-in">
          <div className="w-16 h-16 rounded-md bg-danger-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <h3 className="text-lg font-semibold text-neutral-900 mb-2">
            Failed to Load Map
          </h3>
          <p className="text-neutral-500 mb-6">{error}</p>
          <button onClick={() => fetchTree()} className="btn-primary">
            <ArrowPathIcon className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!treeData) {
    return (
      <div className="h-full flex items-center justify-center bg-neutral-50">
        <div className="text-center">
          <div className="relative w-12 h-12 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-neutral-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-neutral-900 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-neutral-500">Building requirements map…</p>
          <p className="text-neutral-400 text-sm mt-1">Complete the questions first to generate the tree</p>
        </div>
      </div>
    );
  }

  const STATUS_FILTER_OPTIONS = [
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "new", label: "New" },
    { value: "modified", label: "Modified" },
    { value: "deferred", label: "Deferred" },
    { value: "completed", label: "Completed" },
  ];

  return (
    <div className="h-full flex flex-col bg-white">
      <NodeDetailsModal
        node={selectedNodeForModal}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />

      {/* Header with Zoom Controls */}
      <div className="border-b border-neutral-200/60 bg-white flex-shrink-0">
        <div className="p-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-neutral-50 flex items-center justify-center">
                <DocumentTextIcon className="w-4 h-4 text-neutral-900" />
              </div>
              Requirements Map
            </h2>
            <p className="text-xs text-neutral-500 mt-1 ml-10">
              {selectedNodeId
                ? "Chat open - Exploring feature"
                : "Click + on any feature to explore"}
            </p>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-neutral-100 rounded-md p-1">
            <button
              onClick={handleZoomOut}
              className="p-2 hover:bg-white rounded-md transition-all duration-200 hover:shadow-sm"
              title="Zoom out"
            >
              <MagnifyingGlassMinusIcon className="w-4 h-4 text-neutral-600" />
            </button>
            <button
              onClick={handleZoomReset}
              className="px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-white rounded-md transition-all duration-200 min-w-[52px] hover:shadow-sm"
              title="Reset zoom"
            >
              {zoom}%
            </button>
            <button
              onClick={handleZoomIn}
              className="p-2 hover:bg-white rounded-md transition-all duration-200 hover:shadow-sm"
              title="Zoom in"
            >
              <MagnifyingGlassPlusIcon className="w-4 h-4 text-neutral-600" />
            </button>
          </div>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="px-4 pb-3 flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search nodes..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded border border-neutral-200 bg-neutral-50
                         focus:border-neutral-200 focus:ring-1 focus:ring-neutral-200 focus:bg-white transition-colors"
            />
          </div>

          {/* Status filter pills */}
          <div className="flex items-center gap-1">
            <FunnelIcon className="w-3.5 h-3.5 text-neutral-400 mr-1" />
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all duration-200 ${
                  statusFilter === opt.value
                    ? "bg-neutral-900 text-white shadow-sm"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Source filter */}
          {uniqueSources.length > 0 && (
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="text-[11px] border border-neutral-200 rounded-md px-2 py-1 bg-white text-neutral-600"
            >
              <option value="">All Sources</option>
              {uniqueSources.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}

          {/* Active scope toggle */}
          <button
            onClick={() => setStatusFilter(statusFilter === "active" ? "all" : "active")}
            className={`ml-auto px-3 py-1.5 rounded-md text-[11px] font-medium transition-all duration-200 border ${
              statusFilter === "active"
                ? "bg-neutral-50 text-neutral-900 border-neutral-200"
                : "bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50"
            }`}
          >
            Active scope only
          </button>
          <button
            onClick={() => setShowDeferred(!showDeferred)}
            className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-all duration-200 border flex items-center gap-1 ${
              showDeferred
                ? "bg-neutral-700 text-white border-neutral-700"
                : "bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50"
            }`}
          >
            <ClockIcon className="w-3.5 h-3.5" />
            Deferred
          </button>
        </div>
      </div>

      {/* RISK-2.1C — Depth recommendation banner */}
      {treeStats?.depth_warning && !depthDismissed && (
        <div className="mx-4 mt-2 mb-1 px-4 py-2.5 rounded-md bg-amber-50 border border-amber-200 flex items-start gap-3">
          <ExclamationTriangleIcon className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-amber-800">Deep tree detected</p>
            <p className="text-[11px] text-amber-700 mt-0.5">
              {treeStats.depth_warning}
            </p>
            <div className="flex items-center gap-3 mt-1.5 text-[11px]">
              <span className="text-amber-600">
                {treeStats.total_nodes} nodes · {treeStats.max_depth} levels deep
              </span>
            </div>
          </div>
          <button
            onClick={() => setDepthDismissed(true)}
            className="text-amber-400 hover:text-amber-600 text-xs px-1"
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* Tree Content + optional Deferred panel */}
      <div className="flex-1 overflow-hidden flex">
        <div className="flex-1 overflow-auto p-8 bg-neutral-50/50 bg-dot-pattern">
          {filteredTree ? (
            <div
              className="inline-block min-w-full"
              style={{
                transform: `scale(${zoom / 100})`,
                transformOrigin: "top center",
                transition: "transform 0.2s ease-smooth",
              }}
            >
              <RelationshipTreeNode
                node={filteredTree}
                sessionId={sessionId}
                onToggle={toggleNode}
                onExpand={handleExpandNode}
                onNodeClick={handleNodeClick}
                onUpdate={fetchTree}
                isRoot={true}
                selectedNodeId={selectedNodeId}
                readOnly={readOnly}
                teamMembers={teamMembers}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-neutral-400">
              <FunnelIcon className="w-8 h-8 mb-2" />
              <p className="text-sm font-medium">No nodes match the current filter</p>
              <button
                onClick={() => { setStatusFilter("all"); setSearchQuery(""); setSourceFilter(""); }}
                className="mt-2 text-xs text-primary-500 hover:underline"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>

        {/* Deferred items side panel */}
        {showDeferred && (
          <div className="w-80 flex-shrink-0 border-l border-neutral-200 bg-white overflow-y-auto p-4">
            <DeferredItemsList sessionId={sessionId} onReactivated={fetchTree} />
          </div>
        )}
      </div>

      {/* Legend: types + status indicators */}
      <div className="border-t border-neutral-200/60 bg-white p-3 flex-shrink-0">
        <div className="flex items-center justify-center gap-4 text-xs flex-wrap">
          {/* Type legend */}
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-md bg-neutral-900"></div>
            <span className="text-neutral-600 font-medium">Project</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-md bg-warning-500"></div>
            <span className="text-neutral-600 font-medium">Feature</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-md bg-success-500"></div>
            <span className="text-neutral-600 font-medium">Requirement</span>
          </div>

          <div className="w-px h-4 bg-neutral-200 mx-1" />

          {/* Status legend */}
          <div className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
            <span className="text-neutral-500">New</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-neutral-500">Modified</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-neutral-400" />
            <span className="text-neutral-500">Deferred</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-neutral-500">Completed</span>
          </div>
        </div>
      </div>
    </div>
  );
}
