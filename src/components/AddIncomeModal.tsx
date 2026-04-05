import React, { useState, useEffect } from 'react';
import { X, Plus, DollarSign, Clock, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { JobEntry } from '../types';
import { translations } from '../i18n/translations';
import { useSettings } from '../contexts/SettingsContext';

interface AddIncomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (job: Omit<JobEntry, 'id'>) => void;
  onEdit?: (id: string, job: Omit<JobEntry, 'id'>) => void;
  selectedDate: string;
  editingJob?: JobEntry | null;
}

export function AddIncomeModal({ isOpen, onClose, onAdd, onEdit, selectedDate, editingJob }: AddIncomeModalProps) {
  const { currentLang } = useSettings();
  const t = translations[currentLang];

  const [appNetIncome, setAppNetIncome] = useState('');
  const [customerMustPay, setCustomerMustPay] = useState('');
  const [upfrontCost, setUpfrontCost] = useState('');
  const [actualReceived, setActualReceived] = useState('');
  const [jobTime, setJobTime] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (editingJob) {
        setAppNetIncome(editingJob.appNetIncome.toString());
        setCustomerMustPay(editingJob.customerMustPay.toString());
        setUpfrontCost(editingJob.upfrontCost.toString());
        setActualReceived(editingJob.actualReceived.toString());
        const date = new Date(editingJob.date);
        setJobTime(`${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`);
      } else {
        const now = new Date();
        setJobTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
        setAppNetIncome('');
        setCustomerMustPay('');
        setUpfrontCost('');
        setActualReceived('');
      }
    }
  }, [isOpen, editingJob]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const net = parseFloat(appNetIncome) || 0;
    const mustPay = parseFloat(customerMustPay) || 0;
    const upfront = parseFloat(upfrontCost) || 0;
    const received = actualReceived === '' ? (mustPay + upfront) : (parseFloat(actualReceived) || 0);

    const jobData = {
      date: `${selectedDate}T${jobTime}:00`,
      customerMustPay: mustPay || net,
      upfrontCost: upfront,
      appNetIncome: net,
      actualReceived: received,
      transferred: editingJob?.transferred || false
    };

    if (editingJob && onEdit) {
      onEdit(editingJob.id, jobData);
    } else {
      onAdd(jobData);
    }
    onClose();
  };

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
            className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20 dark:border-slate-800"
          >
            <div className="p-6 sm:p-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
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
                        className="w-full h-14 px-4 bg-indigo-50/50 dark:bg-indigo-900/20 border-2 border-indigo-100 dark:border-indigo-900/50 rounded-2xl text-xl font-bold text-indigo-700 dark:text-indigo-300 focus:border-indigo-500 outline-none transition-all" 
                        required 
                        autoFocus
                      />
                      <DollarSign className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-300" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 ml-1">{t.customerMustPay || 'ยอดที่ลูกค้าต้องจ่าย'}</label>
                    <input type="number" step="0.01" value={customerMustPay} onChange={e => setCustomerMustPay(e.target.value)} placeholder="0.00" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:border-indigo-500 outline-none transition-all text-sm" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 ml-1">{t.upfrontCost || 'ค่าบริการล่วงหน้า'}</label>
                    <input type="number" step="0.01" value={upfrontCost} onChange={e => setUpfrontCost(e.target.value)} placeholder="0.00" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:border-indigo-500 outline-none transition-all text-sm" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 ml-1">{t.actualReceived || 'ยอดที่ได้รับจริง'}</label>
                    <input type="number" step="0.01" value={actualReceived} onChange={e => setActualReceived(e.target.value)} placeholder="0.00" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:border-indigo-500 outline-none transition-all text-sm" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 ml-1">{t.time || 'เวลา'}</label>
                    <div className="relative">
                      <input type="time" value={jobTime} onChange={e => setJobTime(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:border-indigo-500 outline-none transition-all text-sm appearance-none" required />
                      <Clock className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-4 px-6 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                  >
                    {t.cancel || 'ยกเลิก'}
                  </button>
                  <button
                    type="submit"
                    className="flex-[2] py-4 px-6 rounded-2xl bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-500/30 hover:bg-indigo-500 transition-all"
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
