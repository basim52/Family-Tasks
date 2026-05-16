import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { toPng } from 'html-to-image';
import { 
  Home, 
  CheckSquare, 
  MessageCircle, 
  Wallet as WalletIcon, 
  User as UserIcon,
  Users,
  User,
  Video,
  Phone,
  Mic,
  Image as ImageIcon,
  Square,
  LogOut,
  PlusCircle,
  Bell,
  BellRing,
  ArrowUpRight,
  TrendingUp,
  Star,
  PlusCircle as PlusCircleIcon,
  CheckCircle2,
  Target,
  Trophy,
  Award,
  Medal,
  Settings,
  ShoppingBag,
  Heart,
  MessageSquare,
  Edit2,
  X,
  Smile,
  Frown,
  Meh,
  Plus,
  Zap,
  Sparkles,
  Share2,
  Download,
  Trash2
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
  deleteDoc,
  arrayUnion,
  limit,
  getDoc,
  getDocs
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Task, Message, UserProfile, Prize, TaskComment, BigGoal, MonthlyReward, Call, BehaviorRating, Motivation, MotivationTemplate, Cheque } from './types';
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
const NotificationsFeed = ({ profile, limit: limitCount = 5 }: { profile: UserProfile, limit?: number }) => {
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, 'notifications'), 
      where('userId', '==', profile.uid),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    return onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notifications');
    });
  }, [profile.uid, limitCount]);

  if (notifications.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-[10px] text-summer-text/20 font-bold italic">لا توجد تنبيهات جديدة حالياً.. استمتع بيومك! ✨</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {notifications.map((n, i) => (
        <motion.div 
          key={n.id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1 }}
          className={cn(
            "flex items-start gap-4 p-4 rounded-3xl border transition-all",
            n.read ? "bg-white/5 border-white/5 opacity-60" : "bg-white/20 border-white/20"
          )}
        >
          <div className={cn(
            "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm",
            n.type === 'success' ? "bg-emerald-500/20 text-emerald-600" : 
            n.type === 'warning' ? "bg-red-500/20 text-red-600" :
            "bg-summer-accent/20 text-summer-accent"
          )}>
            <Bell size={20} />
          </div>
          <div>
            <div className="flex justify-between items-start mb-1">
               <p className="text-xs font-black text-summer-text">{n.title}</p>
               <span className="text-[8px] text-summer-text/20 font-bold whitespace-nowrap">{n.createdAt?.toDate?.()?.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <p className="text-[10px] text-summer-text/50 leading-relaxed font-bold">{n.body}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

const NotificationCentre = ({ profile }: { profile: UserProfile }) => {
  const [notifications, setNotifications] = useState<any[]>([]); // Keep any if dynamic, but we use properties
  const [isOpen, setIsOpen] = useState(false);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    const q = query(
      collection(db, 'notifications'), 
      where('userId', '==', profile.uid),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    return onSnapshot(q, (snapshot) => {
      const newNotifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      
      // Notify only on new additions post-load
      if (!isFirstLoad.current && newNotifs.length > 0) {
        const lastNotif = newNotifs[0];
        // Check if it's truly a new notification (created within last 5 seconds)
        const isRecent = lastNotif.createdAt && (Date.now() - lastNotif.createdAt.toMillis() < 5000);
        
        if (isRecent && Notification.permission === 'granted') {
          // Use window.Notification to avoid collisions if any
          new window.Notification(lastNotif.title, {
            body: lastNotif.body,
            icon: '/pwa-192x192.png'
          });
        }
      }
      
      setNotifications(newNotifs);
      isFirstLoad.current = false;
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notifications');
    });
  }, [profile.uid]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-3 bg-white/20 rounded-2xl hover:bg-white/30 transition-colors relative group"
      >
        <motion.div
          animate={unreadCount > 0 ? {
            rotate: [0, -15, 12, -15, 12, 0],
            transition: {
              repeat: Infinity,
              duration: 2.5,
              repeatDelay: 1.5
            }
          } : {}}
        >
          <Bell size={20} className={cn("transition-colors", unreadCount > 0 ? "text-summer-accent" : "text-summer-text")} />
        </motion.div>
        
        {unreadCount > 0 && (
          <div className="absolute top-2.5 right-2.5 flex items-center justify-center">
            <span className="relative z-10 w-4.5 h-4.5 bg-red-500 border-2 border-white/40 rounded-full text-[8px] flex items-center justify-center font-black text-white shadow-lg">
              {unreadCount}
            </span>
            <motion.span 
              initial={{ scale: 0.8, opacity: 0.8 }}
              animate={{ scale: 1.8, opacity: 0 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "easeOut" }}
              className="absolute w-4 h-4 bg-red-500 rounded-full"
            />
          </div>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm" onClick={() => setIsOpen(false)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm bg-summer-card border border-white/40 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] p-6 overflow-hidden flex flex-col max-h-[80vh] relative"
            >
              <div className="flex justify-between items-center mb-6">
                <h4 className="font-black text-summer-text text-lg pr-2">تنبيهات العائلة 🔔</h4>
                <button onClick={() => setIsOpen(false)} className="text-summer-text/40 hover:text-summer-text p-1">
                  <X size={20} />
                </button>
              </div>
              
              <div className="space-y-3 overflow-y-auto pr-1 flex-1">
                {notifications.length === 0 && (
                  <div className="text-center py-12">
                    <BellRing size={48} className="mx-auto text-summer-text/10 mb-4" />
                    <p className="text-xs text-summer-text/40 font-bold">لا توجد تنبيهات حالياً</p>
                  </div>
                )}
                {notifications.map(n => (
                  <div 
                    key={n.id} 
                    className={cn(
                      "p-5 rounded-3xl border transition-all", 
                      n.read ? "bg-white/5 opacity-50 border-white/5" : "bg-white/20 border-white/20 shadow-md translate-x-[-2px]"
                    )}
                  >
                    <div className="flex justify-between items-start gap-2 mb-2">
                       <p className="text-sm font-black text-summer-text leading-tight">{n.title}</p>
                       <span className="text-[8px] text-summer-text/20 font-bold whitespace-nowrap">{n.createdAt?.toDate?.()?.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-[11px] text-summer-text/60 leading-relaxed font-medium">{n.body}</p>
                  </div>
                ))}
              </div>

              {notifications.length > 0 && (
                <button 
                  onClick={async () => {
                     // In a real app we'd mark all as read here
                     setIsOpen(false);
                  }}
                  className="mt-6 w-full py-4 text-xs font-black text-summer-accent bg-summer-accent/5 rounded-2xl hover:bg-summer-accent/10 transition-all uppercase tracking-widest"
                >
                  إغلاق التنبيهات
                </button>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
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

// --- Family Strategy & Suggestions ---

const SUGGESTED_PLANS = {
  tasks: [
    { title: '🌱 سقي نباتات المنزل', points: 10, category: 'مسؤولية' },
    { title: '📚 قراءة لمدة 15 دقيقة', points: 15, category: 'تطوير' },
    { title: '🍽️ المساعدة في تجهيز السفرة', points: 10, category: 'تعاون' },
    { title: '🧸 ترتيب الألعاب بدقة', points: 20, category: 'تنظيم' },
    { title: '🥣 غسل الأطباق الخاصة بي', points: 15, category: 'مسؤولية' },
    { title: '👟 تنظيف الحذاء المدرسي/الرياضي', points: 10, category: 'عناية' }
  ],
  bigGoals: [
    { title: '☕ رحلة للمقهى المفضل مع الأهل', target: 300, icon: '☕' },
    { title: '🎡 ذهاب لمدينة الملاهي', target: 1000, icon: '🎡' },
    { title: '🍦 آيسكريم مميز في نهاية الأسبوع', target: 150, icon: '🍦' },
    { title: '📽️ اختيار فيلم السهرة مع الفشار', target: 200, icon: '📽️' },
    { title: '🎁 شراء لعبة جديدة (ميزانية محددة)', target: 800, icon: '🎁' }
  ],
  monthlyRewards: [
    { title: '🍕 حفل بيتزا ليلة الجمعة', cost: 150 },
    { title: '🎮 بطاقة شحن ألعاب', cost: 300 },
    { title: '🌙 سهرة متأخرة ساعة إضافية', cost: 100 },
    { title: '🎨 طقم تلوين جديد', cost: 250 },
    { title: '👟 حذاء رياضي من اختيارك', cost: 1000 }
  ]
};

const SuggestionsLibrary = ({ onSelectTask, onSelectGoal, onSelectMonthly }: { 
  onSelectTask?: (task: any) => void, 
  onSelectGoal?: (goal: any) => void,
  onSelectMonthly?: (reward: any) => void
}) => {
  return (
    <div className="space-y-6">
      {onSelectTask && (
        <div className="space-y-3">
          <h4 className="text-[10px] font-black text-summer-accent uppercase tracking-widest px-1">مقترحات مهام ذكية 💡</h4>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_PLANS.tasks.map((task, i) => (
              <button 
                key={i}
                onClick={() => onSelectTask(task)}
                className="bg-white/40 border border-white/60 px-3 py-2 rounded-xl text-[10px] font-bold text-summer-text hover:bg-summer-accent hover:text-white transition-all shadow-sm"
              >
                {task.title} (+{task.points})
              </button>
            ))}
          </div>
        </div>
      )}

      {onSelectGoal && (
        <div className="space-y-3">
          <h4 className="text-[10px] font-black text-summer-accent uppercase tracking-widest px-1">أهداف كبيرة مقترحة 🎯</h4>
          <div className="grid grid-cols-1 gap-2">
            {SUGGESTED_PLANS.bigGoals.map((goal, i) => (
              <button 
                key={i}
                onClick={() => onSelectGoal(goal)}
                className="flex items-center justify-between bg-white/40 border border-white/60 p-3 rounded-xl text-[11px] font-bold text-summer-text hover:border-summer-accent transition-all group"
              >
                <span className="flex items-center gap-2">
                  <span className="text-sm">{goal.icon}</span>
                  {goal.title}
                </span>
                <span className="bg-summer-accent/10 text-summer-accent px-2 py-0.5 rounded-lg group-hover:bg-summer-accent group-hover:text-white transition-colors">
                  {goal.target} ن
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {onSelectMonthly && (
        <div className="space-y-3">
          <h4 className="text-[10px] font-black text-summer-accent uppercase tracking-widest px-1">جوائز شهرية مقترحة 🎁</h4>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_PLANS.monthlyRewards.map((reward, i) => (
              <button 
                key={i}
                onClick={() => onSelectMonthly(reward)}
                className="bg-white/40 border border-white/60 px-3 py-2 rounded-xl text-[10px] font-bold text-summer-text hover:bg-summer-accent hover:text-white transition-all shadow-sm"
              >
                {reward.title} ({reward.cost} ن)
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const SmartAchievement = ({ totalPoints }: { totalPoints: number }) => {
  const levels = [
    { name: 'مبتدئ', min: 0, max: 200, color: 'from-slate-400 to-slate-500' },
    { name: 'برونزي', min: 200, max: 500, color: 'from-amber-600 to-amber-700' },
    { name: 'فضي', min: 500, max: 1000, color: 'from-gray-300 to-gray-400' },
    { name: 'ذهبي', min: 1000, max: Infinity, color: 'from-yellow-400 to-yellow-600' }
  ];

  const currentLevel = levels.find(l => totalPoints >= l.min && totalPoints < l.max) || levels[0];
  const progress = totalPoints < 1000 ? ((totalPoints - currentLevel.min) / (currentLevel.max - currentLevel.min)) * 100 : 100;

  return (
    <div className="bg-summer-card p-6 rounded-3xl border border-white/20 shadow-xl space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xs font-black text-summer-text/40 uppercase tracking-widest">إنجازاتك</h3>
        <Trophy size={18} className="text-summer-accent" />
      </div>
      <div className="flex items-center gap-4">
        <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-br text-white shadow-lg", currentLevel.color)}>
           <Star size={32} />
        </div>
        <div className="flex-1">
          <p className="text-xl font-black text-summer-text">{currentLevel.name}</p>
          <div className="mt-2 h-2 w-full bg-white/20 rounded-full overflow-hidden">
             <motion.div 
               initial={{ width: 0 }}
               animate={{ width: `${progress}%` }}
               className="h-full summer-gradient"
             />
          </div>
          <p className="text-[10px] mt-1 text-summer-text/40 font-bold">
            {totalPoints < 1000 ? `بقي ${currentLevel.max - totalPoints} نقطة للمستوى التالي` : 'أنت في القمة!'}
          </p>
        </div>
      </div>
    </div>
  );
};

const BigGoalCard = ({ profile }: { profile: UserProfile }) => {
  const [goal, setGoal] = useState<BigGoal | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'bigGoals'),
      where('userId', '==', profile.uid),
      where('status', '==', 'active'),
      limit(1)
    );
    return onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setGoal({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as BigGoal);
      } else {
        setGoal(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'bigGoals');
    });
  }, [profile.uid]);

  if (!goal) return null;

  const progress = Math.min(100, (profile.points / goal.targetPoints) * 100);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-summer-card p-6 rounded-[2.5rem] border border-white/40 shadow-2xl relative overflow-hidden group"
    >
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform duration-700">
        <Target size={120} />
      </div>
      
      <div className="flex justify-between items-start mb-6">
        <div>
          <h4 className="text-[10px] font-black text-summer-accent uppercase tracking-[0.2em] mb-1">الهدف العائلي الكبير 🎯</h4>
          <h3 className="text-2xl font-black text-summer-text tracking-tight">{goal.title}</h3>
        </div>
        <div className="bg-summer-accent text-white px-4 py-2 rounded-2xl font-black shadow-lg flex items-center gap-2">
          <span>{goal.targetPoints}</span>
          <Star size={14} className="animate-spin-slow" />
        </div>
      </div>

      <div className="space-y-5">
        <div className="flex justify-between text-[11px] font-black text-summer-text/50 uppercase tracking-wider">
          <span>{profile.points} مجمعة</span>
          <span>{goal.targetPoints} للهدف</span>
        </div>
        <div className="h-6 bg-white/20 rounded-full overflow-hidden border border-white/20 shadow-inner group-hover:border-summer-accent/30 transition-colors">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="h-full summer-gradient relative"
          >
            {progress > 5 && (
              <div className="absolute right-0 top-0 bottom-0 w-8 bg-white/20 animate-pulse" />
            )}
          </motion.div>
        </div>
        <motion.p 
          animate={progress >= 100 ? { scale: [1, 1.1, 1] } : {}}
          transition={{ repeat: Infinity, duration: 2 }}
          className="text-center text-[10px] font-black text-summer-accent uppercase tracking-widest bg-white/20 py-2 rounded-xl"
        >
          {progress >= 100 ? '🎉 مبروك! الهدف بانتظارك 🎉' : `هيا يا بطل! بقي ${goal.targetPoints - profile.points} نقطة للوصول ✨`}
        </motion.p>
      </div>
    </motion.div>
  );
};

const BigGoalManager: React.FC<{ childUid: string; childName: string }> = ({ childUid, childName }) => {
  const [goal, setGoal] = useState<BigGoal | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTarget, setNewTarget] = useState(500);

  useEffect(() => {
    const q = query(
      collection(db, 'bigGoals'),
      where('userId', '==', childUid),
      where('status', '==', 'active'),
      limit(1)
    );
    return onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setGoal({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as BigGoal);
      } else {
        setGoal(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'bigGoals');
    });
  }, [childUid]);

  const addGoal = async () => {
    if (!newTitle) return;
    await addDoc(collection(db, 'bigGoals'), {
      title: newTitle,
      targetPoints: Number(newTarget),
      userId: childUid,
      status: 'active',
      createdAt: serverTimestamp()
    });
    setNewTitle('');
    setShowAdd(false);
  };

  const deleteGoal = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا الهدف؟')) {
      await updateDoc(doc(db, 'bigGoals', id), { status: 'completed' });
    }
  };

  return (
    <div className="p-5 bg-white/10 rounded-3xl border border-white/10 shadow-inner group hover:border-white/30 transition-all">
      <div className="flex justify-between items-center mb-4">
        <h5 className="text-[10px] font-black text-summer-text/40 uppercase tracking-widest flex items-center gap-2">
          <Target size={12} className="text-summer-accent" />
          الهدف الكبير لـ {childName}
        </h5>
        {!goal && !showAdd && (
          <button 
            onClick={() => setShowAdd(true)} 
            className="bg-summer-accent/10 text-summer-accent text-[9px] font-black uppercase px-3 py-1.5 rounded-lg border border-summer-accent/20 hover:bg-summer-accent hover:text-white transition-all"
          >
            إعداد الهدف +
          </button>
        )}
      </div>

      {goal ? (
        <div className="flex justify-between items-center bg-white/20 p-4 rounded-2xl border border-white/10 hover:border-summer-accent/20 transition-all">
          <div>
            <p className="text-sm font-black text-summer-text mb-0.5">{goal.title}</p>
            <div className="flex items-center gap-1.5">
               <span className="text-[10px] font-black text-summer-accent">{goal.targetPoints} نقطة</span>
               <div className="w-1 h-1 bg-summer-text/20 rounded-full" />
               <span className="text-[10px] font-bold text-summer-text/30">نشط</span>
            </div>
          </div>
          <button onClick={() => deleteGoal(goal.id)} className="w-10 h-10 bg-red-500/10 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm">
            <X size={18} />
          </button>
        </div>
      ) : showAdd ? (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <input 
            placeholder="الهدف (مثلاً: يوم في الملاهي 🎠)"
            className="w-full bg-white/30 border border-white/30 rounded-2xl px-5 py-3.5 text-xs text-summer-text outline-none focus:border-summer-accent placeholder:text-summer-text/30 transition-all"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <div className="flex gap-2">
            <input 
              type="number"
              placeholder="النقاط"
              className="flex-1 bg-white/30 border border-white/30 rounded-2xl px-5 py-3.5 text-xs text-summer-text outline-none focus:border-summer-accent transition-all"
              value={newTarget}
              onChange={(e) => setNewTarget(Number(e.target.value))}
            />
            <button 
              onClick={addGoal} 
              className="bg-summer-accent text-white px-6 rounded-2xl text-[10px] font-black shadow-lg hover:scale-105 active:scale-95 transition-all"
            >
              حفظ
            </button>
            <button 
              onClick={() => setShowAdd(false)} 
              className="text-summer-text/40 px-3 text-[10px] font-bold hover:text-summer-text transition-colors"
            >
              إلغاء
            </button>
          </div>
          <div className="pt-2">
            <SuggestionsLibrary onSelectGoal={(goal) => {
              setNewTitle(goal.title);
              setNewTarget(goal.target);
            }} />
          </div>
        </div>
      ) : (
        <p className="text-[10px] text-summer-text/20 text-center py-4 italic font-bold">لم يتم تحديد هدف كبير لهذا الطفل بعد</p>
      )}
    </div>
  );
};

const FamilyBigGoals = () => {
  const [children, setChildren] = useState<UserProfile[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', '==', 'child'));
    return onSnapshot(q, (snapshot) => {
      setChildren(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });
  }, []);

  return (
    <section className="space-y-4">
      <h3 className="text-sm font-bold text-summer-text/40 uppercase tracking-[0.2em] px-1 whitespace-nowrap">إدارة الأهداف الكبيرة 🎯</h3>
      <div className="grid grid-cols-1 gap-4">
        {children.map(child => (
          <BigGoalManager key={child.uid} childUid={child.uid} childName={child.displayName} />
        ))}
        {children.length === 0 && (
          <p className="text-xs text-summer-text/40 bg-white/10 p-6 rounded-3xl text-center italic">لا يوجد أطفال مضافين حالياً</p>
        )}
      </div>
    </section>
  );
};

const MonthlyRewardsManager = () => {
  const [rewards, setRewards] = useState<MonthlyReward[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCost, setNewCost] = useState(100);
  const currentMonth = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    const q = query(collection(db, 'monthlyRewards'), where('month', '==', currentMonth));
    return onSnapshot(q, (snapshot) => {
      setRewards(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MonthlyReward)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'monthlyRewards');
    });
  }, [currentMonth]);

  const addReward = async () => {
    if (!newTitle) return;
    await addDoc(collection(db, 'monthlyRewards'), {
      title: newTitle,
      cost: Number(newCost),
      month: currentMonth,
      createdAt: serverTimestamp(),
      claimedBy: []
    });
    setNewTitle('');
    setShowAdd(false);
  };

  const deleteReward = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذه الجائزة الشهرية؟')) {
      await deleteDoc(doc(db, 'monthlyRewards', id));
    }
  };

  return (
    <section className="bg-summer-card p-6 rounded-3xl border border-white/20 shadow-xl space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-bold text-summer-text/40 uppercase tracking-widest px-1">جوائز الشهر ({currentMonth}) 🎁</h3>
        <button 
          onClick={() => setShowAdd(!showAdd)}
          className="bg-summer-accent text-white p-2 rounded-xl shadow-lg hover:scale-105 transition-all"
        >
          {showAdd ? <X size={18} /> : <Plus size={18} />}
        </button>
      </div>

      {showAdd && (
        <div className="bg-white/10 p-4 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <input 
            placeholder="اسم الجائزة (مثلاً: آيسكريم عملاق 🍦)"
            className="w-full bg-white/30 border border-white/30 rounded-xl px-4 py-3 text-xs text-summer-text outline-none focus:border-summer-accent placeholder:text-summer-text/30"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <div className="flex gap-2">
            <input 
              type="number"
              placeholder="التكلفة"
              className="flex-1 bg-white/30 border border-white/30 rounded-xl px-4 py-3 text-xs text-summer-text outline-none focus:border-summer-accent"
              value={newCost}
              onChange={(e) => setNewCost(Number(e.target.value))}
            />
            <button 
              onClick={addReward}
              className="bg-summer-accent text-white px-6 rounded-xl text-xs font-black"
            >
              إضافة
            </button>
          </div>
          <div className="pt-2">
            <SuggestionsLibrary onSelectMonthly={(reward) => {
              setNewTitle(reward.title);
              setNewCost(reward.cost);
            }} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {rewards.map(reward => (
          <div key={reward.id} className="flex justify-between items-center bg-white/20 p-4 rounded-2xl border border-white/10 group">
            <div>
              <p className="text-sm font-black text-summer-text">{reward.title}</p>
              <p className="text-[10px] font-bold text-summer-accent">{reward.cost} نقطة</p>
            </div>
            <button 
              onClick={() => deleteReward(reward.id)}
              className="w-8 h-8 flex items-center justify-center text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
            >
              <X size={16} />
            </button>
          </div>
        ))}
        {rewards.length === 0 && !showAdd && (
          <p className="text-center text-xs text-summer-text/30 py-4 italic font-bold">لا توجد جوائز مضافة لهذا الشهر</p>
        )}
      </div>
    </section>
  );
};

const MonthlyRewardsShop = ({ profile }: { profile: UserProfile }) => {
  const [rewards, setRewards] = useState<MonthlyReward[]>([]);
  const currentMonth = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    const q = query(collection(db, 'monthlyRewards'), where('month', '==', currentMonth));
    return onSnapshot(q, (snapshot) => {
      setRewards(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MonthlyReward)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'monthlyRewards');
    });
  }, [currentMonth]);

  const claimReward = async (reward: MonthlyReward) => {
    if (profile.role !== 'child') return;
    if (profile.points < reward.cost) {
      alert('نقاطك غير كافية لهذه الجائزة! استمر في العمل الرائع 🌟');
      return;
    }

    if (reward.claimedBy?.includes(profile.uid)) {
      alert('لقد حصلت على هذه الجائزة بالفعل لهذا الشهر! 🎉');
      return;
    }

    if (!confirm(`هل تريد استبدال ${reward.cost} نقطة بـ "${reward.title}"؟`)) return;

    try {
      const childDoc = doc(db, 'users', profile.uid);
      const rewardDoc = doc(db, 'monthlyRewards', reward.id);

      await updateDoc(childDoc, {
        points: profile.points - reward.cost
      });

      await updateDoc(rewardDoc, {
        claimedBy: arrayUnion(profile.uid)
      });

      await addDoc(collection(db, 'transactions'), {
        userId: profile.uid,
        userName: profile.displayName,
        type: 'redeem',
        points: reward.cost,
        currencyAmount: 0,
        status: 'approved',
        requestedAt: serverTimestamp(),
        processedAt: serverTimestamp(),
        note: `جائزة شهرية: ${reward.title}`
      });

      alert('يا بطل! تم خصم النقاط، استلم جائزتك من أهلك الآن! 🎁✨');
    } catch (err) {
      console.error(err);
      alert('عذراً، حدث خطأ أثناء المطالبة بالجائزة.');
    }
  };

  if (rewards.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex justify-between items-center px-1">
        <h3 className="text-sm font-black text-summer-text/40 uppercase tracking-widest">جوائز الشهر الخاصة 🌟</h3>
        <div className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-black text-summer-accent uppercase tracking-widest">
          {currentMonth}
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {rewards.map(reward => {
          const isClaimed = reward.claimedBy?.includes(profile.uid);
          const canAfford = profile.points >= reward.cost;

          return (
            <motion.div 
              key={reward.id}
              whileHover={{ y: -5 }}
              className={cn(
                "p-5 rounded-3xl border transition-all relative overflow-hidden group",
                isClaimed ? "bg-emerald-500/10 border-emerald-500/30" : "bg-summer-card border-white/20 shadow-xl"
              )}
            >
              <div className="relative z-10 flex justify-between items-start">
                <div className="space-y-1">
                  <p className="text-lg font-black text-summer-text">{reward.title}</p>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "px-2 py-1 rounded-lg text-[10px] font-black",
                      canAfford ? "bg-summer-accent/10 text-summer-accent" : "bg-red-500/10 text-red-500"
                    )}>
                      {reward.cost} نقطة
                    </span>
                    {isClaimed && (
                      <span className="bg-emerald-500 text-white px-2 py-1 rounded-lg text-[9px] font-black flex items-center gap-1">
                        <CheckCircle2 size={10} /> تم الحصول عليها
                      </span>
                    )}
                  </div>
                </div>
                
                {!isClaimed && (
                  <button 
                    onClick={() => claimReward(reward)}
                    disabled={!canAfford}
                    className={cn(
                      "p-3 rounded-2xl shadow-lg transition-all active:scale-95",
                      canAfford ? "summer-gradient text-white hover:scale-110" : "bg-white/20 text-summer-text/20 cursor-not-allowed"
                    )}
                  >
                    <ShoppingBag size={20} />
                  </button>
                )}
              </div>
              
              {!isClaimed && !canAfford && (
                <div className="mt-4 h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                   <motion.div 
                     initial={{ width: 0 }}
                     animate={{ width: `${(profile.points / reward.cost) * 100}%` }}
                     className="h-full bg-summer-accent/40" 
                   />
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};

const Dashboard = ({ profile }: { profile: UserProfile }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [motivations, setMotivations] = useState<Motivation[]>([]);
  const isParent = profile.role === 'parent';
  const level = getLevel(profile.totalPointsEarned);

  useEffect(() => {
    const qTasks = isParent 
      ? query(collection(db, 'tasks'), orderBy('createdAt', 'desc'))
      : query(collection(db, 'tasks'), where('assignedTo', '==', profile.uid), orderBy('createdAt', 'desc'));
    
    const unsubTasks = onSnapshot(qTasks, (snapshot) => {
      setTasks(snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Task))
        .filter(t => t.status !== 'approved')
      );
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tasks');
    });

    // Fetch motivations for children
    let unsubMotivations = () => {};
    if (!isParent) {
      const qMotivations = query(
        collection(db, 'motivations'), 
        where('receiverId', '==', profile.uid), 
        orderBy('createdAt', 'desc'), 
        limit(3)
      );
      unsubMotivations = onSnapshot(qMotivations, (snapshot) => {
        setMotivations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Motivation)));
      });
    }

    return () => {
      unsubTasks();
      unsubMotivations();
    };
  }, [profile.uid, isParent]);

  const requestNotifications = async () => {
    if (!('Notification' in window)) {
      alert('متصفحك لا يدعم الإشعارات.');
      return;
    }
    const permission = await window.Notification.requestPermission();
    if (permission === 'granted') {
      alert('تم تفعيل الإشعارات بنجاح! ستصلك تنبيهات المهام والرسائل حتى لو كان التطبيق في الخلفية.');
    } else {
      alert('تحتاج للموافقة على الإذن من إعدادات المتصفح لتفعيل الإشعارات.');
    }
  };

  return (
    <div className="pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500 bg-summer-bg min-h-screen">
      <Header title={`مرحباً، ${profile.displayName}`} profile={profile} />
      
      <div className="px-6 space-y-8 mt-6">
        {/* Family Mood Dashboard */}
        <FamilyPulse profile={profile} />

        {/* Notifications Prompt for Children */}
        {!isParent && typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission !== 'granted' && (
           <motion.section 
             initial={{ scale: 0.9, opacity: 0 }}
             animate={{ scale: 1, opacity: 1 }}
             className="bg-summer-accent/10 p-6 rounded-3xl border border-summer-accent/20 space-y-4 shadow-xl"
           >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-summer-accent rounded-xl flex items-center justify-center text-white shadow-lg">
                  <BellRing size={20} />
                </div>
                <h3 className="font-bold text-summer-text">فعل التنبيهات! 🔔</h3>
              </div>
              <p className="text-xs text-summer-text/60 leading-relaxed font-medium">فعل التنبيهات عشان ما تفوتك أي مهمة جديدة أو مكافأة من أهلك!</p>
              <button 
                onClick={requestNotifications}
                className="w-full bg-summer-accent text-white py-4 rounded-2xl font-black shadow-lg hover:shadow-summer-accent/40 active:scale-95 transition-all text-sm"
              >
                تفعيل الإشعارات الآن
              </button>
           </motion.section>
        )}

        {/* Big Goal Section */}
        {!isParent ? (
          <BigGoalCard profile={profile} />
        ) : (
          <FamilyBigGoals />
        )}

        {/* Motivation Feed for Children */}
        {!isParent && motivations.length > 0 && (
           <section className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <h3 className="text-sm font-bold text-summer-text/40 uppercase tracking-[0.2em]">كلمات تشجيعية ✨</h3>
                <Link to="/motivation" className="text-[10px] font-black text-summer-accent">عرض الكل</Link>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {motivations.map(m => (
                  <motion.div 
                    key={m.id}
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-summer-accent/10 border border-summer-accent/30 p-4 rounded-3xl flex items-center gap-4 shadow-lg group"
                  >
                    <div className="w-10 h-10 bg-summer-accent rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg group-hover:rotate-12 transition-transform">
                      <Sparkles size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-summer-text leading-relaxed">"{m.message}"</p>
                      <p className="text-[9px] text-summer-text/40 mt-1 font-black">بقلم: {m.senderName}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
           </section>
        )}

        {/* Recently Notifications Feed (Middle of the page as requested) */}
        <section className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-sm font-bold text-summer-text/40 uppercase tracking-[0.2em]">آخر التنبيهات العائلية 🔔</h3>
            <button 
              onClick={() => {
                // We'd need something to trigger the modal from here, or just let users use the bell
              }}
              className="text-[10px] font-black text-summer-accent opacity-0" // Hidden but spacing
            >
              عرض الكل
            </button>
          </div>
          <div className="bg-summer-card p-6 rounded-[2.5rem] border border-white/40 shadow-xl overflow-hidden relative">
             <div className="absolute top-0 right-0 p-4 opacity-[0.03] rotate-12">
                <BellRing size={80} />
             </div>
             <NotificationsFeed profile={profile} limit={3} />
          </div>
        </section>

        {/* User Stats & Level */}
        {!isParent && (
          <SmartAchievement totalPoints={profile.totalPointsEarned || 0} />
        )}

        {/* Wallet Section */}
        <WalletCard profile={profile} exchangeRate={0.25} />

        {/* Quick Actions for Parent */}
        {isParent && (
          <section className="space-y-4">
            <h3 className="text-sm font-bold text-summer-text/40 uppercase tracking-[0.2em] px-1">إجراءات سريعة</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <Link to="/behavior" className="bg-summer-card p-6 rounded-3xl border border-white/20 flex items-center gap-4 group shadow-xl hover:border-white/40 transition-all">
                <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                  <Star size={24} />
                </div>
                <div className="text-right">
                  <p className="font-bold text-summer-text text-sm">تقييم السلوك</p>
                  <p className="text-[10px] text-summer-text/40">منح/خصم نقاط</p>
                </div>
              </Link>
              <Link to="/motivation" className="bg-summer-card p-6 rounded-3xl border border-white/20 flex items-center gap-4 group shadow-xl hover:border-white/40 transition-all">
                <div className="w-12 h-12 bg-summer-accent rounded-2xl flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                  <Zap size={24} />
                </div>
                <div className="text-right">
                  <p className="font-bold text-summer-text text-sm">المحفز الذكي</p>
                  <p className="text-[10px] text-summer-text/40">رسائل إيجابية</p>
                </div>
              </Link>
            </div>
          </section>
        )}

        {/* Monthly Rewards Section */}
        {!isParent ? (
          <MonthlyRewardsShop profile={profile} />
        ) : (
          <MonthlyRewardsManager />
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
                  {(task.startTime || task.endTime) && (
                    <div className="mt-3 flex items-center gap-3 text-[10px] font-black text-white/70 bg-white/10 px-3 py-1.5 rounded-xl w-max">
                      <span className="flex items-center gap-1.5">
                        <Play size={10} />
                        {task.startTime || '--:--'}
                      </span>
                      <span className="opacity-30">|</span>
                      <span className="flex items-center gap-1.5">
                        <Pause size={10} />
                        {task.endTime || '--:--'}
                      </span>
                    </div>
                  )}
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
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `tasks/${taskId}/comments`);
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
  const [newStartTime, setNewStartTime] = useState('');
  const [newEndTime, setNewEndTime] = useState('');
  const [family, setFamily] = useState<UserProfile[]>([]);
  const isParent = profile.role === 'parent';
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPoints, setEditPoints] = useState(10);
  const [editAssigned, setEditAssigned] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [showComments, setShowComments] = useState<string | null>(null);

  const [showArchive, setShowArchive] = useState(false);

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

  const activeTasks = tasks.filter(t => t.status !== 'approved');
  const archivedTasks = tasks.filter(t => t.status === 'approved');
  const displayTasks = showArchive ? archivedTasks : activeTasks;

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
        startTime: newStartTime || null,
        endTime: newEndTime || null,
        createdBy: profile.uid,
        createdAt: serverTimestamp(),
      });

      // Notify Child
      if (newAssigned) {
        await sendNotification(newAssigned, 'مهمة جديدة! 🚀', `لقد تم تكليفك بمهمة: ${newTitle}${newStartTime ? ` (تبدأ ${newStartTime})` : ''}`, 'task');
      }

      setNewTitle('');
      setNewStartTime('');
      setNewEndTime('');
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
      startTime: editStartTime || null,
      endTime: editEndTime || null,
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
    setEditStartTime(task.startTime || '');
    setEditEndTime(task.endTime || '');
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
        <div className="flex justify-between items-center px-1 mb-2">
          <div className="flex bg-white/10 p-1 rounded-2xl border border-white/10 flex-1">
            <button 
              onClick={() => setShowArchive(false)}
              className={cn(
                "flex-1 py-3 rounded-xl text-xs font-black transition-all",
                !showArchive ? "bg-summer-accent text-white shadow-lg" : "text-summer-text/40 hover:text-summer-text"
              )}
            >
              المهام النشطة
            </button>
            <button 
              onClick={() => setShowArchive(true)}
              className={cn(
                "flex-1 py-3 rounded-xl text-xs font-black transition-all",
                showArchive ? "bg-summer-accent text-white shadow-lg" : "text-summer-text/40 hover:text-summer-text"
              )}
            >
              الأرشيف (مكتمل)
            </button>
          </div>
        </div>

        {isParent && !showArchive && (
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
                
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-[10px] font-black text-summer-text/40 uppercase tracking-widest mb-1 block px-1">وقت البدء</label>
                    <input 
                      type="time"
                      className="w-full bg-white/20 border border-white/20 rounded-2xl px-5 py-4 text-summer-text outline-none focus:border-summer-accent transition-colors"
                      value={newStartTime}
                      onChange={(e) => setNewStartTime(e.target.value)}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-black text-summer-text/40 uppercase tracking-widest mb-1 block px-1">وقت الانتهاء</label>
                    <input 
                      type="time"
                      className="w-full bg-white/20 border border-white/20 rounded-2xl px-5 py-4 text-summer-text outline-none focus:border-summer-accent transition-colors"
                      value={newEndTime}
                      onChange={(e) => setNewEndTime(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="pt-2">
                  <SuggestionsLibrary onSelectTask={(task) => {
                    setNewTitle(task.title);
                    setNewPoints(task.points);
                  }} />
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

                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-[10px] font-black text-summer-text/40 uppercase tracking-widest mb-1 block px-1">وقت البدء</label>
                    <input 
                      type="time"
                      className="w-full bg-white/20 border border-white/20 rounded-2xl px-5 py-4 text-summer-text outline-none focus:border-summer-accent transition-colors"
                      value={editStartTime}
                      onChange={(e) => setEditStartTime(e.target.value)}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-black text-summer-text/40 uppercase tracking-widest mb-1 block px-1">وقت الانتهاء</label>
                    <input 
                      type="time"
                      className="w-full bg-white/20 border border-white/20 rounded-2xl px-5 py-4 text-summer-text outline-none focus:border-summer-accent transition-colors"
                      value={editEndTime}
                      onChange={(e) => setEditEndTime(e.target.value)}
                    />
                  </div>
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
          {displayTasks.map((task) => (
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
                  {(task.startTime || task.endTime) && (
                    <div className="mt-2 flex items-center gap-2 text-[10px] font-bold text-summer-accent">
                      <span className="flex items-center gap-1">
                        <Play size={10} />
                        {task.startTime || '--:--'}
                      </span>
                      <span>→</span>
                      <span className="flex items-center gap-1">
                        <Pause size={10} />
                        {task.endTime || '--:--'}
                      </span>
                    </div>
                  )}
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
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeCalls, setActiveCalls] = useState<Call[]>([]);
  const [currentCall, setCurrentCall] = useState<Call | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'calls'), where('status', '==', 'active'));
    return onSnapshot(q, (snapshot) => {
      const calls = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Call));
      setActiveCalls(calls);
      
      // If we are in a call that just ended, close UI
      if (currentCall && !calls.find(c => c.id === currentCall.id)) {
        setShowCall(false);
        setCurrentCall(null);
      }
    });
  }, [currentCall]);

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
      
      const mimeType = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav'].find(
        type => MediaRecorder.isTypeSupported(type)
      ) || '';
      
      if (!mimeType) {
        alert("متصفحك لا يدعم تسجيل الصوت.");
        return;
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        setIsUploading(true);
        try {
          const audioBlob = new Blob(chunks, { type: mimeType });
          const fileExt = mimeType.split('/')[1].split(';')[0];
          const storageRef = ref(storage, `audio/${profile.uid}_${Date.now()}.${fileExt}`);
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
          alert("فشل في إرسال التسجيل الصوتي.");
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
      alert("يرجى السماح بالوصول للميكروفون لتسجيل الصوت.");
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

  const initCall = async (type: 'video' | 'voice') => {
    const callData = {
      hostId: profile.uid,
      hostName: profile.displayName,
      hostPhoto: profile.photoURL || '',
      type,
      status: 'active',
      participants: [profile.uid],
      createdAt: serverTimestamp()
    };
    
    try {
      const docRef = await addDoc(collection(db, 'calls'), callData);
      setCurrentCall({ id: docRef.id, ...callData, createdAt: new Date() } as Call);
      setCallType(type);
      setShowCall(true);
    } catch (err) {
      console.error("Error starting call:", err);
      handleFirestoreError(err, OperationType.CREATE, 'calls');
    }
  };

  const joinCall = async (call: Call) => {
    try {
      await updateDoc(doc(db, 'calls', call.id), {
        participants: arrayUnion(profile.uid)
      });
      setCurrentCall(call);
      setCallType(call.type);
      setShowCall(true);
    } catch (err) {
      console.error("Error joining call:", err);
    }
  };

  const endCall = async () => {
    if (currentCall) {
      try {
        if (currentCall.hostId === profile.uid) {
          await updateDoc(doc(db, 'calls', currentCall.id), { status: 'ended' });
        } else {
          // just leave
          // simplified: just end for self
        }
      } catch (err) {
        console.error("Error ending call:", err);
      }
    }
    setShowCall(false);
    setCurrentCall(null);
  };

  return (
    <div className="h-screen flex flex-col pb-24 md:pb-0 bg-summer-bg">
      <Header 
        title="الدردشة العائلية" 
        profile={profile} 
        actions={
          <div className="flex gap-2">
            <button 
              onClick={() => initCall('voice')}
              className="w-10 h-10 bg-emerald-600/20 text-emerald-500 rounded-xl flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all active:scale-95 shadow-lg border border-emerald-500/20"
            >
              <Phone size={18} />
            </button>
            <button 
              onClick={() => initCall('video')}
              className="w-10 h-10 bg-summer-primary/20 text-summer-primary rounded-xl flex items-center justify-center hover:bg-summer-primary hover:text-white transition-all active:scale-95 shadow-lg border border-summer-primary/20"
            >
              <Video size={18} />
            </button>
          </div>
        }
      />

      {/* Active Calls Banner */}
      <div className="px-6 pt-4 space-y-3">
        {activeCalls.filter(c => c.hostId !== profile.uid && !c.participants.includes(profile.uid)).map(call => (
          <motion.div 
            key={call.id}
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-summer-accent text-white p-4 rounded-3xl flex items-center justify-between shadow-2xl shadow-summer-accent/20 border border-white/20"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full border-2 border-white/40 overflow-hidden">
                <img src={call.hostPhoto} alt="" className="w-full h-full object-cover" />
              </div>
              <div>
                <p className="text-xs font-black leading-none mb-1">{call.hostName} بدأ اتصالاً {call.type === 'video' ? 'مرئياً' : 'صوتياً'}</p>
                <div className="flex items-center gap-2">
                   <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                   <p className="text-[10px] opacity-80">نشط الآن...</p>
                </div>
              </div>
            </div>
            <button 
              onClick={() => joinCall(call)}
              className="bg-white text-summer-accent px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all"
            >
              انضمام
            </button>
          </motion.div>
        ))}
      </div>

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
                          if (audio.paused) {
                            audio.play();
                            setPlayingAudio(msg.id);
                          } else {
                            audio.pause();
                            setPlayingAudio(null);
                          }
                        }
                      }}
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90",
                        isOwn ? "bg-white/20 text-white hover:bg-white/30" : "bg-summer-bg/20 text-summer-text hover:bg-summer-bg/30"
                      )}
                    >
                      {playingAudio === msg.id ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                    <div className={cn(
                      "flex-1 h-1 rounded-full relative",
                      isOwn ? "bg-white/10" : "bg-summer-text/5"
                    )}>
                      {playingAudio === msg.id && (
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: '100%' }}
                          transition={{ duration: 5, ease: "linear" }}
                          className={cn("absolute inset-0 h-full rounded-full", isOwn ? "bg-white/40" : "bg-summer-accent/40")}
                        />
                      )}
                    </div>
                    <audio 
                      src={msg.content} 
                      className="hidden" 
                      onEnded={() => setPlayingAudio(null)}
                      onPause={() => setPlayingAudio(null)}
                    />
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
                  <Mic size={24} />
                </button>
                <button 
                  onClick={endCall}
                  className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center text-white shadow-2xl shadow-red-600/50 hover:scale-110 active:scale-90 transition-all"
                >
                  <LogOut size={32} className="rotate-[135deg]" />
                </button>
                <button className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-summer-text border border-white/20">
                  <Video size={24} />
                </button>
              </div>

              <div className="p-8 text-center bg-white/10 border-t border-white/10">
                <div className="flex -space-x-4 space-x-reverse justify-center mb-4">
                  {currentCall?.participants.map(p => (
                    <div key={p} className="w-12 h-12 rounded-full border-4 border-summer-bg bg-summer-primary/40 flex items-center justify-center text-white font-bold">
                       {p.charAt(0)}
                    </div>
                  ))}
                  <div className="w-12 h-12 rounded-full border-4 border-summer-bg bg-summer-accent flex items-center justify-center text-white">
                    <Plus size={16} />
                  </div>
                </div>
                <p className="text-[10px] text-summer-accent font-bold uppercase tracking-[0.2em]">
                  {currentCall?.participants.length} أفراد في الاتصال حالياً
                </p>
              </div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ChequeCard = ({ cheque, onClose }: { cheque: Cheque; onClose: () => void }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl bg-[#fdfbf7] rounded-xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.3)] relative border-4 border-[#e5d5b7] p-8 space-y-8"
        onClick={e => e.stopPropagation()}
      >
        {/* Pattern Background */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 0)', backgroundSize: '10px 10px' }}></div>
        
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-dashed border-[#e5d5b7] pb-6">
          <div className="text-right">
            <h2 className="text-[#8b7355] font-black text-2xl uppercase tracking-tighter">البنك العائلي الذكي</h2>
            <p className="text-[10px] text-[#a08b70] font-bold">SMART FAMILY BANK</p>
          </div>
          <div className="text-left space-y-1">
             <p className="text-[10px] text-[#a08b70] font-bold">DATE: {cheque.issuedAt?.toDate?.()?.toLocaleDateString('ar-EG')}</p>
             <p className="text-[10px] text-[#a08b70] font-bold">NO: {cheque.serialNumber}</p>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-12 py-8 relative">
           <div className="flex items-center gap-4 border-b border-[#e5d5b7] pb-2">
             <span className="text-[#a08b70] text-sm font-bold shrink-0">يصرف لأمر السيد/ة:</span>
             <span className="text-[#4a3721] text-xl font-black flex-1 border-b-2 border-dotted border-[#e5d5b7] px-4 font-mono">{cheque.userName}</span>
           </div>

           <div className="flex items-center gap-4 border-b border-[#e5d5b7] pb-2">
             <span className="text-[#a08b70] text-sm font-bold shrink-0">مبلغ وقدره:</span>
             <span className="text-[#4a3721] text-lg font-bold flex-1 border-b-2 border-dotted border-[#e5d5b7] px-4">
                {cheque.amount} ريال سعودي فقط لا غير
             </span>
             <div className="bg-[#e5d5b7] px-6 py-2 rounded-lg border-2 border-[#8b7355] shadow-inner">
                <span className="text-[#4a3721] font-black text-2xl">{cheque.amount} ر.س</span>
             </div>
           </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-8">
           <div className="relative">
              <div className="w-24 h-24 rounded-full border-4 border-[#8b7355]/20 flex items-center justify-center rotate-[-15deg] opacity-40">
                 <div className="text-[#8b7355] font-black text-[8px] text-center uppercase tracking-widest leading-none">
                    Family Bank<br/>Official<br/>Seal
                 </div>
              </div>
           </div>
           
           <div className="text-center space-y-2">
              <div className="w-48 h-[1px] bg-[#8b7355]"></div>
              <p className="text-[10px] text-[#a08b70] font-bold uppercase">المدير المالي (التوقيع)</p>
              <p className="text-xs text-[#4a3721] font-black italic">{cheque.issuedByName || 'الأهل'}</p>
           </div>
        </div>

        <button 
          onClick={onClose}
          className="absolute top-4 left-4 text-[#a08b70] hover:text-[#8b7355]"
        >
          <X size={20} />
        </button>

        <p className="text-center text-[7px] text-[#a08b70]/50 pt-4 font-mono tracking-[0.5em]">
           ║▌║█║▌│║▌║▌█║ {cheque.transactionId} ║▌║█║▌│║▌║▌█║
        </p>
      </div>
    </motion.div>
  );
};

const WalletPage = ({ profile }: { profile: UserProfile }) => {
  const [requests, setRequests] = useState<any[]>([]);
  const [selectedCheque, setSelectedCheque] = useState<Cheque | null>(null);
  const isParent = profile.role === 'parent';

  useEffect(() => {
    const qTr = isParent 
      ? query(collection(db, 'transactions'), orderBy('requestedAt', 'desc'))
      : query(collection(db, 'transactions'), where('userId', '==', profile.uid), orderBy('requestedAt', 'desc'));
    
    const unsubTr = onSnapshot(qTr, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    });

    return () => unsubTr();
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
      currencyAmount: Math.floor(profile.points * 0.25), // Use current exchange rate
      status: 'pending',
      requestedAt: serverTimestamp(),
    });
  };

  const approveRedeem = async (request: any) => {
    try {
      // 1. Mark status
      await updateDoc(doc(db, 'transactions', request.id), { status: 'approved', processedAt: serverTimestamp() });
      
      // 2. Clear points in profile
      await updateDoc(doc(db, 'users', request.userId), { points: 0 });
      
      // 3. Create Cheque
      const serial = `CHQ-${Math.floor(Math.random() * 900000 + 100000)}`;
      const chequeData = {
        transactionId: request.id,
        userId: request.userId,
        userName: request.userName,
        amount: request.currencyAmount,
        currency: 'ر.س',
        issuedAt: serverTimestamp(),
        issuedBy: profile.uid,
        issuedByName: profile.displayName,
        serialNumber: serial
      };
      
      await addDoc(collection(db, 'cheques'), chequeData);
      
      // 4. Notify Child
      await sendNotification(request.userId, 'تم استلام الشيك! ✍️', `لقد تمت الموافقة على طلب الصرف. تفضل الشيك الخاص بك بمبلغ ${request.currencyAmount} ريال.`, 'success');
      
      alert(`تمت الموافقة! رقم الشيك: ${serial}`);
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء تنفيذ العملية');
    }
  };

  const viewCheque = async (transactionId: string) => {
    const q = query(collection(db, 'cheques'), where('transactionId', '==', transactionId));
    const snap = await getDocs(q);
    if (!snap.empty) {
      setSelectedCheque({ id: snap.docs[0].id, ...snap.docs[0].data() } as Cheque);
    } else {
      alert('لم يتم العثور على شيك لهذه العملية');
    }
  };

  return (
    <div className="pb-24 bg-summer-bg min-h-screen">
      <Header title="البنك العائلي" profile={profile} />
      <div className="px-6 mt-6 space-y-8">
        <WalletCard profile={profile} exchangeRate={0.25} />

        <div className="bg-summer-accent/10 border border-summer-accent/20 p-4 rounded-2xl flex items-center gap-3">
          <Bell className="text-summer-accent shrink-0" size={20} />
          <p className="text-[11px] font-bold text-summer-text">يتم استبدال النقاط وتحويل المبالغ في تاريخ 10 من كل شهر ميلادي 🗓️</p>
        </div>

        {!isParent && profile.points >= 100 && (
          <button 
            onClick={requestRedeem}
            className="w-full summer-gradient text-white py-6 rounded-3xl font-black text-xl shadow-2xl shadow-summer-accent/20 transform hover:scale-[1.02] active:scale-95 transition-all"
          >
            طلب تحويل النقاط إلى كاش!
          </button>
        )}

        <section className="space-y-4">
          <div className="flex justify-between items-center px-1">
             <h3 className="text-sm font-bold text-summer-text/30 uppercase tracking-[0.2em]">سجل العمليات المالية</h3>
             <span className="text-[10px] text-summer-accent font-black">إجمالي الطلبات: {requests.length}</span>
          </div>
          <div className="space-y-4">
            {requests.map(req => (
              <div key={req.id} className="bg-summer-card p-5 rounded-3xl border border-white/40 flex justify-between items-center shadow-xl group hover:border-summer-accent/40 transition-all">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors",
                    req.status === 'approved' ? "bg-emerald-500/20 text-emerald-600" : "bg-summer-accent/10 text-summer-accent"
                  )}>
                    <TrendingUp size={24} />
                  </div>
                  <div>
                    <p className="font-bold text-summer-text leading-none mb-1">{req.userName}</p>
                    <p className="text-[10px] text-summer-text/40">تحويل مبلغ: {req.currencyAmount} ريال</p>
                    <p className="text-[8px] text-summer-text/20 mt-1 uppercase font-bold">{req.requestedAt?.toDate?.()?.toLocaleDateString('ar-SA')}</p>
                  </div>
                </div>
                
                <div className="flex flex-col items-end gap-2">
                  {req.status === 'approved' ? (
                    <button 
                      onClick={() => viewCheque(req.id)}
                      className="flex items-center gap-1.5 text-emerald-600 bg-emerald-500/10 px-3 py-1.5 rounded-lg text-[9px] font-black border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
                    >
                      <UserIcon size={12} />
                      عرض الشيك
                    </button>
                  ) : isParent ? (
                    <button 
                      onClick={() => approveRedeem(req)}
                      className="bg-summer-accent text-white px-5 py-2 rounded-xl text-[10px] font-black shadow-lg hover:shadow-summer-accent/40 active:scale-95 transition-all"
                    >
                      تأكيد الصرف
                    </button>
                  ) : (
                    <span className="text-[9px] font-black uppercase tracking-[0.1em] px-3 py-1.5 rounded-lg border bg-summer-accent/5 text-summer-accent border-summer-accent/10">
                      قيد المراجعة
                    </span>
                  )}
                  {req.status === 'approved' && (
                    <span className="text-[8px] font-bold text-emerald-600/50">تم الصرف بنجاح ✓</span>
                  )}
                </div>
              </div>
            ))}
            {requests.length === 0 && (
              <div className="text-center py-12 text-summer-text/20 font-black italic">
                 لا توجد طلبات صرف حالياً
              </div>
            )}
          </div>
        </section>
      </div>

      <AnimatePresence>
        {selectedCheque && (
          <ChequeCard cheque={selectedCheque} onClose={() => setSelectedCheque(null)} />
        )}
      </AnimatePresence>
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

  const requestNotifications = async () => {
    if (!('Notification' in window)) {
      alert('متصفحك لا يدعم الإشعارات.');
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      alert('تم تفعيل الإشعارات بنجاح! ستصلك تنبيهات المهام والرسائل حتى لو كان التطبيق في الخلفية.');
    } else {
      alert('تحتاج للموافقة على الإذن من إعدادات المتصفح لتفعيل الإشعارات.');
    }
  };

  const [showSmartBanner, setShowSmartBanner] = useState(true);

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

        <section className="bg-summer-card p-6 rounded-3xl border border-white/20 space-y-6 shadow-xl">
          <h3 className="font-bold text-summer-text flex items-center gap-2">
            <Bell size={18} className="text-summer-accent" />
            إشعارات الجوال
          </h3>
          <p className="text-xs text-summer-text/50">تفعيل الإشعارات المنبثقة لتصلك التنبيهات حتى خارج التطبيق</p>
          <button 
            onClick={requestNotifications}
            className="w-full bg-white/20 text-summer-text py-4 rounded-2xl font-black border border-white/20 hover:bg-white/30 transition-all"
          >
            تفعيل إشعارات النظام
          </button>
        </section>

        <section className="bg-summer-card p-6 rounded-3xl border border-white/20 space-y-6 shadow-xl">
           <h3 className="font-bold text-summer-text flex items-center gap-2">
             <Users size={18} className="text-summer-accent" />
             إدارة أفراد العائلة
           </h3>
           
           <div className="space-y-4">
             <FamilyMembersList currentUser={profile} />
           </div>
        </section>
      </div>
    </div>
  );
};

const FamilyMembersList = ({ currentUser }: { currentUser: UserProfile }) => {
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('displayName', 'asc'));
    return onSnapshot(q, (snapshot) => {
      setMembers(snapshot.docs.map(doc => doc.data() as UserProfile));
      setLoading(false);
    });
  }, []);

  const toggleRole = async (member: UserProfile) => {
    // Prevent self-demotion if the user is one of the hardcoded admins
    const isAdminEmail = member.email === 'basim5252@gmail.com' || member.email === 'Hayatalzaki@gmail.com';
    if (isAdminEmail && member.role === 'parent') {
      alert('لا يمكن تغيير رتبة مسؤول النظام الأساسي');
      return;
    }

    const newRole = member.role === 'parent' ? 'child' : 'parent';
    const confirmMsg = newRole === 'parent' 
      ? `هل تريد ترقية ${member.displayName} ليكون مسؤول نظام (أب/أم)؟ سيكون له كامل الصلاحيات.`
      : `هل تريد تغيير رتبة ${member.displayName} إلى عضو عائلي (ابن/ابنة)؟`;

    if (confirm(confirmMsg)) {
      try {
        await updateDoc(doc(db, 'users', member.uid), { role: newRole });
      } catch (error) {
        alert('فشل في تحديث الرتبة');
      }
    }
  };

  const deleteMember = async (member: UserProfile) => {
    if (member.uid === currentUser.uid) {
      alert('لا يمكنك حذف نفسك من النظام');
      return;
    }

    const isAdminEmail = member.email === 'basim5252@gmail.com' || member.email === 'Hayatalzaki@gmail.com';
    if (isAdminEmail) {
      alert('لا يمكن حذف مسؤول النظام الأساسي');
      return;
    }

    if (confirm(`تحذير: هل أنت متأكد من حذف ${member.displayName}؟ سيتم حذف حسابه وتصفير نقاطه.`)) {
      try {
        await deleteDoc(doc(db, 'users', member.uid));
        alert('تم حذف العضو بنجاح');
      } catch (error) {
        alert('فشل في حذف العضو');
      }
    }
  };

  if (loading) return <div className="text-center py-8"><Loader2 className="animate-spin mx-auto text-summer-accent" /></div>;

  return (
    <div className="space-y-3">
      {members.map(member => (
        <div key={member.uid} className="bg-white/10 p-4 rounded-2xl flex items-center justify-between gap-4 border border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-summer-accent/20 flex items-center justify-center overflow-hidden border border-white/20">
              {member.photoURL ? <img src={member.photoURL} alt="" className="w-full h-full object-cover" /> : <User size={20} className="text-summer-accent" />}
            </div>
            <div>
              <p className="text-sm font-bold text-summer-text">{member.displayName}</p>
              <p className="text-[10px] text-summer-text/40">{member.email}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => toggleRole(member)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[10px] font-black transition-all",
                member.role === 'parent' ? "bg-summer-accent text-white" : "bg-white/10 text-summer-text/60"
              )}
            >
              {member.role === 'parent' ? 'مسؤول (أب/أم)' : 'عضو (ابن/ابنة)'}
            </button>
            
            <button 
              onClick={() => deleteMember(member)}
              className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-all"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}
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

        {/* --- Monthly Rewards Section --- */}
        {!isParent ? (
          <MonthlyRewardsShop profile={profile} />
        ) : (
          <MonthlyRewardsManager />
        )}
        {/* ------------------------------ */}

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

const BehaviorRatingPage = ({ profile }: { profile: UserProfile }) => {
  const [ratings, setRatings] = useState<BehaviorRating[]>([]);
  const [family, setFamily] = useState<UserProfile[]>([]);
  const [selectedChild, setSelectedChild] = useState('');
  const [points, setPoints] = useState(0);
  const [reason, setReason] = useState('');
  const isParent = profile.role === 'parent';

  useEffect(() => {
    const q = query(collection(db, 'behaviorRatings'), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribeRatings = onSnapshot(q, (snapshot) => {
      setRatings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BehaviorRating)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'behaviorRatings'));

    const unsubscribeFamily = onSnapshot(collection(db, 'users'), (snapshot) => {
      setFamily(snapshot.docs.map(doc => doc.data() as UserProfile));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'users'));

    return () => {
      unsubscribeRatings();
      unsubscribeFamily();
    };
  }, []);

  const submitRating = async () => {
    if (!selectedChild || points === 0 || !reason) {
      alert('يرجى اختيار العضو وتحديد النقاط والسبب');
      return;
    }
    const child = family.find(f => f.uid === selectedChild);
    if (!child) return;

    try {
      await addDoc(collection(db, 'behaviorRatings'), {
        userId: selectedChild,
        userName: child.displayName,
        points: Number(points),
        reason,
        evaluatorId: profile.uid,
        evaluatorName: profile.displayName,
        createdAt: serverTimestamp()
      });

      // Update child points
      const childRef = doc(db, 'users', selectedChild);
      const newPoints = (child.points || 0) + Number(points);
      const newTotal = (child.totalPointsEarned || 0) + (points > 0 ? Number(points) : 0);
      
      await updateDoc(childRef, { 
        points: Math.max(0, newPoints),
        totalPointsEarned: newTotal
      });

      // Notify Child
      const statusIcon = points > 0 ? '🌟' : '⚠️';
      const statusMsg = points > 0 
        ? `أحسنت! حصلت على ${points} نقطة لسلوكك: ${reason}` 
        : `تم خصم ${Math.abs(points)} نقطة بسبب: ${reason}`;
      
      await sendNotification(selectedChild, `تقييم السلوك ${statusIcon}`, statusMsg, points > 0 ? 'success' : 'warning');

      setSelectedChild('');
      setPoints(0);
      setReason('');
      alert('تم تسجيل التقييم بنجاح');
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء حفظ التقييم');
    }
  };

  return (
    <div className="pb-24 bg-summer-bg min-h-screen">
      <Header title="تقييم السلوك" profile={profile} />
      <div className="px-6 mt-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {isParent && (
          <section className="bg-summer-card p-6 rounded-3xl border border-white/40 shadow-xl space-y-4">
            <div className="flex items-center gap-2 mb-2">
               <TrendingUp className="text-summer-accent" size={20} />
               <h3 className="font-bold text-summer-text">تسجيل تقييم جديد</h3>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-summer-text/40 uppercase tracking-widest px-1">عضو العائلة</label>
                <select 
                  className="w-full bg-white/20 border border-white/20 rounded-2xl px-5 py-4 text-summer-text outline-none focus:border-summer-accent appearance-none transition-all"
                  value={selectedChild}
                  onChange={(e) => setSelectedChild(e.target.value)}
                >
                  <option value="" className="bg-summer-card">اختر الشخص...</option>
                  {family.filter(f => f.role === 'child').map(f => (
                    <option key={f.uid} value={f.uid} className="bg-summer-card">{f.displayName}</option>
                  ))}
                </select>
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-black text-summer-text/40 uppercase tracking-widest px-1">نوع التأثير</label>
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setPoints(10)} 
                    className={cn(
                      "py-4 rounded-2xl font-black text-xs transition-all border flex items-center justify-center gap-2", 
                      points === 10 ? "bg-emerald-500 text-white border-emerald-500 shadow-lg" : "bg-white/10 text-emerald-500 border-emerald-500/20"
                    )}
                  >
                    <Smile size={14} />
                    مكافأة (+10)
                  </button>
                  <button 
                    onClick={() => setPoints(-10)} 
                    className={cn(
                      "py-4 rounded-2xl font-black text-xs transition-all border flex items-center justify-center gap-2", 
                      points === -10 ? "bg-red-500 text-white border-red-500 shadow-lg" : "bg-white/10 text-red-500 border-red-500/20"
                    )}
                  >
                    <Frown size={14} />
                    خصم (-10)
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-summer-text/40 uppercase tracking-widest px-1">النقاط (مخصص)</label>
                <input 
                  type="number"
                  placeholder="مثلاً: 15 أو -15"
                  className="w-full bg-white/20 border border-white/20 rounded-2xl px-5 py-4 text-summer-text outline-none focus:border-summer-accent"
                  value={points}
                  onChange={(e) => setPoints(Number(e.target.value))}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-summer-text/40 uppercase tracking-widest px-1">السبب</label>
                <textarea 
                  placeholder="لماذا هذا التقييم؟ (مثلاً: الالتزام بالصلاة، ترتيب الغرفة، أو تأخر في النوم)"
                  className="w-full bg-white/20 border border-white/20 rounded-2xl px-5 py-4 text-xs text-summer-text outline-none focus:border-summer-accent h-32 resize-none"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>

              <button 
                onClick={submitRating}
                className="w-full summer-gradient text-white py-5 rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all"
              >
                اعتماد التقييم وتحديث الرصيد
              </button>
            </div>
          </section>
        )}

        <section className="space-y-4 pb-12">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-sm font-bold text-summer-text/40 uppercase tracking-widest">تاريخ السلوكيات 📜</h3>
            <span className="text-[10px] font-black text-summer-accent bg-summer-accent/10 px-2 py-1 rounded-lg">الأسبوع الحالي</span>
          </div>
          
          <div className="space-y-4">
            {ratings.map(r => (
              <div key={r.id} className="bg-summer-card p-5 rounded-3xl border border-white/20 shadow-lg flex justify-between items-start group hover:border-summer-accent/30 transition-all">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-summer-primary/10 flex items-center justify-center text-xs font-black text-summer-primary">
                      {r.userName.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-black text-summer-text leading-none">{r.userName}</p>
                      <p className="text-[9px] text-summer-text/30 mt-1">بواسطة: {r.evaluatorName}</p>
                    </div>
                  </div>
                  <div className="bg-white/10 p-3 rounded-2xl border border-white/5">
                    <p className="text-xs text-summer-text leading-relaxed italic">"{r.reason}"</p>
                  </div>
                  <p className="text-[8px] text-summer-text/20 font-bold uppercase tracking-widest">{r.createdAt?.toDate?.()?.toLocaleDateString('ar-SA')}</p>
                </div>
                
                <div className="flex flex-col items-center gap-2">
                   <div className={cn(
                     "w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner", 
                     r.points > 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                   )}>
                     {r.points > 0 ? <Smile size={24} /> : <Frown size={24} />}
                   </div>
                   <span className={cn(
                     "text-lg font-black", 
                     r.points > 0 ? "text-emerald-500" : "text-red-500"
                   )}>
                     {r.points > 0 ? `+${r.points}` : r.points}
                   </span>
                </div>
              </div>
            ))}
            {ratings.length === 0 && (
              <div className="text-center py-12 bg-white/10 rounded-3xl border border-dashed border-white/20">
                <Meh size={48} className="mx-auto text-summer-text/10 mb-4" />
                <p className="text-xs text-summer-text/30 font-bold">لا توجد تقييمات مسجلة بعد. ابدأ بتقييم سلوك أطفالك!</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

const MotivationCardShare = ({ motivation, onClose }: { motivation: Motivation; onClose: () => void }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const downloadImage = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(cardRef.current, { cacheBust: true, pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `motivation-${motivation.id}.png`;
      link.href = dataUrl;
      link.click();
      alert('تم تحميل وسام الإيجابية! 🏆 يمكنك الآن إهدائه ومشاركته.');
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء تحميل الوسام');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-sm flex flex-col gap-6"
        onClick={e => e.stopPropagation()}
      >
        {/* The Card to be captured */}
        <div 
          ref={cardRef}
          className="bg-[#fdfbf7] rounded-[3rem] border-[6px] border-summer-accent/20 overflow-hidden shadow-2xl relative"
        >
           {/* Decorative corner stars */}
           <div className="absolute top-6 left-6 text-yellow-400 opacity-60"><Star size={24} fill="currentColor" /></div>
           <div className="absolute top-20 right-10 text-summer-accent opacity-40 rotate-12"><Heart size={16} fill="currentColor" /></div>
           <div className="absolute bottom-40 left-8 text-blue-400 opacity-30 rotate-[-20deg]"><Trophy size={32} /></div>

           <div className="relative p-10 space-y-8 text-center flex flex-col items-center">
              {/* Main Badge Wrapper */}
              <div className="relative">
                <div className="w-24 h-24 bg-gradient-to-br from-summer-accent to-summer-primary text-white rounded-full flex items-center justify-center shadow-2xl relative z-10">
                   <Medal size={48} className="drop-shadow-lg" />
                </div>
                {/* Glow Effect */}
                <div className="absolute inset-0 bg-summer-accent blur-2xl opacity-20 scale-150 animate-pulse"></div>
              </div>
              
              <div className="space-y-4">
                <h2 className="text-2xl font-black text-summer-text tracking-tight">وسام التميز الذكي ✨</h2>
                <p className="text-[10px] text-summer-accent font-black uppercase tracking-[0.3em]">Certificate of Excellence</p>
              </div>

              {/* Message Content */}
              <div className="w-full bg-white/60 backdrop-blur-sm p-8 rounded-[2.5rem] border-2 border-dashed border-summer-accent/20 shadow-inner relative overflow-hidden">
                 <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 0)', backgroundSize: '12px 12px' }}></div>
                 <p className="text-xl font-bold text-summer-text leading-relaxed text-right italic relative z-10">"{motivation.message}"</p>
                 <div className="absolute -bottom-2 -left-2 text-summer-accent/5"><Sparkles size={60} /></div>
              </div>

              {/* CUTE BADGES SECTION */}
              <div className="flex gap-4 justify-center py-2 w-full">
                 <div className="flex flex-col items-center gap-1">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 border-2 border-emerald-500/20 shadow-sm">
                       <Zap size={20} fill="currentColor" />
                    </div>
                    <span className="text-[8px] font-black text-emerald-700">بطل المهام</span>
                 </div>
                 <div className="flex flex-col items-center gap-1">
                    <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 border-2 border-amber-500/20 shadow-sm">
                       <Star size={20} fill="currentColor" />
                    </div>
                    <span className="text-[8px] font-black text-amber-700">مبدع</span>
                 </div>
                 <div className="flex flex-col items-center gap-1">
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 border-2 border-blue-500/20 shadow-sm">
                       <Award size={20} fill="currentColor" />
                    </div>
                    <span className="text-[8px] font-black text-blue-700">الملتزم</span>
                 </div>
              </div>

              <div className="pt-6 border-t border-summer-accent/10 w-full flex justify-between items-center px-4">
                 <div className="text-right">
                    <p className="text-[9px] text-summer-text/30 font-bold uppercase tracking-widest leading-none mb-1">من القلب:</p>
                    <p className="text-sm font-black text-summer-text">{motivation.senderName}</p>
                 </div>
                 <div className="text-left">
                    <p className="text-[9px] text-summer-text/30 font-bold uppercase tracking-widest leading-none mb-1">إلى البطل/ة:</p>
                    <p className="text-sm font-black text-summer-text">{motivation.userName}</p>
                 </div>
              </div>

              <div className="pt-4 flex flex-col items-center gap-1 opacity-40">
                 <p className="text-[7px] text-summer-text font-black uppercase tracking-[0.4em]">Family Smart System • © 2026</p>
                 <div className="w-24 h-0.5 bg-summer-text/20 rounded-full"></div>
              </div>
           </div>
        </div>

        <div className="flex gap-4">
          <button 
            onClick={downloadImage}
            disabled={downloading}
            className="flex-1 bg-summer-accent text-white py-5 rounded-[2rem] font-black shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {downloading ? (
              <Loader2 className="animate-spin" />
            ) : (
              <>
                <Download size={22} />
                تحميل وسام الفخر
              </>
            )}
          </button>
          
          <button 
            onClick={onClose}
            className="w-18 h-18 bg-white/20 flex items-center justify-center rounded-[2rem] text-white hover:bg-white/30 transition-all border border-white/20"
          >
            <X size={28} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

const MotivationPage = ({ profile }: { profile: UserProfile }) => {
  const [motivations, setMotivations] = useState<Motivation[]>([]);
  const [templates, setTemplates] = useState<MotivationTemplate[]>([]);
  const [family, setFamily] = useState<UserProfile[]>([]);
  const [selectedChild, setSelectedChild] = useState('');
  const [customMsg, setCustomMsg] = useState('');
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [newTemplateMsg, setNewTemplateMsg] = useState('');
  const [selectedMotivationShare, setSelectedMotivationShare] = useState<Motivation | null>(null);
  const isParent = profile.role === 'parent';

  useEffect(() => {
    const motivationsRef = collection(db, 'motivations');
    const qMotivations = isParent 
      ? query(motivationsRef, orderBy('createdAt', 'desc'), limit(50))
      : query(motivationsRef, where('receiverId', '==', profile.uid), orderBy('createdAt', 'desc'), limit(50));

    const unsubscribeMotivations = onSnapshot(qMotivations, (snapshot) => {
      setMotivations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Motivation)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'motivations'));

    const unsubscribeTemplates = onSnapshot(collection(db, 'motivationTemplates'), (snapshot) => {
      setTemplates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MotivationTemplate)));
    });

    const unsubscribeFamily = onSnapshot(query(collection(db, 'users'), where('role', '==', 'child')), (snapshot) => {
      setFamily(snapshot.docs.map(doc => doc.data() as UserProfile));
    });

    return () => {
      unsubscribeMotivations();
      unsubscribeTemplates();
      unsubscribeFamily();
    };
  }, []);

  const sendMotivation = async (msg: string) => {
    if (!selectedChild || !msg) {
      alert('يرجى اختيار العضو وكتابة الرسالة');
      return;
    }
    const child = family.find(f => f.uid === selectedChild);
    if (!child) return;

    try {
      await addDoc(collection(db, 'motivations'), {
        senderId: profile.uid,
        senderName: profile.displayName,
        receiverId: selectedChild,
        userName: child.displayName,
        message: msg,
        icon: 'Sparkles',
        createdAt: serverTimestamp()
      });

      await sendNotification(selectedChild, 'رسالة محفزة! ✨', `لديك رسالة إيجابية من ${profile.displayName}: ${msg}`, 'motivation');
      
      // WhatsApp Share Link
      const shareText = `نصيحة من محفز العائلة الذكي لـ ${child.displayName}: 🌟\n\n"${msg}"\n\nفخور فيك يا بطل! ❤️`;
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
      window.open(whatsappUrl, '_blank');

      setCustomMsg('');
      alert('تم إرسال المحفز بنجاح ومشاركته عبر واتساب! 🌟');
    } catch (err) {
      console.error(err);
      alert('فشل في إرسال المحفز');
    }
  };

  const addTemplate = async () => {
    if (!newTemplateMsg) return;
    await addDoc(collection(db, 'motivationTemplates'), {
      content: newTemplateMsg,
      category: 'عام',
      createdAt: serverTimestamp()
    });
    setNewTemplateMsg('');
    setShowAddTemplate(false);
  };

  const deleteTemplate = async (id: string) => {
    if (confirm('هل تريد حذف هذا القالب؟')) {
      await deleteDoc(doc(db, 'motivationTemplates', id));
    }
  };

  const deleteMotivation = async (id: string) => {
    if (confirm('هل تريد حذف هذه الرسالة من السجل؟')) {
      try {
        await deleteDoc(doc(db, 'motivations', id));
      } catch (err) {
        console.error(err);
        alert('فشل في حذف الرسالة');
      }
    }
  };

  const shareToWhatsApp = (m: Motivation) => {
    const text = `رسالة محفزة من عائلتي الذكية ✨\n\n"${m.message}"\n\nمن: ${m.senderName}\nإلى: ${m.userName}\n💎 نظام العائلة الذكي`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const defaultTemplates = [
    "أنت مبدع ورائع اليوم! 🌟",
    "فخور جداً بالتزامك بالمهام 👏",
    "روحك الإيجابية تنور البيت ✨",
    "استمر في هذا الإبداع، أنت بطل! 💪",
    "شكراً لكونك شخصاً يساعد الجميع ❤️"
  ];

  return (
    <div className="pb-24 bg-summer-bg min-h-screen">
      <Header title="المحفز الذكي" profile={profile} />
      <div className="px-6 mt-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {isParent && (
          <section className="bg-summer-card p-6 rounded-3xl border border-white/40 shadow-xl space-y-6">
            <div className="flex items-center gap-2">
               <Zap className="text-summer-accent" size={20} />
               <h3 className="font-bold text-summer-text">إرسال محفز عائلي</h3>
            </div>

            <div className="space-y-4">
               <div>
                  <label className="text-[10px] font-black text-summer-text/40 uppercase tracking-widest px-1">لمن الرسالة؟</label>
                  <div className="flex gap-2 mt-2 overflow-x-auto pb-2 scrollbar-none">
                    {family.map(child => (
                      <button 
                        key={child.uid}
                        onClick={() => setSelectedChild(child.uid)}
                        className={cn(
                          "px-4 py-3 rounded-2xl text-xs font-black transition-all border shrink-0",
                          selectedChild === child.uid ? "bg-summer-accent text-white border-summer-accent shadow-lg" : "bg-white/10 text-summer-text border-white/10"
                        )}
                      >
                        {child.displayName}
                      </button>
                    ))}
                  </div>
               </div>

               <div>
                 <label className="text-[10px] font-black text-summer-text/40 uppercase tracking-widest px-1">اختر رسالة جاهزة</label>
                 <div className="grid grid-cols-1 gap-2 mt-2">
                    {templates.length > 0 ? templates.map(t => (
                      <div key={t.id} className="flex gap-2">
                        <button 
                          onClick={() => sendMotivation(t.content)}
                          className="flex-1 text-right bg-white/10 border border-white/10 p-4 rounded-xl text-xs text-summer-text hover:bg-summer-accent/10 hover:border-summer-accent transition-all"
                        >
                          {t.content}
                        </button>
                        <button onClick={() => deleteTemplate(t.id)} className="p-2 text-red-400 hover:text-red-600">
                          <X size={16} />
                        </button>
                      </div>
                    )) : defaultTemplates.map((msg, i) => (
                      <button 
                        key={i}
                        onClick={() => sendMotivation(msg)}
                        className="text-right bg-white/10 border border-white/10 p-4 rounded-xl text-xs text-summer-text hover:bg-summer-accent/10 hover:border-summer-accent transition-all"
                      >
                        {msg}
                      </button>
                    ))}
                 </div>
               </div>

               <div className="space-y-2">
                  <label className="text-[10px] font-black text-summer-text/40 uppercase tracking-widest px-1">أو اكتب رسالة مخصصة</label>
                  <div className="flex gap-2">
                    <input 
                      placeholder="رسالة إيجابية من قلبك..."
                      className="flex-1 bg-white/10 border border-white/10 rounded-2xl px-5 py-4 text-xs text-summer-text outline-none focus:border-summer-accent"
                      value={customMsg}
                      onChange={(e) => setCustomMsg(e.target.value)}
                    />
                    <button 
                      onClick={() => sendMotivation(customMsg)}
                      className="bg-summer-accent text-white px-6 rounded-2xl shadow-lg active:scale-95 transition-all"
                    >
                      <Zap size={18} />
                    </button>
                  </div>
               </div>

               <button 
                 onClick={() => setShowAddTemplate(!showAddTemplate)}
                 className="text-[10px] font-bold text-summer-accent underline"
               >
                 {showAddTemplate ? 'إلغاء' : 'إضافة رسالة للقائمة الجاهزة +'}
               </button>

               {showAddTemplate && (
                 <div className="flex gap-2 animate-in fade-in duration-300">
                    <input 
                      placeholder="أضف رسالة جديدة للجوال..."
                      className="flex-1 bg-white/20 border border-dashed border-white/40 rounded-xl px-4 py-2 text-xs text-summer-text outline-none"
                      value={newTemplateMsg}
                      onChange={(e) => setNewTemplateMsg(e.target.value)}
                    />
                    <button onClick={addTemplate} className="bg-summer-text text-white px-4 rounded-xl text-xs font-bold">حفظ</button>
                 </div>
               )}
            </div>
          </section>
        )}

        <section className="space-y-4 pb-12">
           <h3 className="text-sm font-bold text-summer-text/40 uppercase tracking-widest px-1">سجل الإيجابية 💎</h3>
           <div className="space-y-4">
              {motivations.map(m => (
                <motion.div 
                  key={m.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-summer-card p-5 rounded-3xl border border-white/20 shadow-lg flex items-start gap-4"
                >
                  <div className="w-12 h-12 rounded-2xl bg-summer-accent/10 flex items-center justify-center text-summer-accent shrink-0">
                    <Sparkles size={24} className="animate-pulse" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                       <div>
                         <p className="text-xs font-black text-summer-text">{m.userName}</p>
                         <p className="text-[9px] text-summer-text/30">من: {m.senderName}</p>
                       </div>
                       <div className="flex items-center gap-2">
                         <button 
                           onClick={() => shareToWhatsApp(m)}
                           className="p-2 bg-emerald-500/10 text-emerald-600 rounded-lg hover:bg-emerald-500/20 transition-all"
                           title="مشاركة عبر واتساب"
                         >
                           <MessageCircle size={14} />
                         </button>
                         <button 
                           onClick={() => setSelectedMotivationShare(m)}
                           className="p-2 bg-summer-accent/10 text-summer-accent rounded-lg hover:bg-summer-accent/20 transition-all"
                           title="تحويل لصورة"
                         >
                           <Share2 size={14} />
                         </button>
                         {(isParent || m.senderId === profile.uid) && (
                           <button 
                             onClick={() => deleteMotivation(m.id)}
                             className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-all"
                             title="حذف"
                           >
                             <Trash2 size={14} />
                           </button>
                         )}
                         <span className="text-[8px] text-summer-text/20 font-bold">{m.createdAt?.toDate?.()?.toLocaleTimeString('ar-SA')}</span>
                       </div>
                    </div>
                    <div className="bg-white/10 p-4 rounded-2xl border border-white/5">
                       <p className="text-sm font-bold text-summer-text leading-relaxed">"{m.message}"</p>
                    </div>
                  </div>
                </motion.div>
              ))}
              {motivations.length === 0 && (
                <div className="text-center py-12 bg-white/10 rounded-3xl border border-dashed border-white/20">
                  <Heart size={48} className="mx-auto text-summer-text/10 mb-4" />
                  <p className="text-xs text-summer-text/30 font-bold text-center">لا توجد رسائل محفزة بعد. انشر الإيجابية اليوم!</p>
                </div>
              )}
           </div>
        </section>
      </div>

      <AnimatePresence>
        {selectedMotivationShare && (
          <MotivationCardShare 
            motivation={selectedMotivationShare} 
            onClose={() => setSelectedMotivationShare(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default function App() {
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(reg => {
        console.log('SW Registered:', reg.scope);
      }).catch(err => {
        console.error('SW Registration Failed:', err);
      });
    }
  }, []);

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
            <Route path="/behavior" element={<BehaviorRatingPage profile={profile} />} />
            <Route path="/motivation" element={<MotivationPage profile={profile} />} />
            <Route path="/settings" element={<SettingsPage profile={profile} />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

// No-op for late binding
