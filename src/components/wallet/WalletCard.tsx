import React from 'react';
import { motion } from 'motion/react';
import { Wallet, TrendingUp, ArrowUpRight, Clock, Star } from 'lucide-react';
import { UserProfile } from '../../types';

interface Props {
  profile: UserProfile;
  exchangeRate: number;
}

export const WalletCard: React.FC<Props> = ({ profile, exchangeRate }) => {
  const sarValue = (profile.points * exchangeRate).toFixed(2);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gradient-to-br from-navy-light to-navy p-6 rounded-3xl border border-gold/30 shadow-2xl relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-gold/5 blur-3xl rounded-full" />
      
      <h3 className="text-gold text-sm font-bold mb-4 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-gold animate-pulse"></span>
        البنك العائلي
      </h3>

      <div className="mb-6">
        <p className="text-blue-200/70 text-xs mb-1">إجمالي رصيد النقاط</p>
        <div className="flex items-baseline gap-2">
          <span className="text-5xl font-black text-gold tracking-tighter">{profile.points}</span>
          <span className="text-sm text-gold/70 font-medium">نقطة</span>
        </div>
      </div>

      <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-blue-100">القيمة بالريال</span>
          <span className="text-xs font-bold text-emerald-400">+{((profile.points * exchangeRate) / 10).toFixed(0)}%</span>
        </div>
        <p className="text-2xl font-bold">{sarValue} <span className="text-xs font-normal opacity-60">ريال سعودي</span></p>
        <p className="text-[10px] text-blue-200/40 mt-2 italic">سعر الصرف: {1/exchangeRate} نقاط = ١ ريال</p>
      </div>

      {profile.role === 'child' && (
        <button className="w-full mt-6 bg-gold text-navy-dark py-3 rounded-xl font-bold text-sm shadow-lg hover:scale-[1.02] active:scale-95 transition-all">
          طلب مكافأة
        </button>
      )}
    </motion.div>
  );
};
