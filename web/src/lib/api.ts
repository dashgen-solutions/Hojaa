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

// ── Node Assignment (DEC-1.3) ──

export const assignNode = async (nodeId: string, teamMemberId: string) => {
  const response = await api.post(`/api/manage/nodes/${nodeId}/assign`, {
    team_member_id: teamMemberId,
  });
  return response.data;
};

export const unassignNode = async (nodeId: string) => {
  const response = await api.delete(`/api/manage/nodes/${nodeId}/assign`);
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
  dateTo?: string,
  changedBy?: string,
) => {
  const params = new URLSearchParams();
  if (dateFrom) params.append('date_from', dateFrom);
  if (dateTo) params.append('date_to', dateTo);
  if (changedBy) params.append('changed_by', changedBy);
  const queryString = params.toString();
  const response = await api.post(
    `/api/audit/${sessionId}/export${queryString ? '?' + queryString : ''}`,
    {},
    { responseType: 'blob' }
  );
  return response.data;
};

export const exportAuditReportPdf = async (
  sessionId: string,
  dateFrom?: string,
  dateTo?: string,
  changedBy?: string,
) => {
  const params = new URLSearchParams();
  if (dateFrom) params.append('date_from', dateFrom);
  if (dateTo) params.append('date_to', dateTo);
  if (changedBy) params.append('changed_by', changedBy);
  const queryString = params.toString();
  const response = await api.post(
    `/api/audit/${sessionId}/export/pdf${queryString ? '?' + queryString : ''}`,
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
  template?: 'standard' | 'executive' | 'technical';
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
  const response = await api.post('/api/export/pdf', { ...data, format: 'pdf', _t: Date.now() }, {
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
    notify_team_member_added?: boolean;
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

// ── Admin: User Management ───────────────────────────────────────────────

export const listUsers = async (search?: string, role?: string) => {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (role) params.append('role', role);
  const qs = params.toString();
  const response = await api.get(`/api/auth/users${qs ? '?' + qs : ''}`);
  return response.data;
};

export const updateUserRole = async (userId: string, role: string) => {
  const response = await api.patch(`/api/auth/users/${userId}/role`, { role });
  return response.data;
};

export const adminCreateUser = async (data: {
  email: string;
  username: string;
  password: string;
  role?: string;
  org_role?: string;
  job_title?: string;
}) => {
  const response = await api.post('/api/auth/users', data);
  return response.data;
};

export const adminDeleteUser = async (userId: string) => {
  const response = await api.delete(`/api/auth/users/${userId}`);
  return response.data;
};

export const adminToggleUserActive = async (userId: string) => {
  const response = await api.patch(`/api/auth/users/${userId}/toggle-active`);
  return response.data;
};

// ── Organization Management ──────────────────────────────────────────────

export const getOrganization = async () => {
  const response = await api.get('/api/auth/organization');
  return response.data;
};

export const updateOrganization = async (data: {
  name?: string;
  industry?: string;
  size?: string;
  website?: string;
  logo_url?: string;
  scope_approval_policy?: string;
}) => {
  const response = await api.patch('/api/auth/organization', data);
  return response.data;
};

// ── Session Access Management ────────────────────────────────────────────

export const grantSessionAccess = async (userId: string, sessionIds: string[], role: string = 'viewer') => {
  const response = await api.post(`/api/auth/users/${userId}/session-access`, {
    session_ids: sessionIds,
    role,
  });
  return response.data;
};

export const revokeSessionAccess = async (userId: string, sessionId: string) => {
  const response = await api.delete(`/api/auth/users/${userId}/session-access/${sessionId}`);
  return response.data;
};

export const getUserSessionAccess = async (userId: string) => {
  const response = await api.get(`/api/auth/users/${userId}/session-access`);
  return response.data;
};

// ── Sessions List ────────────────────────────────────────────────────────

export const listSessions = async () => {
  const response = await api.get('/api/sessions');
  return response.data;
};

export const deleteSession = async (sessionId: string) => {
  const response = await api.delete(`/api/sessions/${sessionId}`);
  return response.data;
};

export const shareSession = async (sessionId: string, email: string, role: string = 'viewer') => {
  const response = await api.post(`/api/sessions/${sessionId}/share`, { email, role });
  return response.data;
};

export const getSessionMembers = async (sessionId: string) => {
  const response = await api.get(`/api/sessions/${sessionId}/members`);
  return response.data;
};

export const revokeSessionShare = async (sessionId: string, userId: string) => {
  const response = await api.delete(`/api/sessions/${sessionId}/share/${userId}`);
  return response.data;
};

// ── Success Metrics — Platform Admin (Section 19) ────────────────────────────
// These use a SEPARATE token stored under "platform_admin_token", completely
// independent of the regular user auth flow.

const PLATFORM_TOKEN_KEY = "platform_admin_token";

export const platformAdminLogin = async (email: string, password: string) => {
  const response = await api.post('/api/metrics/login', { email, password });
  const { access_token } = response.data;
  if (typeof window !== 'undefined') {
    localStorage.setItem(PLATFORM_TOKEN_KEY, access_token);
  }
  return response.data;
};

export const platformAdminLogout = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(PLATFORM_TOKEN_KEY);
  }
};

export const getPlatformToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(PLATFORM_TOKEN_KEY);
  }
  return null;
};

/** Axios instance that uses the platform admin token */
const platformApi = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

platformApi.interceptors.request.use((config) => {
  const token = getPlatformToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const getAllMetrics = async (days: number = 30) => {
  const response = await platformApi.get(`/api/metrics/all?days=${days}`);
  return response.data;
};

export const getProductMetrics = async (days: number = 30) => {
  const response = await platformApi.get(`/api/metrics/product?days=${days}`);
  return response.data;
};

export const getSatisfactionMetrics = async () => {
  const response = await platformApi.get('/api/metrics/satisfaction');
  return response.data;
};

export const getTechnicalMetrics = async () => {
  const response = await platformApi.get('/api/metrics/technical');
  return response.data;
};

export const getMetricsTrends = async (days: number = 30) => {
  const response = await platformApi.get(`/api/metrics/trends?days=${days}`);
  return response.data;
};

// RISK-2.3C: AI usage / budget monitoring
export const getAIUsageMetrics = async (days: number = 30) => {
  const response = await platformApi.get(`/api/metrics/ai-usage?days=${days}`);
  return response.data;
};


// ═══════════════════════════════════════════════════════════
//  18.2-B: External Integrations (Jira, Slack)
// ═══════════════════════════════════════════════════════════

export const listIntegrations = async () => {
  const response = await api.get('/api/integrations');
  return response.data;
};

export const upsertIntegration = async (data: {
  integration_type: string;
  config: Record<string, string>;
  is_active?: boolean;
}) => {
  const response = await api.post('/api/integrations', data);
  return response.data;
};

export const deleteIntegration = async (integrationId: string) => {
  await api.delete(`/api/integrations/${integrationId}`);
};

export const testIntegration = async (type: string) => {
  const response = await api.post(`/api/integrations/test/${type}`);
  return response.data;
};

export const getIntegrationSyncs = async (limit: number = 50) => {
  const response = await api.get(`/api/integrations/syncs?limit=${limit}`);
  return response.data;
};

export const exportCardsToJira = async (sessionId: string, cardIds?: string[]) => {
  const response = await api.post('/api/integrations/jira/export-cards', {
    session_id: sessionId,
    card_ids: cardIds,
  });
  return response.data;
};

export const sendSlackNotification = async (text: string, sessionId?: string, channel?: string) => {
  const response = await api.post('/api/integrations/slack/notify', {
    text,
    session_id: sessionId,
    channel,
  });
  return response.data;
};


// ═══════════════════════════════════════════════════════════
//  18.2-C: White-labeling / Branding
// ═══════════════════════════════════════════════════════════

export interface BrandSettings {
  app_name: string;
  tagline?: string;
  logo_url?: string;
  favicon_url?: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  text_color: string;
  font_family: string;
  pdf_header_text?: string;
  pdf_footer_text?: string;
  email_from_name?: string;
  custom_domain?: string;
}

export const getBrandSettings = async (): Promise<BrandSettings> => {
  const response = await api.get('/api/branding');
  return response.data;
};

export const updateBrandSettings = async (data: Partial<BrandSettings>): Promise<BrandSettings> => {
  const response = await api.put('/api/branding', data);
  return response.data;
};

export const getPublicBrandSettings = async (orgSlug: string): Promise<BrandSettings> => {
  const response = await api.get(`/api/branding/public/${orgSlug}`);
  return response.data;
};


// ═══════════════════════════════════════════════════════════
//  18.2-D: Public API — API Key Management
// ═══════════════════════════════════════════════════════════

export interface APIKeyInfo {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  is_active: boolean;
  last_used_at?: string;
  request_count: number;
  expires_at?: string;
  created_at: string;
}

export const listAPIKeys = async (): Promise<APIKeyInfo[]> => {
  const response = await api.get('/api/api-keys');
  return response.data;
};

export const createAPIKey = async (data: {
  name: string;
  scopes?: string[];
  expires_at?: string;
}): Promise<{ raw_key: string; key: APIKeyInfo }> => {
  const response = await api.post('/api/api-keys', data);
  return response.data;
};

export const revokeAPIKey = async (keyId: string) => {
  await api.delete(`/api/api-keys/${keyId}`);
};


// ===== Session AI Chatbot API =====

export interface SessionChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tool_calls?: Array<{ name: string; args: Record<string, any>; result_preview?: string }>;
  created_at: string;
}

export interface SessionChatResponse {
  response: string;
  tool_calls: Array<{ name: string; args: Record<string, any>; result_preview?: string }>;
  actions_taken: Array<{ action: string; args: Record<string, any> }>;
  message_id: string;
}

export const sendSessionChatMessage = async (
  sessionId: string,
  message: string,
): Promise<SessionChatResponse> => {
  const response = await api.post('/api/session-chat/send', {
    session_id: sessionId,
    message,
  });
  return response.data;
};

export const getSessionChatHistory = async (
  sessionId: string,
  limit: number = 50,
): Promise<{ messages: SessionChatMessage[] }> => {
  const response = await api.get(`/api/session-chat/history/${sessionId}?limit=${limit}`);
  return response.data;
};

export const clearSessionChatHistory = async (sessionId: string) => {
  const response = await api.delete(`/api/session-chat/history/${sessionId}`);
  return response.data;
};


// ===== Global Messaging API ("Mini Slack") =====

export interface ChatChannelMemberInfo {
  user_id: string;
  username: string;
  email: string;
  joined_at: string;
}

export interface ChatMessagePreview {
  content: string | null;
  sender_name: string | null;
  created_at: string | null;
}

export interface ChatChannel {
  id: string;
  name: string | null;
  is_direct: boolean;
  other_user: { user_id: string; username: string } | null;
  members: ChatChannelMemberInfo[];
  member_count: number;
  last_message: ChatMessagePreview | null;
  unread_count: number;
  created_at: string;
}

export interface ChatMessageItem {
  id: string;
  channel_id: string;
  sender_id: string | null;
  sender_name: string;
  content: string;
  reference_type: string | null;
  reference_id: string | null;
  reference_name: string | null;
  is_edited: boolean;
  created_at: string;
}

export interface MessagingUser {
  id: string;
  username: string;
  email: string;
  job_title: string | null;
}

export const getChannels = async (): Promise<ChatChannel[]> => {
  const response = await api.get('/api/messaging/channels');
  return response.data;
};

export const createChannel = async (data: {
  name?: string;
  is_direct: boolean;
  member_ids: string[];
}): Promise<{ id: string; name: string | null; is_direct: boolean; already_exists?: boolean }> => {
  const response = await api.post('/api/messaging/channels', data);
  return response.data;
};

export const getChannelDetail = async (channelId: string) => {
  const response = await api.get(`/api/messaging/channels/${channelId}`);
  return response.data;
};

export const updateChannelName = async (channelId: string, name: string) => {
  const response = await api.patch(`/api/messaging/channels/${channelId}`, { name });
  return response.data;
};

export const deleteChannel = async (channelId: string) => {
  await api.delete(`/api/messaging/channels/${channelId}`);
};

export const addChannelMember = async (channelId: string, userId: string) => {
  const response = await api.post(`/api/messaging/channels/${channelId}/members`, { user_id: userId });
  return response.data;
};

export const removeChannelMember = async (channelId: string, userId: string) => {
  await api.delete(`/api/messaging/channels/${channelId}/members/${userId}`);
};

export const getChannelMessages = async (
  channelId: string,
  limit: number = 50,
  before?: string,
): Promise<ChatMessageItem[]> => {
  const params = new URLSearchParams({ limit: limit.toString() });
  if (before) params.append('before', before);
  const response = await api.get(`/api/messaging/channels/${channelId}/messages?${params.toString()}`);
  return response.data;
};

export const sendChannelMessage = async (
  channelId: string,
  data: {
    content: string;
    reference_type?: string;
    reference_id?: string;
    reference_name?: string;
  },
): Promise<ChatMessageItem> => {
  const response = await api.post(`/api/messaging/channels/${channelId}/messages`, data);
  return response.data;
};

export const editChannelMessage = async (messageId: string, content: string): Promise<ChatMessageItem> => {
  const response = await api.patch(`/api/messaging/messages/${messageId}`, { content });
  return response.data;
};

export const deleteChannelMessage = async (messageId: string) => {
  await api.delete(`/api/messaging/messages/${messageId}`);
};

export const markChannelRead = async (channelId: string) => {
  const response = await api.post(`/api/messaging/channels/${channelId}/read`);
  return response.data;
};

export const getMessagingUnreadCount = async (): Promise<{ total: number }> => {
  const response = await api.get('/api/messaging/unread');
  return response.data;
};

export const getMessagingUsers = async (): Promise<MessagingUser[]> => {
  const response = await api.get('/api/messaging/users');
  return response.data;
};


// ===== Documents API =====

export interface ScopeDocument {
  id: string;
  session_id: string;
  title: string;
  status: string;
  created_by: string | null;
  creator_name: string | null;
  template_id: string | null;
  content: unknown[];
  share_token: string | null;
  recipients_count: number;
  pricing_items_count: number;
  created_at: string;
  updated_at: string;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  thumbnail_url: string | null;
  variables: { name: string; label: string; default_value: string; source: string }[];
  is_system: boolean;
  created_at: string;
}

export interface DocumentRecipientInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  sent_at: string | null;
  viewed_at: string | null;
  completed_at: string | null;
  access_token: string | null;
}

export interface PricingLineItemInfo {
  id: string;
  document_id: string;
  name: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_percent: number;
  is_optional: boolean;
  is_selected: boolean;
  order_index: number;
  card_id: string | null;
  line_total: number;
}

export interface DocumentVersionInfo {
  id: string;
  version_number: number;
  changed_by: string | null;
  author_name: string | null;
  change_summary: string | null;
  created_at: string;
}

export interface ResolvedVariables {
  [key: string]: string;
}

export interface ScopeDataNode {
  id: string;
  question: string;
  answer: string | null;
  node_type: string;
  status: string;
  depth: number;
}

export interface ScopeDataCard {
  id: string;
  title: string;
  description: string | null;
  status: string;
  estimated_hours: number | null;
  node_id: string | null;
}

// Document CRUD

export const getProjectDocuments = async (sessionId: string): Promise<ScopeDocument[]> => {
  const response = await api.get(`/api/documents/session/${sessionId}`);
  return response.data;
};

export const createDocument = async (
  sessionId: string,
  data: { title?: string; template_id?: string }
): Promise<ScopeDocument> => {
  const response = await api.post(`/api/documents/session/${sessionId}`, data);
  return response.data;
};

export const getDocument = async (documentId: string): Promise<ScopeDocument> => {
  const response = await api.get(`/api/documents/${documentId}`);
  return response.data;
};

export const updateDocument = async (
  documentId: string,
  data: { title?: string; status?: string }
): Promise<ScopeDocument> => {
  const response = await api.patch(`/api/documents/${documentId}`, data);
  return response.data;
};

export const deleteDocument = async (documentId: string): Promise<void> => {
  await api.delete(`/api/documents/${documentId}`);
};

export const duplicateDocument = async (documentId: string): Promise<ScopeDocument> => {
  const response = await api.post(`/api/documents/${documentId}/duplicate`);
  return response.data;
};

// Content & Auto-save

export const saveDocumentContent = async (
  documentId: string,
  content: unknown[]
): Promise<{ updated_at: string }> => {
  const response = await api.put(`/api/documents/${documentId}/content`, { content });
  return response.data;
};

export const getDocumentVersions = async (documentId: string): Promise<DocumentVersionInfo[]> => {
  const response = await api.get(`/api/documents/${documentId}/versions`);
  return response.data;
};

export const createDocumentVersion = async (
  documentId: string,
  changeSummary?: string
): Promise<DocumentVersionInfo> => {
  const response = await api.post(`/api/documents/${documentId}/versions`, {
    change_summary: changeSummary,
  });
  return response.data;
};

// Variables & Scope Integration

export const resolveDocumentVariables = async (documentId: string): Promise<ResolvedVariables> => {
  const response = await api.get(`/api/documents/${documentId}/variables`);
  return response.data;
};

export const getScopeDataForDocument = async (
  sessionId: string
): Promise<{ nodes: ScopeDataNode[]; cards: ScopeDataCard[] }> => {
  const response = await api.get(`/api/documents/session/${sessionId}/scope-data`);
  return response.data;
};

// Pricing

export const getDocumentPricing = async (
  documentId: string
): Promise<{ items: PricingLineItemInfo[]; subtotal: number; total_tax: number; grand_total: number }> => {
  const response = await api.get(`/api/documents/${documentId}/pricing`);
  return response.data;
};

export const addPricingItem = async (
  documentId: string,
  data: {
    name: string;
    description?: string;
    quantity?: number;
    unit_price?: number;
    discount_percent?: number;
    tax_percent?: number;
    is_optional?: boolean;
    order_index?: number;
  }
): Promise<PricingLineItemInfo> => {
  const response = await api.post(`/api/documents/${documentId}/pricing`, data);
  return response.data;
};

export const updatePricingItem = async (
  itemId: string,
  data: Partial<{
    name: string;
    description: string;
    quantity: number;
    unit_price: number;
    discount_percent: number;
    tax_percent: number;
    is_optional: boolean;
    is_selected: boolean;
    order_index: number;
  }>
): Promise<PricingLineItemInfo> => {
  const response = await api.patch(`/api/documents/pricing/${itemId}`, data);
  return response.data;
};

export const deletePricingItem = async (itemId: string): Promise<void> => {
  await api.delete(`/api/documents/pricing/${itemId}`);
};

export const generatePricingFromCards = async (
  documentId: string,
  hourlyRate: number
): Promise<PricingLineItemInfo[]> => {
  const response = await api.post(`/api/documents/${documentId}/pricing/from-cards`, {
    hourly_rate: hourlyRate,
  });
  return response.data;
};

// Sharing & Recipients

export const shareDocument = async (
  documentId: string,
  recipients?: { name: string; email: string; role?: string }[]
): Promise<{ share_url: string; share_token: string; recipients: DocumentRecipientInfo[] }> => {
  const response = await api.post(`/api/documents/${documentId}/share`, {
    recipients: recipients || [],
  });
  return response.data;
};

export const getDocumentRecipients = async (documentId: string): Promise<DocumentRecipientInfo[]> => {
  const response = await api.get(`/api/documents/${documentId}/recipients`);
  return response.data;
};

export const sendDocument = async (documentId: string): Promise<ScopeDocument> => {
  const response = await api.post(`/api/documents/${documentId}/send`);
  return response.data;
};

// Templates

export const getDocumentTemplates = async (): Promise<DocumentTemplate[]> => {
  const response = await api.get('/api/documents/templates');
  return response.data;
};

export const saveAsTemplate = async (
  documentId: string,
  data: { name: string; description?: string; category?: string }
): Promise<DocumentTemplate> => {
  const response = await api.post('/api/documents/templates', {
    document_id: documentId,
    ...data,
  });
  return response.data;
};

export const deleteTemplate = async (templateId: string): Promise<void> => {
  await api.delete(`/api/documents/templates/${templateId}`);
};

// PDF Export

export const getDocumentPDF = async (documentId: string): Promise<Blob> => {
  const response = await api.get(`/api/documents/${documentId}/pdf`, {
    responseType: 'blob',
  });
  return response.data;
};

export default api;
