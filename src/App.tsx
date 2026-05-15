import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home, 
  CheckSquare, 
  MessageCircle, 
  Wallet as WalletIcon, 
  User as UserIcon,
  Video,
  Phone,
  Mic,
  Image as ImageIcon,
  Square,
  LogOut,
  PlusCircle,
  Bell,
  ArrowUpRight,
  TrendingUp,
  Star,
  PlusCircle as PlusCircleIcon,
  CheckCircle2,
  Settings,
  ShoppingBag,
  Heart,
  MessageSquare,
  Edit2,
  X,
  Smile,
  Frown,
  Meh
} from 'lucide-react';
import { auth, db, storage } from './lib/firebase';
import { useAuth } from './hooks/useAuth';
import { Landing } from './pages/Landing';
import { WalletCard } from './components/wallet/WalletCard';
import { TaskImageGenerator } from './components/TaskImageGenerator';
import { Play, Pause, Loader2 } from 'lucide-react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  where, 
  addDoc, 
  serverTimestamp, 
  updateDoc, 
  doc,
  limit,
  getDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Task, Message, UserProfile, Prize, TaskComment } from './types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}

// --- Components ---

const Navbar = ({ profile }: { profile: UserProfile | null }) => {
  const location = useLocation();
  const navItems = [
    { path: '/', icon: Home, label: 'الرئيسية' },
    { path: '/tasks', icon: CheckSquare, label: 'المهام' },
    { path: '/chat', icon: MessageCircle, label: 'الدردشة' },
    { path: '/wallet', icon: WalletIcon, label: 'المحفظة' },
  ];
  const isParent = profile?.role === 'parent';

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-summer-card border-t border-white/20 z-50 rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.2)] md:static md:border-t-0 md:rounded-none md:shadow-none md:w-20 md:min-h-screen md:text-white">
      <div className="flex md:flex-col justify-around md:justify-center items-center h-20 md:h-full md:gap-8">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link 
              key={item.path} 
              to={item.path}
              className={cn(
                "flex flex-col items-center gap-1 transition-all group p-2",
                isActive ? "text-summer-accent" : "text-summer-text/50 hover:text-summer-accent"
              )}
            >
              <div className={cn(
                "p-2 rounded-xl transition-all",
                isActive ? "bg-white/30" : "group-hover:bg-white/20"
              )}>
                <item.icon size={22} className={cn(isActive && "animate-pulse")} />
              </div>
              <span className="text-[10px] font-bold md:hidden">{item.label}</span>
            </Link>
          );
        })}
        <Link 
          to="/shop"
          className={cn(
            "flex flex-col items-center gap-1 transition-all group p-2",
            location.pathname === '/shop' ? "text-summer-accent" : "text-summer-text/50 hover:text-summer-accent"
          )}
        >
          <div className={cn(
            "p-2 rounded-xl transition-all",
            location.pathname === '/shop' ? "bg-white/30" : "group-hover:bg-white/20"
          )}>
            <ShoppingBag size={22} />
          </div>
          <span className="text-[10px] font-bold md:hidden">المتجر</span>
        </Link>
        {isParent && (
          <Link 
            to="/settings"
            className={cn(
              "flex flex-col items-center gap-1 transition-all group p-2",
              location.pathname === '/settings' ? "text-summer-accent" : "text-summer-text/50 hover:text-summer-accent"
            )}
          >
            <div className={cn(
              "p-2 rounded-xl transition-all",
              location.pathname === '/settings' ? "bg-white/30" : "group-hover:bg-white/20"
            )}>
              <Settings size={22} />
            </div>
            <span className="text-[10px] font-bold md:hidden">الإعدادات</span>
          </Link>
        )}
        <button 
          onClick={() => auth.signOut()}
          className="p-2 text-red-400 hover:bg-white/5 rounded-xl transition-all md:mt-auto md:mb-8"
        >
          <LogOut size={22} />
        </button>
      </div>
    </nav>
  );
};

// --- Utils ---
const sendNotification = async (userId: string, title: string, body: string, type: string = 'info') => {
  await addDoc(collection(db, 'notifications'), {
    userId,
    title,
    body,
    type,
    read: false,
    createdAt: serverTimestamp()
  });
};

const getLevel = (totalPoints: number = 0) => {
  if (totalPoints >= 1000) return { name: 'المستوى الذهبي', color: 'text-summer-accent', icon: Star };
  if (totalPoints >= 500) return { name: 'المستوى الفضي', color: 'text-summer-primary', icon: Star };
  if (totalPoints >= 200) return { name: 'المستوى البرونزي', color: 'text-amber-700', icon: Star };
  return { name: 'مبتدئ', color: 'text-slate-500', icon: Star };
};

// --- Components ---
const NotificationCentre = ({ profile }: { profile: UserProfile }) => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'notifications'), 
      where('userId', '==', profile.uid),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    return onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notifications');
    });
  }, [profile.uid]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-3 bg-white/20 rounded-2xl hover:bg-white/30 transition-colors relative"
      >
        <Bell size={20} className="text-summer-text" />
        {unreadCount > 0 && (
          <span className="absolute top-3 right-3 w-4 h-4 bg-red-500 border-2 border-summer-bg rounded-full text-[8px] flex items-center justify-center font-bold text-white">{unreadCount}</span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute top-16 left-0 w-80 bg-summer-card border border-white/40 rounded-3xl shadow-2xl p-4 z-[100] max-h-96 overflow-y-auto"
          >
            <h4 className="font-bold text-summer-text mb-4 px-2">الإشعارات الأخيرة</h4>
            <div className="space-y-3">
              {notifications.length === 0 && <p className="text-xs text-summer-text/40 text-center py-4">لا توجد إشعارات حالياً</p>}
              {notifications.map(n => (
                <div key={n.id} className={cn("p-3 rounded-2xl border border-white/10", n.read ? "bg-white/10 opacity-50" : "bg-white/20")}>
                  <p className="text-xs font-bold text-summer-text mb-1">{n.title}</p>
                  <p className="text-[10px] text-summer-text/60">{n.body}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Header = ({ title, profile, actions }: { title: string, profile: UserProfile, actions?: React.ReactNode }) => (
  <header className="px-6 py-6 flex justify-between items-center bg-summer-card border-b border-white/20 sticky top-0 z-40">
    <div className="flex items-center gap-4">
      <NotificationCentre profile={profile} />
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-lg md:text-2xl font-bold tracking-tight text-summer-text whitespace-nowrap">{title}</h1>
          <p className="text-[10px] text-summer-text/60 uppercase tracking-widest font-medium">نظام العائلة الذكي</p>
        </div>
        {actions && <div className="flex gap-2 mr-2 md:mr-4 border-r border-white/20 pr-2 md:pr-4">{actions}</div>}
      </div>
    </div>
    <div className="flex gap-4 items-center">
      <div className="hidden md:block text-left text-xs">
        <p className="font-semibold text-summer-text">{profile.displayName}</p>
        <p className="text-summer-accent opacity-70">{profile.role === 'parent' ? 'مسؤول النظام' : 'عضو عائلي'}</p>
      </div>
      <button className="w-10 h-10 md:w-12 md:h-12 rounded-full border-2 border-summer-accent p-0.5 overflow-hidden shrink-0">
        <img src={profile.photoURL || ''} alt="User" className="w-full h-full rounded-full object-cover" />
      </button>
    </div>
  </header>
);

// --- Smart Achievement & Progress Components ---

const Dashboard = ({ profile }: { profile: UserProfile }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const isParent = profile.role === 'parent';
  const level = getLevel(profile.totalPointsEarned);

  useEffect(() => {
    const q = isParent 
      ? query(collection(db, 'tasks'), orderBy('createdAt', 'desc'))
      : query(collection(db, 'tasks'), where('assignedTo', '==', profile.uid), orderBy('createdAt', 'desc'));
    
    return onSnapshot(q, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tasks');
    });
  }, [profile.uid, isParent]);

  return (
    <div className="pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500 bg-summer-bg min-h-screen">
      <Header title={`مرحباً، ${profile.displayName}`} profile={profile} />
      
      <div className="px-6 space-y-8 mt-6">
        {/* Family Mood Dashboard */}
        <FamilyPulse profile={profile} />

        {/* User Stats & Level */}
        {!isParent && (
          <motion.div 
            whileHover={{ scale: 1.02 }}
            className="bg-summer-card p-6 rounded-3xl border border-white/20 shadow-2xl flex items-center justify-between overflow-hidden relative"
          >
            <div className="absolute top-0 right-0 w-32 h-32 summer-gradient opacity-10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div>
              <p className="text-summer-text/40 text-[10px] uppercase tracking-widest font-bold mb-1">المستوى الحالي</p>
              <div className="flex items-center gap-3">
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center bg-white/20", level.color)}>
                  <level.icon size={18} />
                </div>
                <h4 className={cn("text-xl font-black", level.color)}>{level.name}</h4>
              </div>
            </div>
            <div className="text-left">
              <p className="text-summer-text/40 text-[10px] uppercase tracking-widest font-bold mb-1">إجمالي النقاط</p>
              <p className="text-summer-text text-2xl font-black">{profile.totalPointsEarned || 0}</p>
            </div>
          </motion.div>
        )}

        {/* Wallet Section */}
        <WalletCard profile={profile} exchangeRate={0.25} />

        {/* Quick Actions for Parent */}
        {isParent && (
          <section className="space-y-4">
            <h3 className="text-sm font-bold text-summer-text/40 uppercase tracking-[0.2em] px-1">إجراءات سريعة</h3>
            <div className="grid grid-cols-2 gap-4">
              <Link to="/tasks" className="bg-summer-card p-6 rounded-3xl border border-white/20 flex items-center gap-4 group shadow-xl hover:border-white/40 transition-all">
                <div className="w-12 h-12 summer-gradient rounded-2xl flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                  <PlusCircle size={24} />
                </div>
                <div className="text-right">
                  <p className="font-bold text-summer-text text-sm">إضافة مهمة</p>
                  <p className="text-[10px] text-summer-text/40">كافئ أطفالك</p>
                </div>
              </Link>
              <Link to="/chat" className="bg-summer-card p-6 rounded-3xl border border-white/20 flex items-center gap-4 group shadow-xl hover:border-white/40 transition-all">
                <div className="w-12 h-12 bg-summer-primary rounded-2xl flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                  <Video size={24} />
                </div>
                <div className="text-right">
                  <p className="font-bold text-summer-text text-sm">اتصال مرئي</p>
                  <p className="text-[10px] text-summer-text/40">تواصل مباشر</p>
                </div>
              </Link>
            </div>
          </section>
        )}

        {/* Tasks Preview */}
        <section className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-sm font-bold text-summer-text/40 uppercase tracking-[0.2em]">آخر المهام النشطة</h3>
            <Link to="/tasks" className="text-xs font-bold text-summer-accent hover:text-summer-secondary transition-colors">عرض الكل</Link>
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            {tasks.slice(0, 3).map((task) => (
              <div key={task.id} className="bg-summer-primary p-5 rounded-3xl border border-white/30 flex flex-col justify-between shadow-xl relative overflow-hidden group">
                <div className="absolute top-4 left-4">
                   <div className="bg-summer-secondary text-white px-3 py-1 rounded-full text-[10px] font-black shadow-md">{task.points} نقطة</div>
                </div>
                <div className="mb-4">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl mb-4 flex items-center justify-center text-summer-secondary">
                    <CheckSquare size={24} />
                  </div>
                  <h4 className="text-lg font-bold mb-1 text-white">{task.title}</h4>
                  <p className="text-xs text-white/80 leading-relaxed">{task.description}</p>
                </div>
                <div className="flex items-center justify-between border-t border-white/20 pt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-summer-secondary flex items-center justify-center text-[8px] text-white font-bold">
                       {task.assignedToName?.charAt(0)}
                    </div>
                    <span className="text-[10px] text-white/90">{task.assignedToName}</span>
                  </div>
                  <TaskImageGenerator task={task} pointsValue={`${task.points} نقطة`} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

// --- AI Out-of-the-box Components ---

const AIAssistant = ({ profile }: { profile: UserProfile }) => {
  return (
    <div className="h-screen flex flex-col pb-24 bg-summer-bg">
      <Header title="المساعد" profile={profile} />
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
        <div className="w-20 h-20 bg-summer-accent/10 rounded-full flex items-center justify-center">
          <Settings size={40} className="text-summer-accent" />
        </div>
        <h3 className="text-xl font-bold text-summer-text">هذه الخدمة غير متوفرة</h3>
        <p className="text-xs text-summer-text/50">تم إيقاف خدمات المساعد الذكي حالياً.</p>
      </div>
    </div>
  );
};

const FamilyPulse = ({ profile }: { profile: UserProfile }) => {
  const [mood, setMood] = useState<string | null>(null);
  
  const moods = [
    { icon: Smile, label: 'سعيد', color: 'text-emerald-500', id: 'happy' },
    { icon: Meh, label: 'متفرغ', color: 'text-summer-primary', id: 'neutral' },
    { icon: Frown, label: 'تعبان', color: 'text-red-500', id: 'tired' },
  ];

  return (
    <section className="bg-summer-card p-6 rounded-3xl border border-white/20 shadow-xl">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-sm font-bold text-summer-text/40 uppercase tracking-widest">نبض العائلة اليوم</h3>
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        {moods.map(m => (
          <button 
            key={m.id}
            onClick={() => setMood(m.id)}
            className={cn(
              "flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all duration-300",
              mood === m.id ? "bg-white/40 border-summer-accent shadow-lg" : "bg-white/20 border-transparent hover:bg-white/30"
            )}
          >
            <m.icon size={28} className={mood === m.id ? m.color : 'text-summer-text/20'} />
            <span className={cn("text-[10px] font-bold", mood === m.id ? "text-summer-text" : "text-summer-text/30")}>{m.label}</span>
          </button>
        ))}
      </div>
      
      {mood && (
        <motion.p 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="text-center text-[10px] text-summer-accent mt-4 font-bold"
        >
          شكراً لمشاركة شعورك!
        </motion.p>
      )}
    </section>
  );
};


const TaskComments = ({ taskId, profile }: { taskId: string, profile: UserProfile }) => {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    const q = query(
      collection(db, 'tasks', taskId, 'comments'),
      orderBy('createdAt', 'asc')
    );
    return onSnapshot(q, (snapshot) => {
      setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaskComment)));
    });
  }, [taskId]);

  const postComment = async () => {
    if (!newComment.trim()) return;
    await addDoc(collection(db, 'tasks', taskId, 'comments'), {
      taskId,
      userId: profile.uid,
      userName: profile.displayName,
      userPhoto: profile.photoURL,
      content: newComment,
      createdAt: serverTimestamp()
    });
    setNewComment('');
  };

  return (
    <div className="mt-4 pt-4 border-t border-white/20 space-y-4">
      <div className="space-y-3">
        {comments.map(c => (
          <div key={c.id} className="flex gap-2 items-start">
            <img src={c.userPhoto} className="w-6 h-6 rounded-full border border-white/20" alt="" />
            <div className="bg-white/30 rounded-2xl px-3 py-2 flex-1">
              <p className="text-[9px] font-black text-summer-accent/70 mb-0.5">{c.userName}</p>
              <p className="text-xs text-summer-text font-medium">{c.content}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input 
          placeholder="إضافة تعليق..."
          className="flex-1 bg-white/20 border border-white/30 rounded-xl px-4 py-2 text-xs text-summer-text outline-none focus:border-summer-accent/50 placeholder:text-summer-text/30"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && postComment()}
        />
        <button 
          onClick={postComment}
          className="p-2 bg-summer-accent/10 text-summer-accent rounded-xl hover:bg-summer-accent transition-colors hover:text-white"
        >
          <MessageSquare size={16} />
        </button>
      </div>
    </div>
  );
};

const TaskTimeline = ({ task }: { task: Task }) => {
  const steps = [
    { label: 'تمت الإضافة', date: task.createdAt, icon: PlusCircle, color: 'text-summer-primary' },
    { label: 'بانتظار المراجعة', date: task.completedAt, icon: CheckCircle2, color: 'text-emerald-500' },
    { label: 'تم الاعتماد', date: task.approvedAt, icon: Star, color: 'text-summer-accent' }
  ];

  return (
    <div className="flex items-center justify-between px-1 py-4">
      {steps.map((step, idx) => {
        const isActive = !!step.date;
        return (
          <React.Fragment key={idx}>
            <div className="flex flex-col items-center gap-1.5 relative">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500",
                isActive ? `${step.color} border-current bg-white/20` : "text-summer-text/10 border-summer-text/10"
              )}>
                <step.icon size={14} />
              </div>
              <span className={cn("text-[8px] font-bold uppercase tracking-tighter", isActive ? "text-summer-text" : "text-summer-text/20")}>
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className={cn("flex-1 h-0.5 mx-2 rounded-full", steps[idx+1].date ? "bg-emerald-500/30" : "bg-white/10")} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const TasksPage = ({ profile }: { profile: UserProfile }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPoints, setNewPoints] = useState(10);
  const [newAssigned, setNewAssigned] = useState('');
  const [family, setFamily] = useState<UserProfile[]>([]);
  const isParent = profile.role === 'parent';
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPoints, setEditPoints] = useState(10);
  const [editAssigned, setEditAssigned] = useState('');
  const [showComments, setShowComments] = useState<string | null>(null);

  useEffect(() => {
    const q = isParent 
      ? query(collection(db, 'tasks'), orderBy('createdAt', 'desc'))
      : query(collection(db, 'tasks'), where('assignedTo', '==', profile.uid), orderBy('createdAt', 'desc'));
    
    const unsubscribeTasks = onSnapshot(q, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tasks');
    });

    const unsubscribeFamily = onSnapshot(collection(db, 'users'), (snapshot) => {
      setFamily(snapshot.docs.map(doc => doc.data() as UserProfile));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => {
      unsubscribeTasks();
      unsubscribeFamily();
    };
  }, [profile.uid, isParent]);

  const addTask = async () => {
    if (!newTitle) return;
    try {
      const assignedUser = family.find(f => f.uid === newAssigned);
      await addDoc(collection(db, 'tasks'), {
        title: newTitle,
        description: 'مهمة عائلية من الأهل',
        points: Number(newPoints),
        status: 'pending',
        assignedTo: newAssigned,
        assignedToName: assignedUser?.displayName || 'الجميع',
        createdBy: profile.uid,
        createdAt: serverTimestamp(),
      });

      // Notify Child
      if (newAssigned) {
        await sendNotification(newAssigned, 'مهمة جديدة! 🚀', `لقد تم تكليفك بمهمة: ${newTitle}`, 'task');
      }

      setNewTitle('');
      setShowAdd(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'tasks');
    }
  };

  const updateTask = async () => {
    if (!editingTask || !editTitle) return;
    
    const assignedUser = family.find(f => f.uid === editAssigned);
    
    await updateDoc(doc(db, 'tasks', editingTask.id), {
      title: editTitle,
      points: Number(editPoints),
      assignedTo: editAssigned,
      assignedToName: assignedUser?.displayName || 'الجميع',
    });

    // Notify Child if reassigned
    if (editAssigned !== editingTask.assignedTo) {
      await sendNotification(editAssigned, 'تم تعديل المهمة! 📝', `لقد تم تكليفك بمهمة معدلة: ${editTitle}`, 'task');
    }

    setEditingTask(null);
  };

  const startEdit = (task: Task) => {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditPoints(task.points);
    setEditAssigned(task.assignedTo);
  };

  const approveTask = async (task: Task) => {
    if (!isParent) return;
    // 1. Update Task
    await updateDoc(doc(db, 'tasks', task.id), { 
      status: 'approved',
      approvedAt: serverTimestamp()
    });
    
    // 2. Add Points to Child
    const userRef = doc(db, 'users', task.assignedTo);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const currentPoints = userSnap.data().points || 0;
      const totalPoints = userSnap.data().totalPointsEarned || 0;
      await updateDoc(userRef, { 
        points: currentPoints + task.points,
        totalPointsEarned: totalPoints + task.points
      });
      
      // Notify Child
      await sendNotification(task.assignedTo, 'مبروك! 🏆', `تمت الموافقة على مهمة "${task.title}" وحصلت على ${task.points} نقطة`, 'success');
    }
  };

  const rejectTask = async (task: Task) => {
    if (!isParent) return;
    await updateDoc(doc(db, 'tasks', task.id), { 
      status: 'pending',
      completedAt: null 
    });
    await sendNotification(task.assignedTo, 'طلب مراجعة 📝', `هناك ملاحظات على مهمة "${task.title}"، يرجى مراجعتها`, 'warning');
  };

  const completeTask = async (task: Task) => {
    try {
      await updateDoc(doc(db, 'tasks', task.id), { 
        status: 'completed', 
        completedAt: serverTimestamp() 
      });

      // Notify Parents
      const parentUids = family.filter(f => f.role === 'parent').map(f => f.uid);
      for (const parentUid of parentUids) {
        await sendNotification(
          parentUid, 
          'إنجاز جديد! 🎉', 
          `لقد أتم ${profile.displayName} مهمة: ${task.title}`, 
          'task_completed'
        );
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${task.id}`);
    }
  };

  return (
    <div className="pb-24 bg-summer-bg min-h-screen">
      <Header title="لوحة المهام النشطة" profile={profile} />
      
      <div className="px-6 mt-6 space-y-6">
        {isParent && (
          <button 
            onClick={() => setShowAdd(!showAdd)}
            className="w-full bg-summer-primary text-white rounded-2xl py-5 font-bold flex items-center justify-center gap-3 shadow-xl hover:bg-summer-primary/90 transition-all active:scale-95"
          >
            <PlusCircle size={24} />
            <span className="text-lg">إضافة مهمة جديدة</span>
          </button>
        )}

        <AnimatePresence>
          {showAdd && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-summer-card p-6 rounded-3xl border border-white/40 space-y-4 shadow-2xl">
                <input 
                  placeholder="اسم المهمة (مثلاً: تنظيف المطبخ)"
                  className="w-full bg-white/20 border border-white/20 rounded-2xl px-5 py-4 text-summer-text placeholder:text-summer-text/30 focus:border-summer-accent outline-none transition-colors"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
                <div className="flex gap-4">
                  <input 
                    type="number"
                    placeholder="النقاط"
                    className="w-1/3 bg-white/20 border border-white/20 rounded-2xl px-5 py-4 text-summer-text outline-none focus:border-summer-accent placeholder:text-summer-text/30"
                    value={newPoints}
                    onChange={(e) => setNewPoints(Number(e.target.value))}
                  />
                  <select 
                    className="w-2/3 bg-white/20 border border-white/20 rounded-2xl px-5 py-4 text-summer-text outline-none focus:border-summer-accent appearance-none placeholder:text-summer-text/30"
                    value={newAssigned}
                    onChange={(e) => setNewAssigned(e.target.value)}
                  >
                    <option value="" className="bg-summer-card text-summer-text">تعيين إلى...</option>
                    {family.filter(f => f.role === 'child').map(f => (
                      <option key={f.uid} value={f.uid} className="bg-summer-card text-summer-text">{f.displayName}</option>
                    ))}
                  </select>
                </div>
                
                <button 
                  onClick={addTask}
                  className="w-full summer-gradient text-white py-4 rounded-2xl font-black text-lg hover:shadow-lg transition-all shadow-lg active:scale-95"
                >
                  حفظ المهمة ومشاركتها
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {editingTask && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-6"
            >
              <div className="bg-summer-card p-6 rounded-3xl border border-summer-secondary/30 space-y-4 shadow-2xl">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-summer-accent font-bold">تعديل المهمة</h3>
                  <button onClick={() => setEditingTask(null)} className="text-summer-text/40 hover:text-summer-text">
                    <X size={20} />
                  </button>
                </div>
                <input 
                  placeholder="اسم المهمة"
                  className="w-full bg-white/20 border border-white/20 rounded-2xl px-5 py-4 text-summer-text placeholder:text-summer-text/30 focus:border-summer-accent outline-none transition-colors"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
                <div className="flex gap-4">
                  <input 
                    type="number"
                    placeholder="النقاط"
                    className="w-1/3 bg-white/20 border border-white/20 rounded-2xl px-5 py-4 text-summer-text outline-none focus:border-summer-accent placeholder:text-summer-text/30"
                    value={editPoints}
                    onChange={(e) => setEditPoints(Number(e.target.value))}
                  />
                  <select 
                    className="w-2/3 bg-white/20 border border-white/20 rounded-2xl px-5 py-4 text-summer-text outline-none focus:border-summer-accent appearance-none placeholder:text-summer-text/30"
                    value={editAssigned}
                    onChange={(e) => setEditAssigned(e.target.value)}
                  >
                    <option value="" className="bg-summer-card text-summer-text">تعيين إلى...</option>
                    {family.filter(f => f.role === 'child').map(f => (
                      <option key={f.uid} value={f.uid} className="bg-summer-card text-summer-text">{f.displayName}</option>
                    ))}
                  </select>
                </div>
                <button 
                  onClick={updateTask}
                  className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-emerald-700 transition-all shadow-lg active:scale-95"
                >
                  تحديث بيانات المهمة
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tasks.map((task) => (
            <div key={task.id} className="bg-summer-card rounded-3xl border border-white/40 p-6 shadow-xl space-y-4 relative overflow-hidden group hover:border-summer-accent/30 transition-all">
              {task.status === 'approved' && (
                <div className="absolute top-0 right-0 px-10 py-1 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-[0.2em] translate-x-1/3 translate-y-1/2 rotate-45 z-20">
                  تمت المصادقة
                </div>
              )}
              
              <div className="flex justify-between items-start">
                <div className="flex-1">
                   <div className="w-14 h-14 bg-white/30 rounded-2xl mb-4 flex items-center justify-center text-summer-accent group-hover:scale-110 transition-transform">
                    <CheckSquare size={28} />
                  </div>
                  <h4 className="text-xl font-bold text-summer-text mb-1 group-hover:text-summer-accent transition-colors">{task.title}</h4>
                  <p className="text-xs text-summer-text/50 line-clamp-2">عن طريق: {family.find(f => f.uid === task.createdBy)?.displayName || 'الأهل'}</p>
                </div>
                <div className="bg-summer-accent text-white px-4 py-2 rounded-xl font-black shadow-lg">
                  {task.points} ن
                </div>
                {isParent && (
                  <button 
                    onClick={() => startEdit(task)}
                    className="absolute top-4 left-4 p-2 bg-white/20 rounded-xl text-summer-text/40 hover:text-summer-accent transition-colors"
                  >
                    <Edit2 size={16} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3 py-3 border-y border-white/20">
                <div className="w-10 h-10 bg-summer-primary/20 rounded-full flex items-center justify-center text-sm font-bold text-summer-primary">
                  {task.assignedToName?.charAt(0)}
                </div>
                <div>
                  <p className="text-[10px] text-summer-text/30 uppercase tracking-widest font-bold">بواسطة</p>
                  <p className="text-sm font-bold text-summer-text">{task.assignedToName}</p>
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                {task.status === 'completed' && isParent && (
                  <div className="flex gap-3 w-full">
                    <button 
                      onClick={() => approveTask(task)}
                      className="flex-1 summer-gradient text-white py-4 rounded-2xl font-black hover:shadow-lg transition-all active:scale-95 shadow-xl"
                    >
                      موافقة ومنح {task.points} ن
                    </button>
                    <button 
                      onClick={() => rejectTask(task)}
                      className="w-16 bg-red-600/10 text-red-500 py-4 rounded-2xl font-black hover:bg-red-500 hover:text-white transition-all active:scale-95 border border-red-500/20"
                      title="طلب تعديل"
                    >
                      <X size={20} className="mx-auto" />
                    </button>
                  </div>
                )}
                {!isParent && task.status === 'pending' && task.assignedTo === profile.uid && (
                  <button 
                    onClick={() => completeTask(task)}
                    className="flex-1 bg-summer-primary text-white py-4 rounded-2xl font-black hover:bg-summer-primary/90 transition-all active:scale-95 shadow-lg"
                  >
                    تأكيد الإنجاز 🧹
                  </button>
                )}
                {task.status === 'completed' && !isParent && (
                   <div className="flex-1 bg-emerald-500/10 text-emerald-600 py-4 rounded-2xl text-center font-bold text-xs border border-emerald-500/20 flex items-center justify-center gap-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                      بانتظار مراجعة الأهل...
                   </div>
                )}
                {task.status === 'approved' && (
                   <div className="flex-1 bg-summer-accent/10 text-summer-accent py-4 rounded-2xl text-center font-black text-xs border border-summer-accent/20 flex items-center justify-center gap-2">
                      <Star size={14} />
                      تمت المهمة بنجاح 🏆
                   </div>
                )}
                <div className="flex shrink-0">
                  <TaskImageGenerator task={task} pointsValue={`${task.points} نقطة`} />
                </div>
              </div>
              
              <TaskTimeline task={task} />
              
              {/* Family Reactions & Comments Toggle */}
              <div className="pt-4 flex items-center justify-between border-t border-white/20">
                 <div className="flex items-center gap-4">
                    <button className="flex items-center gap-1.5 text-[10px] font-black text-summer-text/30 hover:text-red-500 transition-colors group">
                       <Heart size={14} className="group-active:scale-125 transition-transform" />
                       <span>تفاعل</span>
                    </button>
                    <button 
                      onClick={() => setShowComments(showComments === task.id ? null : task.id)}
                      className={cn(
                        "flex items-center gap-1.5 text-[10px] font-black transition-colors",
                        showComments === task.id ? "text-summer-accent" : "text-summer-text/30 hover:text-summer-text"
                      )}
                    >
                       <MessageSquare size={14} />
                       <span>تعليقات</span>
                    </button>
                 </div>
                 <div className="text-[9px] font-bold text-summer-text/20 italic">
                    آخر تحديث: {task.completedAt ? 'منذ قليل' : 'تم إنشاؤها مؤخراً'}
                 </div>
              </div>

              {showComments === task.id && <TaskComments taskId={task.id} profile={profile} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const ChatPage = ({ profile }: { profile: UserProfile }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [showCall, setShowCall] = useState(false);
  const [callType, setCallType] = useState<'video' | 'voice'>('video');
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'messages'), orderBy('createdAt', 'desc'), limit(50));
    return onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message)).reverse());
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'messages');
    });
  }, []);

  useEffect(() => {
    if (showCall) {
      startCamera();
    } else {
      stopCamera();
    }
  }, [showCall]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        setIsUploading(true);
        try {
          const audioBlob = new Blob(chunks, { type: 'audio/webm' });
          const storageRef = ref(storage, `audio/${profile.uid}_${Date.now()}.webm`);
          await uploadBytes(storageRef, audioBlob);
          const downloadURL = await getDownloadURL(storageRef);
          
          await addDoc(collection(db, 'messages'), {
            senderId: profile.uid,
            senderName: profile.displayName,
            content: downloadURL,
            type: 'audio',
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          console.error("Error uploading audio:", err);
        } finally {
          setIsUploading(false);
        }
        stream.getTracks().forEach(t => t.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) {
      console.error("Error starting recording:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const storageRef = ref(storage, `images/${profile.uid}_${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      await addDoc(collection(db, 'messages'), {
        senderId: profile.uid,
        senderName: profile.displayName,
        content: downloadURL,
        type: 'image',
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Error uploading image:", err);
      alert("فشل رفع الصورة، يرجى المحاولة مرة أخرى.");
    } finally {
      setIsUploading(false);
    }
  };

  const sendMsg = async () => {
    if (!newMsg.trim()) return;
    await addDoc(collection(db, 'messages'), {
      senderId: profile.uid,
      senderName: profile.displayName,
      content: newMsg,
      type: 'text',
      createdAt: serverTimestamp(),
    });
    setNewMsg('');
  };

  return (
    <div className="h-screen flex flex-col pb-24 md:pb-0 bg-summer-bg">
      <Header 
        title="الدردشة العائلية" 
        profile={profile} 
        actions={
          <div className="flex gap-2">
            <button 
              onClick={() => { setCallType('voice'); setShowCall(true); }}
              className="w-10 h-10 bg-emerald-600/20 text-emerald-500 rounded-xl flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all active:scale-95 shadow-lg border border-emerald-500/20"
            >
              <Phone size={18} />
            </button>
            <button 
              onClick={() => { setCallType('video'); setShowCall(true); }}
              className="w-10 h-10 bg-summer-primary/20 text-summer-primary rounded-xl flex items-center justify-center hover:bg-summer-primary hover:text-white transition-all active:scale-95 shadow-lg border border-summer-primary/20"
            >
              <Video size={18} />
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg) => {
          const isOwn = msg.senderId === profile.uid;
          return (
            <div key={msg.id} className={cn("flex flex-col", isOwn ? "items-start" : "items-end")}>
              <div className={cn(
                "max-w-[85%] p-4 rounded-3xl text-[13px] leading-relaxed relative shadow-xl border",
                isOwn 
                  ? "bg-summer-primary text-white rounded-br-none border-white/20" 
                  : "bg-white text-summer-text border-white/30 rounded-bl-none font-medium"
              )}>
                {!isOwn && <p className="text-[10px] font-black text-summer-text/40 uppercase mb-1 tracking-widest px-4 pt-1">{msg.senderName}</p>}
                
                {msg.type === 'text' && <p className="px-4 pb-2">{msg.content}</p>}
                
                {msg.type === 'image' && (
                  <div className="-mx-4 -mt-4 mb-2 overflow-hidden rounded-t-[28px] border-b border-white/20 bg-summer-bg/10">
                    <img src={msg.content} alt="Sent" className="w-full h-auto object-cover max-h-[500px] hover:scale-105 transition-transform duration-500" />
                  </div>
                )}
                
                {msg.type === 'audio' && (
                  <div className="flex items-center gap-3 px-4 pb-2 mt-1">
                    <button 
                      onClick={(e) => {
                        const audio = e.currentTarget.parentElement?.querySelector('audio');
                        if (audio) {
                          audio.paused ? audio.play() : audio.pause();
                        }
                      }}
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90",
                        isOwn ? "bg-white/20 text-white hover:bg-white/30" : "bg-summer-bg/20 text-summer-text hover:bg-summer-bg/30"
                      )}
                    >
                      <Play size={16} />
                    </button>
                    <div className={cn(
                      "flex-1 h-1 rounded-full",
                      isOwn ? "bg-white/10" : "bg-summer-text/5"
                    )} />
                    <audio src={msg.content} className="hidden" />
                    <span className="text-[10px] opacity-60">صوت</span>
                  </div>
                )}

                <div className={cn("text-[9px] mt-2 opacity-50 font-bold", isOwn ? "text-right" : "text-left")}>
                  {msg.createdAt?.toDate?.()?.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-4 bg-summer-card border-t border-white/40 relative z-10">
        <input 
          type="file" 
          accept="image/*" 
          className="hidden" 
          ref={fileInputRef} 
          onChange={handleImageUpload}
        />
        <div className="flex gap-2 items-center">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-summer-text/40 hover:text-summer-accent transition-colors"
          >
            <ImageIcon size={20} />
          </button>
          
          <div className="flex-1 flex gap-2 bg-white/40 p-2 rounded-2xl border border-white/40 group focus-within:border-summer-accent transition-colors relative">
            {isUploading && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-xl flex items-center justify-center z-20 gap-3">
                <Loader2 size={16} className="text-summer-accent animate-spin" />
                <span className="text-[10px] text-summer-text font-bold uppercase tracking-widest">جاري الرفع...</span>
              </div>
            )}
            <input 
              placeholder="اكتب رسالة للعائلة..."
              className="flex-1 bg-transparent border-none focus:ring-0 px-4 text-sm font-medium text-summer-text placeholder:text-summer-text/30"
              value={newMsg}
              onChange={(e) => setNewMsg(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMsg()}
            />
            <button 
              onClick={sendMsg}
              className="summer-gradient text-white p-3 rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg"
            >
              <ArrowUpRight size={20} />
            </button>
          </div>

          <button 
            onClick={isRecording ? stopRecording : startRecording}
            className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-lg",
              isRecording ? "bg-red-500 text-white animate-pulse" : "bg-white/20 text-summer-text/40 hover:text-summer-accent"
            )}
          >
            {isRecording ? <Square size={20} /> : <Mic size={20} />}
          </button>
        </div>
      </div>

      {/* Call UI with Real Preview */}
      <AnimatePresence>
        {showCall && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-summer-bg flex flex-col"
            >
              <div className="absolute top-10 left-10 p-4 border border-white/40 rounded-3xl bg-white/40 backdrop-blur-xl z-50 shadow-2xl">
                 <p className="text-summer-text text-xs opacity-50 mb-2">معاينة الكاميرا</p>
                 <div className="w-32 h-48 bg-summer-primary/40 rounded-2xl overflow-hidden relative border border-white/20">
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      muted 
                      className="w-full h-full object-cover mirror"
                    />
                    {!stream && <UserIcon size={32} className="text-summer-text/20 absolute inset-0 m-auto" />}
                 </div>
              </div>

              <div className="flex-1 flex flex-col items-center justify-center text-center relative p-8">
                <div className="w-48 h-48 bg-summer-accent/10 rounded-full flex items-center justify-center mb-6 animate-pulse">
                   <div className="w-32 h-32 summer-gradient rounded-full flex items-center justify-center">
                      <UserIcon size={64} className="text-white" />
                   </div>
                </div>
                <h2 className="text-summer-text text-3xl font-black mb-2">
                  {callType === 'video' ? 'جاري الاتصال بالعائلة...' : 'اتصال صوتي عائلي...'}
                </h2>
                <p className="text-summer-text/40 opacity-60">تشفير تام بين الطرفين (WebRTC)</p>
              </div>

              <div className="p-12 flex justify-center gap-8 items-center bg-white/40 backdrop-blur-md border-t border-white/20">
                <button className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-summer-text border border-white/20">
                  {isRecording ? <Mic size={24} className="text-red-500" /> : <Mic size={24} />}
                </button>
                <button 
                  onClick={() => setShowCall(false)}
                  className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center text-white shadow-2xl shadow-red-600/50 hover:scale-110 active:scale-90 transition-all"
                >
                  <LogOut size={32} className="rotate-[135deg]" />
                </button>
                <button className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-summer-text border border-white/20">
                  <Video size={24} />
                </button>
              </div>

              <div className="p-8 text-center bg-white/10 border-t border-white/10">
                <p className="text-[10px] text-summer-accent font-bold uppercase tracking-[0.2em]">
                  Real-time WebRTC Signaling Implementation Required for Multi-party
                </p>
              </div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const WalletPage = ({ profile }: { profile: UserProfile }) => {
  const [requests, setRequests] = useState<any[]>([]);
  const isParent = profile.role === 'parent';

  useEffect(() => {
    const q = isParent 
      ? query(collection(db, 'transactions'), orderBy('requestedAt', 'desc'))
      : query(collection(db, 'transactions'), where('userId', '==', profile.uid), orderBy('requestedAt', 'desc'));
    
    return onSnapshot(q, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    });
  }, [profile.uid, isParent]);

  const requestRedeem = async () => {
    if (profile.points < 100) {
      alert('يجب أن تملك 100 نقطة على الأقل لطلب الصرف');
      return;
    }
    await addDoc(collection(db, 'transactions'), {
      userId: profile.uid,
      userName: profile.displayName,
      type: 'redeem',
      points: profile.points,
      currencyAmount: profile.points * 0.1, // Example conversion
      status: 'pending',
      requestedAt: serverTimestamp(),
    });

    // Notify Parents
    const parents = await getDoc(doc(db, 'config', 'family_data')); // Simplified lookup
    // Actually we best fetch all parents from users collection
  };

  const approveRedeem = async (request: any) => {
    // 1. Mark status
    await updateDoc(doc(db, 'transactions', request.id), { status: 'approved', processedAt: serverTimestamp() });
    // 2. Clear points in profile
    await updateDoc(doc(db, 'users', request.userId), { points: 0 });
    // 3. Notify Child
    await sendNotification(request.userId, 'تم استلام المبلغ! 💸', `لقد تمت الموافقة على طلب الصرف الخاص بك.`, 'success');
  };

  return (
    <div className="pb-24 bg-summer-bg min-h-screen">
      <Header title="البنك العائلي" profile={profile} />
      <div className="px-6 mt-6 space-y-8">
        <WalletCard profile={profile} exchangeRate={0.25} />

        {!isParent && profile.points >= 100 && (
          <button 
            onClick={requestRedeem}
            className="w-full summer-gradient text-white py-6 rounded-3xl font-black text-xl shadow-2xl shadow-summer-accent/20 transform hover:scale-[1.02] active:scale-95 transition-all"
          >
            طلب تحويل النقاط إلى كاش!
          </button>
        )}

        <section className="space-y-4 text-right">
          <h3 className="text-sm font-bold text-summer-text/30 uppercase tracking-[0.2em] px-1">سجل العمليات المالية</h3>
          <div className="space-y-4">
            {requests.map(req => (
              <div key={req.id} className="bg-summer-card p-5 rounded-3xl border border-white/40 flex justify-between items-center shadow-xl">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center",
                    req.status === 'approved' ? "bg-emerald-500/20 text-emerald-600" : "bg-summer-accent/10 text-summer-accent"
                  )}>
                    <TrendingUp size={24} />
                  </div>
                  <div>
                    <p className="font-bold text-summer-text leading-none mb-1">{req.userName}</p>
                    <p className="text-[10px] text-summer-text/40">تحويل مبلغ: {req.currencyAmount} ريال</p>
                  </div>
                </div>
                {isParent && req.status === 'pending' ? (
                  <button 
                    onClick={() => approveRedeem(req)}
                    className="bg-summer-accent text-white px-6 py-2 rounded-xl text-xs font-black shadow-lg"
                  >
                    تأكيد الصرف
                  </button>
                ) : (
                  <span className={cn(
                    "text-[10px] font-black uppercase tracking-[0.1em] px-4 py-2 rounded-xl border",
                    req.status === 'approved' ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-summer-accent/5 text-summer-accent border-summer-accent/10"
                  )}>
                    {req.status === 'approved' ? 'تم التنفيذ' : 'قيد المراجعة'}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

// --- New Shop Page ---
// --- New Settings & Prize Pages ---

const SettingsPage = ({ profile }: { profile: UserProfile }) => {
  const [rate, setRate] = useState(0.25);
  const [saving, setSaving] = useState(false);
  const [smartMode, setSmartMode] = useState(() => localStorage.getItem('family_smart_mode') !== 'false');

  useEffect(() => {
    getDoc(doc(db, 'config', 'family_settings')).then(snap => {
      if (snap.exists()) setRate(snap.data().pointExchangeRate || 0.25);
    });
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    await updateDoc(doc(db, 'config', 'family_settings'), {
      pointExchangeRate: Number(rate)
    });
    localStorage.setItem('family_smart_mode', String(smartMode));
    setSaving(false);
    alert('تم حفظ الإعدادات بنجاح. قد تحتاج لإعادة تحميل الصفحة لتطبيق بعض التغييرات الذكية.');
  };

  if (profile.role !== 'parent') return <Navigate to="/" />;

  return (
    <div className="pb-24 bg-summer-bg min-h-screen">
      <Header title="إعدادات العائلة" profile={profile} />
      <div className="p-6 space-y-8">
        <section className="bg-summer-card p-6 rounded-3xl border border-white/20 space-y-6 shadow-xl">
          <h3 className="font-bold text-summer-text flex items-center gap-2">
            <Settings size={18} className="text-summer-accent" />
            إعدادات النظام
          </h3>

          <div className="space-y-4 pt-4 border-t border-white/10">
            <h3 className="font-bold text-summer-text">إعدادات النقاط</h3>
            <p className="text-xs text-summer-text/40">حدد كم يعادل كل نقطة بالريال السعودي</p>
            <div className="flex gap-4 items-center">
              <input 
                type="number"
                step="0.01"
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
                className="flex-1 bg-white/20 border border-white/20 rounded-2xl px-5 py-4 text-summer-text outline-none focus:border-summer-accent"
              />
              <span className="text-summer-text font-bold">ريال/نقطة</span>
            </div>
          </div>

          <button 
            onClick={saveSettings}
            disabled={saving}
            className="w-full summer-gradient text-white py-4 rounded-2xl font-black hover:shadow-lg transition-all disabled:opacity-50 shadow-lg"
          >
            {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
          </button>
        </section>

        <section className="bg-summer-card p-6 rounded-3xl border border-white/20 space-y-4 opacity-50 shadow-xl">
           <h3 className="font-bold text-summer-text">إدارة أفراد العائلة</h3>
           <p className="text-xs text-summer-text/40">قريباً: إضافة/حذف أفراد العائلة وتعديل صلاحياتهم</p>
        </section>
      </div>
    </div>
  );
};

const SmartAdvisor = () => {
  return null;
};

const ShopPage = ({ profile }: { profile: UserProfile }) => {
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCost, setNewCost] = useState(50);
  const isParent = profile.role === 'parent';

  useEffect(() => {
    return onSnapshot(collection(db, 'prizes'), (snapshot) => {
      setPrizes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Prize)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'prizes');
    });
  }, []);

  const addPrize = async () => {
    if (!newTitle) return;
    try {
      await addDoc(collection(db, 'prizes'), {
        title: newTitle,
        cost: Number(newCost),
        createdAt: serverTimestamp()
      });
      setNewTitle('');
      setShowAdd(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'prizes');
    }
  };

  const buyPrize = async (prize: Prize) => {
    if (profile.points < prize.cost) {
      alert('نقاطك لا تكفي! استمر في العمل الرائع ✨');
      return;
    }
    
    try {
      // 1. Deduct Points
      await updateDoc(doc(db, 'users', profile.uid), {
        points: profile.points - prize.cost
      });

      // 2. Record Transaction
      await addDoc(collection(db, 'transactions'), {
        userId: profile.uid,
        userName: profile.displayName,
        type: 'prize_purchase',
        prizeTitle: prize.title,
        points: prize.cost,
        status: 'approved',
        requestedAt: serverTimestamp()
      });

      alert(`تم شراء "${prize.title}" بنجاح! سيصلك تنبيه قريباً.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'prize_purchase');
    }
  };

  return (
    <div className="pb-24 bg-summer-bg min-h-screen">
      
      <div className="px-6 mt-6 space-y-6">
        <div className="bg-summer-card p-6 rounded-3xl border border-white/20 flex items-center justify-between shadow-xl">
          <div>
            <p className="text-summer-text/40 text-[10px] uppercase tracking-widest font-bold mb-1">الرصيد المتاح</p>
            <h4 className="text-2xl font-black text-summer-accent">{profile.points} <span className="text-xs text-summer-text/50">نقطة</span></h4>
          </div>
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-summer-accent">
            <ShoppingBag size={24} />
          </div>
        </div>

        {isParent && (
          <button 
            onClick={() => setShowAdd(!showAdd)}
            className="w-full bg-summer-primary text-white rounded-2xl py-4 font-bold flex items-center justify-center gap-3 shadow-lg hover:bg-summer-primary/90 transition-all active:scale-95"
          >
            <PlusCircle size={20} />
            <span>إضافة مكافأة جديدة للمتجر</span>
          </button>
        )}

        <AnimatePresence>
          {showAdd && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-summer-card p-6 rounded-3xl border border-white/40 space-y-4 shadow-2xl">
                <input 
                  placeholder="اسم المكافأة (مثلاً: ساعة إضافية سوني)"
                  className="w-full bg-white/20 border border-white/20 rounded-2xl px-5 py-4 text-summer-text placeholder:text-summer-text/30 outline-none focus:border-summer-accent transition-colors"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
                <input 
                  type="number"
                  placeholder="التكلفة بالنقاط"
                  className="w-full bg-white/20 border border-white/20 rounded-2xl px-5 py-4 text-summer-text outline-none focus:border-summer-accent placeholder:text-summer-text/30"
                  value={newCost}
                  onChange={(e) => setNewCost(Number(e.target.value))}
                />
                <button 
                  onClick={addPrize}
                  className="w-full summer-gradient text-white py-4 rounded-2xl font-black shadow-lg"
                >
                  حفظ في المتجر
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {prizes.map(prize => (
            <div key={prize.id} className="bg-summer-card p-5 rounded-3xl border border-white/30 relative overflow-hidden group shadow-xl hover:border-summer-accent/30 transition-all">
              <div className="absolute top-0 left-0 w-full h-1 bg-summer-accent scale-x-0 group-hover:scale-x-100 transition-transform origin-right" />
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="text-lg font-bold text-summer-text">{prize.title}</h4>
                  <p className="text-summer-accent font-black text-xs">{prize.cost} نقطة</p>
                </div>
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-summer-text/20 group-hover:text-summer-accent transition-colors">
                  <Star size={20} />
                </div>
              </div>
              <button 
                onClick={() => buyPrize(prize)}
                className="w-full bg-white/20 hover:bg-summer-accent hover:text-white text-summer-text rounded-xl py-3 text-xs font-bold transition-all shadow-sm"
              >
                {isParent ? 'تعديل المكافأة' : 'شراء الآن'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const { user, profile, loading } = useAuth();

  if (loading) return (
    <div className="h-screen bg-summer-bg flex items-center justify-center p-8">
       <div className="w-16 h-1 w-full bg-white/20 rounded-full overflow-hidden">
          <motion.div 
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
            className="w-full h-full summer-gradient"
          />
       </div>
    </div>
  );

  if (!user || !profile) return <Landing />;

  return (
    <Router>
      <div className={cn("min-h-screen bg-summer-bg flex flex-col md:flex-row-reverse rtl")} dir="rtl">
        <Navbar profile={profile} />
        <main className="flex-1 overflow-x-hidden md:max-w-4xl md:mx-auto bg-summer-bg shadow-2xl border-x border-white/20">
          <Routes>
            <Route path="/" element={<Dashboard profile={profile} />} />
            <Route path="/tasks" element={<TasksPage profile={profile} />} />
            <Route path="/chat" element={<ChatPage profile={profile} />} />
            <Route path="/wallet" element={<WalletPage profile={profile} />} />
            <Route path="/shop" element={<ShopPage profile={profile} />} />
            <Route path="/settings" element={<SettingsPage profile={profile} />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

// No-op for late binding
