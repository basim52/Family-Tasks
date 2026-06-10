export type UserRole = 'parent' | 'child';

export type ThemeType = 'classic' | 'midnight' | 'boutique';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  role: UserRole;
  points: number;
  totalPointsEarned?: number;
  currencyBalance: number;
  tokensBalance: number; // New specialized currency
  lastLuckySpinAt?: any;
  lastTreasureClaimedCount?: number;
  theme?: ThemeType;
  customBgColor?: string;
  customAccentColor?: string;
  createdAt: any;
}

export interface StoreProduct {
  id: string;
  name: string;
  price: number;
  image: string;
  description?: string;
  stock: number;
  createdAt: any;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  points: number;
  rewardType: 'points' | 'tokens';
  rewardAmount: number;
  status: 'pending' | 'completed' | 'approved' | 'rejected' | 'expired';
  assignedTo: string;
  assignedToName: string;
  createdBy: string;
  createdByName?: string;
  startTime?: any;
  endTime?: any;
  imageUrl?: string;
  createdAt: any;
  completedAt?: any;
  approvedAt?: any;
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly';
  parentTaskId?: string;
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

export interface BigGoal {
  id: string;
  title: string;
  targetPoints: number;
  userId: string;
  status: 'active' | 'completed';
  createdAt: any;
}

export interface MonthlyReward {
  id: string;
  title: string;
  cost: number;
  month: string;
  description?: string;
  claimedBy?: string[];
  createdAt: any;
}

export interface Call {
  id: string;
  hostId: string;
  hostName: string;
  hostPhoto: string;
  type: 'video' | 'voice';
  status: 'active' | 'ended';
  participants: string[];
  createdAt: any;
}

export interface BehaviorRating {
  id: string;
  userId: string;
  userName: string;
  points: number;
  reason: string;
  evaluatorId: string;
  evaluatorName: string;
  createdAt: any;
}

export interface Motivation {
  id: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  userName: string;
  message: string;
  icon: string;
  createdAt: any;
}

export interface MotivationTemplate {
  id: string;
  content: string;
  category: string;
  createdAt: any;
}

export interface Badge {
  id: string;
  name: string;
  childId: string;
  childName: string;
  icon: string;
  color: string;
  awardedAt: any;
}

export interface Cheque {
  id: string;
  transactionId: string;
  userId: string;
  userName: string;
  amount: number;
  currency: string;
  issuedAt: any;
  issuedBy: string;
  issuedByName: string;
  serialNumber: string;
  createdAt: any;
}

export interface SilenceSession {
  id: string;
  userId: string;
  userName: string;
  phrase: string;
  durationMinutes?: number;
  recorderId: string;
  recorderName: string;
  createdAt: any;
}

export interface Milestone {
  id: string;
  title: string;
  completed: boolean;
  completedAt?: any;
}

export interface DevelopmentPlan {
  id: string;
  title: string;
  description: string;
  assignedTo: string;
  assignedToName: string;
  creatorId: string;
  creatorName: string;
  rewardCoins: number;
  status: 'active' | 'completed';
  milestones: Milestone[];
  createdAt: any;
  completedAt?: any;
}
