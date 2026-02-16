import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Session API
export const createSession = async (userType: 'technical' | 'non_technical' = 'non_technical') => {
  const response = await api.post('/api/sessions', {
    user_type: userType
  });
  return response.data;
};

// Upload API
export const uploadDocument = async (sessionId: string, file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await api.post(`/api/upload/${sessionId}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

// Questions API
export const getQuestions = async (sessionId: string) => {
  const response = await api.get(`/api/questions/${sessionId}`);
  return response.data;
};

export const submitAnswers = async (sessionId: string, answers: Array<{ question_id: string; answer_text: string }>) => {
  const response = await api.post('/api/questions/submit', {
    session_id: sessionId,
    answers,
  });
  return response.data;
};

// Tree API
export const getTree = async (sessionId: string) => {
  const response = await api.get(`/api/tree/${sessionId}`);
  return response.data;
};

// Chat API
export const startChat = async (sessionId: string, nodeId: string) => {
  const response = await api.post('/api/chat/start', {
    session_id: sessionId,
    node_id: nodeId,
  });
  return response.data;
};

export const sendMessage = async (conversationId: string, message: string) => {
  const response = await api.post('/api/chat/message', {
    conversation_id: conversationId,
    message,
  });
  return response.data;
};

export const confirmChat = async (conversationId: string) => {
  const response = await api.post('/api/chat/confirm', {
    conversation_id: conversationId,
  });
  return response.data;
};

// Health Check
export const healthCheck = async () => {
  const response = await api.get('/health');
  return response.data;
};

// ===== Transcription API =====

export const transcribeAudio = async (audioFile: File, language?: string) => {
  const formData = new FormData();
  formData.append('audio_file', audioFile);
  if (language) {
    formData.append('language', language);
  }
  
  const response = await api.post('/api/transcription/transcribe', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

// ===== Question Management API =====

export const addQuestion = async (sessionId: string, questionText: string, category?: string) => {
  const response = await api.post(`/api/manage/questions/${sessionId}/add`, {
    question_text: questionText,
    category: category || 'custom',
  });
  return response.data;
};

export const deleteQuestion = async (questionId: string) => {
  const response = await api.delete(`/api/manage/questions/${questionId}`);
  return response.data;
};

export const updateQuestion = async (
  questionId: string,
  updates: {
    question_text?: string;
    answer_text?: string;
    category?: string;
  }
) => {
  const response = await api.patch(`/api/manage/questions/${questionId}`, updates);
  return response.data;
};

export const listQuestions = async (sessionId: string) => {
  const response = await api.get(`/api/manage/questions/${sessionId}/list`);
  return response.data;
};

// ===== Node Management API =====

export const addNode = async (nodeData: {
  session_id: string;
  parent_id?: string;
  question: string;
  answer?: string;
  node_type?: string;
  metadata?: Record<string, any>;
}) => {
  const response = await api.post('/api/manage/nodes/add', nodeData);
  return response.data;
};

export const deleteNode = async (nodeId: string, cascade: boolean = true) => {
  const response = await api.delete(`/api/manage/nodes/${nodeId}?cascade=${cascade}`);
  return response.data;
};

export const updateNode = async (
  nodeId: string,
  updates: {
    question?: string;
    answer?: string;
    node_type?: string;
    metadata?: Record<string, any>;
  }
) => {
  const response = await api.patch(`/api/manage/nodes/${nodeId}`, updates);
  return response.data;
};

export const moveNode = async (nodeId: string, newParentId?: string) => {
  const url = newParentId
    ? `/api/manage/nodes/${nodeId}/move?new_parent_id=${newParentId}`
    : `/api/manage/nodes/${nodeId}/move`;
  const response = await api.post(url);
  return response.data;
};


// ===== Source Ingestion API (Phase 1) =====

export const ingestSource = async (data: {
  session_id: string;
  source_type: string;
  source_format?: string;
  source_name: string;
  raw_content: string;
  meeting_type?: string;
  source_metadata?: Record<string, any>;
}) => {
  const response = await api.post('/api/sources/ingest', data);
  return response.data;
};

export const uploadSourceFile = async (formData: FormData) => {
  const response = await api.post('/api/sources/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const listSources = async (sessionId: string) => {
  const response = await api.get(`/api/sources/${sessionId}`);
  return response.data;
};

export const getSourceDetail = async (sourceId: string) => {
  const response = await api.get(`/api/sources/detail/${sourceId}`);
  return response.data;
};

export const applySuggestions = async (decisions: Array<{
  suggestion_id: string;
  is_approved: boolean;
  edited_title?: string;
  edited_description?: string;
  reviewer_note?: string;
}>) => {
  const response = await api.post('/api/sources/apply', { decisions });
  return response.data;
};

export const getSourceSuggestions = async (sourceId: string) => {
  const response = await api.get(`/api/sources/${sourceId}/suggestions`);
  return response.data;
};

export const deleteSource = async (sourceId: string) => {
  const response = await api.delete(`/api/sources/${sourceId}`);
  return response.data;
};

export const reanalyzeSource = async (sourceId: string) => {
  const response = await api.post(`/api/sources/${sourceId}/reanalyze`);
  return response.data;
};


// ===== Node Status & Audit API (Phase 2 & 3) =====

export const updateNodeStatus = async (
  nodeId: string,
  status: string,
  reason?: string,
  cascade: boolean = false
) => {
  const response = await api.patch(
    `/api/nodes/${nodeId}/status?cascade=${cascade}`,
    { status, reason }
  );
  return response.data;
};

export const getFilteredNodes = async (
  sessionId: string,
  filters?: {
    status?: string;
    nodeType?: string;
    dateFrom?: string;
    dateTo?: string;
    sourceId?: string;
    search?: string;
  }
) => {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.nodeType) params.append('node_type', filters.nodeType);
  if (filters?.dateFrom) params.append('date_from', filters.dateFrom);
  if (filters?.dateTo) params.append('date_to', filters.dateTo);
  if (filters?.sourceId) params.append('source_id', filters.sourceId);
  if (filters?.search) params.append('search', filters.search);
  const queryString = params.toString();
  const url = `/api/nodes/${sessionId}/filter${queryString ? '?' + queryString : ''}`;
  const response = await api.get(url);
  return response.data;
};

export const bulkUpdateNodeStatus = async (
  nodeIds: string[],
  status: string,
  reason?: string
) => {
  const response = await api.patch('/api/nodes/bulk-status', {
    node_ids: nodeIds,
    status,
    reason,
  });
  return response.data;
};

export const getNodeHistory = async (nodeId: string) => {
  const response = await api.get(`/api/nodes/${nodeId}/history`);
  return response.data;
};

export const getAuditLog = async (
  sessionId: string,
  options?: { dateFrom?: string; dateTo?: string; changeType?: string; limit?: number; offset?: number }
) => {
  const params = new URLSearchParams();
  if (options?.dateFrom) params.append('date_from', options.dateFrom);
  if (options?.dateTo) params.append('date_to', options.dateTo);
  if (options?.changeType) params.append('change_type', options.changeType);
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.offset) params.append('offset', options.offset.toString());
  const queryString = params.toString();
  const response = await api.get(`/api/audit/${sessionId}${queryString ? '?' + queryString : ''}`);
  return response.data;
};

export const getAuditTimeline = async (sessionId: string, days: number = 7, changedBy?: string) => {
  const params = new URLSearchParams({ days: days.toString() });
  if (changedBy) params.append('changed_by', changedBy);
  const response = await api.get(`/api/audit/${sessionId}/timeline?${params.toString()}`);
  return response.data;
};


// ===== Time-Travel API (Phase 3) =====

export const getGraphStateAt = async (sessionId: string, asOfDate: string) => {
  const params = new URLSearchParams({
    session_id: sessionId,
    as_of_date: asOfDate,
  });
  const response = await api.get(`/api/audit/graph-state?${params.toString()}`);
  return response.data;
};

export const compareGraphStates = async (
  sessionId: string,
  dateFrom: string,
  dateTo: string
) => {
  const params = new URLSearchParams({
    session_id: sessionId,
    date_from: dateFrom,
    date_to: dateTo,
  });
  const response = await api.get(`/api/audit/compare?${params.toString()}`);
  return response.data;
};

// ===== Audit Extras (Phase 3 additions) =====

export const getSessionUsers = async (sessionId: string) => {
  const response = await api.get(`/api/audit/${sessionId}/users`);
  return response.data;
};

export const revertNode = async (nodeId: string, historyEntryId: string) => {
  const response = await api.post(`/api/nodes/${nodeId}/revert`, {
    history_entry_id: historyEntryId,
  });
  return response.data;
};

export const compareNodeVersions = async (
  nodeId: string,
  entryIdA: string,
  entryIdB: string
) => {
  const response = await api.post(`/api/nodes/${nodeId}/compare-versions`, {
    entry_id_a: entryIdA,
    entry_id_b: entryIdB,
  });
  return response.data;
};

export const exportAuditReport = async (
  sessionId: string,
  dateFrom?: string,
  dateTo?: string
) => {
  const params = new URLSearchParams();
  if (dateFrom) params.append('date_from', dateFrom);
  if (dateTo) params.append('date_to', dateTo);
  const queryString = params.toString();
  const response = await api.post(
    `/api/audit/${sessionId}/export${queryString ? '?' + queryString : ''}`,
    {},
    { responseType: 'blob' }
  );
  return response.data;
};


// ===== Planning Board API (Phase 4) =====

export const getPlanningBoard = async (sessionId: string, assigneeFilter?: string) => {
  const params = assigneeFilter ? `?assignee=${assigneeFilter}` : '';
  const response = await api.get(`/api/planning/${sessionId}${params}`);
  return response.data;
};

export const createCard = async (data: {
  node_id?: string;
  session_id: string;
  priority?: string;
  due_date?: string;
  title?: string;
  description?: string;
  is_out_of_scope?: boolean;
  estimated_hours?: number;
}) => {
  const response = await api.post('/api/planning/cards', data);
  return response.data;
};

export const bulkCreateCards = async (data: {
  session_id: string;
  node_types?: string[];
  include_details?: boolean;
}) => {
  const response = await api.post('/api/planning/cards/bulk', data);
  return response.data;
};

export const updateCard = async (cardId: string, updates: {
  status?: string;
  priority?: string;
  due_date?: string;
  estimated_hours?: number;
  actual_hours?: number;
  title?: string;
  description?: string;
}) => {
  const response = await api.patch(`/api/planning/cards/${cardId}`, updates);
  return response.data;
};

export const assignCard = async (cardId: string, teamMemberId: string, role: string = 'assignee') => {
  const response = await api.post(`/api/planning/cards/${cardId}/assign`, {
    team_member_id: teamMemberId,
    role,
  });
  return response.data;
};

export const removeCardAssignment = async (cardId: string, teamMemberId: string) => {
  const response = await api.delete(`/api/planning/cards/${cardId}/assign/${teamMemberId}`);
  return response.data;
};

export const deleteCard = async (cardId: string) => {
  const response = await api.delete(`/api/planning/cards/${cardId}`);
  return response.data;
};

// ---- Acceptance Criteria ----

export const addAcceptanceCriterion = async (cardId: string, data: { description: string; node_id?: string }) => {
  const response = await api.post(`/api/planning/cards/${cardId}/ac`, data);
  return response.data;
};

export const updateAcceptanceCriterion = async (criterionId: string, data: { description?: string; is_completed?: boolean }) => {
  const response = await api.patch(`/api/planning/ac/${criterionId}`, data);
  return response.data;
};

export const deleteAcceptanceCriterion = async (criterionId: string) => {
  const response = await api.delete(`/api/planning/ac/${criterionId}`);
  return response.data;
};

// ---- Comments ----

export const addCardComment = async (cardId: string, content: string) => {
  const response = await api.post(`/api/planning/cards/${cardId}/comments`, { content });
  return response.data;
};

export const getCardComments = async (cardId: string) => {
  const response = await api.get(`/api/planning/cards/${cardId}/comments`);
  return response.data;
};

// ---- Workload ----

export const getWorkload = async (sessionId: string) => {
  const response = await api.get(`/api/planning/workload/${sessionId}`);
  return response.data;
};

// ---- Out of Scope ----

export const addOutOfScopeToGraph = async (cardId: string, parentNodeId: string) => {
  const response = await api.post(`/api/planning/cards/${cardId}/add-to-graph?parent_node_id=${parentNodeId}`);
  return response.data;
};

// ---- Team ----

export const getTeamMembers = async (sessionId: string) => {
  const response = await api.get(`/api/planning/team/${sessionId}`);
  return response.data;
};

export const addTeamMember = async (sessionId: string, data: {
  name: string;
  email?: string;
  role?: string;
}) => {
  const response = await api.post(`/api/planning/team?session_id=${sessionId}`, data);
  return response.data;
};

export const deleteTeamMember = async (teamMemberId: string) => {
  const response = await api.delete(`/api/planning/team/${teamMemberId}`);
  return response.data;
};


// ===== Export API (Phase 6) =====

export interface ExportOptions {
  session_id: string;
  include_deferred?: boolean;
  include_change_log?: boolean;
  include_assignments?: boolean;
  include_sources?: boolean;
  include_completed?: boolean;
  include_conversations?: boolean;
  detail_level?: 'summary' | 'detailed' | 'full';
  date_from?: string;
}

export const exportMarkdown = async (data: ExportOptions) => {
  const response = await api.post('/api/export/markdown', { ...data, format: 'markdown' });
  return response.data;
};

export const exportJson = async (data: ExportOptions) => {
  const response = await api.post('/api/export/json', { ...data, format: 'json' });
  return response.data;
};

export const exportPdf = async (data: ExportOptions) => {
  const response = await api.post('/api/export/pdf', { ...data, format: 'pdf' }, {
    responseType: 'blob',
  });
  return response.data;
};

export const exportDeferred = async (sessionId: string) => {
  const response = await api.post('/api/export/deferred', { session_id: sessionId });
  return response.data;
};

export const exportChangelog = async (data: ExportOptions) => {
  const response = await api.post('/api/export/changelog', { ...data, format: 'markdown' });
  return response.data;
};

// ── Notifications (Mailchimp) ────────────────────────────────────────────

export const getNotificationHealth = async () => {
  const response = await api.get('/api/notifications/health');
  return response.data;
};

export const getNotificationPreferences = async (sessionId: string) => {
  const response = await api.get(`/api/notifications/${sessionId}/preferences`);
  return response.data;
};

export const updateNotificationPreferences = async (
  sessionId: string,
  updates: {
    notify_node_created?: boolean;
    notify_node_modified?: boolean;
    notify_node_deleted?: boolean;
    notify_node_moved?: boolean;
    notify_status_changed?: boolean;
    notify_source_ingested?: boolean;
    is_subscribed?: boolean;
  },
) => {
  const response = await api.patch(`/api/notifications/${sessionId}/preferences`, updates);
  return response.data;
};

export const sendTestNotification = async () => {
  const response = await api.post('/api/notifications/test');
  return response.data;
};

export default api;
