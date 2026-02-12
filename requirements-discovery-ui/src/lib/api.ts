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
  source_name: string;
  raw_content: string;
  source_metadata?: Record<string, any>;
}) => {
  const response = await api.post('/api/sources/ingest', data);
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
}>) => {
  const response = await api.post('/api/sources/apply', { decisions });
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
  statusFilter?: string,
  nodeTypeFilter?: string
) => {
  const params = new URLSearchParams();
  if (statusFilter) params.append('status', statusFilter);
  if (nodeTypeFilter) params.append('node_type', nodeTypeFilter);
  const queryString = params.toString();
  const url = `/api/nodes/${sessionId}/filter${queryString ? '?' + queryString : ''}`;
  const response = await api.get(url);
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

export const getAuditTimeline = async (sessionId: string, days: number = 7) => {
  const response = await api.get(`/api/audit/${sessionId}/timeline?days=${days}`);
  return response.data;
};


// ===== Planning Board API (Phase 4) =====

export const getPlanningBoard = async (sessionId: string) => {
  const response = await api.get(`/api/planning/${sessionId}`);
  return response.data;
};

export const createCard = async (data: {
  node_id: string;
  session_id: string;
  priority?: string;
  due_date?: string;
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


// ===== Export API (Phase 5) =====

export const exportMarkdown = async (data: {
  session_id: string;
  include_deferred?: boolean;
  include_change_log?: boolean;
  include_assignments?: boolean;
}) => {
  const response = await api.post('/api/export/markdown', { ...data, format: 'markdown' });
  return response.data;
};

export const exportJson = async (data: {
  session_id: string;
  include_deferred?: boolean;
  include_change_log?: boolean;
  include_assignments?: boolean;
}) => {
  const response = await api.post('/api/export/json', { ...data, format: 'json' });
  return response.data;
};

export const exportPdf = async (data: {
  session_id: string;
  include_deferred?: boolean;
  include_change_log?: boolean;
  include_assignments?: boolean;
}) => {
  const response = await api.post('/api/export/pdf', { ...data, format: 'pdf' }, {
    responseType: 'blob',
  });
  return response.data;
};

export default api;
