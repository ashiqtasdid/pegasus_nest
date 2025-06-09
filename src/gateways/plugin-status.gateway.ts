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
  namespace: '/plugin-status',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['*'],
    credentials: false,
  },
})
export class PluginStatusGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(PluginStatusGateway.name);
  private connectedClients = new Set<string>();
  private pluginSubscriptions = new Map<string, Set<string>>(); // pluginId -> Set of clientIds

  async handleConnection(client: Socket) {
    this.logger.log(`Client attempting connection: ${client.id}`);
    this.logger.log(`Client handshake: "${client.handshake.headers.origin}"`);
    this.logger.log(`Client transport: ${client.conn.transport.name}`);

    this.connectedClients.add(client.id);

    this.logger.log(`🔌 Client connected successfully: ${client.id}`);
    this.logger.log(
      `📍 Namespace: /plugin-status, Total clients: ${this.connectedClients.size}`,
    );

    // Send welcome message
    client.emit('connection-established', {
      clientId: client.id,
      timestamp: new Date().toISOString(),
      message: 'Connected to Plugin Status Gateway',
    });
  }

  async handleDisconnect(client: Socket) {
    this.connectedClients.delete(client.id);

    // Remove client from all plugin subscriptions
    for (const [pluginId, clients] of this.pluginSubscriptions.entries()) {
      clients.delete(client.id);
      if (clients.size === 0) {
        this.pluginSubscriptions.delete(pluginId);
      }
    }

    this.logger.log(
      `🔌 Client disconnected: ${client.id}, Total clients: ${this.connectedClients.size}`,
    );
  }

  @SubscribeMessage('subscribe-plugin')
  handleSubscribePlugin(
    @MessageBody() data: { pluginId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { pluginId } = data;

    if (!this.pluginSubscriptions.has(pluginId)) {
      this.pluginSubscriptions.set(pluginId, new Set());
    }

    this.pluginSubscriptions.get(pluginId).add(client.id);

    this.logger.log(`📡 Client ${client.id} subscribed to plugin: ${pluginId}`);

    client.emit('subscription-confirmed', {
      pluginId,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('unsubscribe-plugin')
  handleUnsubscribePlugin(
    @MessageBody() data: { pluginId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { pluginId } = data;

    if (this.pluginSubscriptions.has(pluginId)) {
      this.pluginSubscriptions.get(pluginId).delete(client.id);

      if (this.pluginSubscriptions.get(pluginId).size === 0) {
        this.pluginSubscriptions.delete(pluginId);
      }
    }

    this.logger.log(
      `📡 Client ${client.id} unsubscribed from plugin: ${pluginId}`,
    );

    client.emit('unsubscription-confirmed', {
      pluginId,
      timestamp: new Date().toISOString(),
    });
  }

  // Method to emit plugin status updates
  emitPluginStatus(pluginId: string, status: any) {
    const subscribedClients = this.pluginSubscriptions.get(pluginId);

    if (!subscribedClients || subscribedClients.size === 0) {
      this.logger.debug(`No clients subscribed to plugin: ${pluginId}`);
      return;
    }

    const payload = {
      pluginId,
      status,
      timestamp: new Date().toISOString(),
    };

    // Emit to all subscribed clients
    subscribedClients.forEach((clientId) => {
      const client = this.server.sockets.sockets.get(clientId);
      if (client) {
        client.emit('plugin-status-update', payload);
      }
    });

    this.logger.log(
      `📤 Plugin status update sent to ${subscribedClients.size} clients for plugin: ${pluginId}`,
    );
  }

  // Method to emit compilation progress
  emitCompilationProgress(
    pluginId: string,
    progress: {
      stage: string;
      percentage: number;
      message: string;
      success?: boolean;
      error?: string;
    },
  ) {
    const subscribedClients = this.pluginSubscriptions.get(pluginId);

    if (!subscribedClients || subscribedClients.size === 0) {
      this.logger.debug(`No clients subscribed to plugin: ${pluginId}`);
      return;
    }

    const payload = {
      pluginId,
      progress,
      timestamp: new Date().toISOString(),
    };

    // Emit to all subscribed clients
    subscribedClients.forEach((clientId) => {
      const client = this.server.sockets.sockets.get(clientId);
      if (client) {
        client.emit('compilation-progress', payload);
      }
    });

    this.logger.log(
      `📤 Compilation progress sent to ${subscribedClients.size} clients for plugin: ${pluginId} - ${progress.stage}: ${progress.percentage}%`,
    );
  }

  // Method to emit validation results
  emitValidationResult(
    pluginId: string,
    validation: {
      stage: string;
      success: boolean;
      score?: number;
      message: string;
      details?: any;
    },
  ) {
    const subscribedClients = this.pluginSubscriptions.get(pluginId);

    if (!subscribedClients || subscribedClients.size === 0) {
      this.logger.debug(`No clients subscribed to plugin: ${pluginId}`);
      return;
    }

    const payload = {
      pluginId,
      validation,
      timestamp: new Date().toISOString(),
    };

    // Emit to all subscribed clients
    subscribedClients.forEach((clientId) => {
      const client = this.server.sockets.sockets.get(clientId);
      if (client) {
        client.emit('validation-result', payload);
      }
    });

    this.logger.log(
      `📤 Validation result sent to ${subscribedClients.size} clients for plugin: ${pluginId} - ${validation.stage}: ${validation.success ? 'Success' : 'Failed'}`,
    );
  }

  // Method to get connected clients count
  getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }

  // Method to get plugin subscriptions count
  getPluginSubscriptionsCount(): number {
    return this.pluginSubscriptions.size;
  }
}
