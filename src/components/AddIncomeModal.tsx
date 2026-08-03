import React, { useState, useEffect } from 'react';
import { X, Plus, DollarSign, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { JobEntry } from '../types';
import { translations } from '../i18n/translations';
import { useSettings } from '../contexts/SettingsContext';
import { toast } from 'sonner';

interface AddIncomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (job: Omit<JobEntry, 'id'>) => void;
  onEdit?: (id: string, job: Omit<JobEntry, 'id'>) => void;
  selectedDate: string;
  editingJob?: JobEntry | null;
  workType?: 'rider' | 'freelance' | 'salary';
}

export function AddIncomeModal({ isOpen, onClose, onAdd, onEdit, selectedDate, editingJob, workType = 'rider' }: AddIncomeModalProps) {
  const { currentLang } = useSettings();
  const t = translations[currentLang];

  const [appNetIncome, setAppNetIncome] = useState('');
  const [customerMustPay, setCustomerMustPay] = useState('');
  const [upfrontCost, setUpfrontCost] = useState('');
  const [actualReceived, setActualReceived] = useState('');
  const [jobTime, setJobTime] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [isMultiDay, setIsMultiDay] = useState(false);
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      if (editingJob) {
        setAppNetIncome((editingJob.appNetIncome ?? 0).toString());
        setCustomerMustPay((editingJob.customerMustPay ?? 0).toString());
        setUpfrontCost((editingJob.upfrontCost ?? 0).toString());
        setActualReceived((editingJob.actualReceived ?? 0).toString());
        setJobTitle(editingJob.jobTitle || '');
        setIsMultiDay(editingJob.isMultiDay || false);
        setEndDate(editingJob.endDate || '');
        const date = new Date(editingJob.date);
        setJobTime(`${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`);
      } else {
        const now = new Date();
        setJobTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
        setAppNetIncome('');
        setCustomerMustPay('');
        setUpfrontCost('');
        setActualReceived('');
        setJobTitle('');
        setIsMultiDay(false);
        setEndDate('');
      }
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, editingJob]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const net = parseFloat(appNetIncome) || 0;
    const mustPay = parseFloat(customerMustPay) || 0;
    const upfront = parseFloat(upfrontCost) || 0;
    const received = parseFloat(actualReceived) || 0;

    let finalMustPay = mustPay;
    let finalUpfront = upfront;
    let finalNet = net;
    let finalReceived = received;
    let finalTitle = jobTitle.trim();

    if (workType === 'freelance') {
      finalTitle = finalTitle || 'งานรับจ้างอิสระ';
      finalMustPay = net;
      finalUpfront = upfront;
      finalNet = net;
      finalReceived = actualReceived === '' ? (net + upfront) : received;
    } else if (workType === 'salary') {
      finalTitle = finalTitle || 'รายรับเงินเดือน/งานนอก';
      finalMustPay = net;
      finalUpfront = 0;
      finalNet = net;
      finalReceived = actualReceived === '' ? net : received;
    } else {
      finalTitle = finalTitle || 'งานส่งของเดลิเวอรี';
      finalMustPay = mustPay || net;
      finalUpfront = upfront;
      finalNet = net;
      finalReceived = actualReceived === '' ? (finalMustPay + upfront) : received;
    }

    const jobData = {
      date: `${selectedDate}T${jobTime}:00`,
      customerMustPay: finalMustPay,
      upfrontCost: finalUpfront,
      appNetIncome: finalNet,
      actualReceived: finalReceived,
      transferred: editingJob?.transferred || false,
      jobTitle: finalTitle,
      workType,
      isMultiDay: workType === 'freelance' ? isMultiDay : false,
      endDate: (workType === 'freelance' && isMultiDay) ? (endDate || selectedDate) : undefined,
    };

    if (editingJob && onEdit) {
      onEdit(editingJob.id, jobData);
    } else {
      onAdd(jobData);
    }
    onClose();
  };

  const currentLangCode = currentLang || 'th';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-y-auto max-h-[90vh] border border-white/20 dark:border-slate-800"
          >
            <div className="p-6 sm:p-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 animate-pulse">
                    {editingJob ? <Clock className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
                  </div>
                  {editingJob ? (t.edit || 'แก้ไข') : (t.addJobEntry || 'เพิ่มรายรับ')}
                </h2>
                <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* FREELANCE FORM FIELDS */}
                  {workType === 'freelance' && (
                    <>
                      <div className="col-span-2">
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 ml-1 uppercase tracking-wider">
                          {currentLangCode === 'th' ? 'ชื่องาน / ลูกค้า *' : 'Job Name / Client *'}
                        </label>
                        <input 
                          type="text" 
                          value={jobTitle} 
                          onChange={e => setJobTitle(e.target.value)} 
                          placeholder={currentLangCode === 'th' ? 'เช่น ออกแบบกราฟิก, เขียนแอปพลิเคชัน' : 'e.g. Logos design, Web coding'} 
                          className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-800/70 border-2 border-slate-200/50 dark:border-slate-800 rounded-2xl focus:border-indigo-500 outline-none transition-all text-sm font-bold text-slate-800 dark:text-slate-200" 
                          required 
                          autoFocus
                        />
                        <div className="flex gap-1.5 mt-2.5 flex-wrap">
                          {(currentLangCode === 'th' ? ['รับจ้างทั่วไป', 'งานดีไซน์', 'โปรติจน์งาน', 'แปลเอกสาร'] : ['Consulting', 'Design', 'Coding', 'Writing']).map(tag => (
                            <button 
                              type="button" 
                              key={tag} 
                              onClick={() => setJobTitle(tag)} 
                              className="text-[10px] font-black px-2.5 py-1 bg-slate-50 hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-500 border border-slate-200/30 dark:border-slate-800 rounded-lg transition-all"
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="col-span-2">
                        <label className="block text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1.5 ml-1 uppercase tracking-wider">
                          {currentLangCode === 'th' ? 'ค่าจ้างสุทธิที่พึงได้รับ (รายรับ) *' : 'Wage / Income Amount *'}
                        </label>
                        <div className="relative">
                          <input 
                            type="number" 
                            step="0.01" 
                            value={appNetIncome} 
                            onChange={e => setAppNetIncome(e.target.value)} 
                            placeholder="0.00" 
                            className="w-full h-14 px-4 bg-indigo-50/50 dark:bg-indigo-900/10 border-2 border-indigo-100 dark:border-indigo-900/50 rounded-2xl text-xl font-extrabold text-indigo-700 dark:text-indigo-300 focus:border-indigo-500 outline-none transition-all" 
                            required 
                          />
                          <DollarSign className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-300" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 ml-1">{currentLangCode === 'th' ? 'ต้นทุนสำรองจ่ายในงาน' : 'Prepaid Expenses'}</label>
                        <input type="number" step="0.01" value={upfrontCost} onChange={e => setUpfrontCost(e.target.value)} placeholder="0.00" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:border-indigo-500 outline-none transition-all text-sm font-semibold" />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 ml-1">{currentLangCode === 'th' ? 'ยอดที่รับเงินจริง' : 'Actual Received'}</label>
                        <input 
                          type="number" 
                          step="0.01" 
                          value={actualReceived} 
                          onChange={e => setActualReceived(e.target.value)} 
                          placeholder={appNetIncome ? (parseFloat(appNetIncome) + (parseFloat(upfrontCost) || 0)).toString() : '0.00'} 
                          className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:border-indigo-500 outline-none transition-all text-sm font-semibold" 
                        />
                      </div>

                      {/* Multi-day Project Toggle */}
                      <div className="col-span-2 p-4 bg-indigo-50/40 dark:bg-slate-800/40 rounded-3xl border border-indigo-100/30 dark:border-slate-800 space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isMultiDay}
                            onChange={(e) => {
                              setIsMultiDay(e.target.checked);
                              if (e.target.checked && !endDate) {
                                setEndDate(selectedDate);
                              }
                            }}
                            className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 transition-colors"
                          />
                          <div className="flex flex-col">
                            <span className="text-sm font-black text-slate-700 dark:text-slate-200">
                              {currentLangCode === 'th' ? '📅 งานระยะยาว (ทำหลายวัน)' : '📅 Multi-day Project'}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {currentLangCode === 'th' ? 'เลือกหากตารางงานต่อเนื่องกันหลายวัน โดยจะไม่ถูกคิดเป็นวันหยุดงานระหว่างกลาง' : 'Check if project spans multiple days, so intermediate days are not marked as off floors.'}
                            </span>
                          </div>
                        </label>
                        
                        {isMultiDay && (
                          <div className="pt-2 space-y-2">
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 ml-1">
                              {currentLangCode === 'th' ? 'วันที่สิ้นสุดโครงการ *' : 'End Date *'}
                            </label>
                            <input
                              type="date"
                              value={endDate}
                              min={selectedDate}
                              onChange={(e) => setEndDate(e.target.value)}
                              className="w-full h-11 px-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl focus:border-indigo-500 outline-none transition-all text-sm font-semibold text-slate-700 dark:text-slate-300"
                              required={isMultiDay}
                            />
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* SALARY FORM FIELDS */}
                  {workType === 'salary' && (
                    <>
                      <div className="col-span-2">
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 ml-1 uppercase tracking-wider">
                          {currentLangCode === 'th' ? 'รายการรายรับ / งานเสริม *' : 'Income / Gig Title *'}
                        </label>
                        <input 
                          type="text" 
                          value={jobTitle} 
                          onChange={e => setJobTitle(e.target.value)} 
                          placeholder={currentLangCode === 'th' ? 'เช่น เงินเดือนประจำ, ค่าทำงานล่วงเวลา (OT)' : 'e.g. Monthly Salary, Overtime Work'} 
                          className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-800/70 border-2 border-slate-200/50 dark:border-slate-800 rounded-2xl focus:border-indigo-500 outline-none transition-all text-sm font-bold text-slate-800 dark:text-slate-200" 
                          required 
                          autoFocus
                        />
                        <div className="flex gap-1.5 mt-2.5 flex-wrap">
                          {(currentLangCode === 'th' ? ['เงินเดือนประจำ', 'ค่าทำโอที (OT)', 'ค่านายหน้า', 'งานเสริม'] : ['Monthly Salary', 'Overtime (OT)', 'Bonus', 'Side Hustle']).map(tag => (
                            <button 
                              type="button" 
                              key={tag} 
                              onClick={() => setJobTitle(tag)} 
                              className="text-[10px] font-black px-2.5 py-1 bg-slate-50 hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-500 border border-slate-200/30 dark:border-slate-800 rounded-lg transition-all"
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="col-span-2">
                        <label className="block text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1.5 ml-1 uppercase tracking-wider">
                          {currentLangCode === 'th' ? 'จำนวนเงินที่ได้รับ *' : 'Earnings *'}
                        </label>
                        <div className="relative">
                          <input 
                            type="number" 
                            step="0.01" 
                            value={appNetIncome} 
                            onChange={e => setAppNetIncome(e.target.value)} 
                            placeholder="0.00" 
                            className="w-full h-14 px-4 bg-emerald-50/50 dark:bg-emerald-950/10 border-2 border-emerald-100 dark:border-emerald-950/50 rounded-2xl text-xl font-extrabold text-emerald-700 dark:text-emerald-300 focus:border-indigo-500 outline-none transition-all" 
                            required 
                          />
                          <DollarSign className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-300" />
                        </div>
                      </div>

                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 ml-1">{currentLangCode === 'th' ? 'จำนวนสุทธิได้รับจริง (ทางบัญชี)' : 'Actual Received Account'}</label>
                        <input 
                          type="number" 
                          step="0.01" 
                          value={actualReceived} 
                          onChange={e => setActualReceived(e.target.value)} 
                          placeholder={appNetIncome || '0.00'} 
                          className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:border-indigo-500 outline-none transition-all text-sm font-semibold" 
                        />
                      </div>
                    </>
                  )}

                  {/* STANDARD RIDER FORM FIELDS */}
                  {workType === 'rider' && (
                    <>
                      <div className="col-span-2">
                        <label className="block text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1.5 ml-1 uppercase tracking-wider">
                          {t.appNetIncome || 'รายได้สุทธิ (แอป)'} *
                        </label>
                        <div className="relative">
                          <input 
                            type="number" 
                            step="0.01" 
                            value={appNetIncome} 
                            onChange={e => setAppNetIncome(e.target.value)} 
                            placeholder="0.00" 
                            className="w-full h-14 px-4 bg-indigo-50/50 dark:bg-indigo-900/10 border-2 border-indigo-100 dark:border-indigo-900/50 rounded-2xl text-xl font-extrabold text-indigo-700 dark:text-indigo-300 focus:border-indigo-500 outline-none transition-all" 
                            required 
                            autoFocus
                          />
                          <DollarSign className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-300" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 ml-1">{t.customerMustPay || 'ยอดที่ลูกค้าต้องจ่าย'}</label>
                        <input type="number" step="0.01" value={customerMustPay} onChange={e => setCustomerMustPay(e.target.value)} placeholder="0.00" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:border-indigo-500 outline-none transition-all text-sm" />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 ml-1">{t.upfrontCost || 'ค่าบริการล่วงหน้า'}</label>
                        <input type="number" step="0.01" value={upfrontCost} onChange={e => setUpfrontCost(e.target.value)} placeholder="0.00" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:border-indigo-500 outline-none transition-all text-sm" />
                      </div>

                      <div className="col-span-2 sm:col-span-1">
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 ml-1">{t.actualReceived || 'ยอดที่ได้รับจริง'}</label>
                        <input type="number" step="0.01" value={actualReceived} onChange={e => setActualReceived(e.target.value)} placeholder="0.00" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:border-indigo-500 outline-none transition-all text-sm" />
                      </div>

                    </>
                  )}

                  {/* COMMON TIME PICKER */}
                  <div className={workType === 'rider' ? 'col-span-2 sm:col-span-1' : 'col-span-2'}>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 ml-1 uppercase tracking-wider">{t.time || 'เวลา'}</label>
                    <div className="relative">
                      <input type="time" value={jobTime} onChange={e => setJobTime(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:border-indigo-500 outline-none transition-all text-sm appearance-none font-semibold text-slate-700 dark:text-slate-300" required />
                      <Clock className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-4 px-6 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer text-xs"
                  >
                    {t.cancel || 'ยกเลิก'}
                  </button>
                  <button
                    type="submit"
                    className="flex-[2] py-4 px-6 rounded-2xl bg-indigo-600 text-white font-extrabold shadow-lg shadow-indigo-500/30 hover:bg-indigo-500 transition-all cursor-pointer text-xs"
                  >
                    {t.save || 'บันทึก'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
