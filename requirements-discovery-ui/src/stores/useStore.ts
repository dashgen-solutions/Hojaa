import { create } from 'zustand';
import {
  listSources, ingestSource, uploadSourceFile, applySuggestions, getSourceDetail,
  deleteSource as apiDeleteSource, getSourceSuggestions, reanalyzeSource as apiReanalyzeSource,
  getPlanningBoard, createCard, bulkCreateCards, updateCard, assignCard,
  addTeamMember, getTeamMembers, deleteTeamMember, removeCardAssignment, deleteCard,
  addAcceptanceCriterion, updateAcceptanceCriterion, deleteAcceptanceCriterion,
  addCardComment, getCardComments, getWorkload, addOutOfScopeToGraph,
  getAuditLog, getAuditTimeline, getNodeHistory,
  getGraphStateAt, compareGraphStates, getSessionUsers,
  revertNode as apiRevertNode, compareNodeVersions as apiCompareNodeVersions,
  exportAuditReport as apiExportAuditReport,
  updateNodeStatus, getFilteredNodes, bulkUpdateNodeStatus,
  exportMarkdown, exportJson, exportPdf,
  getNotificationPreferences, updateNotificationPreferences as apiUpdateNotificationPreferences,
  getNotificationHealth, sendTestNotification as apiSendTestNotification,
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
  reviewer_note: string | null;
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

export interface AcceptanceCriterionItem {
  id: string;
  card_id: string;
  node_id: string | null;
  description: string;
  is_completed: boolean;
  completed_at: string | null;
  order_index: number;
}

export interface CardCommentItem {
  id: string;
  card_id: string;
  author_name: string | null;
  content: string;
  created_at: string;
}

export interface WorkloadEntry {
  team_member_id: string;
  team_member_name: string;
  role: string | null;
  total_cards: number;
  completed_cards: number;
  in_progress_cards: number;
  estimated_hours: number;
  actual_hours: number;
  progress_percentage: number;
}

export interface PlanningCard {
  id: string;
  node_id: string | null;
  session_id: string;
  node_title: string;
  node_description: string | null;
  node_type: string;
  node_status: string | null;
  title: string | null;
  description: string | null;
  status: string;
  priority: string;
  is_out_of_scope: boolean;
  due_date: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  assignments: CardAssignment[];
  acceptance_criteria: AcceptanceCriterionItem[];
  comments: CardCommentItem[];
  ac_total: number;
  ac_completed: number;
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
  source_id: string | null;
  source_name: string | null;
  changed_by: string | null;
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

export interface NotificationPreferences {
  notify_node_created: boolean;
  notify_node_modified: boolean;
  notify_node_deleted: boolean;
  notify_node_moved: boolean;
  notify_status_changed: boolean;
  notify_source_ingested: boolean;
  is_subscribed: boolean;
}

export interface PlanningBoard {
  session_id: string;
  columns: Record<string, PlanningCard[]>;
  team_members: TeamMember[];
  total_cards: number;
  completed_cards: number;
  progress_percentage: number;
}

// ===== Time-Travel Types =====

export interface GraphSnapshotNode {
  id: string;
  parent_id: string | null;
  title: string;
  description: string | null;
  node_type: string;
  status: string;
  depth: number;
  created_at: string;
}

export interface GraphSnapshot {
  session_id: string;
  as_of_date: string;
  total_nodes: number;
  status_counts: Record<string, number>;
  nodes: GraphSnapshotNode[];
}

export interface ComparisonChangeEntry {
  node_id: string;
  title: string;
  change_type?: string;
  node_type?: string;
  status?: string;
  field_changed?: string;
  old_value?: string | null;
  new_value?: string | null;
  reason?: string | null;
  changed_at?: string;
  created_at?: string;
  parent_id?: string | null;
}

export interface GraphComparison {
  session_id: string;
  date_from: string;
  date_to: string;
  summary: {
    added_count: number;
    removed_count: number;
    modified_count: number;
    deferred_count: number;
    status_changes_count: number;
    total_changes: number;
  };
  added: ComparisonChangeEntry[];
  removed: ComparisonChangeEntry[];
  modified: ComparisonChangeEntry[];
  deferred: ComparisonChangeEntry[];
  status_changes: ComparisonChangeEntry[];
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
  sessionUsers: { id: string; username: string }[];
  isLoadingAudit: boolean;

  // Notification state
  notificationPreferences: NotificationPreferences | null;
  notificationHealth: { enabled: boolean; status: string } | null;
  isLoadingNotifications: boolean;

  // Time-travel state
  graphSnapshot: GraphSnapshot | null;
  graphComparison: GraphComparison | null;
  isLoadingTimeTravel: boolean;

  // Source actions
  fetchSources: (sessionId: string) => Promise<void>;
  submitSource: (data: {
    session_id: string;
    source_type: string;
    source_format?: string;
    source_name: string;
    raw_content: string;
    meeting_type?: string;
    source_metadata?: Record<string, any>;
  }) => Promise<any>;
  uploadSourceFile: (formData: FormData, sessionId: string) => Promise<any>;
  fetchSourceDetail: (sourceId: string) => Promise<void>;
  applyDecisions: (decisions: Array<{
    suggestion_id: string;
    is_approved: boolean;
    edited_title?: string;
    edited_description?: string;
    reviewer_note?: string;
  }>) => Promise<any>;

  // Source delete & re-analyze
  deleteSource: (sourceId: string, sessionId: string) => Promise<void>;
  reanalyzeSource: (sourceId: string, sessionId: string) => Promise<any>;

  // Node status actions
  changeNodeStatus: (nodeId: string, status: string, reason?: string, cascade?: boolean) => Promise<any>;
  bulkChangeNodeStatus: (nodeIds: string[], status: string, reason?: string) => Promise<any>;
  fetchFilteredNodes: (sessionId: string, filters?: {
    status?: string;
    nodeType?: string;
    dateFrom?: string;
    dateTo?: string;
    sourceId?: string;
  }) => Promise<any>;

  // Planning actions
  fetchBoard: (sessionId: string, assigneeFilter?: string) => Promise<void>;
  addCard: (data: { node_id?: string; session_id: string; priority?: string; title?: string; description?: string; is_out_of_scope?: boolean; estimated_hours?: number }) => Promise<any>;
  bulkAddCards: (data: { session_id: string; node_types?: string[]; include_details?: boolean }) => Promise<any>;
  moveCard: (cardId: string, newStatus: string) => Promise<any>;
  removeCard: (cardId: string) => Promise<void>;
  updateCardDetails: (cardId: string, updates: { title?: string; description?: string; estimated_hours?: number; actual_hours?: number; priority?: string }) => Promise<any>;
  assignTeamMember: (cardId: string, teamMemberId: string, role?: string) => Promise<any>;
  unassignTeamMember: (cardId: string, teamMemberId: string) => Promise<void>;
  addMember: (sessionId: string, data: { name: string; email?: string; role?: string }) => Promise<any>;
  removeMember: (teamMemberId: string) => Promise<void>;
  fetchTeamMembers: (sessionId: string) => Promise<void>;
  // AC actions
  addAC: (cardId: string, description: string, nodeId?: string) => Promise<any>;
  toggleAC: (criterionId: string, isCompleted: boolean) => Promise<any>;
  updateAC: (criterionId: string, description: string) => Promise<any>;
  deleteAC: (criterionId: string) => Promise<any>;
  // Comment actions
  addComment: (cardId: string, content: string) => Promise<any>;
  fetchComments: (cardId: string) => Promise<CardCommentItem[]>;
  // Workload
  workload: WorkloadEntry[];
  fetchWorkload: (sessionId: string) => Promise<void>;
  // Out-of-scope
  convertOutOfScope: (cardId: string, parentNodeId: string) => Promise<any>;

  // Audit actions
  fetchAuditLog: (sessionId: string, options?: Record<string, any>) => Promise<void>;
  fetchTimeline: (sessionId: string, days?: number, changedBy?: string) => Promise<void>;
  fetchNodeHistory: (nodeId: string) => Promise<void>;
  fetchSessionUsers: (sessionId: string) => Promise<void>;
  revertNodeVersion: (nodeId: string, historyEntryId: string) => Promise<any>;
  compareVersions: (nodeId: string, entryIdA: string, entryIdB: string) => Promise<any>;
  exportAuditReport: (sessionId: string, dateFrom?: string, dateTo?: string) => Promise<Blob>;

  // Notification actions
  fetchNotificationPreferences: (sessionId: string) => Promise<void>;
  updateNotificationPreferences: (sessionId: string, updates: Partial<NotificationPreferences>) => Promise<void>;
  fetchNotificationHealth: () => Promise<void>;
  sendTestNotification: () => Promise<{ success: boolean }>;

  // Time-travel actions
  fetchGraphSnapshot: (sessionId: string, asOfDate: string) => Promise<void>;
  fetchGraphComparison: (sessionId: string, dateFrom: string, dateTo: string) => Promise<void>;
  clearTimeTravel: () => void;

  // Export actions
  downloadMarkdown: (data: {
    session_id: string;
    include_deferred?: boolean;
    include_change_log?: boolean;
    include_assignments?: boolean;
    include_sources?: boolean;
    include_completed?: boolean;
    include_conversations?: boolean;
    detail_level?: 'summary' | 'detailed' | 'full';
  }) => Promise<string>;
  downloadJson: (data: {
    session_id: string;
    include_deferred?: boolean;
    include_change_log?: boolean;
    include_assignments?: boolean;
    include_sources?: boolean;
    include_completed?: boolean;
    include_conversations?: boolean;
    detail_level?: 'summary' | 'detailed' | 'full';
  }) => Promise<string>;
  downloadPdf: (data: {
    session_id: string;
    include_deferred?: boolean;
    include_change_log?: boolean;
    include_assignments?: boolean;
    include_sources?: boolean;
    include_completed?: boolean;
    include_conversations?: boolean;
    detail_level?: 'summary' | 'detailed' | 'full';
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
  workload: [],

  auditEntries: [],
  auditTotalChanges: 0,
  nodeHistory: {},
  sessionUsers: [],
  isLoadingAudit: false,

  notificationPreferences: null,
  notificationHealth: null,
  isLoadingNotifications: false,

  graphSnapshot: null,
  graphComparison: null,
  isLoadingTimeTravel: false,

  // ===== Source Actions =====

  fetchSources: async (sessionId) => {
    set({ isLoadingSources: true });
    try {
      const data = await listSources(sessionId);
      // API returns { items, total, limit, offset } (paginated) or a plain array
      const sources = Array.isArray(data) ? data : (data.items ?? []);
      set({ sources, isLoadingSources: false });
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

  uploadSourceFile: async (formData, sessionId) => {
    set({ isLoadingSources: true });
    try {
      const result = await uploadSourceFile(formData);
      set({ currentSourceDetail: result, isLoadingSources: false });
      await get().fetchSources(sessionId);
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

  // ===== Source Delete =====

  deleteSource: async (sourceId, sessionId) => {
    await apiDeleteSource(sourceId);
    // Refresh the sources list after deletion
    await get().fetchSources(sessionId);
  },

  reanalyzeSource: async (sourceId, sessionId) => {
    set({ isLoadingSources: true });
    try {
      const result = await apiReanalyzeSource(sourceId);
      set({ currentSourceDetail: result, isLoadingSources: false });
      await get().fetchSources(sessionId);
      return result;
    } catch (error) {
      set({ isLoadingSources: false });
      throw error;
    }
  },

  // ===== Node Status Actions =====

  changeNodeStatus: async (nodeId, status, reason, cascade = false) => {
    const result = await updateNodeStatus(nodeId, status, reason, cascade);
    return result;
  },

  bulkChangeNodeStatus: async (nodeIds, status, reason) => {
    const result = await bulkUpdateNodeStatus(nodeIds, status, reason);
    return result;
  },

  fetchFilteredNodes: async (sessionId, filters) => {
    const result = await getFilteredNodes(sessionId, filters);
    return result;
  },

  // ===== Planning Actions =====

  fetchBoard: async (sessionId, assigneeFilter) => {
    set({ isLoadingBoard: true });
    try {
      const data = await getPlanningBoard(sessionId, assigneeFilter);
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
    if (get().board?.session_id) {
      await get().fetchBoard(get().board!.session_id);
    }
    return result;
  },

  removeCard: async (cardId) => {
    await deleteCard(cardId);
    if (get().board?.session_id) {
      await get().fetchBoard(get().board!.session_id);
    }
  },

  updateCardDetails: async (cardId, updates) => {
    const result = await updateCard(cardId, updates);
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

  // AC actions
  addAC: async (cardId, description, nodeId) => {
    const result = await addAcceptanceCriterion(cardId, { description, node_id: nodeId });
    if (get().board?.session_id) await get().fetchBoard(get().board!.session_id);
    return result;
  },
  toggleAC: async (criterionId, isCompleted) => {
    const result = await updateAcceptanceCriterion(criterionId, { is_completed: isCompleted });
    if (get().board?.session_id) await get().fetchBoard(get().board!.session_id);
    return result;
  },
  updateAC: async (criterionId, description) => {
    const result = await updateAcceptanceCriterion(criterionId, { description });
    if (get().board?.session_id) await get().fetchBoard(get().board!.session_id);
    return result;
  },
  deleteAC: async (criterionId) => {
    const result = await deleteAcceptanceCriterion(criterionId);
    if (get().board?.session_id) await get().fetchBoard(get().board!.session_id);
    return result;
  },

  // Comment actions
  addComment: async (cardId, content) => {
    const result = await addCardComment(cardId, content);
    if (get().board?.session_id) await get().fetchBoard(get().board!.session_id);
    return result;
  },
  fetchComments: async (cardId) => {
    return await getCardComments(cardId);
  },

  // Workload
  fetchWorkload: async (sessionId) => {
    const data = await getWorkload(sessionId);
    set({ workload: data });
  },

  // Out-of-scope
  convertOutOfScope: async (cardId, parentNodeId) => {
    const result = await addOutOfScopeToGraph(cardId, parentNodeId);
    if (get().board?.session_id) await get().fetchBoard(get().board!.session_id);
    return result;
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

  fetchTimeline: async (sessionId, days = 7, changedBy) => {
    set({ isLoadingAudit: true });
    try {
      const data = await getAuditTimeline(sessionId, days, changedBy);
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

  fetchSessionUsers: async (sessionId) => {
    try {
      const data = await getSessionUsers(sessionId);
      set({ sessionUsers: data.users || [] });
    } catch {
      // silent fail
    }
  },

  revertNodeVersion: async (nodeId, historyEntryId) => {
    const result = await apiRevertNode(nodeId, historyEntryId);
    return result;
  },

  compareVersions: async (nodeId, entryIdA, entryIdB) => {
    const result = await apiCompareNodeVersions(nodeId, entryIdA, entryIdB);
    return result;
  },

  exportAuditReport: async (sessionId, dateFrom, dateTo) => {
    const blob = await apiExportAuditReport(sessionId, dateFrom, dateTo);
    return blob;
  },

  // ===== Notification Actions =====

  fetchNotificationPreferences: async (sessionId) => {
    set({ isLoadingNotifications: true });
    try {
      const data = await getNotificationPreferences(sessionId);
      set({ notificationPreferences: data, isLoadingNotifications: false });
    } catch {
      set({ isLoadingNotifications: false });
    }
  },

  updateNotificationPreferences: async (sessionId, updates) => {
    try {
      const data = await apiUpdateNotificationPreferences(sessionId, updates);
      set({ notificationPreferences: data });
    } catch (err) {
      console.error('Failed to update notification preferences', err);
      throw err;
    }
  },

  fetchNotificationHealth: async () => {
    try {
      const data = await getNotificationHealth();
      set({ notificationHealth: data });
    } catch {
      set({ notificationHealth: { enabled: false, status: 'error' } });
    }
  },

  sendTestNotification: async () => {
    const result = await apiSendTestNotification();
    return result;
  },

  // ===== Time-Travel Actions =====

  fetchGraphSnapshot: async (sessionId, asOfDate) => {
    set({ isLoadingTimeTravel: true });
    try {
      const data = await getGraphStateAt(sessionId, asOfDate);
      set({ graphSnapshot: data, isLoadingTimeTravel: false });
    } catch {
      set({ isLoadingTimeTravel: false });
    }
  },

  fetchGraphComparison: async (sessionId, dateFrom, dateTo) => {
    set({ isLoadingTimeTravel: true });
    try {
      const data = await compareGraphStates(sessionId, dateFrom, dateTo);
      set({ graphComparison: data, isLoadingTimeTravel: false });
    } catch {
      set({ isLoadingTimeTravel: false });
    }
  },

  clearTimeTravel: () => {
    set({ graphSnapshot: null, graphComparison: null });
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
