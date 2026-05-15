export type UserRole = 'parent' | 'child';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  role: UserRole;
  points: number;
  totalPointsEarned?: number;
  currencyBalance: number;
  createdAt: any;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  points: number;
  status: 'pending' | 'completed' | 'approved' | 'rejected';
  assignedTo: string;
  assignedToName: string;
  createdBy: string;
  imageUrl?: string;
  createdAt: any;
  completedAt?: any;
  approvedAt?: any;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  userPhoto: string;
  content: string;
  createdAt: any;
}

export interface Transaction {
  id: string;
  userId: string;
  userName: string;
  type: 'earn' | 'redeem';
  points: number;
  currencyAmount: number;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: any;
  processedAt?: any;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  type: 'text' | 'image' | 'audio' | 'video_call';
  createdAt: any;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  createdAt: any;
}

export interface Prize {
  id: string;
  title: string;
  cost: number;
  imageUrl?: string;
}

export interface AppConfig {
  pointExchangeRate: number; // 1 point = X SAR
}
