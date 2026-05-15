import React from 'react';
import { motion } from 'motion/react';
import { signInWithGoogle } from '../lib/firebase';
import { LogIn, Sparkles } from 'lucide-react';

export const Login: React.FC = () => {
  return (
    <div className="min-h-screen bg-summer-bg flex items-center justify-center p-4 overflow-hidden relative">
      {/* Decorative background atoms */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-summer-secondary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-summer-primary/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-summer-card rounded-[40px] p-12 shadow-2xl relative z-10 text-center border border-white/10 overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-summer-secondary to-transparent opacity-50" />
        
        <div className="w-24 h-24 summer-gradient rounded-3xl mx-auto mb-8 flex items-center justify-center shadow-[0_10px_40px_rgba(255,183,3,0.2)]">
          <Sparkles className="text-white" size={48} />
        </div>
        
        <h1 className="text-4xl font-black text-summer-secondary mb-3 tracking-tighter">مهام عائلية</h1>
        <p className="text-white/60 mb-10 text-sm leading-relaxed max-w-[240px] mx-auto font-medium">حول المهام المنزلية إلى جوائز قيمة بنظام ذكي وعملي</p>
        
        <button
          onClick={signInWithGoogle}
          className="w-full bg-white text-summer-primary rounded-2xl py-5 flex items-center justify-center gap-4 transition-all active:scale-95 group font-black text-lg shadow-xl hover:bg-summer-secondary hover:text-white hover:shadow-summer-secondary/20"
        >
          <LogIn size={24} className="group-hover:translate-x-[-4px] transition-transform" />
          <span>الدخول باستخدام جوجل</span>
        </button>
        
        <div className="mt-14 pt-8 border-t border-white/5 flex justify-center gap-6 text-[10px] font-black uppercase tracking-[0.2em] text-blue-200/20">
          <span>أمان تام</span>
          <span>بسيط</span>
          <span>ذكي</span>
        </div>
      </motion.div>
    </div>
  );
};
