import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { MinecraftServerService } from '../services/minecraft-server.service';
import { UserManagementService } from '../services/user-management.service';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/minecraft-status',
})
export class MinecraftStatusGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MinecraftStatusGateway.name);
  private connectedClients = new Map<
    string,
    { socket: Socket; userId?: string }
  >();

  constructor(
    private readonly minecraftServerService: MinecraftServerService,
    private readonly userManagementService: UserManagementService,
  ) {}

  async handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    this.connectedClients.set(client.id, { socket: client });

    // Send initial server status
    try {
      const servers = await this.minecraftServerService.getAllServerStatuses();
      client.emit('initial-status', servers);
    } catch (error) {
      this.logger.error('Failed to send initial status', error);
      client.emit('error', { message: 'Failed to get server status' });
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.connectedClients.delete(client.id);
  }

  @SubscribeMessage('subscribe-user')
  async handleSubscribeToUser(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; authToken?: string },
  ) {
    try {
      // Validate user access (you might want to add proper authentication here)
      const user = await this.userManagementService.getUserById(data.userId);
      if (!user) {
        client.emit('error', { message: 'User not found' });
        return;
      }

      // Update client info
      const clientInfo = this.connectedClients.get(client.id);
      if (clientInfo) {
        clientInfo.userId = data.userId;
      }

      // Join user-specific room
      client.join(`user-${data.userId}`);

      // Send user's server status
      const serverStatus = await this.minecraftServerService.getServerStatus(
        data.userId,
      );
      client.emit('user-server-status', {
        userId: data.userId,
        status: serverStatus,
      });

      this.logger.log(`Client ${client.id} subscribed to user ${data.userId}`);
    } catch (error) {
      this.logger.error(`Failed to subscribe to user: ${error.message}`);
      client.emit('error', { message: 'Failed to subscribe to user updates' });
    }
  }

  @SubscribeMessage('unsubscribe-user')
  handleUnsubscribeFromUser(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    client.leave(`user-${data.userId}`);
    const clientInfo = this.connectedClients.get(client.id);
    if (clientInfo) {
      clientInfo.userId = undefined;
    }
    this.logger.log(
      `Client ${client.id} unsubscribed from user ${data.userId}`,
    );
  }

  @SubscribeMessage('get-server-logs')
  async handleGetServerLogs(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; lines?: number },
  ) {
    try {
      const logs = await this.minecraftServerService.getServerLogs(
        data.userId,
        data.lines || 50,
      );
      client.emit('server-logs', { userId: data.userId, logs });
    } catch (error) {
      this.logger.error(`Failed to get server logs: ${error.message}`);
      client.emit('error', { message: 'Failed to get server logs' });
    }
  }

  @SubscribeMessage('execute-command')
  async handleExecuteCommand(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { userId: string; command: string; authToken?: string },
  ) {
    try {
      // Add authentication/authorization here
      const result = await this.minecraftServerService.executeCommand(
        data.userId,
        data.command,
      );
      client.emit('command-result', {
        userId: data.userId,
        command: data.command,
        result,
      });
    } catch (error) {
      this.logger.error(`Failed to execute command: ${error.message}`);
      client.emit('error', { message: 'Failed to execute command' });
    }
  }

  // Method to broadcast server status updates
  async broadcastServerStatus(userId: string, status: any) {
    this.server.to(`user-${userId}`).emit('server-status-update', {
      userId,
      status,
      timestamp: new Date().toISOString(),
    });
  }

  // Method to broadcast server events
  async broadcastServerEvent(userId: string, event: string, data: any) {
    this.server.to(`user-${userId}`).emit('server-event', {
      userId,
      event,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  // Method to broadcast log updates
  async broadcastLogUpdate(userId: string, logLine: string) {
    this.server.to(`user-${userId}`).emit('log-update', {
      userId,
      logLine,
      timestamp: new Date().toISOString(),
    });
  }

  // Method to broadcast player events
  async broadcastPlayerEvent(
    userId: string,
    playerName: string,
    event: 'join' | 'leave',
    data?: any,
  ) {
    this.server.to(`user-${userId}`).emit('player-event', {
      userId,
      playerName,
      event,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  // Method to broadcast system metrics
  async broadcastSystemMetrics(userId: string, metrics: any) {
    this.server.to(`user-${userId}`).emit('system-metrics', {
      userId,
      metrics,
      timestamp: new Date().toISOString(),
    });
  }

  // Get all connected clients for a user
  getConnectedClientsForUser(userId: string): Socket[] {
    return Array.from(this.connectedClients.values())
      .filter((client) => client.userId === userId)
      .map((client) => client.socket);
  }

  // Get total connected clients count
  getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }

  // Get users with active connections
  getActiveUsers(): string[] {
    return Array.from(
      new Set(
        Array.from(this.connectedClients.values())
          .map((client) => client.userId)
          .filter((userId) => userId),
      ),
    );
  }
}
