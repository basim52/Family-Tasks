import React, { useState, useEffect } from 'react';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  where, 
  onSnapshot, 
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile, DailyTask } from '../types';
import { 
  Plus, 
  Check, 
  Calendar, 
  Clock, 
  Award, 
  AlertCircle,
  TrendingUp, 
  CheckCircle, 
  XCircle,
  HelpCircle,
  User,
  Trash2,
  CalendarCheck,
  BookOpen,
  Dumbbell,
  Home,
  Sparkles,
  Archive
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Help functions to fetch current week details
const getDatesForCurrentWeek = () => {
  const current = new Date();
  const dayOfCurrent = current.getDay(); // 0 is Sunday, 1 is Monday...
  // Let Sunday be the first day of our Arabic week
  const sunday = new Date(current);
  sunday.setDate(current.getDate() - dayOfCurrent);
  
  const days = [];
  const arabicDayNames = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  
  for (let i = 0; i < 7; i++) {
    const nextDay = new Date(sunday);
    nextDay.setDate(sunday.getDate() + i);
    const dateString = nextDay.toISOString().split('T')[0]; // "YYYY-MM-DD"
    days.push({
      dateString,
      dayNumber: nextDay.getDate(),
      dayName: arabicDayNames[i],
      rawDate: nextDay,
    });
  }
  return days;
};

const timeToMinutes = (t: string) => {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const formatArabicTime = (timeStr: string) => {
  if (!timeStr) return '';
  try {
    const [hStr, mStr] = timeStr.split(':');
    let hour = Number(hStr);
    const minute = mStr || '00';
    const ampm = hour >= 12 ? 'م' : 'ص';
    hour = hour % 12;
    hour = hour ? hour : 12; // '0' should be '12'
    return `${hour}:${minute} ${ampm}`;
  } catch (e) {
    return timeStr;
  }
};

const calculateDuration = (startTime: string, endTime: string) => {
  if (!startTime || !endTime) return '';
  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);
  let diff = endMin - startMin;
  if (diff < 0) diff += 24 * 60; // wrap around for next day
  
  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;
  
  let result = '';
  if (hours > 0) {
    result += `${hours} ${hours === 1 ? 'ساعة' : hours === 2 ? 'ساعتين' : 'ساعات'}`;
  }
  if (minutes > 0) {
    if (result) result += ' و ';
    result += `${minutes} ${minutes === 1 ? 'دقيقة' : 'دقائق'}`;
  }
  return result || '0 دقيقة';
};

const getCategoryDetails = (categoryKey?: string) => {
  switch (categoryKey) {
    case 'educational':
      return { label: 'تعليمي', icon: BookOpen, colorClass: 'text-blue-400 bg-blue-500/10 border-blue-500/20' };
    case 'athletic':
      return { label: 'رياضي', icon: Dumbbell, colorClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
    case 'household':
      return { label: 'منزلي', icon: Home, colorClass: 'text-purple-400 bg-purple-500/10 border-purple-500/20' };
    default:
      return { label: 'عام', icon: Sparkles, colorClass: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
  }
};

interface DailyTasksPageProps {
  profile: UserProfile;
}

export default function DailyTasksPage({ profile }: DailyTasksPageProps) {
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [familyMembers, setFamilyMembers] = useState<UserProfile[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>(profile.role === 'parent' ? '' : profile.uid);
  const [selectedDay, setSelectedDay] = useState<string>(new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState<'list' | 'timeline' | 'archive'>('list');
  
  // New Task Form State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskTime, setNewTaskTime] = useState('12:00');
  const [newTaskEndTime, setNewTaskEndTime] = useState('13:00');
  const [newTaskDate, setNewTaskDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTaskPoints, setNewTaskPoints] = useState<number>(5);
  const [newTaskCategory, setNewTaskCategory] = useState<string>('educational');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Notification & WhatsApp Proximity States
  const [currentTime, setCurrentTime] = useState(new Date());
  const [notifiedTasks, setNotifiedTasks] = useState<Record<string, boolean>>({});
  const [notificationPermission, setNotificationPermission] = useState<string>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [editingPhoneUid, setEditingPhoneUid] = useState<string | null>(null);
  const [phoneInputVal, setPhoneInputVal] = useState('');

  const isParent = profile.role === 'parent';
  const weekDays = getDatesForCurrentWeek();

  // Update current time every 30 seconds to run real-time proximity checks
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Proximity Alert calculations: find pending tasks today that expire within 60 minutes
  const expiringSoonTasks = tasks.filter(task => {
    if (task.status !== 'pending' || task.isArchived) return false;
    
    // Check if task date is today (using YYYY-MM-DD formatted in local time)
    const todayStr = currentTime.toLocaleDateString('en-CA'); // Outputs "YYYY-MM-DD" reliably
    if (task.date !== todayStr) return false;
    
    const endTimeStr = task.endTime || task.time;
    if (!endTimeStr) return false;
    
    const [hour, min] = endTimeStr.split(':').map(Number);
    const deadlineDate = new Date(currentTime);
    deadlineDate.setHours(hour, min, 0, 0);
    
    const diffMs = deadlineDate.getTime() - currentTime.getTime();
    const diffMin = Math.ceil(diffMs / (1000 * 60));
    
    // Within 60 minutes and in the future
    return diffMin > 0 && diffMin <= 60;
  });

  // Trigger system push notifications if any task enters the 60 min warning zone
  useEffect(() => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    
    expiringSoonTasks.forEach(task => {
      if (!notifiedTasks[task.id]) {
        try {
          const pointsStr = task.points > 0 ? ` (+${task.points} نقاط)` : '';
          
          new Notification("تنبيه مهمة توشك على الانتهاء! ⏰", {
            body: `البطل ${task.userName}، بقيت ساعة واحدة أو أقل لإنجاز مهمة: "${task.title}" ${pointsStr}! أسرع لإنجازها.`,
            icon: '/favicon.ico',
            tag: task.id // Prevent duplicates for the same task
          });
          
          setNotifiedTasks(prev => ({ ...prev, [task.id]: true }));
        } catch (e) {
          console.error('Failed to trigger native notification:', e);
        }
      }
    });
  }, [expiringSoonTasks, notifiedTasks]);

  const handleRequestNotificationPermission = async () => {
    if (typeof Notification === 'undefined') {
      alert('متصفحك الحالي لا يدعم ميزة الإشعارات التلقائية.');
      return;
    }
    
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        new Notification("تم تفعيل الإشعارات بنجاح! 🎉", {
          body: "سنقوم بتنبيهك تلقائياً قبل ساعة كاملة من انتهاء مهامك المعلقة لتنجزها بذكاء!",
          icon: '/favicon.ico'
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendWhatsAppReminder = (task: DailyTask) => {
    const pointsText = task.points > 0 ? ` (+${task.points} نقاط)` : '';
    const formattedEndTime = formatArabicTime(task.endTime || task.time);
    
    // Calculate minutes left dynamically if today
    const todayStr = new Date().toLocaleDateString('en-CA');
    let timeLeftText = `قبل انتهاء الوقت في تمام ${formattedEndTime}`;
    
    if (task.date === todayStr) {
      const endTimeStr = task.endTime || task.time;
      if (endTimeStr) {
        const [hour, min] = endTimeStr.split(':').map(Number);
        const deadlineDate = new Date();
        deadlineDate.setHours(hour, min, 0, 0);
        const diffMs = deadlineDate.getTime() - Date.now();
        const diffMin = Math.ceil(diffMs / (1000 * 60));
        if (diffMin > 0 && diffMin <= 60) {
          timeLeftText = `متبقي ${diffMin} دقيقة فقط (ينتهي الساعة ${formattedEndTime})`;
        }
      }
    }

    const message = `تنبيه عاجل للبطل 👦 *${task.userName}* ⏰\n\nتوشك فترة مهمتك اليومية *"${task.title}"* ${pointsText} على الانتهاء!\n⏱️ الوقت: *${timeLeftText}*.\n\nأسرع لإنجاز المهمة وتسجيل نجاحك اليومي الباهر وكسب نقاطك الوفيرة! 💪🏆🎉`;
    const encodedText = encodeURIComponent(message);
    
    // Attempt to direct to specific phone number of the assigned child/user
    const member = familyMembers.find(m => m.uid === task.userId);
    let targetPhone = member?.phoneNumber || '';
    
    // Clean targetPhone - remove '+', '-', spaces, parentheses
    targetPhone = targetPhone.replace(/[\s\+\-\(\)]/g, '');
    
    if (targetPhone) {
      // Support Saudi numbers conversion: 05xxxxxxxx -> 9665xxxxxxxx
      if (targetPhone.startsWith('0') && targetPhone.length === 10) {
        targetPhone = '966' + targetPhone.substring(1);
      }
      window.open(`https://wa.me/${targetPhone}?text=${encodedText}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${encodedText}`, '_blank');
    }
  };

  const handleUpdatePhoneNumber = async (uid: string, num: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        phoneNumber: num.trim()
      });
      setEditingPhoneUid(null);
    } catch (e) {
      console.error('Failed to update phone number:', e);
    }
  };

  // Load all family members (both parents and children)
  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const members = snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
      setFamilyMembers(members);
      if (members.length > 0 && !selectedChildId) {
        // Default to first child if parent, or themselves if child/no-children
        const firstChild = members.find(m => m.role === 'child');
        setSelectedChildId(firstChild ? firstChild.uid : (profile.uid || members[0].uid));
      }
    });
    return () => unsubscribe();
  }, [profile.uid, selectedChildId]);

  // Load Tasks for the active user/child/parent selected
  const targetUserId = selectedChildId || profile.uid;

  useEffect(() => {
    if (!targetUserId) return;
    
    // Fetch all tasks for current week to calculate statistics, filter by date later dynamically
    const q = query(
      collection(db, 'dailyTasks'),
      where('userId', '==', targetUserId)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      let fetchedTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyTask));
      
      // Sort in memory by createdAt desc safely
      fetchedTasks.sort((a, b) => {
        const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
        const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
        return bTime - aTime;
      });
      
      // Auto-update expired tasks locally & check if we need to write back status for outdated tasks
      const now = new Date();
      const updatedTasks = await Promise.all(fetchedTasks.map(async (task) => {
        // Construct task deadline using task.endTime (or fall back to task.time if not present)
        const expirationTime = task.endTime || task.time;
        const [hour, sec] = expirationTime.split(':');
        const taskDeadline = new Date(task.date);
        taskDeadline.setHours(Number(hour || 12), Number(sec || 0), 0, 0);

        if (task.status === 'pending' && now > taskDeadline) {
          // If in past, mark as expired in DB asynchronously
          try {
            await updateDoc(doc(db, 'dailyTasks', task.id), { status: 'expired' });
          } catch (e) {
            console.error('Failed to auto-expire task:', e);
          }
          return { ...task, status: 'expired' as const };
        }
        return task;
      }));

      setTasks(updatedTasks);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'dailyTasks');
    });

    return () => unsubscribe();
  }, [targetUserId]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) {
      setFormError('يرجى كتابة عنوان المهمة اليومية!');
      return;
    }
    setFormError('');
    setIsSubmitting(true);

    try {
      const taskUserId = isParent ? (selectedChildId || profile.uid) : profile.uid;
      const taskUserName = isParent 
        ? (familyMembers.find(m => m.uid === taskUserId)?.displayName || 'عضو عائلي')
        : (profile.displayName || 'عضو عائلي');

      if (!taskUserId) {
        setFormError('برجاء اختيار العضو المستهدف أولاً!');
        setIsSubmitting(false);
        return;
      }

      // Validate time order
      const [startH, startM] = newTaskTime.split(':').map(Number);
      const [endH, endM] = newTaskEndTime.split(':').map(Number);
      if (startH * 60 + startM >= endH * 60 + endM) {
        setFormError('يرجى التأكد من أن وقت الانتهاء يأتي بعد وقت البدء!');
        setIsSubmitting(false);
        return;
      }

      await addDoc(collection(db, 'dailyTasks'), {
        title: newTaskTitle.trim(),
        userId: taskUserId,
        userName: taskUserName,
        date: newTaskDate,
        time: newTaskTime,
        endTime: newTaskEndTime,
        points: Number(newTaskPoints) || 0,
        status: 'pending',
        category: newTaskCategory,
        isArchived: false,
        createdAt: serverTimestamp()
      });

      // Notify user / child about new daily task
      if (isParent && taskUserId !== profile.uid) {
        await addDoc(collection(db, 'notifications'), {
          userId: taskUserId,
          title: 'مهمة يومية جديدة! 🗓️✨',
          body: `لقد أضاف الأهل مهمة يومية جديدة لك بـ [${newTaskTitle}] برصيد ${newTaskPoints} نقاط!`,
          type: 'info',
          read: false,
          createdAt: serverTimestamp()
        });
      }

      setNewTaskTitle('');
      // Keep selected day/time for seamless continuous entries
      alert('تم إضافة المهمة اليومية بنجاح بنظام الأوقات والتأكيد الفوري! 🎉');
    } catch (err: any) {
      console.error(err);
      setFormError('حدث خطأ أثناء حفظ المهمة: ' + (err.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleTask = async (task: DailyTask) => {
    if (task.status === 'expired') {
      alert('هذه المهمة منتهية الصلاحية ومغلقة لانتهاء الوقت المحدد لها! ⏳');
      return;
    }

    const isCurrentlyCompleted = task.status === 'completed';
    const newStatus = isCurrentlyCompleted ? 'pending' : 'completed';

    try {
      // Find user to grant points
      const taskUserRef = doc(db, 'users', task.userId);
      const pointsDiff = task.points || 0;
      
      const targetMember = familyMembers.find(m => m.uid === task.userId);
      const currentPoints = targetMember ? (targetMember.points || 0) : (task.userId === profile.uid ? profile.points : 0);

      if (newStatus === 'completed') {
        // Add real user points if task completed successfully
        await updateDoc(taskUserRef, {
          points: currentPoints + pointsDiff
        });

        // Add real earn transaction
        await addDoc(collection(db, 'transactions'), {
          userId: task.userId,
          userName: task.userName,
          type: 'earn',
          points: pointsDiff,
          currencyAmount: 0,
          status: 'approved',
          requestedAt: serverTimestamp()
        });

        // Send confirmation notification
        await addDoc(collection(db, 'notifications'), {
          userId: task.userId,
          title: 'كفو! أنجزت مهمتك اليومية 🎉💪',
          body: `مبارك الحصول على ${pointsDiff} نقاط لإنجازك: ${task.title}`,
          type: 'success',
          read: false,
          createdAt: serverTimestamp()
        });
      } else {
        // Unchecked task - subtract points safely keeping user above 0
        const newPointsValue = Math.max(0, currentPoints - pointsDiff);

        await updateDoc(taskUserRef, {
          points: newPointsValue
        });

        // Record a transaction for rollback or decrease
        await addDoc(collection(db, 'transactions'), {
          userId: task.userId,
          userName: task.userName,
          type: 'redeem',
          points: pointsDiff,
          currencyAmount: 0,
          status: 'approved',
          requestedAt: serverTimestamp()
        });
      }

      await updateDoc(doc(db, 'dailyTasks', task.id), {
        status: newStatus,
        completedAt: newStatus === 'completed' ? serverTimestamp() : null,
        isArchived: newStatus === 'completed' ? true : false
      });

    } catch (error: any) {
      console.error("Failed to toggle daily task status:", error);
      alert("تعذر تحديث المهمة: " + (error.message || error));
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    const confirmDelete = window.confirm('هل أنت متأكد من حذف هذه المهمة اليومية نهائياً؟');
    if (!confirmDelete) return;

    try {
      const taskRef = doc(db, 'dailyTasks', taskId);
      await updateDoc(taskRef, { status: 'expired' }); // Lock or delete. Let's physically delete for custom list comfort!
      // To keep it 100% clean, let's delete
      // Actually we can do write:
      // Wait, firestore rules allows write if signedIn. So delete is perfectly permitted!
      // But instead of standard physical delete, we can also modify collections or delete directly
      const { deleteDoc } = await import('firebase/firestore');
      await deleteDoc(taskRef);
    } catch (e: any) {
      console.error(e);
      alert('فشل حذف المهمة: ' + e.message);
    }
  };

  // Filter tasks to show for the selected day (active tasks)
  const filteredTasks = tasks.filter(t => t.date === selectedDay && !t.isArchived);

  // Filter archived tasks for the selected day
  const archivedTasks = tasks.filter(t => t.date === selectedDay && t.isArchived);

  // Compute Weekly Statistics
  // Filter all tasks belonging to the current week strip
  const weekDateStrings = weekDays.map(d => d.dateString);
  const currentWeekTasks = tasks.filter(t => weekDateStrings.includes(t.date));
  
  const completedCount = currentWeekTasks.filter(t => t.status === 'completed').length;
  const expiredCount = currentWeekTasks.filter(t => t.status === 'expired').length;
  const pendingCount = currentWeekTasks.filter(t => t.status === 'pending').length;
  const totalWeekTasks = currentWeekTasks.length;
  
  const completionPercentage = totalWeekTasks > 0 
    ? Math.round((completedCount / totalWeekTasks) * 100) 
    : 0;

  // Evaluation Message
  const getWeeklyFeedback = (percentage: number) => {
    if (totalWeekTasks === 0) return 'لا يوجد مهام مجدولة لهذا الأسبوع حتى الآن. ابدأ بإضافة المهام اليومية المرتبة! 🗓️';
    if (percentage >= 90) return 'تقييم أسطوري! 🌟👑 أنت بطل خارق وملتزم بجدولك بالكامل!';
    if (percentage >= 70) return 'تقييم بطل مميز! 🚀🔥 إنجاز رائع وسعي استثنائي نحو القمة!';
    if (percentage >= 50) return 'عمل جيد ورائع! 👍✨ واصل تنظيم وقتك وإكمال أهدافك اليومية!';
    return 'حفّز نفسك وحاول التعويض في الأيام القادمة! 🎯⚡ تنظيم الوقت طريقك للنجاح!';
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 pb-32">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white/5 border border-white/10 p-6 rounded-[2.5rem] shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-brand-primary/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="space-y-1.5 z-10">
          <div className="flex items-center gap-2">
            <CalendarCheck className="text-amber-400 w-8 h-8 animate-bounce" />
            <h1 className="text-2xl font-black text-white">اصنع مهامك اليومية 🗓️🔑</h1>
          </div>
          <p className="text-xs text-brand-text/60">
            خطط ورتب يومك بساعات المعيشة المحددة، كافئ نفسك بالتأكيد الفوري وعش متعة النجاح!
          </p>
        </div>

        {/* Family Member Selector */}
        <div className="z-10 bg-white/5 border border-white/10 px-4 py-3 rounded-2xl flex items-center gap-3">
          <span className="text-xs font-bold text-amber-300">عرض جدول مهام:</span>
          <select
            value={selectedChildId || profile.uid}
            onChange={(e) => setSelectedChildId(e.target.value)}
            className="bg-slate-900 border border-white/20 text-white rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:border-amber-400 cursor-pointer"
          >
            <option value="" disabled>اختر العضو...</option>
            {familyMembers.map(member => (
              <option key={member.uid} value={member.uid}>
                {member.displayName} {member.role === 'parent' ? '👨‍👩‍👦 (الوالدين)' : '👦 (البطل)'} {member.uid === profile.uid ? ' (أنت)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 🔔 Urgent Expiring Tasks and Notification Control Panel */}
      <div className="space-y-4">
        {/* Permission Request Header / Alert */}
        <div className="bg-slate-900 border border-white/10 p-5 rounded-[2rem] flex flex-col sm:flex-row items-center justify-between gap-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 animate-pulse text-lg">
              🔔
            </div>
            <div className="space-y-0.5 text-right">
              <h3 className="text-xs font-black text-white">إشعارات تذكير الموقت التلقائي</h3>
              <p className="text-[10px] text-brand-text/60">
                فعل الإشعارات ليرسل النظام تنبيهات دفع (Push) تذكر الطفل تلقائياً قبل ساعة كاملة من فوات وقت المهمة!
              </p>
            </div>
          </div>

          <button
            onClick={handleRequestNotificationPermission}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap outline-none ${
              notificationPermission === 'granted'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-default'
                : 'bg-amber-500 text-slate-950 hover:bg-amber-400 hover:scale-105 shadow-lg shadow-amber-500/10'
            }`}
          >
            {notificationPermission === 'granted' ? '✓ تم تفعيل الإشعارات' : '🔔 تفعيل تنبيهات الدفع'}
          </button>
        </div>

        {/* 📞 Family WhatsApp Contacts Settings */}
        <div className="bg-slate-900 border border-white/10 p-5 rounded-[2rem] space-y-4 text-right">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">💬</span>
            <div className="space-y-0.5">
              <h3 className="text-xs font-black text-white">إعدادات أرقام واتساب للتذكير الفوري</h3>
              <p className="text-[10px] text-brand-text/60">
                أدخل أرقام الهواتف (بالصيغة الدولية، مثلاً 9665xxxxxxxx) لتبسيط إرسال تنبيهات واتساب المباشرة للأبطال أو الوالدين!
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {familyMembers.map((member) => {
              const isEditing = editingPhoneUid === member.uid;
              const hasPermissionToEdit = isParent || member.uid === profile.uid;

              return (
                <div key={member.uid} className="bg-white/5 border border-white/5 p-3.5 rounded-2xl flex items-center justify-between gap-3 transition-all hover:bg-white/[0.07]">
                  <div className="flex items-center gap-3">
                    <img
                      src={member.photoURL || 'https://api.dicebear.com/7.x/bottts/svg'}
                      alt={member.displayName}
                      className="w-8 h-8 rounded-xl object-cover bg-slate-800 border border-white/10"
                      referrerPolicy="no-referrer"
                    />
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-black text-white">{member.displayName}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-white/5 border border-white/5 text-brand-text/60">
                          {member.role === 'parent' ? 'الوالدين 👨‍👩‍👦' : 'البطل 👦'}
                        </span>
                      </div>
                      
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <input
                            type="text"
                            value={phoneInputVal}
                            onChange={(e) => setPhoneInputVal(e.target.value)}
                            placeholder="مثال: 9665xxxxxxxx"
                            dir="ltr"
                            className="bg-slate-950 border border-white/10 text-white rounded-lg px-2 py-1 text-xs font-bold outline-none focus:border-emerald-500 w-36 text-center"
                          />
                          <button
                            onClick={() => handleUpdatePhoneNumber(member.uid, phoneInputVal)}
                            className="p-1.5 bg-emerald-500 text-slate-950 rounded-lg hover:bg-emerald-400 transition-all font-black text-[10px]"
                            title="حفظ الرقم"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => setEditingPhoneUid(null)}
                            className="p-1.5 bg-white/5 text-white/50 rounded-lg hover:bg-white/10 transition-all text-[10px]"
                            title="إلغاء"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <p className="text-[10px] font-mono text-emerald-400 mt-1">
                          {member.phoneNumber ? `💬 ${member.phoneNumber}` : '⚠️ لم يتم ربط رقم واتساب'}
                        </p>
                      )}
                    </div>
                  </div>

                  {!isEditing && hasPermissionToEdit && (
                    <button
                      onClick={() => {
                        setEditingPhoneUid(member.uid);
                        setPhoneInputVal(member.phoneNumber || '');
                      }}
                      className="px-2.5 py-1.5 text-[9px] font-black text-amber-400 bg-amber-400/5 hover:bg-amber-400/10 border border-amber-400/20 rounded-xl transition-all outline-none"
                    >
                      {member.phoneNumber ? 'تعديل الرقم ✏️' : 'إضافة رقم ➕'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Proximity Alerts (tasks expiring soon in the next hour) */}
        {expiringSoonTasks.length > 0 && (
          <div className="bg-red-500/5 border border-red-500/15 p-6 rounded-[2.5rem] space-y-4 relative overflow-hidden text-right">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-2xl pointer-events-none" />
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg animate-bounce">🚨</span>
                <h3 className="text-xs font-black text-red-400">مهام توشك على الانتهاء خلال ساعة أو أقل!</h3>
              </div>
              <span className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full font-black animate-pulse">
                عاجل ({expiringSoonTasks.length})
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AnimatePresence mode="popLayout">
                {expiringSoonTasks.map(task => {
                  const cat = getCategoryDetails(task.category);
                  const CatIcon = cat.icon;
                  const formattedEndTime = formatArabicTime(task.endTime || task.time);

                  // Calculate exact minutes left
                  const endTimeStr = task.endTime || task.time;
                  let diffMin = 60;
                  if (endTimeStr) {
                    const [h, m] = endTimeStr.split(':').map(Number);
                    const deadlineDate = new Date();
                    deadlineDate.setHours(h, m, 0, 0);
                    const diffMs = deadlineDate.getTime() - Date.now();
                    diffMin = Math.ceil(diffMs / (1000 * 60));
                  }

                  return (
                    <motion.div
                      key={`urgent-${task.id}`}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-slate-950/80 border border-red-500/20 p-4 rounded-2xl flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-500/10 text-red-400 rounded-xl border border-red-500/20 animate-pulse">
                          <Clock size={16} />
                        </div>
                        <div className="space-y-1 text-right">
                          <div className="flex items-center gap-1.5">
                            <div className={`p-0.5 rounded border text-[8px] flex items-center justify-center ${cat.colorClass}`}>
                              <CatIcon size={10} />
                            </div>
                            <span className="text-[10px] font-black text-white">{task.title}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[9px] font-bold text-red-400/80">
                            <span>⏱️ ينتهي خلال {diffMin} دقيقة</span>
                            <span>•</span>
                            <span>(الساعة {formattedEndTime})</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Send direct WhatsApp reminder */}
                        <button
                          onClick={() => handleSendWhatsAppReminder(task)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 text-[10px] font-black flex items-center gap-1 transition-all shadow-md shadow-emerald-500/10"
                          title="إرسال تذكير مباشر للواتساب"
                        >
                          <span>واتساب 💬</span>
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      {/* Weekly Evaluation Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Right Card: Main Progress Metric */}
        <div className="md:col-span-2 bg-gradient-to-br from-purple-900/40 to-slate-900 border border-white/10 p-6 rounded-[2.5rem] shadow-xl flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 w-24 h-24 bg-brand-accent/5 rounded-full blur-xl pointer-events-none" />
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-white/50 tracking-wider">الحصاد الأسبوعي المنظم</span>
              <span className="text-xs font-black text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full border border-emerald-400/20 animate-pulse">
                الأسبوع الحالي ✓
              </span>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-black text-white">معدل تحقيق المهام</h3>
              <p className="text-xs text-brand-text/80 leading-relaxed font-medium">
                {getWeeklyFeedback(completionPercentage)}
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <div className="flex justify-between items-center text-xs font-black text-white/75">
              <span>نسبة تحقيق الأهداف اليومية</span>
              <span className="text-amber-400 text-lg font-black">{completionPercentage}%</span>
            </div>
            
            <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/10">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${completionPercentage}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full"
              />
            </div>

            <div className="grid grid-cols-3 gap-2 text-center pt-2">
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-2xl space-y-0.5">
                <span className="block text-[8px] text-emerald-400 font-bold">المهام المكتملة</span>
                <span className="block text-sm font-black text-white">{completedCount}</span>
              </div>
              <div className="bg-red-500/10 border border-red-500/20 p-2.5 rounded-2xl space-y-0.5">
                <span className="block text-[8px] text-red-400 font-bold">المهام الفائتة</span>
                <span className="block text-sm font-black text-white">{expiredCount}</span>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-2xl space-y-0.5">
                <span className="block text-[8px] text-amber-400 font-bold">انتظار الإكمال</span>
                <span className="block text-sm font-black text-white">{pendingCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Left Card: Fast Task Authoring Form */}
        <div className="bg-slate-900 border border-white/10 p-6 rounded-[2.5rem] shadow-xl">
          <h3 className="text-sm font-black text-white mb-4 flex items-center gap-2">
            <Plus size={16} className="text-amber-400" />
            أنشئ مهمتك فوراً
          </h3>

          <form onSubmit={handleCreateTask} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] text-white/50 font-bold">اسم المهمة اليومية</label>
              <input 
                type="text" 
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="مثال: مراجعة سورة الملك، ترتيب غرفتي..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-amber-400 font-bold text-right"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-white/50 font-bold">التاريخ</label>
              <input 
                type="date" 
                value={newTaskDate}
                onChange={(e) => setNewTaskDate(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-400 font-bold text-center"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-white/50 font-bold">وقت البدء</label>
                <input 
                  type="time" 
                  value={newTaskTime}
                  onChange={(e) => setNewTaskTime(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-400 font-bold text-center"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-white/50 font-bold">وقت الانتهاء</label>
                <input 
                  type="time" 
                  value={newTaskEndTime}
                  onChange={(e) => setNewTaskEndTime(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-400 font-bold text-center"
                />
              </div>
            </div>

            <div className="space-y-1 bg-white/5 p-4 rounded-2xl border border-white/5">
              <label className="text-[10px] text-white/50 font-bold flex justify-between">
                <span>النقاط التحفيزية</span>
                <span className="text-amber-400">{newTaskPoints} نقاط</span>
              </label>
              <input 
                type="range"
                min="0"
                max="20"
                step="1"
                value={newTaskPoints}
                onChange={(e) => setNewTaskPoints(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-white/50 font-bold">تصنيف المهمة اليومية</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'educational', label: 'تعليمي', icon: BookOpen, color: 'border-blue-500/30 text-blue-400 hover:bg-blue-500/5' },
                  { id: 'athletic', label: 'رياضي', icon: Dumbbell, color: 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/5' },
                  { id: 'household', label: 'منزلي', icon: Home, color: 'border-purple-500/30 text-purple-400 hover:bg-purple-500/5' },
                  { id: 'general', label: 'عام', icon: Sparkles, color: 'border-amber-500/30 text-amber-400 hover:bg-amber-500/5' },
                ].map((cat) => {
                  const CatIcon = cat.icon;
                  const isSelected = newTaskCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setNewTaskCategory(cat.id)}
                      className={`py-2.5 px-1 rounded-xl border text-[10px] font-black flex flex-col items-center justify-center gap-1.5 transition-all outline-none ${
                        isSelected
                          ? 'bg-amber-500 border-amber-500 text-slate-950 shadow-md scale-105'
                          : `bg-white/5 ${cat.color}`
                      }`}
                    >
                      <CatIcon size={14} />
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {formError && (
              <p className="text-[10px] text-red-400 bg-red-400/5 px-2.5 py-1.5 rounded-lg border border-red-400/10 font-bold text-right flex items-center gap-1">
                <AlertCircle size={12} />
                {formError}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 font-black rounded-xl text-xs hover:shadow-lg active:scale-95 transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'جاري الحفظ...' : 'إضافة إلى المخطط اليومي ✨'}
            </button>
          </form>
        </div>
      </div>

      {/* Week Navigation Timeline Strip */}
      <div className="space-y-3">
        <h4 className="text-xs font-black text-brand-text/50 uppercase tracking-widest flex items-center gap-2">
          <Calendar size={14} className="text-amber-400 animate-pulse" />
          مخطط الأيام والمهمات
        </h4>

        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day) => {
            const isToday = day.dateString === new Date().toISOString().split('T')[0];
            const isSelected = day.dateString === selectedDay;
            
            // Check count of tasks for this day
            const dayTaskCount = tasks.filter(t => t.date === day.dateString).length;
            const dayDoneCount = tasks.filter(t => t.date === day.dateString && t.status === 'completed').length;

            return (
              <button
                key={day.dateString}
                onClick={() => setSelectedDay(day.dateString)}
                className={`p-3 rounded-2xl border transition-all relative flex flex-col items-center gap-1 outline-none ${
                  isSelected 
                    ? 'bg-amber-500 border-amber-500 text-slate-950 shadow-xl shadow-amber-500/10 scale-105'
                    : isToday
                    ? 'bg-white/15 border-amber-500/50 text-white'
                    : 'bg-white/5 border-white/5 text-brand-text/70 hover:bg-white/10'
                }`}
              >
                <span className="text-[9px] font-black opacity-80">{day.dayName}</span>
                <span className="text-sm font-black font-sans">{day.dayNumber}</span>
                
                {dayTaskCount > 0 && (
                  <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded-md ${
                    isSelected ? 'bg-slate-950 text-amber-400' : 'bg-white/10 text-white'
                  }`}>
                    {dayDoneCount}/{dayTaskCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* View Switcher and Day Progress Tracker */}
      <div className="bg-slate-900 border border-white/10 p-4 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 outline-none ${
              viewMode === 'list' 
                ? 'bg-amber-500 text-slate-950 shadow-lg font-black' 
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            📋 عرض قائمة المهام
          </button>
          <button
            onClick={() => setViewMode('timeline')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 outline-none ${
              viewMode === 'timeline' 
                ? 'bg-amber-500 text-slate-950 shadow-lg font-black' 
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            ⏱️ مخطط المهام الزمني (الساعات)
          </button>
          <button
            onClick={() => setViewMode('archive')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 outline-none ${
              viewMode === 'archive' 
                ? 'bg-amber-500 text-slate-950 shadow-lg font-black' 
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            📦 أرشيف اليوم ({archivedTasks.length})
          </button>
        </div>

        {/* Day Specific Completion Progress */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="block text-[9px] text-white/40 font-bold">إنجاز اليوم المختار</span>
            <span className="block text-xs font-black text-white">
              {filteredTasks.filter(t => t.status === 'completed').length} من {filteredTasks.length} مكتملة
            </span>
          </div>
          <div className="w-24 h-2 bg-white/5 border border-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full transition-all duration-500"
              style={{ 
                width: `${filteredTasks.length > 0 
                  ? Math.round((filteredTasks.filter(t => t.status === 'completed').length / filteredTasks.length) * 100) 
                  : 0}%` 
              }}
            />
          </div>
        </div>
      </div>

      {/* Tasks List Content */}
      <div className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <span className="text-xs font-black text-white/50">
            {viewMode === 'list' ? 'قائمة مهمات' : viewMode === 'timeline' ? 'المخطط الزمني لمهمات' : 'أرشيف مهمات'} يوم {weekDays.find(d => d.dateString === selectedDay)?.dayName || 'المحدد'} ({selectedDay})
          </span>
          <span className="text-xs text-amber-300 font-bold">
            {viewMode === 'archive' ? `${archivedTasks.length} مؤرشفة` : `${filteredTasks.length} مهمات مجدولة`}
          </span>
        </div>

        {viewMode === 'archive' ? (
          /* Archive list view */
          archivedTasks.length === 0 ? (
            <div className="bg-white/5 border border-white/5 p-12 text-center rounded-[2.5rem] space-y-2">
              <Archive size={36} className="mx-auto text-white/20" />
              <h5 className="font-bold text-white text-xs">لا توجد مهام مؤرشفة لهذا اليوم</h5>
              <p className="text-[10px] text-white/40">عندما تنجز مهام اليوم أو تنتهي فترتها، ستؤرشف تلقائياً لتنظيف جدولك!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AnimatePresence mode="popLayout">
                {archivedTasks.map((task) => {
                  const isCompleted = task.status === 'completed';
                  const cat = getCategoryDetails(task.category);
                  const CatIcon = cat.icon;

                  return (
                    <motion.div
                      key={task.id}
                      layoutId={task.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={`p-5 rounded-3xl border transition-all relative overflow-hidden flex items-center justify-between group ${
                        isCompleted 
                          ? 'bg-emerald-500/5 border-emerald-500/10'
                          : 'bg-red-500/5 border-red-500/10 opacity-75'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${
                          isCompleted
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>
                          <Archive size={18} />
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <div className={`p-1 rounded-md border text-[9px] flex items-center justify-center ${cat.colorClass}`} title={cat.label}>
                              <CatIcon size={12} />
                            </div>
                            <h4 className={`font-black text-xs text-white/80 line-through`}>
                              {task.title}
                            </h4>
                          </div>

                          <div className="flex items-center gap-3 text-[10px] text-white/30 font-bold">
                            <span className="flex items-center gap-1">
                              <Clock size={12} />
                              <span>{formatArabicTime(task.time)}</span>
                            </span>
                            <span>•</span>
                            <span className={isCompleted ? 'text-emerald-400/60' : 'text-red-400/60'}>
                              {isCompleted ? 'مكتملة ✓' : 'فائتة ⏳'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Restore button */}
                        <button
                          onClick={async () => {
                            try {
                              await updateDoc(doc(db, 'dailyTasks', task.id), {
                                isArchived: false,
                                status: 'pending' // restore to pending so they can review it or re-complete it
                              });
                            } catch (err) {
                              console.error(err);
                            }
                          }}
                          className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-[10px] font-black text-white/60 hover:text-white transition-all"
                          title="استعادة المهمة للمخطط النشط"
                        >
                          إلغاء الأرشفة ↩
                        </button>

                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="p-2 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all outline-none"
                          title="حذف نهائي"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )
        ) : filteredTasks.length === 0 ? (
          <div className="bg-white/5 border border-white/5 p-12 text-center rounded-[2.5rem] space-y-2">
            <HelpCircle size={36} className="mx-auto text-white/20" />
            <h5 className="font-bold text-white text-xs">لا توجد مهام في هذا اليوم</h5>
            <p className="text-[10px] text-white/40">استعمل الصندوق في الجهة اليسرى لإنشاء المهمات وترتيب جدولك فورياً!</p>
          </div>
        ) : viewMode === 'list' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence mode="popLayout">
              {filteredTasks.map((task) => {
                const isCompleted = task.status === 'completed';
                const isExpired = task.status === 'expired';

                return (
                  <motion.div
                    key={task.id}
                    layoutId={task.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className={`p-5 rounded-3xl border transition-all relative overflow-hidden flex items-center justify-between group ${
                      isCompleted 
                        ? 'bg-emerald-500/10 border-emerald-500/20'
                        : isExpired
                        ? 'bg-red-500/5 border-red-500/10 opacity-70'
                        : 'bg-white/5 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {/* Checkmark mark container */}
                      <button
                        onClick={() => handleToggleTask(task)}
                        disabled={isExpired}
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all outline-none ${
                          isCompleted
                            ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                            : isExpired
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20 cursor-not-allowed'
                            : 'bg-white/10 hover:bg-white/20 border border-white/10 text-white'
                        }`}
                      >
                        {isCompleted ? (
                          <Check size={20} className="stroke-[3]" />
                        ) : isExpired ? (
                          <XCircle size={18} />
                        ) : (
                          <div className="w-2.5 h-2.5 bg-white/40 rounded-full group-hover:scale-125 transition-transform" />
                        )}
                      </button>

                      {/* Info layout */}
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {(() => {
                            const cat = getCategoryDetails(task.category);
                            const CatIcon = cat.icon;
                            return (
                              <div className={`p-1 rounded-md border text-[9px] flex items-center justify-center ${cat.colorClass}`} title={cat.label}>
                                <CatIcon size={12} />
                              </div>
                            );
                          })()}
                          <h4 className={`font-black text-xs text-white ${isCompleted ? 'line-through text-white/50' : ''}`}>
                            {task.title}
                          </h4>
                        </div>
                        
                        <div className="flex items-center gap-3 text-[10px] text-white/40 font-bold">
                          <span className="flex items-center gap-1 text-amber-400/80" title="الفترة الزمنية للمهمة">
                            <Clock size={12} />
                            <span>{formatArabicTime(task.time)}</span>
                            {task.endTime && (
                              <>
                                <span className="text-white/30 font-normal">إلى</span>
                                <span>{formatArabicTime(task.endTime)}</span>
                              </>
                            )}
                          </span>
                          
                          {task.points > 0 && (
                            <span className="flex items-center gap-1 text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-md">
                              <Award size={10} />
                              +{task.points} نقاط
                            </span>
                          )}

                          {isExpired && (
                            <span className="text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded-md text-[9px]">
                              غير مكتملة ومغلقة ⏳
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 z-10">
                      {/* WhatsApp reminder button for active/pending tasks */}
                      {!isCompleted && !isExpired && (
                        <button
                          onClick={() => handleSendWhatsAppReminder(task)}
                          className="p-2 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-all outline-none"
                          title="إرسال تذكير واتساب"
                        >
                          💬
                        </button>
                      )}

                      {/* Delete option for parents, or children deleting their pending tasks */}
                      {(isParent || (!isCompleted && !isExpired)) && (
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="p-2 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all outline-none md:opacity-0 group-hover:opacity-100"
                          title="حذف المهمة"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          /* Chronological Developed Timeline Chart View */
          <div className="relative pr-8 mr-4 border-r-2 border-dashed border-white/10 space-y-6 py-4">
            <AnimatePresence mode="popLayout">
              {[...filteredTasks]
                .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time))
                .map((task, index) => {
                  const isCompleted = task.status === 'completed';
                  const isExpired = task.status === 'expired';
                  
                  // Active detection: check if today's local time fits inside task slot
                  const todayStr = new Date().toISOString().split('T')[0];
                  const isTodaySelected = selectedDay === todayStr;
                  const now = new Date();
                  const currentMin = now.getHours() * 60 + now.getMinutes();
                  const startMin = timeToMinutes(task.time);
                  const endMin = timeToMinutes(task.endTime || task.time);
                  const isActiveNow = isTodaySelected && !isCompleted && !isExpired && (currentMin >= startMin && currentMin <= endMin);

                  const durationText = calculateDuration(task.time, task.endTime || task.time);

                  // Find user details
                  const assignee = familyMembers.find(m => m.uid === task.userId);
                  const isAssigneeParent = assignee?.role === 'parent';

                  return (
                    <motion.div
                      key={task.id}
                      layoutId={task.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: index * 0.05 }}
                      className={`relative p-5 rounded-3xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group ${
                        isCompleted
                          ? 'bg-emerald-500/10 border-emerald-500/20 shadow-md shadow-emerald-500/5'
                          : isActiveNow
                          ? 'bg-amber-500/10 border-amber-500/40 ring-2 ring-amber-500/20'
                          : isExpired
                          ? 'bg-red-500/5 border-red-500/10 opacity-70'
                          : 'bg-white/5 border-white/10 hover:border-white/20'
                      }`}
                    >
                      {/* Timeline Circular Bullet Node */}
                      <div className="absolute right-[-41px] top-1/2 -translate-y-1/2 flex items-center justify-center z-10">
                        <button
                          onClick={() => handleToggleTask(task)}
                          disabled={isExpired}
                          className={`w-5 h-5 rounded-full border-2 transition-all outline-none flex items-center justify-center ${
                            isCompleted
                              ? 'bg-emerald-500 border-slate-900 shadow-lg text-slate-950'
                              : isActiveNow
                              ? 'bg-amber-500 border-slate-900 shadow-lg text-slate-950 animate-pulse'
                              : isExpired
                              ? 'bg-red-500 border-slate-900 text-slate-950'
                              : 'bg-slate-950 border-white/40 hover:border-amber-400'
                          }`}
                          title={isCompleted ? 'تراجع عن الإنجاز' : 'اعتماد الإنجاز الفوري'}
                        >
                          {isCompleted ? (
                            <Check size={10} className="stroke-[3]" />
                          ) : isExpired ? (
                            <XCircle size={10} />
                          ) : (
                            <div className="w-1.5 h-1.5 bg-white/60 rounded-full" />
                          )}
                        </button>
                      </div>

                      {/* Left Side: Time and Title */}
                      <div className="flex flex-col md:flex-row md:items-center gap-4">
                        {/* Elegant Time Badge Column */}
                        <div className="flex flex-col items-start justify-center bg-slate-950 border border-white/5 px-3 py-2 rounded-2xl min-w-[120px] text-center font-sans">
                          <span className="text-[10px] font-black text-amber-400">
                            {formatArabicTime(task.time)}
                          </span>
                          {task.endTime && (
                            <>
                              <span className="text-[8px] text-white/30 my-0.5">إلى</span>
                              <span className="text-[10px] font-black text-amber-400">
                                {formatArabicTime(task.endTime)}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Title & Assignment Metadata */}
                        <div className="space-y-1.5 text-right">
                          <div className="flex items-center flex-wrap gap-2">
                            {(() => {
                              const cat = getCategoryDetails(task.category);
                              const CatIcon = cat.icon;
                              return (
                                <div className={`p-1 rounded-md border text-[9px] flex items-center justify-center ${cat.colorClass}`} title={cat.label}>
                                  <CatIcon size={12} />
                                </div>
                              );
                            })()}
                            <h4 className={`font-black text-sm text-white ${isCompleted ? 'line-through text-white/50' : ''}`}>
                              {task.title}
                            </h4>
                            
                            {/* Active indicator */}
                            {isActiveNow && (
                              <span className="text-[8px] font-black text-slate-900 bg-amber-400 px-2 py-0.5 rounded-full animate-bounce">
                                نشط الآن ⚡
                              </span>
                            )}

                            {/* Assignee pill */}
                            <span className={`text-[8px] font-black px-2 py-0.5 rounded-md flex items-center gap-1 ${
                              isAssigneeParent
                                ? 'bg-purple-500/10 text-purple-300 border border-purple-500/20'
                                : 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                            }`}>
                              <User size={10} />
                              <span>{task.userName}</span>
                              <span className="opacity-60 text-[7px]">
                                ({isAssigneeParent ? 'الأهل' : 'البطل'})
                              </span>
                            </span>
                          </div>

                          <div className="flex items-center flex-wrap gap-3 text-[10px] text-white/40 font-bold">
                            {durationText && (
                              <span className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-md text-white/60">
                                <Clock size={10} />
                                المدة: {durationText}
                              </span>
                            )}

                            {task.points > 0 && (
                              <span className="flex items-center gap-1 text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-md">
                                <Award size={10} />
                                +{task.points} نقاط
                              </span>
                            )}

                            {isCompleted ? (
                              <span className="text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-md text-[9px] flex items-center gap-0.5">
                                مكتملة بنجاح ✓
                              </span>
                            ) : isExpired ? (
                              <span className="text-red-400 bg-red-400/10 px-2 py-0.5 rounded-md text-[9px] flex items-center gap-0.5">
                                فائتة ومغلقة ⏳
                              </span>
                            ) : (
                              <span className="text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md text-[9px] flex items-center gap-0.5 animate-pulse">
                                بانتظار الإنجاز ⏳
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right Side: Quick Action and Delete Controls */}
                      <div className="flex items-center justify-end gap-3 self-end md:self-auto pt-2 md:pt-0">
                        {/* WhatsApp reminder button for active/pending tasks */}
                        {!isCompleted && !isExpired && (
                          <button
                            onClick={() => handleSendWhatsAppReminder(task)}
                            className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-black flex items-center gap-1 transition-all outline-none"
                            title="إرسال تذكير واتساب"
                          >
                            💬 تذكير واتساب
                          </button>
                        )}

                        {/* Complete button */}
                        {!isExpired && (
                          <button
                            onClick={() => handleToggleTask(task)}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all flex items-center gap-1 ${
                              isCompleted
                                ? 'bg-white/10 text-white/60 hover:bg-white/15'
                                : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 hover:scale-105'
                            }`}
                          >
                            {isCompleted ? 'تراجع عن الإنجاز ↩' : 'أنجزت المهمة! 🎉'}
                          </button>
                        )}

                        {/* Delete button */}
                        {(isParent || (!isCompleted && !isExpired)) && (
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="p-2 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all outline-none md:opacity-0 group-hover:opacity-100"
                            title="حذف المهمة"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
            </AnimatePresence>
          </div>
        )}
      </div>

    </div>
  );
}
