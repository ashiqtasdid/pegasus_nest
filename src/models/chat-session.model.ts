export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  attachments?: {
    type: 'file' | 'image' | 'log';
    content: string;
    name: string;
  }[];
}

export interface ChatSession {
  id: string;
  pluginName: string;
  pluginPath: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'completed' | 'failed';
}
