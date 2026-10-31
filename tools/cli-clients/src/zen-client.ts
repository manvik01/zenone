import axios, { AxiosInstance } from 'axios';

export interface ClientConfig {
  baseUrl: string;
  email?: string;
  password?: string;
}

export interface User {
  userId: string;
  email: string;
  accountStatus: string;
  emailVerified: boolean;
  createdAt: string;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface Device {
  deviceId: string;
  platform: string;
  deviceName: string;
  capabilities: string[];
  lastSeen: string;
  trustStatus: string;
  isOnline: boolean;
  revokedAt?: string;
  createdAt: string;
}

export interface Task {
  taskId: string;
  userId: string;
  sourceDeviceId: string;
  targetDeviceId: string;
  actionType: string;
  actionPayload: any;
  state: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  approvedAt?: string;
  approvedBy?: string;
  canceledAt?: string;
  cancelReason?: string;
  failureReason?: string;
  completedAt?: string;
  transferResult?: any;
}

export interface Grant {
  grantId: string;
  deviceId: string;
  resourceType: string;
  resourcePath: string;
  capabilities: string[];
  expiresAt?: string;
  revokedAt?: string;
  createdAt: string;
}

export class ZenClient {
  private client: AxiosInstance;
  private accessToken?: string;

  constructor(private config: ClientConfig) {
    this.client = axios.create({
      baseURL: config.baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add auth interceptor
    this.client.interceptors.request.use((config) => {
      if (this.accessToken) {
        config.headers.Authorization = `Bearer ${this.accessToken}`;
      }
      return config;
    });
  }

  // Identity endpoints
  async register(email: string, password: string): Promise<User & { verificationToken: string }> {
    const response = await this.client.post('/v1/auth/register', { email, password });
    return response.data;
  }

  async verifyEmail(token: string): Promise<{ message: string; emailVerified: boolean }> {
    const response = await this.client.post('/v1/auth/verify-email', { token });
    return response.data;
  }

  async login(email: string, password: string): Promise<Session> {
    const response = await this.client.post('/v1/auth/login', { email, password });
    this.accessToken = response.data.accessToken;
    return response.data;
  }

  async logout(): Promise<void> {
    await this.client.post('/v1/auth/logout');
    this.accessToken = undefined;
  }

  async getCurrentUser(): Promise<User> {
    const response = await this.client.get('/v1/auth/me');
    return response.data;
  }

  // Device endpoints
  async startPairing(deviceName: string, platform: string, capabilities: string[]): Promise<{ deviceId: string; pairingCode: string; expiresAt: string }> {
    const publicKey = `pubkey-${Date.now()}`; // Simulated public key
    const response = await this.client.post('/v1/devices/pair/start', {
      deviceName,
      platform,
      publicKey,
      capabilities,
    });
    return response.data;
  }

  async confirmPairing(deviceId: string, pairingCode: string): Promise<Device> {
    const response = await this.client.post(`/v1/devices/pair/confirm/${deviceId}`, {
      pairingCode,
    });
    return response.data;
  }

  async listDevices(): Promise<Device[]> {
    const response = await this.client.get('/v1/devices');
    return response.data;
  }

  async getDevice(deviceId: string): Promise<Device> {
    const response = await this.client.get(`/v1/devices/${deviceId}`);
    return response.data;
  }

  async updatePresence(deviceId: string): Promise<{ deviceId: string; lastSeen: string; isOnline: boolean }> {
    const response = await this.client.post(`/v1/devices/${deviceId}/heartbeat`);
    return response.data;
  }

  async revokeDevice(deviceId: string): Promise<{ message: string; deviceId: string; revokedAt: string }> {
    const response = await this.client.delete(`/v1/devices/${deviceId}`);
    return response.data;
  }

  // ZenControl endpoints
  async createGrant(deviceId: string, resourceType: string, resourcePath: string, capabilities: string[], expiresAt?: string): Promise<Grant> {
    const response = await this.client.post('/v1/zencontrol/grants', {
      deviceId,
      resourceType,
      resourcePath,
      capabilities,
      expiresAt,
    });
    return response.data;
  }

  async listGrants(): Promise<Grant[]> {
    const response = await this.client.get('/v1/zencontrol/grants');
    return response.data;
  }

  async revokeGrant(grantId: string): Promise<Grant> {
    const response = await this.client.delete(`/v1/zencontrol/grants/${grantId}`);
    return response.data;
  }

  async checkGrant(deviceId: string, resourceType: string, resourcePath: string, capability: string): Promise<{ granted: boolean; reason?: string }> {
    const response = await this.client.post('/v1/zencontrol/check', {
      deviceId,
      resourceType,
      resourcePath,
      capability,
    });
    return response.data;
  }

  // Task endpoints
  async createTask(sourceDeviceId: string, targetDeviceId: string, actionType: string, actionPayload: any, idempotencyKey?: string): Promise<Task> {
    const response = await this.client.post('/v1/tasks', {
      sourceDeviceId,
      targetDeviceId,
      actionType,
      actionPayload,
      idempotencyKey,
    });
    return response.data;
  }

  async listTasks(filters?: { state?: string; actionType?: string; deviceId?: string }): Promise<Task[]> {
    const response = await this.client.get('/v1/tasks', { params: filters });
    return response.data;
  }

  async getTask(taskId: string): Promise<Task> {
    const response = await this.client.get(`/v1/tasks/${taskId}`);
    return response.data;
  }

  async getTaskStatus(taskId: string): Promise<{ taskId: string; state: string; updatedAt: string }> {
    const response = await this.client.get(`/v1/tasks/${taskId}/status`);
    return response.data;
  }

  async approveTask(taskId: string, approvedBy?: string): Promise<Task> {
    const response = await this.client.post(`/v1/tasks/${taskId}/approve`, {
      approvedBy,
    });
    return response.data;
  }

  async cancelTask(taskId: string, cancelReason?: string): Promise<Task> {
    const response = await this.client.post(`/v1/tasks/${taskId}/cancel`, {
      cancelReason,
    });
    return response.data;
  }

  async executeTask(taskId: string): Promise<Task> {
    const response = await this.client.post(`/v1/tasks/${taskId}/execute`);
    return response.data;
  }
}
