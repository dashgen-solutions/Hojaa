"use client";

import { useState, useEffect } from "react";
import RelationshipTreeNode from "./RelationshipTreeNode";
import NodeDetailsModal from "./NodeDetailsModal";
import {
  DocumentTextIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  ArrowPathIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { getTree } from "@/lib/api";

interface TreeNodeData {
  id: string;
  question: string;
  answer?: string;
  node_type?: string;
  type?: "root" | "feature" | "detail";
  depth: number;
  children?: TreeNodeData[];
  isExpanded?: boolean;
  is_expanded?: boolean;
  canExpand?: boolean;
  can_expand?: boolean;
  order_index?: number;
}

interface TreeVisualizationProps {
  sessionId: string;
  onNodeSelect?: (nodeId: string) => void;
  selectedNodeId?: string | null;
}

export default function TreeVisualization({
  sessionId,
  onNodeSelect,
  selectedNodeId,
}: TreeVisualizationProps) {
  const [treeData, setTreeData] = useState<TreeNodeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [selectedNodeForModal, setSelectedNodeForModal] =
    useState<TreeNodeData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchTree = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await getTree(sessionId);

      const convertNode = (node: any, depth: number = 0): TreeNodeData => ({
        id: node.id,
        question: node.question,
        answer: node.answer,
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
    }
  }, [sessionId]);

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

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-neutral-50">
        <div className="text-center animate-fade-in">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-neutral-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
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
          <div className="w-16 h-16 rounded-2xl bg-danger-100 flex items-center justify-center mx-auto mb-4">
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
        <p className="text-neutral-500">No data available</p>
      </div>
    );
  }

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
              <div className="w-8 h-8 rounded-xl bg-primary-100 flex items-center justify-center">
                <DocumentTextIcon className="w-4 h-4 text-primary-600" />
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
          <div className="flex items-center gap-1 bg-neutral-100 rounded-xl p-1">
            <button
              onClick={handleZoomOut}
              className="p-2 hover:bg-white rounded-lg transition-all duration-200 hover:shadow-soft-sm"
              title="Zoom out"
            >
              <MagnifyingGlassMinusIcon className="w-4 h-4 text-neutral-600" />
            </button>
            <button
              onClick={handleZoomReset}
              className="px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-white rounded-lg transition-all duration-200 min-w-[52px] hover:shadow-soft-sm"
              title="Reset zoom"
            >
              {zoom}%
            </button>
            <button
              onClick={handleZoomIn}
              className="p-2 hover:bg-white rounded-lg transition-all duration-200 hover:shadow-soft-sm"
              title="Zoom in"
            >
              <MagnifyingGlassPlusIcon className="w-4 h-4 text-neutral-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Tree Content */}
      <div className="flex-1 overflow-auto p-8 bg-neutral-50/50">
        <div
          className="inline-block min-w-full"
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: "top center",
            transition: "transform 0.2s ease-smooth",
          }}
        >
          <RelationshipTreeNode
            node={treeData}
            sessionId={sessionId}
            onToggle={toggleNode}
            onExpand={handleExpandNode}
            onNodeClick={handleNodeClick}
            onUpdate={fetchTree}
            isRoot={true}
            selectedNodeId={selectedNodeId}
          />
        </div>
      </div>

      {/* Legend */}
      <div className="border-t border-neutral-200/60 bg-white p-3 flex-shrink-0">
        <div className="flex items-center justify-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-md bg-gradient-to-br from-primary-500 to-primary-600"></div>
            <span className="text-neutral-600 font-medium">Project</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-md bg-gradient-to-br from-warning-500 to-warning-600"></div>
            <span className="text-neutral-600 font-medium">Feature</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-md bg-gradient-to-br from-success-500 to-success-600"></div>
            <span className="text-neutral-600 font-medium">Requirement</span>
          </div>
        </div>
      </div>
    </div>
  );
}
