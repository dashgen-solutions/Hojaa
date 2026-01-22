"use client";

import { useState, useEffect } from "react";
import RelationshipTreeNode from "./RelationshipTreeNode";
import NodeDetailsModal from "./NodeDetailsModal";
import { DocumentTextIcon, MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon } from "@heroicons/react/24/outline";
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

export default function TreeVisualization({ sessionId, onNodeSelect, selectedNodeId }: TreeVisualizationProps) {
  const [treeData, setTreeData] = useState<TreeNodeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [selectedNodeForModal, setSelectedNodeForModal] = useState<TreeNodeData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchTree = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await getTree(sessionId);
      
      // Convert backend format to frontend format
      // Only auto-expand the root node, keep all children collapsed
      const convertNode = (node: any, depth: number = 0): TreeNodeData => ({
        id: node.id,
        question: node.question,
        answer: node.answer,
        type: node.node_type === "ROOT" ? "root" : node.node_type === "FEATURE" ? "feature" : "detail",
        depth: node.depth,
        isExpanded: depth === 0, // Only root is expanded by default
        canExpand: node.can_expand,
        children: node.children ? node.children.map((child: any) => convertNode(child, depth + 1)) : []
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
    // Don't reset zoom when expanding a node
    if (onNodeSelect) {
      onNodeSelect(nodeId);
    }
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(150, prev + 10));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(50, prev - 10));
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
    setTimeout(() => setSelectedNodeForModal(null), 300); // Clear after animation
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading relationship map...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-gray-100 p-8">
        <div className="text-center max-w-md">
          <div className="text-red-600 text-5xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Map</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!treeData) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-gray-100">
        <p className="text-gray-600">No data available</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Modal */}
      <NodeDetailsModal
        node={selectedNodeForModal}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
      
      {/* Header with Zoom Controls */}
      <div className="border-b border-gray-200 bg-white shadow-sm flex-shrink-0">
        <div className="p-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <DocumentTextIcon className="w-5 h-5 text-blue-600" />
              Requirements Map
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {selectedNodeId ? 'Chat open - Exploring feature' : 'Click + on any feature to explore'}
            </p>
          </div>
          
          {/* Zoom Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleZoomOut}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Zoom out"
            >
              <MagnifyingGlassMinusIcon className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={handleZoomReset}
              className="px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Reset zoom"
            >
              {zoom}%
            </button>
            <button
              onClick={handleZoomIn}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Zoom in"
            >
              <MagnifyingGlassPlusIcon className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Tree Content - Scrollable Canvas with WHITE background */}
      <div className="flex-1 overflow-auto p-8 bg-white">
        <div 
          className="inline-block min-w-full"
          style={{ 
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
            transition: 'transform 0.2s ease'
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
      <div className="border-t border-gray-200 bg-white p-3 shadow-lg flex-shrink-0">
        <div className="flex items-center justify-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-gradient-to-br from-blue-500 to-indigo-600"></div>
            <span className="text-gray-700 font-medium">Project</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-gradient-to-br from-amber-500 to-orange-600"></div>
            <span className="text-gray-700 font-medium">Feature</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-gradient-to-br from-emerald-500 to-teal-600"></div>
            <span className="text-gray-700 font-medium">Requirement</span>
          </div>
        </div>
      </div>
    </div>
  );
}
