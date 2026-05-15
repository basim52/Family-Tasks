export type UserRole = 'parent' | 'child';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  role: UserRole;
  points: number;
  currencyBalance: number;
  createdAt: any;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  points: number;
  status: 'pending' | 'completed' | 'approved';
  assignedTo: string;
  assignedToName: string;
  createdBy: string;
  imageUrl?: string;
  createdAt: any;
  completedAt?: any;
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
  type: 'text' | 'image';
  createdAt: any;
}

export interface AppConfig {
  pointExchangeRate: number; // 1 point = X SAR
}
