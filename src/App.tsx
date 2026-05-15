import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home, 
  CheckSquare, 
  MessageCircle, 
  Wallet as WalletIcon, 
  User as UserIcon,
  Video,
  LogOut,
  PlusCircle,
  Bell,
  ArrowUpRight,
  TrendingUp
} from 'lucide-react';
import { auth, db } from './lib/firebase';
import { useAuth } from './hooks/useAuth';
import { Login } from './pages/Login';
import { WalletCard } from './components/wallet/WalletCard';
import { TaskImageGenerator } from './components/TaskImageGenerator';
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
import { Task, Message, UserProfile } from './types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const Navbar = () => {
  const location = useLocation();
  const navItems = [
    { path: '/', icon: Home, label: 'الرئيسية' },
    { path: '/tasks', icon: CheckSquare, label: 'المهام' },
    { path: '/chat', icon: MessageCircle, label: 'الدردشة' },
    { path: '/wallet', icon: WalletIcon, label: 'المحفظة' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-navy border-t border-white/10 z-50 rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.2)] md:static md:border-t-0 md:rounded-none md:shadow-none md:w-20 md:min-h-screen md:text-white">
      <div className="flex md:flex-col justify-around md:justify-center items-center h-20 md:h-full md:gap-8">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link 
              key={item.path} 
              to={item.path}
              className={cn(
                "flex flex-col items-center gap-1 transition-all group p-2",
                isActive ? "text-gold" : "text-blue-300/50 hover:text-gold"
              )}
            >
              <div className={cn(
                "p-2 rounded-xl transition-all",
                isActive ? "bg-white/10" : "group-hover:bg-white/5"
              )}>
                <item.icon size={22} className={cn(isActive && "animate-pulse")} />
              </div>
              <span className="text-[10px] font-bold md:hidden">{item.label}</span>
            </Link>
          );
        })}
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

const Header = ({ title, showNotify = true }: { title: string, showNotify?: boolean }) => (
  <header className="px-6 py-6 flex justify-between items-center bg-navy border-b border-gold/20 sticky top-0 z-40">
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-gold">{title}</h1>
      <p className="text-[10px] text-blue-200/60 uppercase tracking-widest font-medium">نظام إدارة المنزل الذكي</p>
    </div>
    <div className="flex gap-4 items-center">
      <div className="hidden md:block text-left text-xs">
        <p className="font-semibold text-white">{auth.currentUser?.displayName}</p>
        <p className="text-gold opacity-70">مسؤول النظام</p>
      </div>
      <button className="w-12 h-12 rounded-full border-2 border-gold p-0.5 overflow-hidden">
        <img src={auth.currentUser?.photoURL || ''} alt="User" className="w-full h-full rounded-full object-cover" />
      </button>
    </div>
  </header>
);

const Dashboard = ({ profile }: { profile: UserProfile }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const isParent = profile.role === 'parent';

  useEffect(() => {
    const q = isParent 
      ? query(collection(db, 'tasks'), orderBy('createdAt', 'desc'))
      : query(collection(db, 'tasks'), where('assignedTo', '==', profile.uid), orderBy('createdAt', 'desc'));
    
    return onSnapshot(q, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
    });
  }, [profile.uid, isParent]);

  return (
    <div className="pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500 bg-navy-dark min-h-screen">
      <Header title="مهام عائلية" />
      
      <div className="px-6 space-y-8 mt-6">
        {/* Wallet Section */}
        <WalletCard profile={profile} exchangeRate={0.25} />

        {/* Quick Actions for Parent */}
        {isParent && (
          <section className="space-y-4">
            <h3 className="text-sm font-bold text-blue-200/40 uppercase tracking-[0.2em] px-1">إجراءات سريعة</h3>
            <div className="grid grid-cols-2 gap-4">
              <Link to="/tasks" className="bg-navy p-6 rounded-3xl border border-white/5 flex items-center gap-4 group shadow-xl hover:border-gold/30 transition-all">
                <div className="w-12 h-12 gold-gradient rounded-2xl flex items-center justify-center text-navy-dark group-hover:scale-110 transition-transform">
                  <PlusCircle size={24} />
                </div>
                <div className="text-right">
                  <p className="font-bold text-white text-sm">إضافة مهمة</p>
                  <p className="text-[10px] text-blue-200/40">كافئ أطفالك</p>
                </div>
              </Link>
              <Link to="/chat" className="bg-navy p-6 rounded-3xl border border-white/5 flex items-center gap-4 group shadow-xl hover:border-gold/30 transition-all">
                <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                  <Video size={24} />
                </div>
                <div className="text-right">
                  <p className="font-bold text-white text-sm">اتصال مرئي</p>
                  <p className="text-[10px] text-blue-200/40">تواصل مباشر</p>
                </div>
              </Link>
            </div>
          </section>
        )}

        {/* Tasks Preview */}
        <section className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-sm font-bold text-blue-200/40 uppercase tracking-[0.2em]">آخر المهام النشطة</h3>
            <Link to="/tasks" className="text-xs font-bold text-gold hover:text-gold-light transition-colors">عرض الكل</Link>
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            {tasks.slice(0, 3).map((task) => (
              <div key={task.id} className="bg-navy-light p-5 rounded-3xl border border-gold/40 flex flex-col justify-between shadow-xl relative overflow-hidden group">
                <div className="absolute top-4 left-4">
                   <div className="bg-gold text-navy-dark px-3 py-1 rounded-full text-[10px] font-black shadow-md">{task.points} نقطة</div>
                </div>
                <div className="mb-4">
                  <div className="w-12 h-12 bg-white/5 rounded-2xl mb-4 flex items-center justify-center text-gold">
                    <CheckSquare size={24} />
                  </div>
                  <h4 className="text-lg font-bold mb-1 text-white">{task.title}</h4>
                  <p className="text-xs text-blue-200/60 leading-relaxed">{task.description}</p>
                </div>
                <div className="flex items-center justify-between border-t border-white/5 pt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-400 flex items-center justify-center text-[8px] text-white font-bold">
                       {task.assignedToName?.charAt(0)}
                    </div>
                    <span className="text-[10px] text-white/70">{task.assignedToName}</span>
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

const TasksPage = ({ profile }: { profile: UserProfile }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPoints, setNewPoints] = useState(10);
  const [newAssigned, setNewAssigned] = useState('');
  const [family, setFamily] = useState<UserProfile[]>([]);
  const isParent = profile.role === 'parent';

  useEffect(() => {
    const q = isParent 
      ? query(collection(db, 'tasks'), orderBy('createdAt', 'desc'))
      : query(collection(db, 'tasks'), where('assignedTo', '==', profile.uid), orderBy('createdAt', 'desc'));
    
    const unsubscribeTasks = onSnapshot(q, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
    });

    const unsubscribeFamily = onSnapshot(collection(db, 'users'), (snapshot) => {
      setFamily(snapshot.docs.map(doc => doc.data() as UserProfile));
    });

    return () => {
      unsubscribeTasks();
      unsubscribeFamily();
    };
  }, [profile.uid, isParent]);

  const addTask = async () => {
    if (!newTitle) return;
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
    setNewTitle('');
    setShowAdd(false);
  };

  const approveTask = async (task: Task) => {
    if (!isParent) return;
    // 1. Update Task
    await updateDoc(doc(db, 'tasks', task.id), { status: 'approved' });
    // 2. Add Points to User
    const userRef = doc(db, 'users', task.assignedTo);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const currentPoints = userSnap.data().points || 0;
      await updateDoc(userRef, { points: currentPoints + task.points });
    }
  };

  return (
    <div className="pb-24 bg-navy-dark min-h-screen">
      <Header title="لوحة المهام النشطة" />
      
      <div className="px-6 mt-6 space-y-6">
        {isParent && (
          <button 
            onClick={() => setShowAdd(!showAdd)}
            className="w-full bg-blue-600 text-white rounded-2xl py-5 font-bold flex items-center justify-center gap-3 shadow-xl hover:bg-blue-700 transition-all active:scale-95"
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
              <div className="bg-navy p-6 rounded-3xl border border-white/10 space-y-4 shadow-2xl">
                <input 
                  placeholder="اسم المهمة (مثلاً: تنظيف المطبخ)"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-blue-200/40 focus:border-gold outline-none transition-colors"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
                <div className="flex gap-4">
                  <input 
                    type="number"
                    placeholder="النقاط"
                    className="w-1/3 bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:border-gold"
                    value={newPoints}
                    onChange={(e) => setNewPoints(Number(e.target.value))}
                  />
                  <select 
                    className="w-2/3 bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:border-gold appearance-none"
                    value={newAssigned}
                    onChange={(e) => setNewAssigned(e.target.value)}
                  >
                    <option value="" className="bg-navy text-white">تعيين إلى...</option>
                    {family.filter(f => f.role === 'child').map(f => (
                      <option key={f.uid} value={f.uid} className="bg-navy text-white">{f.displayName}</option>
                    ))}
                  </select>
                </div>
                <button 
                  onClick={addTask}
                  className="w-full bg-gold text-navy-dark py-4 rounded-2xl font-black text-lg hover:bg-gold-light transition-all shadow-lg active:scale-95"
                >
                  حفظ المهمة ومشاركتها
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tasks.map((task) => (
            <div key={task.id} className="bg-navy rounded-3xl border border-white/10 p-6 shadow-xl space-y-4 relative overflow-hidden group hover:border-gold/30 transition-all">
              {task.status === 'approved' && (
                <div className="absolute top-0 right-0 px-10 py-1 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-[0.2em] translate-x-1/3 translate-y-1/2 rotate-45 z-20">
                  تمت المصادقة
                </div>
              )}
              
              <div className="flex justify-between items-start">
                <div className="flex-1">
                   <div className="w-14 h-14 bg-white/5 rounded-2xl mb-4 flex items-center justify-center text-gold group-hover:scale-110 transition-transform">
                    <CheckSquare size={28} />
                  </div>
                  <h4 className="text-xl font-bold text-white mb-1 group-hover:text-gold transition-colors">{task.title}</h4>
                  <p className="text-xs text-blue-200/50 line-clamp-2">عن طريق: {family.find(f => f.uid === task.createdBy)?.displayName || 'الأهل'}</p>
                </div>
                <div className="bg-gold text-navy-dark px-4 py-2 rounded-xl font-black shadow-lg">
                  {task.points} ن
                </div>
              </div>

              <div className="flex items-center gap-3 py-3 border-y border-white/5">
                <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center text-sm font-bold text-blue-300">
                  {task.assignedToName?.charAt(0)}
                </div>
                <div>
                  <p className="text-[10px] text-blue-200/30 uppercase tracking-widest font-bold">بواسطة</p>
                  <p className="text-sm font-bold text-white">{task.assignedToName}</p>
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                {isParent && task.status === 'completed' && (
                  <button 
                    onClick={() => approveTask(task)}
                    className="flex-1 bg-emerald-500 text-white py-4 rounded-2xl font-black shadow-xl hover:bg-emerald-600 transition-all active:scale-95"
                  >
                    منح المكافأة
                  </button>
                )}
                {!isParent && task.status === 'pending' && (
                  <button 
                    onClick={() => updateDoc(doc(db, 'tasks', task.id), { status: 'completed', completedAt: serverTimestamp() })}
                    className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black hover:bg-blue-700 transition-all active:scale-95 shadow-lg"
                  >
                    تأكيد الإنجاز 🧹
                  </button>
                )}
                <div className="flex shrink-0">
                  <TaskImageGenerator task={task} pointsValue={`${task.points} نقطة`} />
                </div>
              </div>
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

  useEffect(() => {
    const q = query(collection(db, 'messages'), orderBy('createdAt', 'desc'), limit(50));
    return onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message)).reverse());
    });
  }, []);

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
    <div className="h-screen flex flex-col pb-24 md:pb-0 bg-navy-dark">
      <header className="px-6 py-6 flex justify-between items-center bg-navy border-b border-white/5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 gold-gradient rounded-2xl flex items-center justify-center text-navy-dark font-black text-xl shadow-lg">F</div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">الدردشة العائلية</h1>
            <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-[0.2em] animate-pulse">متصل الآن</p>
          </div>
        </div>
        <button 
          onClick={() => setShowCall(true)}
          className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-900/20 hover:scale-105 active:scale-95 transition-all"
        >
          <Video size={20} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg) => {
          const isOwn = msg.senderId === profile.uid;
          return (
            <div key={msg.id} className={cn("flex flex-col", isOwn ? "items-start" : "items-end")}>
              <div className={cn(
                "max-w-[85%] p-4 rounded-3xl text-[13px] leading-relaxed relative shadow-xl border",
                isOwn 
                  ? "bg-navy-light text-white rounded-br-none border-white/5" 
                  : "bg-gold text-navy-dark border-gold-light rounded-bl-none font-medium"
              )}>
                {!isOwn && <p className="text-[10px] font-black text-navy-dark/40 uppercase mb-1 tracking-widest">{msg.senderName}</p>}
                <p>{msg.content}</p>
                <div className={cn("text-[9px] mt-2 opacity-50 font-bold", isOwn ? "text-right" : "text-left")}>
                  {msg.createdAt?.toDate?.()?.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-4 bg-navy border-t border-white/5 relative z-10">
        <div className="flex gap-2 bg-navy-dark p-2 rounded-2xl border border-white/10 group focus-within:border-gold/50 transition-colors">
          <input 
            placeholder="اكتب رسالة للعائلة..."
            className="flex-1 bg-transparent border-none focus:ring-0 px-4 text-sm font-medium text-white placeholder:text-blue-200/30"
            value={newMsg}
            onChange={(e) => setNewMsg(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMsg()}
          />
          <button 
            onClick={sendMsg}
            className="gold-gradient text-navy-dark p-3 rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg"
          >
            <ArrowUpRight size={20} />
          </button>
        </div>
      </div>

      {/* Call UI Outline */}
      <AnimatePresence>
        {showCall && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-navy flex flex-col"
            >
              <div className="absolute top-10 left-10 p-4 border border-white/20 rounded-3xl bg-white/5 backdrop-blur-xl">
                 <p className="text-white text-xs opacity-50 mb-2">معاينة الكاميرا</p>
                 <div className="w-32 h-48 bg-slate-800 rounded-2xl overflow-hidden flex items-center justify-center">
                    <UserIcon size={32} className="text-white/20" />
                 </div>
              </div>

              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <div className="w-32 h-32 bg-gold/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
                   <div className="w-24 h-24 bg-gold rounded-full flex items-center justify-center">
                      <UserIcon size={48} className="text-navy" />
                   </div>
                </div>
                <h2 className="text-white text-3xl font-bold mb-2">جاري الاتصال بالعائلة...</h2>
                <p className="text-blue-200 opacity-60">تشفير تام بين الطرفين</p>
              </div>

              <div className="p-12 flex justify-center gap-8 items-center">
                <button className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center text-white border border-white/10">
                  <Bell size={24} />
                </button>
                <button 
                  onClick={() => setShowCall(false)}
                  className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center text-white shadow-2xl shadow-red-500/50 hover:scale-110 active:scale-90 transition-all"
                >
                  <LogOut size={32} className="rotate-135" />
                </button>
                <button className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center text-white border border-white/10">
                  <Video size={24} />
                </button>
              </div>

              <div className="p-8 text-center bg-white/5 border-t border-white/5">
                <p className="text-[10px] text-blue-300 font-bold uppercase tracking-[0.2em]">
                  Outline API: WebRTC Peer-to-Peer Protocol
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
  };

  const approveRedeem = async (request: any) => {
    // 1. Mark status
    await updateDoc(doc(db, 'transactions', request.id), { status: 'approved', processedAt: serverTimestamp() });
    // 2. Clear points in profile
    await updateDoc(doc(db, 'users', request.userId), { points: 0 });
  };

  return (
    <div className="pb-24 bg-navy-dark min-h-screen">
      <Header title="البنك العائلي" />
      <div className="px-6 mt-6 space-y-8">
        <WalletCard profile={profile} exchangeRate={0.25} />

        {!isParent && profile.points >= 100 && (
          <button 
            onClick={requestRedeem}
            className="w-full gold-gradient text-navy-dark py-6 rounded-3xl font-black text-xl shadow-2xl shadow-gold/20 transform hover:scale-[1.02] active:scale-95 transition-all"
          >
            طلب تحويل النقاط إلى كاش!
          </button>
        )}

        <section className="space-y-4 text-right">
          <h3 className="text-sm font-bold text-blue-200/30 uppercase tracking-[0.2em] px-1">سجل العمليات المالية</h3>
          <div className="space-y-4">
            {requests.map(req => (
              <div key={req.id} className="bg-navy p-5 rounded-3xl border border-white/5 flex justify-between items-center shadow-xl">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center",
                    req.status === 'approved' ? "bg-emerald-500/20 text-emerald-400" : "bg-gold/10 text-gold"
                  )}>
                    <TrendingUp size={24} />
                  </div>
                  <div>
                    <p className="font-bold text-white leading-none mb-1">{req.userName}</p>
                    <p className="text-[10px] text-blue-200/40">تحويل مبلغ: {req.currencyAmount} ريال</p>
                  </div>
                </div>
                {isParent && req.status === 'pending' ? (
                  <button 
                    onClick={() => approveRedeem(req)}
                    className="bg-gold text-navy-dark px-6 py-2 rounded-xl text-xs font-black shadow-lg"
                  >
                    تأكيد الصرف
                  </button>
                ) : (
                  <span className={cn(
                    "text-[10px] font-black uppercase tracking-[0.1em] px-4 py-2 rounded-xl border",
                    req.status === 'approved' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-gold/5 text-gold border-gold/10"
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

// --- Main App ---

export default function App() {
  const { user, profile, loading } = useAuth();

  if (loading) return (
    <div className="h-screen bg-navy flex items-center justify-center p-8">
       <div className="w-16 h-1 w-full bg-white/10 rounded-full overflow-hidden">
          <motion.div 
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
            className="w-full h-full bg-gold"
          />
       </div>
    </div>
  );

  if (!user || !profile) return <Login />;

  return (
    <Router>
      <div className={cn("min-h-screen bg-navy-dark flex flex-col md:flex-row-reverse rtl")} dir="rtl">
        <Navbar />
        <main className="flex-1 overflow-x-hidden md:max-w-4xl md:mx-auto bg-navy-dark shadow-2xl border-x border-white/5">
          <Routes>
            <Route path="/" element={<Dashboard profile={profile} />} />
            <Route path="/tasks" element={<TasksPage profile={profile} />} />
            <Route path="/chat" element={<ChatPage profile={profile} />} />
            <Route path="/wallet" element={<WalletPage profile={profile} />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

// No-op for late binding
