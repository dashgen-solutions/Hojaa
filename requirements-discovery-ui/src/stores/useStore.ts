import { create } from 'zustand';
import {
  listSources, ingestSource, applySuggestions, getSourceDetail,
  getPlanningBoard, createCard, bulkCreateCards, updateCard, assignCard,
  addTeamMember, getTeamMembers, deleteTeamMember, removeCardAssignment,
  getAuditLog, getAuditTimeline, getNodeHistory,
  updateNodeStatus, getFilteredNodes,
  exportMarkdown, exportJson, exportPdf,
} from '@/lib/api';

// ===== Type Definitions =====

export interface Source {
  id: string;
  session_id: string;
  source_type: string;
  source_name: string;
  is_processed: boolean;
  processed_summary: string | null;
  source_metadata: Record<string, any>;
  suggestions_count: number;
  approved_count: number;
  rejected_count: number;
  pending_count: number;
  created_at: string;
}

export interface Suggestion {
  id: string;
  source_id: string;
  change_type: string;
  target_node_id: string | null;
  parent_node_id: string | null;
  title: string;
  description: string | null;
  acceptance_criteria: string[];
  confidence: number;
  reasoning: string | null;
  source_quote: string | null;
  is_approved: boolean | null;
}

export interface TeamMember {
  id: string;
  session_id: string;
  name: string;
  email: string | null;
  role: string | null;
  avatar_color: string | null;
  created_at: string;
}

export interface CardAssignment {
  id: string;
  team_member_id: string;
  team_member_name: string;
  role: string;
  assigned_at: string;
}

export interface PlanningCard {
  id: string;
  node_id: string;
  session_id: string;
  node_title: string;
  node_description: string | null;
  node_type: string;
  status: string;
  priority: string;
  due_date: string | null;
  estimated_hours: number | null;
  assignments: CardAssignment[];
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditEntry {
  id: string;
  node_id: string;
  node_title: string;
  change_type: string;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
  change_reason: string | null;
  source_name: string | null;
  changed_by_name: string | null;
  changed_at: string;
}

export interface NodeHistoryEntry {
  id: string;
  node_id: string;
  change_type: string;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
  change_reason: string | null;
  source_name: string | null;
  changed_by_name: string | null;
  changed_at: string;
}

export interface PlanningBoard {
  session_id: string;
  columns: Record<string, PlanningCard[]>;
  team_members: TeamMember[];
  total_cards: number;
  completed_cards: number;
}

// ===== Store Interface =====

interface MoMetricStore {
  // Sources state
  sources: Source[];
  currentSourceDetail: { suggestions: Suggestion[]; [key: string]: any } | null;
  isLoadingSources: boolean;

  // Planning state
  board: PlanningBoard | null;
  teamMembers: TeamMember[];
  isLoadingBoard: boolean;

  // Audit state
  auditEntries: AuditEntry[];
  auditTotalChanges: number;
  nodeHistory: Record<string, NodeHistoryEntry[]>;
  isLoadingAudit: boolean;

  // Source actions
  fetchSources: (sessionId: string) => Promise<void>;
  submitSource: (data: {
    session_id: string;
    source_type: string;
    source_name: string;
    raw_content: string;
    source_metadata?: Record<string, any>;
  }) => Promise<any>;
  fetchSourceDetail: (sourceId: string) => Promise<void>;
  applyDecisions: (decisions: Array<{
    suggestion_id: string;
    is_approved: boolean;
    edited_title?: string;
    edited_description?: string;
  }>) => Promise<any>;

  // Node status actions
  changeNodeStatus: (nodeId: string, status: string, reason?: string, cascade?: boolean) => Promise<any>;
  fetchFilteredNodes: (sessionId: string, status?: string, nodeType?: string) => Promise<any>;

  // Planning actions
  fetchBoard: (sessionId: string) => Promise<void>;
  addCard: (data: { node_id: string; session_id: string; priority?: string }) => Promise<any>;
  bulkAddCards: (data: { session_id: string; node_types?: string[]; include_details?: boolean }) => Promise<any>;
  moveCard: (cardId: string, newStatus: string) => Promise<any>;
  assignTeamMember: (cardId: string, teamMemberId: string, role?: string) => Promise<any>;
  unassignTeamMember: (cardId: string, teamMemberId: string) => Promise<void>;
  addMember: (sessionId: string, data: { name: string; email?: string; role?: string }) => Promise<any>;
  removeMember: (teamMemberId: string) => Promise<void>;
  fetchTeamMembers: (sessionId: string) => Promise<void>;

  // Audit actions
  fetchAuditLog: (sessionId: string, options?: Record<string, any>) => Promise<void>;
  fetchTimeline: (sessionId: string, days?: number) => Promise<void>;
  fetchNodeHistory: (nodeId: string) => Promise<void>;

  // Export actions
  downloadMarkdown: (data: {
    session_id: string;
    include_deferred?: boolean;
    include_change_log?: boolean;
    include_assignments?: boolean;
  }) => Promise<string>;
  downloadJson: (data: {
    session_id: string;
    include_deferred?: boolean;
    include_change_log?: boolean;
    include_assignments?: boolean;
  }) => Promise<string>;
  downloadPdf: (data: {
    session_id: string;
    include_deferred?: boolean;
    include_change_log?: boolean;
    include_assignments?: boolean;
  }) => Promise<Blob>;
}

// ===== Store Implementation =====

export const useStore = create<MoMetricStore>((set, get) => ({
  // Initial state
  sources: [],
  currentSourceDetail: null,
  isLoadingSources: false,

  board: null,
  teamMembers: [],
  isLoadingBoard: false,

  auditEntries: [],
  auditTotalChanges: 0,
  nodeHistory: {},
  isLoadingAudit: false,

  // ===== Source Actions =====

  fetchSources: async (sessionId) => {
    set({ isLoadingSources: true });
    try {
      const data = await listSources(sessionId);
      set({ sources: data, isLoadingSources: false });
    } catch {
      set({ isLoadingSources: false });
    }
  },

  submitSource: async (data) => {
    set({ isLoadingSources: true });
    try {
      const result = await ingestSource(data);
      set({ currentSourceDetail: result, isLoadingSources: false });
      // Refresh sources list
      await get().fetchSources(data.session_id);
      return result;
    } catch (error) {
      set({ isLoadingSources: false });
      throw error;
    }
  },

  fetchSourceDetail: async (sourceId) => {
    set({ isLoadingSources: true });
    try {
      const data = await getSourceDetail(sourceId);
      set({ currentSourceDetail: data, isLoadingSources: false });
    } catch {
      set({ isLoadingSources: false });
    }
  },

  applyDecisions: async (decisions) => {
    try {
      const result = await applySuggestions(decisions);
      return result;
    } catch (error) {
      throw error;
    }
  },

  // ===== Node Status Actions =====

  changeNodeStatus: async (nodeId, status, reason, cascade = false) => {
    const result = await updateNodeStatus(nodeId, status, reason, cascade);
    return result;
  },

  fetchFilteredNodes: async (sessionId, status, nodeType) => {
    const result = await getFilteredNodes(sessionId, status, nodeType);
    return result;
  },

  // ===== Planning Actions =====

  fetchBoard: async (sessionId) => {
    set({ isLoadingBoard: true });
    try {
      const data = await getPlanningBoard(sessionId);
      set({
        board: data,
        teamMembers: data.team_members || [],
        isLoadingBoard: false,
      });
    } catch {
      set({ isLoadingBoard: false });
    }
  },

  addCard: async (data) => {
    const result = await createCard(data);
    // Refresh board
    await get().fetchBoard(data.session_id);
    return result;
  },

  bulkAddCards: async (data) => {
    const result = await bulkCreateCards(data);
    await get().fetchBoard(data.session_id);
    return result;
  },

  moveCard: async (cardId, newStatus) => {
    const result = await updateCard(cardId, { status: newStatus });
    // Refresh board if we have a session
    if (get().board?.session_id) {
      await get().fetchBoard(get().board!.session_id);
    }
    return result;
  },

  assignTeamMember: async (cardId, teamMemberId, role = 'assignee') => {
    const result = await assignCard(cardId, teamMemberId, role);
    if (get().board?.session_id) {
      await get().fetchBoard(get().board!.session_id);
    }
    return result;
  },

  unassignTeamMember: async (cardId, teamMemberId) => {
    await removeCardAssignment(cardId, teamMemberId);
    if (get().board?.session_id) {
      await get().fetchBoard(get().board!.session_id);
    }
  },

  addMember: async (sessionId, data) => {
    const result = await addTeamMember(sessionId, data);
    await get().fetchTeamMembers(sessionId);
    return result;
  },

  removeMember: async (teamMemberId) => {
    await deleteTeamMember(teamMemberId);
    if (get().board?.session_id) {
      await get().fetchTeamMembers(get().board!.session_id);
    }
  },

  fetchTeamMembers: async (sessionId) => {
    const members = await getTeamMembers(sessionId);
    set({ teamMembers: members });
  },

  // ===== Audit Actions =====

  fetchAuditLog: async (sessionId, options) => {
    set({ isLoadingAudit: true });
    try {
      const data = await getAuditLog(sessionId, options);
      set({
        auditEntries: data.entries || [],
        auditTotalChanges: data.total_changes || 0,
        isLoadingAudit: false,
      });
    } catch {
      set({ isLoadingAudit: false });
    }
  },

  fetchTimeline: async (sessionId, days = 7) => {
    set({ isLoadingAudit: true });
    try {
      const data = await getAuditTimeline(sessionId, days);
      set({
        auditEntries: data.entries || [],
        auditTotalChanges: data.total_changes || 0,
        isLoadingAudit: false,
      });
    } catch {
      set({ isLoadingAudit: false });
    }
  },

  fetchNodeHistory: async (nodeId) => {
    try {
      const data = await getNodeHistory(nodeId);
      set((state) => ({
        nodeHistory: {
          ...state.nodeHistory,
          [nodeId]: data.history || [],
        },
      }));
    } catch {
      // silent fail
    }
  },

  // ===== Export Actions =====

  downloadMarkdown: async (data) => {
    const result = await exportMarkdown(data);
    return result.content;
  },

  downloadJson: async (data) => {
    const result = await exportJson(data);
    return result.content;
  },

  downloadPdf: async (data) => {
    const blob = await exportPdf(data);
    return blob;
  },
}));
