import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: '/agent-feedback',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['*'],
    credentials: false,
  },
})
export class AgentFeedbackGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AgentFeedbackGateway.name);
  private connectedClients = new Set<string>();
  private sessionSubscriptions = new Map<string, Set<string>>(); // sessionId -> Set of clientIds

  async handleConnection(client: Socket) {
    this.logger.log(`Client attempting connection: ${client.id}`);
    this.logger.log(`Client handshake: "${client.handshake.headers.origin}"`);
    this.logger.log(`Client transport: ${client.conn.transport.name}`);

    this.connectedClients.add(client.id);

    this.logger.log(`🔌 Client connected successfully: ${client.id}`);
    this.logger.log(
      `📍 Namespace: /agent-feedback, Total clients: ${this.connectedClients.size}`,
    );

    // Send welcome message
    client.emit('connection-established', {
      clientId: client.id,
      timestamp: new Date().toISOString(),
      message: 'Connected to Agent Feedback Gateway',
    });
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    this.connectedClients.delete(client.id);

    // Remove client from all session subscriptions
    for (const [sessionId, clients] of this.sessionSubscriptions.entries()) {
      if (clients.has(client.id)) {
        clients.delete(client.id);
        if (clients.size === 0) {
          this.sessionSubscriptions.delete(sessionId);
        }
      }
    }

    this.logger.log(
      `📍 Total clients remaining: ${this.connectedClients.size}`,
    );
  }

  @SubscribeMessage('subscribe-session')
  handleSessionSubscription(
    @MessageBody() data: { sessionId: string; userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { sessionId, userId } = data;

    this.logger.log(
      `📋 Client ${client.id} subscribing to session: ${sessionId} (user: ${userId})`,
    );

    if (!this.sessionSubscriptions.has(sessionId)) {
      this.sessionSubscriptions.set(sessionId, new Set());
    }

    this.sessionSubscriptions.get(sessionId).add(client.id);

    // Confirm subscription
    client.emit('session-subscribed', {
      sessionId,
      userId,
      timestamp: new Date().toISOString(),
      message: `Subscribed to session ${sessionId}`,
    });

    this.logger.log(
      `📊 Session ${sessionId} now has ${this.sessionSubscriptions.get(sessionId).size} subscribers`,
    );
  }

  @SubscribeMessage('unsubscribe-session')
  handleSessionUnsubscription(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { sessionId } = data;

    if (this.sessionSubscriptions.has(sessionId)) {
      this.sessionSubscriptions.get(sessionId).delete(client.id);

      if (this.sessionSubscriptions.get(sessionId).size === 0) {
        this.sessionSubscriptions.delete(sessionId);
      }
    }

    client.emit('session-unsubscribed', {
      sessionId,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(
      `📋 Client ${client.id} unsubscribed from session: ${sessionId}`,
    );
  }

  @SubscribeMessage('test-event')
  handleTestEvent(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    this.logger.log(`🧪 Test event received from ${client.id}:`, data);

    client.emit('test-response', {
      received: data,
      timestamp: new Date().toISOString(),
      message: 'Test event processed successfully',
    });
  }

  /**
   * Broadcast progress update to all clients subscribed to a session
   */
  broadcastProgress(sessionId: string, progressData: any) {
    const subscribers = this.sessionSubscriptions.get(sessionId);

    if (!subscribers || subscribers.size === 0) {
      this.logger.warn(
        `📊 No subscribers for session ${sessionId} to receive progress update`,
      );
      return;
    }

    const eventData = {
      sessionId,
      timestamp: new Date().toISOString(),
      ...progressData,
    };

    subscribers.forEach((clientId) => {
      const clientSocket = this.server.to(clientId);
      if (clientSocket) {
        clientSocket.emit('agent-progress', eventData);
      }
    });

    this.logger.log(
      `📊 Progress broadcasted to ${subscribers.size} clients for session ${sessionId}`,
    );
  }

  /**
   * Broadcast task update to all clients subscribed to a session
   */
  broadcastTaskUpdate(sessionId: string, taskData: any) {
    const subscribers = this.sessionSubscriptions.get(sessionId);

    if (!subscribers || subscribers.size === 0) {
      this.logger.warn(
        `🔧 No subscribers for session ${sessionId} to receive task update`,
      );
      return;
    }

    const eventData = {
      sessionId,
      timestamp: new Date().toISOString(),
      ...taskData,
    };

    subscribers.forEach((clientId) => {
      const clientSocket = this.server.to(clientId);
      if (clientSocket) {
        clientSocket.emit('agent-task', eventData);
      }
    });

    this.logger.log(
      `🔧 Task update broadcasted to ${subscribers.size} clients for session ${sessionId}`,
    );
  }

  /**
   * Broadcast error to all clients subscribed to a session
   */
  broadcastError(sessionId: string, errorData: any) {
    const subscribers = this.sessionSubscriptions.get(sessionId);

    if (!subscribers || subscribers.size === 0) {
      this.logger.warn(
        `❌ No subscribers for session ${sessionId} to receive error`,
      );
      return;
    }

    const eventData = {
      sessionId,
      timestamp: new Date().toISOString(),
      ...errorData,
    };

    subscribers.forEach((clientId) => {
      const clientSocket = this.server.to(clientId);
      if (clientSocket) {
        clientSocket.emit('agent-error', eventData);
      }
    });

    this.logger.error(
      `❌ Error broadcasted to ${subscribers.size} clients for session ${sessionId}:`,
      errorData,
    );
  }

  /**
   * Broadcast completion to all clients subscribed to a session
   */
  broadcastCompletion(sessionId: string, completionData: any) {
    const subscribers = this.sessionSubscriptions.get(sessionId);

    if (!subscribers || subscribers.size === 0) {
      this.logger.warn(
        `✅ No subscribers for session ${sessionId} to receive completion`,
      );
      return;
    }

    const eventData = {
      sessionId,
      timestamp: new Date().toISOString(),
      ...completionData,
    };

    subscribers.forEach((clientId) => {
      const clientSocket = this.server.to(clientId);
      if (clientSocket) {
        clientSocket.emit('agent-complete', eventData);
      }
    });

    this.logger.log(
      `✅ Completion broadcasted to ${subscribers.size} clients for session ${sessionId}`,
    );
  }

  /**
   * Get the number of connected clients
   */
  getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }

  /**
   * Get the number of active sessions
   */
  getActiveSessionsCount(): number {
    return this.sessionSubscriptions.size;
  }

  /**
   * Get session statistics
   */
  getSessionStats() {
    const stats = {};
    for (const [sessionId, clients] of this.sessionSubscriptions.entries()) {
      stats[sessionId] = clients.size;
    }
    return {
      totalSessions: this.sessionSubscriptions.size,
      totalClients: this.connectedClients.size,
      sessionDetails: stats,
    };
  }
}
