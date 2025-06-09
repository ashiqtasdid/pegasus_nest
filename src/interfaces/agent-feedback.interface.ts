// Real-time agent feedback interface
export interface AgentProgressEvent {
  sessionId: string;
  userId?: string;
  phase:
    | 'analysis'
    | 'optimization'
    | 'generation'
    | 'quality'
    | 'compilation'
    | 'assessment';
  step: string;
  progress: number; // 0-100
  message: string;
  agentId?: string;
  estimatedTimeRemaining?: number;
  details?: any;
  timestamp: Date;
}

export interface AgentTaskEvent {
  sessionId: string;
  userId?: string;
  taskId: string;
  type: 'creation' | 'validation' | 'compilation' | 'optimization' | 'repair';
  action: string;
  status: 'started' | 'progress' | 'completed' | 'failed' | 'retrying';
  agentId: string;
  progress?: number;
  message?: string;
  error?: string;
  result?: any;
  timestamp: Date;
}

export interface AgentFeedbackSession {
  sessionId: string;
  pluginName: string;
  userId: string;
  startTime: Date;
  currentPhase: string;
  overallProgress: number;
  phases: {
    [phase: string]: {
      status: 'pending' | 'active' | 'completed' | 'failed';
      progress: number;
      startTime?: Date;
      endTime?: Date;
      tasks: AgentTaskEvent[];
    };
  };
  estimatedCompletion: Date;
  qualityScore?: number;
  agents: {
    id: string;
    name: string;
    currentTask?: string;
    tasksCompleted: number;
    performance: number;
  }[];
}

export interface AgentFeedbackClient {
  userId: string;
  sessionId: string;
  socketId: string;
  subscribedTo: string[];
}
