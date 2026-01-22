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

export default api;
