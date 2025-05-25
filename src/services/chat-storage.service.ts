/* eslint-disable @typescript-eslint/require-await */
import { Injectable } from '@nestjs/common';
import { ChatSession, ChatMessage } from '../models/chat-session.model';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ChatStorageService {
  private readonly chatDir = path.join(process.cwd(), 'chats');

  constructor() {
    // Create chats directory if it doesn't exist
    if (!fs.existsSync(this.chatDir)) {
      fs.mkdirSync(this.chatDir, { recursive: true });
    }
  }

  async createSession(pluginName: string): Promise<ChatSession> {
    const session: ChatSession = {
      id: uuidv4(),
      pluginName,
      pluginPath: path.join(process.cwd(), 'generated', pluginName),
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'active',
    };

    await this.saveSession(session);
    return session;
  }

  async getSession(sessionId: string): Promise<ChatSession | null> {
    const sessionPath = path.join(this.chatDir, `${sessionId}.json`);
    if (!fs.existsSync(sessionPath)) {
      return null;
    }

    const data = fs.readFileSync(sessionPath, 'utf8');
    return JSON.parse(data) as ChatSession;
  }

  async saveSession(session: ChatSession): Promise<void> {
    session.updatedAt = new Date();
    const sessionPath = path.join(this.chatDir, `${session.id}.json`);
    fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2));
  }

  async addMessage(
    sessionId: string,
    message: ChatMessage,
  ): Promise<ChatSession> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session with ID ${sessionId} not found`);
    }

    session.messages.push(message);
    session.updatedAt = new Date();
    await this.saveSession(session);
    return session;
  }

  async listSessionsByPlugin(pluginName: string): Promise<ChatSession[]> {
    // Read all chat sessions and filter by plugin name
    const sessions: ChatSession[] = [];
    const files = fs.readdirSync(this.chatDir);

    for (const file of files) {
      if (file.endsWith('.json')) {
        const data = fs.readFileSync(path.join(this.chatDir, file), 'utf8');
        const session = JSON.parse(data) as ChatSession;
        if (session.pluginName === pluginName) {
          sessions.push(session);
        }
      }
    }

    return sessions;
  }
}
