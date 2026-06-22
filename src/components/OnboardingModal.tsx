import React, { useState } from 'react';
import { Bike, Laptop, Briefcase, ChevronRight, Sparkles, Check, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { translations } from '../i18n/translations';
import { useSettings } from '../contexts/SettingsContext';

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: (preferences: {
    workType: 'rider' | 'freelance' | 'salary';
    baseSalary?: number;
    salaryPayday?: number;
    hasCompletedOnboarding: boolean;
  }) => void;
}

export function OnboardingModal({ isOpen, onComplete }: OnboardingModalProps) {
  const { currentLang } = useSettings();
  const t = translations[currentLang];

  const [selectedType, setSelectedType] = useState<'rider' | 'freelance' | 'salary'>('rider');
  const [baseSalary, setBaseSalary] = useState<string>('');
  const [salaryPayday, setSalaryPayday] = useState<string>('25');

  const handleStart = () => {
    onComplete({
      workType: selectedType,
      baseSalary: selectedType === 'salary' ? (parseFloat(baseSalary) || 0) : undefined,
      salaryPayday: selectedType === 'salary' ? parseInt(salaryPayday) : undefined,
      hasCompletedOnboarding: true,
    });
  };

  const currentLangCode = currentLang || 'th';

  const typeConfig = {
    rider: {
      title: currentLangCode === 'th' ? 'ไรเดอร์ / เดลิเวอรี' : 'Rider & Delivery',
      desc: currentLangCode === 'th' ? 'ผู้ขับขี่ Grab, Lineman, Lalamove, Foodpanda, Shopee ฯลฯ' : 'For Grab, Lineman, Lalamove, Foodpanda, Shopee, etc.',
      features: currentLangCode === 'th' 
        ? ['คำนวณเงินค้างหักระบบ', 'บันทึกยอดเก็บแทนลูกค้า', 'บันทึกยอดสำรองจ่ายหน้างาน', 'วิเคราะห์ทิปเศษ และยอดสุทธิ'] 
        : ['Calculate app commission deductions', 'Track customer-collected amounts', 'Track upfront prepaid costs', 'Analyze tips and net income'],
      color: 'from-indigo-500 to-blue-600',
      bgGlow: 'bg-indigo-500/10 dark:bg-indigo-400/5',
      borderColor: 'border-indigo-100 dark:border-indigo-900/30',
      activeBorder: 'border-indigo-500 dark:border-indigo-400',
      icon: Bike,
    },
    freelance: {
      title: currentLangCode === 'th' ? 'ฟรีแลนซ์ / รับจ้างทั่วไป' : 'Freelancer',
      desc: currentLangCode === 'th' ? 'โปรแกรมเมอร์, กราฟิกดีไซเนอร์, ช่างภาพ, ช่างซ่อมบำรุง, นายหน้า' : 'For programmers, designers, photographers, consultants, agents.',
      features: currentLangCode === 'th' 
        ? ['ระบุชื่องานเพื่อความชัดเจน', 'คำนวณต้นทุน/ค่าเดินทางของแต่ละงาน', 'บันทึกรายได้รายจ๊อบแบบอิสระ', 'ไม่ยึดติดกับแท่นฟอร์มไรเดอร์'] 
        : ['Assign customized job/project names', 'Calculate materials & transport costs per job', 'Flexible income logs', 'No complex rider-specific Commission calculations'],
      color: 'from-cyan-500 to-teal-500',
      bgGlow: 'bg-cyan-500/10 dark:bg-cyan-400/5',
      borderColor: 'border-cyan-100 dark:border-cyan-900/30',
      activeBorder: 'border-cyan-500 dark:border-cyan-400',
      icon: Laptop,
    },
    salary: {
      title: currentLangCode === 'th' ? 'พนักงานประจำ / มนุษย์เงินเดือน' : 'Regular Salary',
      desc: currentLangCode === 'th' ? 'พนักงานประจำ, ข้าราชการ, ผู้รับรายเดือน พร้อมเงินเศษจากงานเสริม' : 'For office employees, civil servants, or regular monthly income earners.',
      features: currentLangCode === 'th' 
        ? ['ลงยอดเงินเดือนเข้าบัญชีอัตโนมัติ', 'คัดแยกค่าล่วงเวลา (OT) ค่านายหน้า', 'ตั้งเป้าหมายสปอนเซอร์รายรับ', 'สะดวกสำหรับผู้มีรายหลักประสานงานเสริม'] 
        : ['Automate monthly salary log', 'Track Overtime (OT) & bonuses', 'Set target parameters', 'Perfect for combining side earnings with salary'],
      color: 'from-emerald-500 to-teal-600',
      bgGlow: 'bg-emerald-500/10 dark:bg-emerald-400/5',
      borderColor: 'border-emerald-100 dark:border-emerald-900/30',
      activeBorder: 'border-emerald-500 dark:border-emerald-400',
      icon: Briefcase,
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto bg-slate-950/80 backdrop-blur-md">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-slate-800 p-6 md:p-10 my-8 overflow-hidden"
        >
          {/* Animated Background blobs */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 dark:bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-teal-500/10 dark:bg-teal-500/5 rounded-full blur-[100px] pointer-events-none" />

          <div className="relative flex flex-col items-center text-center max-w-2xl mx-auto mb-8">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100/40 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-400 mb-4 animate-bounce">
              <Sparkles className="w-4 h-4 fill-indigo-100 dark:fill-indigo-950" />
              <span className="text-xs font-black uppercase tracking-wider">
                {currentLangCode === 'th' ? 'ปรับแต่งการใช้งานครั้งแรก' : 'First-time Setup'}
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800 dark:text-white leading-tight mb-3">
              {currentLangCode === 'th' ? 'ยินดีต้อนรับสู่แอปบัญชีอัจฉริยะ' : 'Welcome to Smart Income Tracker'}
            </h1>
            <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 leading-relaxed">
              {currentLangCode === 'th'
                ? 'เพื่ออินเตอร์เฟสฟอร์มที่สะอาดและกรอกข้อมูลรายรับได้สะดวกที่สุด โปรดเลือกรูปแบบวิธีการรับรายได้ของคุณหลักๆ'
                : 'Choose your main work profile to customize form inputs and dashboard widgets for the cleanest experience.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8 relative">
            {(['rider', 'freelance', 'salary'] as const).map((type) => {
              const cfg = typeConfig[type];
              const Icon = cfg.icon;
              const isSelected = selectedType === type;
              return (
                <div
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`cursor-pointer rounded-3xl p-5 md:p-6 transition-all duration-300 flex flex-col justify-between h-full border-2 relative overflow-hidden bg-slate-50/40 dark:bg-slate-900/40 ${
                    isSelected 
                      ? `${cfg.activeBorder} shadow-lg ring-1 ring-offset-0 ring-indigo-400/20` 
                      : `${cfg.borderColor} hover:border-slate-300 dark:hover:border-slate-700 hover:scale-[1.01]`
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-4 right-4 bg-emerald-500 text-white p-1 rounded-full shadow-md z-10">
                      <Check className="w-3.5 h-3.5 stroke-[3px]" />
                    </div>
                  )}

                  <div>
                    {/* Glowing Accent */}
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br ${cfg.color} text-white shadow-md mb-4`}>
                      <Icon className="w-6 h-6 shrink-0" />
                    </div>

                    <h3 className="text-lg font-black text-slate-800 dark:text-white mb-1.5">{cfg.title}</h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed font-bold mb-4">{cfg.desc}</p>
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4 mt-auto">
                    <ul className="space-y-2">
                      {cfg.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Conditional salary inputs */}
          <AnimatePresence>
            {selectedType === 'salary' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="max-w-xl mx-auto mb-8 bg-emerald-500/[0.03] border border-emerald-500/10 p-5 rounded-3xl"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-emerald-600 dark:text-emerald-400 mb-1.5 ml-1 uppercase tracking-wider">
                      {currentLangCode === 'th' ? 'ฐานเงินเดือน (บาท/เดือน)' : 'Monthly Base Salary (THB)'} *
                    </label>
                    <input 
                      type="number" 
                      value={baseSalary}
                      onChange={e => setBaseSalary(e.target.value)}
                      placeholder="เช่น 25000"
                      className="w-full h-12 px-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-base font-bold text-slate-700 dark:text-slate-350 focus:border-emerald-500 outline-none transition-all"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-emerald-600 dark:text-emerald-400 mb-1.5 ml-1 uppercase tracking-wider">
                      {currentLangCode === 'th' ? 'วันที่เงินออกโดยประมาณ (1-31)' : 'Approx. Salary Payday (1-31)'}
                    </label>
                    <select
                      value={salaryPayday}
                      onChange={e => setSalaryPayday(e.target.value)}
                      className="w-full h-12 px-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-base font-bold text-slate-700 dark:text-slate-350 focus:border-emerald-500 outline-none transition-all cursor-pointer"
                    >
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                        <option key={day} value={day}>{day}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex justify-center">
            <button
              onClick={handleStart}
              className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black shadow-lg shadow-indigo-500/20 active:scale-95 transition-all text-sm flex items-center gap-2 uppercase tracking-wide cursor-pointer"
            >
              <span>{currentLangCode === 'th' ? 'ยืนยันและเริ่มต้นใช้งานระบบ' : 'Confirm & Start Using'}</span>
              <ChevronRight className="w-4 h-4 text-white" />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
