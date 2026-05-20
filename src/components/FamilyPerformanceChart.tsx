import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Line, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  AreaChart, 
  Area 
} from 'recharts';
import { 
  TrendingUp, 
  Award, 
  CheckCircle2, 
  Calendar, 
  Users, 
  BarChart3, 
  CheckSquare, 
  Zap, 
  Star,
  Flame,
  Sparkles,
  Lightbulb
} from 'lucide-react';
import { UserProfile, Task } from '../types';

interface FamilyPerformanceChartProps {
  family: UserProfile[];
  tasks: Task[];
}

export const FamilyPerformanceChart: React.FC<FamilyPerformanceChartProps> = ({ family, tasks }) => {
  const [timeRange, setTimeRange] = useState<'weekly' | 'monthly'>('weekly');
  const [chartType, setChartType] = useState<'comparison' | 'trend' | 'reports'>('comparison');
  const [activeMetric, setActiveMetric] = useState<'completion' | 'points'>('completion');

  // Filter out parents, only analyze child accounts
  const children = useMemo(() => {
    return family.filter(f => f.role === 'child');
  }, [family]);

  // Safe timestamp parser to robustly handle Firestore Timestamp, Date or Strings
  const parseTaskDate = (val: any): Date | null => {
    if (!val) return null;
    if (val instanceof Date) return val;
    if (typeof val.toDate === 'function') return val.toDate();
    if (typeof val.seconds === 'number') return new Date(val.seconds * 1000);
    if (typeof val === 'string' || typeof val === 'number') {
      const parsed = new Date(val);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  };

  // List of colors mapping to children to display distinctive chart lines/bars
  const colors = [
    '#0ea5e9', // Sky Blue
    '#db2777', // Pink
    '#10b981', // Emerald Green
    '#f59e0b', // Amber Orange
    '#8b5cf6', // Violet
  ];

  const getChildColor = (index: number) => colors[index % colors.length];

  // Defined Date ranges
  const rangeConfig = useMemo(() => {
    const now = new Date();
    const daysCount = timeRange === 'weekly' ? 7 : 30;
    const dates: Date[] = [];
    
    // Create UTC baseline for dates to avoid timezone shifting
    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      d.setHours(0, 0, 0, 0);
      dates.push(d);
    }
    
    return { dates, daysCount };
  }, [timeRange]);

  // Aggregate stats per child in the selected time range
  const childPerformanceStats = useMemo(() => {
    const { dates } = rangeConfig;
    const cutoffDate = dates[0];

    return children.map((child, idx) => {
      // Filter tasks assigned to this child and created/completed within the selected period
      const relevantTasks = tasks.filter(t => {
        if (t.assignedTo !== child.uid) return false;
        const taskDate = parseTaskDate(t.createdAt);
        return taskDate ? taskDate >= cutoffDate : false;
      });

      const totalAssigned = relevantTasks.length;
      const completedTasks = relevantTasks.filter(t => t.status === 'completed' || t.status === 'approved');
      const approvedTasks = relevantTasks.filter(t => t.status === 'approved');

      // Points earned from approved tasks in this window
      const pointsEarned = approvedTasks.reduce((sum, t) => {
        const rewardAmount = t.rewardAmount || t.points || 0;
        return sum + rewardAmount;
      }, 0);

      const completionRate = totalAssigned > 0 
        ? Math.round((completedTasks.length / totalAssigned) * 100) 
        : 0;

      return {
        uid: child.uid,
        displayName: child.displayName || 'بطل',
        totalAssigned,
        completedCount: completedTasks.length,
        approvedCount: approvedTasks.length,
        pointsEarned,
        completionRate,
        color: getChildColor(idx)
      };
    });
  }, [children, tasks, rangeConfig]);

  // Comparison Chart Data (All children side-by-side)
  const comparisonData = useMemo(() => {
    return childPerformanceStats.map(stat => ({
      name: stat.displayName,
      'نسبة الإنجاز (%)': stat.completionRate,
      'النقاط المكتسبة': stat.pointsEarned,
      'عدد المهام الكلية': stat.totalAssigned,
      'المهام المنجزة': stat.completedCount,
      color: stat.color
    }));
  }, [childPerformanceStats]);

  // Daily Trend Chart Data (Day by day)
  const trendData = useMemo(() => {
    const { dates } = rangeConfig;
    const arabicDays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

    return dates.map(date => {
      const dayLabel = timeRange === 'weekly' 
        ? arabicDays[date.getDay()] 
        : `${date.getDate()} / ${date.getMonth() + 1}`;

      const dataRow: any = {
        name: dayLabel,
        fullDate: date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' }),
      };

      children.forEach((child, idx) => {
        // Find tasks for this child completed / approved on this specific day
        const dayTasks = tasks.filter(t => {
          if (t.assignedTo !== child.uid) return false;
          const completionDate = parseTaskDate(t.approvedAt || t.completedAt);
          if (!completionDate) return false;
          
          return (
            completionDate.getDate() === date.getDate() &&
            completionDate.getMonth() === date.getMonth() &&
            completionDate.getFullYear() === date.getFullYear()
          );
        });

        if (activeMetric === 'points') {
          // Points generated on this day
          const dayPoints = dayTasks
            .filter(t => t.status === 'approved')
            .reduce((sum, t) => sum + (t.rewardAmount || t.points || 0), 0);
          dataRow[child.displayName] = dayPoints;
        } else {
          // Count of completed tasks on this day
          dataRow[child.displayName] = dayTasks.length;
        }
      });

      return dataRow;
    });
  }, [rangeConfig, children, tasks, activeMetric, timeRange]);

  // Calculate Reports for each child
  const memberReports = useMemo(() => {
    return children.map((child, idx) => {
      // Completed and approved tasks for this child
      const completedTasks = tasks.filter(t => 
        t.assignedTo === child.uid && 
        (t.status === 'completed' || t.status === 'approved')
      );

      // 1. Group by title to find "what task they completed the most"
      const taskCounts: { [title: string]: number } = {};
      completedTasks.forEach(t => {
        const titleClean = t.title.trim();
        taskCounts[titleClean] = (taskCounts[titleClean] || 0) + 1;
      });

      let mostCompletedTask = 'لا يوجد مهام مكتملة حتى الآن';
      let mostCompletedCount = 0;
      Object.entries(taskCounts).forEach(([title, count]) => {
        if (count > mostCompletedCount) {
          mostCompletedCount = count;
          mostCompletedTask = title;
        }
      });

      // 2. Identify Superpower Title & Icon & Theme Color
      let superpowerTitle = 'البطل المتألق 🌟';
      let badgeBg = 'bg-amber-500/20 text-text-pink-300 border-amber-500/30';
      let description = 'صاحب همة عالية وحماس يملأ البيت نشاطاً، مستعد دائماً للتحديات الكبرى!';
      let advice = 'استمر بهذا التدفق المنعش، فالفوز الحقيقي هو متعة الإنجاز اليومي!';
      
      const textForAnalysis = completedTasks.map(t => t.title + ' ' + (t.description || '')).join(' ').toLowerCase();
      
      if (/صلاة|قرآن|مسجد|وضوء|ذكر/.test(textForAnalysis)) {
        superpowerTitle = 'حارس النور والروحانيات 🕌';
        badgeBg = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
        description = 'بطل يتقرب إلى الله ويهتم بطاعاته وأخلاقه، يضفي على البيت بركة ونوراً بأعماله المتميزة.';
        advice = 'رائع جداً! حافظ على نور قلبك لتنير طريق الآخرين بحماسك.';
      } else if (/دراسة|واجب|مذاكرة|مدرسة|كتاب|قراءة|حفظ/.test(textForAnalysis)) {
        superpowerTitle = 'المكتشف والعالِم الصغير 📚';
        badgeBg = 'bg-sky-500/20 text-sky-300 border-sky-500/30';
        description = 'محب للعلم والشغف بالدراسة، يحرص على تطوير مهاراته العقلية وتجهيز مستقبله الواعد.';
        advice = 'يا لك من ذكي! المعرفة هي القوة العظمى، واكب التميز بقراءة كتاب جديد اليوم.';
      } else if (/ترتيب|تنظيف|مطبخ|غرفة|ملابس|غسيل/.test(textForAnalysis)) {
        superpowerTitle = 'مهندس الترتيب والأناقة 🧹';
        badgeBg = 'bg-pink-500/20 text-pink-300 border-pink-500/30';
        description = 'يجعل المكان جميلاً ومريحاً للجميع بلمساته المرتبة، يكره الفوضى ويحب تنظيم كل زاوية.';
        advice = 'واو! طاقتك المنظمة تجعل البيت مكاناً مبهجاً كشمس الصباح المنعشة.';
      } else if (/رياضة|تمارين|جري|tمرين|مشي/.test(textForAnalysis)) {
        superpowerTitle = 'الإعصار الرياضي النشيط ⚡';
        badgeBg = 'bg-orange-500/20 text-orange-300 border-orange-500/30';
        description = 'صاحب قوة حركية هائلة، يهتم بصحته ولياقته البدنية وينشر الطاقة الإيجابية بابتسامته الحيوية.';
        advice = 'سرعتك مبهرة! تذكر دائماً أن العقل السليم في الجسم السليم المفعم بالنشاط.';
      } else if (completedTasks.length > 5) {
        superpowerTitle = 'المساعد الموثوق والمبادر 🤝';
        badgeBg = 'bg-purple-500/20 text-purple-300 border-purple-500/30';
        description = 'بطل متكامل تجده دائماً في الموعد لإنجاز أي مسؤولية، يعتمد عليه الأهل في كل الأوقات.';
        advice = 'أنت صمام الأمان والبهجة اليومية، مبادرتك السريعة هي كنز البيت الحقيقي!';
      }

      // 3. Weekly Streak count
      let currentStreak = 0;
      const today = new Date();
      for (let i = 0; i < 7; i++) {
        const checkDate = new Date();
        checkDate.setDate(today.getDate() - i);
        const hasCompletedOnDay = completedTasks.some(t => {
          const compDate = parseTaskDate(t.approvedAt || t.completedAt);
          return compDate && 
            compDate.getDate() === checkDate.getDate() &&
            compDate.getMonth() === checkDate.getMonth() &&
            compDate.getFullYear() === checkDate.getFullYear();
        });
        if (hasCompletedOnDay) {
          currentStreak++;
        } else if (i > 0) {
          break;
        }
      }

      return {
        uid: child.uid,
        displayName: child.displayName || 'بطل',
        superpowerTitle,
        badgeBg,
        description,
        advice,
        mostCompletedTask,
        mostCompletedCount,
        totalCompleted: completedTasks.length,
        currentStreak,
        color: getChildColor(idx)
      };
    });
  }, [children, tasks]);

  if (children.length === 0) {
    return (
      <div className="bg-summer-card p-8 rounded-[2.5rem] border border-white/40 shadow-xl text-center">
        <Users size={48} className="mx-auto text-summer-text/30 mb-3 animate-pulse" />
        <h3 className="font-black text-summer-text text-base mb-1">لوحة الإنجاز البياني</h3>
        <p className="text-xs text-summer-text/60">أضف أطفالاً إلى عائلتك لتفعيل لوحات ومخططات التحفيز البياني!</p>
      </div>
    );
  }

  return (
    <section className="bg-summer-card p-6 rounded-[2.5rem] border border-white/40 shadow-xl space-y-6 relative overflow-hidden" id="family-performance-chart">
      {/* Decorative gradient aura */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-summer-primary/5 rounded-full blur-[80px] -z-10 pointer-events-none" />
      
      {/* Header details */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-summer-primary to-summer-accent rounded-xl flex items-center justify-center text-white shadow-lg brand-glow">
            <TrendingUp size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-summer-text/40 uppercase tracking-[0.15em] leading-none mb-1.5">مركز التحليل البياني 📊</h3>
            <h4 className="font-black text-summer-text text-base">مستوى النشاط وتراكم الإنجازات</h4>
          </div>
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="bg-white/10 border border-white/10 p-1 rounded-2xl flex gap-1">
            <button 
              onClick={() => setTimeRange('weekly')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${timeRange === 'weekly' ? 'bg-white text-summer-primary shadow-sm' : 'text-summer-text/60 hover:text-summer-text'}`}
            >
              أسبوعي
            </button>
            <button 
              onClick={() => setTimeRange('monthly')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${timeRange === 'monthly' ? 'bg-white text-summer-primary shadow-sm' : 'text-summer-text/60 hover:text-summer-text'}`}
            >
              شهري
            </button>
          </div>
        </div>
      </div>

      {/* Visual Navigation Tabs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <button
          onClick={() => setChartType('comparison')}
          className={`p-4 rounded-3xl border text-right transition-all flex flex-col justify-between ${
            chartType === 'comparison'
              ? 'bg-summer-primary/10 border-summer-primary/40 text-summer-text shadow-md'
              : 'bg-white/15 border-white/10 hover:bg-white/25 text-summer-text/60'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-2">
            <BarChart3 size={18} className={chartType === 'comparison' ? 'text-summer-primary' : ''} />
            <span className="text-[10px] font-black bg-white/25 px-2 py-0.5 rounded-full">مقارنة</span>
          </div>
          <div>
            <span className="text-xs font-black block">مقارنة أداء الأبطال</span>
            <span className="text-[9px] text-summer-text/40 font-medium">معدلات الإنجاز التراكمية للمهام الكلية</span>
          </div>
        </button>

        <button
          onClick={() => setChartType('trend')}
          className={`p-4 rounded-3xl border text-right transition-all flex flex-col justify-between ${
            chartType === 'trend'
              ? 'bg-summer-primary/10 border-summer-primary/40 text-summer-text shadow-md'
              : 'bg-white/15 border-white/10 hover:bg-white/25 text-summer-text/60'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-2">
            <TrendingUp size={18} className={chartType === 'trend' ? 'text-summer-primary' : ''} />
            <span className="text-[10px] font-black bg-white/25 px-2 py-0.5 rounded-full">تاريخي</span>
          </div>
          <div>
            <span className="text-xs font-black block">مسار الإنجاز اليومي</span>
            <span className="text-[9px] text-summer-text/40 font-medium">تطور وإنجاز المهام يوماً بعد يوم</span>
          </div>
        </button>

        <button
          onClick={() => setChartType('reports')}
          className={`p-4 rounded-3xl border text-right transition-all flex flex-col justify-between ${
            chartType === 'reports'
              ? 'bg-summer-primary/10 border-summer-primary/40 text-summer-text shadow-md animate-pulse'
              : 'bg-white/15 border-white/10 hover:bg-white/25 text-summer-text/60'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-2">
            <Sparkles size={18} className={chartType === 'reports' ? 'text-summer-accent animate-spin' : ''} />
            <span className="text-[10px] font-black bg-white/25 px-2 py-0.5 rounded-full">تحليل ذكي</span>
          </div>
          <div>
            <span className="text-xs font-black block">ألقاب وأوسمة الأعضاء 🏆</span>
            <span className="text-[9px] text-summer-text/40 font-medium font-bold text-amber-500">منعش: المهام الأكثر تكراراً والقدرات</span>
          </div>
        </button>
      </div>

      {/* If trend chart is chosen, show metric selector (completion vs points) */}
      {chartType === 'trend' && (
        <div className="flex items-center justify-start gap-2 bg-white/10 p-1 rounded-2xl border border-white/10 w-fit">
          <button
            onClick={() => setActiveMetric('completion')}
            className={`px-4 py-2 rounded-xl text-[10px] font-bold transition-all flex items-center gap-1.5 ${
              activeMetric === 'completion'
                ? 'bg-white text-summer-primary shadow-sm'
                : 'text-summer-text/60 hover:text-summer-text'
            }`}
          >
            <CheckSquare size={13} />
            عدد المهام المنجزة
          </button>
          <button
            onClick={() => setActiveMetric('points')}
            className={`px-4 py-2 rounded-xl text-[10px] font-bold transition-all flex items-center gap-1.5 ${
              activeMetric === 'points'
                ? 'bg-white text-summer-primary shadow-sm'
                : 'text-summer-text/60 hover:text-summer-text'
            }`}
          >
            <Star size={13} />
            النقاط المستحقة
          </button>
        </div>
      )}

      {/* Chart Canvas Area */}
      {chartType !== 'reports' ? (
        <div className="bg-white/15 p-4 rounded-[2rem] border border-white/20 relative" dir="ltr">
          <div className="h-[280px] sm:h-[350px] w-full">
            {chartType === 'comparison' ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={comparisonData} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: 'currentColor', opacity: 0.6, fontSize: 11, fontWeight: 'bold' }} 
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    yAxisId="left"
                    tick={{ fill: 'currentColor', opacity: 0.6, fontSize: 11 }} 
                    axisLine={false}
                    tickLine={false}
                    unit="%"
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    tick={{ fill: '#f59e0b', opacity: 0.8, fontSize: 11 }} 
                    axisLine={false}
                    tickLine={false}
                    unit="ن"
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(255,255,255,0.95)', 
                      borderRadius: '16px', 
                      border: 'none', 
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                      color: '#0f172a',
                      fontWeight: 'bold',
                      fontSize: '12px'
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', opacity: 0.8, paddingTop: '10px' }}
                  />
                  <Bar 
                    yAxisId="left"
                    dataKey="نسبة الإنجاز (%)" 
                    fill="var(--primary, #0ea5e9)" 
                    radius={[12, 12, 0, 0]} 
                    maxBarSize={45}
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="النقاط المكتسبة" 
                    stroke="#f59e0b" 
                    strokeWidth={4} 
                    dot={{ r: 6, fill: '#f59e0b', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 8 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                  <defs>
                    {children.map((child, idx) => (
                      <linearGradient key={child.uid} id={`grad_${child.uid}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={getChildColor(idx)} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={getChildColor(idx)} stopOpacity={0.01}/>
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: 'currentColor', opacity: 0.6, fontSize: 10, fontWeight: 'bold' }} 
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fill: 'currentColor', opacity: 0.6, fontSize: 11 }} 
                    axisLine={false}
                    tickLine={false}
                    unit={activeMetric === 'points' ? 'ن' : ''}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(255,255,255,0.95)', 
                      borderRadius: '16px', 
                      border: 'none', 
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                      color: '#0f172a',
                      fontWeight: 'bold',
                      fontSize: '11px'
                    }}
                    labelStyle={{ color: '#64748b', fontSize: '10px' }}
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', opacity: 0.8, paddingTop: '10px' }}
                  />
                  {children.map((child, idx) => (
                    <Area
                      key={child.uid}
                      type="monotone"
                      dataKey={child.displayName}
                      stroke={getChildColor(idx)}
                      strokeWidth={3}
                      dot={{ r: 3 }}
                      fillOpacity={1}
                      fill={`url(#grad_${child.uid})`}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Beautiful Refreshing Bento Grid for Member Reports */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6" dir="rtl">
            {memberReports.map((report) => (
              <div 
                key={report.uid} 
                className="bg-white/10 hover:bg-white/15 transition-all p-6 rounded-[2rem] border border-white/25 shadow-xl space-y-4 relative overflow-hidden flex flex-col justify-between"
              >
                {/* Aura badge matching child color */}
                <div 
                  className="absolute -top-12 -left-12 w-28 h-28 rounded-full blur-[40px] opacity-20 pointer-events-none" 
                  style={{ backgroundColor: report.color }}
                />

                <div className="space-y-3">
                  {/* Title & Badge */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm shadow-md"
                        style={{ backgroundColor: report.color }}
                      >
                        {report.displayName.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-black text-summer-text text-base">{report.displayName}</h4>
                        <span className="text-[10px] text-summer-text/40 font-bold">ملف إنجاز البطة</span>
                      </div>
                    </div>

                    <span className={`text-xs px-3 py-1.5 rounded-2xl font-black border ${report.badgeBg} flex items-center gap-1`}>
                      <Sparkles size={12} className="animate-spin" />
                      {report.superpowerTitle}
                    </span>
                  </div>

                  {/* Poetic description */}
                  <p className="text-xs text-summer-text/80 leading-relaxed font-semibold bg-white/5 p-3.5 rounded-2xl border border-white/5">
                    {report.description}
                  </p>

                  <div className="grid grid-cols-2 gap-3 text-right">
                    {/* Unique Feature: Tasks completed the most */}
                    <div className="bg-white/5 p-3 rounded-2xl border border-white/5 flex flex-col justify-between">
                      <span className="text-[9px] text-summer-text/40 font-black block mb-1">المهام الأكثر تكراراً 🥇</span>
                      <div>
                        <span className="text-xs font-black text-summer-text block line-clamp-1">{report.mostCompletedTask}</span>
                        <span className="text-[10px] text-amber-400 font-bold">تم إنجازها {report.mostCompletedCount} مرة!</span>
                      </div>
                    </div>

                    {/* Weekly Streak */}
                    <div className="bg-white/5 p-3 rounded-2xl border border-white/5 flex flex-col justify-between">
                      <span className="text-[9px] text-summer-text/40 font-black block mb-1">حمى الالتزام المتتالي 🔥</span>
                      <div className="flex items-center gap-1 text-orange-400">
                        <Flame size={16} className="fill-orange-500 text-orange-500 animate-pulse" />
                        <span className="text-sm font-black text-orange-300">{report.currentStreak} أيام متتالية</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sparkling advice with Refreshing tip */}
                <div className="bg-gradient-to-r from-summer-primary/10 to-indigo-500/10 border border-white/10 p-4 rounded-2xl mt-4 flex items-start gap-2.5">
                  <Lightbulb size={20} className="text-amber-300 shrink-0 mt-0.5 animate-bounce" />
                  <div>
                    <span className="text-[9px] font-black text-amber-300 block mb-0.5 font-bold">نصيحة الانتعاش العظمى 💡</span>
                    <p className="text-[10px] text-summer-text/75 leading-relaxed font-bold">{report.advice}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Development Insight Summary (Interactive motivational banner) */}
          <div className="bg-gradient-to-r from-teal-500/15 via-emerald-500/15 to-amber-500/15 border border-white/20 p-6 rounded-[2rem] text-right space-y-4 shadow-md relative overflow-hidden" dir="rtl">
            <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-300">
                  <Sparkles size={20} className="animate-pulse" />
                </div>
                <div>
                  <h4 className="font-black text-white text-sm">البوصلة التطويرية وخطة الانتعاش العائلي 🚀</h4>
                  <p className="text-[10px] text-summer-text/60">تحليل الأنماط السلوكية والخطوات القادمة لتحفيز لانهائي</p>
                </div>
              </div>
              <div className="p-1 px-3 bg-white/10 border border-white/10 text-[9px] font-black rounded-lg text-summer-text">خطة الانتعاش المعتمدة لعام 2026</div>
            </div>
            
            <p className="text-xs text-summer-text/90 leading-relaxed font-bold">
              لاحظنا تميزاً مبهراً هذا الأسبوع! لتعزيز هذا الحماس وجعل الأجواء أكثر انتعاشاً، نقترح تفعيل <span className="text-emerald-300">"تحدي الأداء الفائق"</span> حيث يحصل العضو صاحب أطول سلسلة التزام متتالي (Streak) أو الأعلى تكراراً لمهمته المفضلة على <span className="text-amber-300">وسام البطل المنعش للبيت</span> بالإضافة إلى مكافأة توكن إضافية يوم الجمعة! 🎉
            </p>
          </div>
        </div>
      )}

      {/* Children Performance Cards (Table/Cards Summary in Arabic) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {childPerformanceStats.map((stat) => (
          <div 
            key={stat.uid} 
            className="p-4 rounded-3xl border border-white/20 bg-white/10 hover:bg-white/15 transition-all flex flex-col justify-between"
          >
            <div className="flex items-center gap-2 mb-3">
              <div 
                className="w-3 h-3 rounded-full shrink-0" 
                style={{ backgroundColor: stat.color }}
              />
              <span className="text-xs font-black text-summer-text">{stat.displayName}</span>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-summer-text/50 font-bold">معدل الإنجاز لمهام الفترة</span>
                <span className="font-black text-summer-text" style={{ color: stat.color }}>
                  {stat.completionRate}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-1000" 
                  style={{ width: `${stat.completionRate}%`, backgroundColor: stat.color }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
              <div className="text-right">
                <span className="text-[8px] text-summer-text/40 block font-bold">نقاط الفترة المعتمدة</span>
                <span className="text-xs font-black text-amber-500 flex items-center gap-0.5">
                  <Star size={11} className="inline fill-amber-500 text-amber-500" />
                  {stat.pointsEarned} ن
                </span>
              </div>
              <div className="text-right border-r border-white/10 pr-2">
                <span className="text-[8px] text-summer-text/40 block font-bold">نسبة المهام</span>
                <span className="text-xs font-black text-summer-text">
                  {stat.completedCount} من {stat.totalAssigned}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
