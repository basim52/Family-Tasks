import React, { useRef } from 'react';
import { toPng } from 'html-to-image';
import { Task } from '../types';
import { Share2, Download } from 'lucide-react';

interface Props {
  task: Task;
  pointsValue: string; // e.g. "10 نقاط"
}

export const TaskImageGenerator: React.FC<Props> = ({ task, pointsValue }) => {
  const elementRef = useRef<HTMLDivElement>(null);

  const generateImage = async (share = false) => {
    if (!elementRef.current) return;
    
    try {
      const dataUrl = await toPng(elementRef.current, {
        cacheBust: true,
        width: 1200,
        height: 630,
      });

      if (share && navigator.share) {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], `task-${task.id}.png`, { type: 'image/png' });
        await navigator.share({
          files: [file],
          title: task.title,
          text: `مهمة جديدة: ${task.title}`,
        });
      } else {
        const link = document.createElement('a');
        link.download = `task-${task.id}.png`;
        link.href = dataUrl;
        link.click();
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.message?.includes('canceled') || err?.message?.includes('cancelled')) {
        console.log('User cancelled the share action.');
        return;
      }
      console.error('Error generating image:', err);
    }
  };

  return (
    <div className="flex gap-2">
      {/* Hidden high-quality card for capture */}
      <div className="fixed -left-[2000px] top-0 pointer-events-none">
          <div 
          ref={elementRef}
          className="w-[1200px] h-[630px] flex flex-col p-12 relative overflow-hidden text-summer-text"
          style={{ 
            background: 'linear-gradient(135deg, #caf0f8 0%, #90e0ef 100%)',
            fontFamily: '"Noto Sans Arabic", sans-serif'
          }}
          dir="rtl"
        >
          {/* Summer Decorative Elements */}
          <div className="absolute top-0 right-0 w-64 h-64 border-t-8 border-r-8 border-summer-accent/30 rounded-tr-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 border-b-8 border-l-8 border-summer-accent/30 rounded-bl-3xl" />
          
          <div className="flex-1 flex flex-col justify-between z-10">
            <div className="flex justify-between items-start">
              <div className="bg-summer-accent p-6 rounded-3xl shadow-xl border-4 border-white/50">
                <span className="text-white text-5xl font-bold">{pointsValue}</span>
              </div>
              <div className="text-right">
                <h2 className="text-summer-primary text-3xl font-black mb-2 tracking-widest uppercase">مهام عائلية صيفية</h2>
                <div className="h-1 w-32 bg-summer-accent ml-auto" />
              </div>
            </div>

            <div className="text-center px-12">
              <h1 className="text-summer-text text-7xl font-black mb-8 leading-tight drop-shadow-sm">
                {task.title}
              </h1>
              <p className="text-summer-text/60 text-3xl leading-relaxed max-w-3xl mx-auto font-medium">
                {task.description}
              </p>
            </div>

            <div className="flex justify-between items-center bg-white/40 p-8 rounded-2xl border border-white/60 backdrop-blur-sm">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-summer-primary rounded-full flex items-center justify-center text-white text-4xl font-bold border-4 border-white/50">
                  {task.assignedToName?.charAt(0) || '؟'}
                </div>
                <div>
                  <p className="text-summer-accent text-xl mb-1 font-bold">مسندة إلى</p>
                  <p className="text-summer-text text-3xl font-black">{task.assignedToName || 'الجميع'}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-summer-text/40 text-lg font-bold">بوابة العائلة الذكية ☀️</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => generateImage(true)}
        className="p-2 bg-summer-primary/10 text-summer-primary rounded-xl hover:bg-summer-primary hover:text-white transition-all flex items-center gap-2 text-sm font-bold border border-summer-primary/20"
        title="مشاركة عبر واتساب"
      >
        <Share2 size={16} />
        <span>واتساب</span>
      </button>
      <button
        onClick={() => generateImage(false)}
        className="p-2 bg-summer-accent/10 text-summer-accent rounded-xl hover:bg-summer-accent hover:text-white transition-all flex items-center gap-2 text-sm font-bold border border-summer-accent/20"
        title="تحميل كصورة"
      >
        <Download size={16} />
        <span>حمّل الصورة</span>
      </button>
    </div>
  );
};
