import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, History, Plus, Trash2, Edit2, RefreshCw, ArrowRightLeft, Clock } from 'lucide-react';
import { ActivityLog } from '../types';
import { useSettings } from '../contexts/SettingsContext';
import { translations } from '../i18n/translations';

interface ActivityLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: ActivityLog[];
}

export function ActivityLogModal({ isOpen, onClose, logs }: ActivityLogModalProps) {
  const { currentLang } = useSettings();
  const t = translations[currentLang];

  const getIcon = (type: ActivityLog['type']) => {
    switch (type) {
      case 'add_job':
      case 'add_expense':
        return <Plus className="w-4 h-4 text-emerald-500" />;
      case 'edit_job':
      case 'edit_expense':
        return <Edit2 className="w-4 h-4 text-indigo-500" />;
      case 'delete_job':
      case 'delete_expense':
        return <Trash2 className="w-4 h-4 text-rose-500" />;
      case 'reset_data':
        return <RefreshCw className="w-4 h-4 text-amber-500" />;
      case 'transfer_income':
        return <ArrowRightLeft className="w-4 h-4 text-blue-500" />;
      default:
        return <History className="w-4 h-4 text-slate-400" />;
    }
  };

  const getLabel = (type: ActivityLog['type']) => {
    switch (type) {
      case 'add_job': return 'เพิ่มงาน';
      case 'edit_job': return 'แก้ไขงาน';
      case 'delete_job': return 'ลบงาน';
      case 'add_expense': return 'เพิ่มรายจ่าย';
      case 'edit_expense': return 'แก้ไขรายจ่าย';
      case 'delete_expense': return 'ลบรายจ่าย';
      case 'reset_data': return 'ล้างข้อมูล';
      case 'transfer_income': return 'โอนรายได้';
      default: return type;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="glass-panel w-full max-w-lg max-h-[80vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl"
          >
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
                  <History className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-white">บันทึกกิจกรรม</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">ประวัติการเพิ่ม ลบ และแก้ไขข้อมูล</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Clock className="w-12 h-12 mb-3 opacity-20" />
                  <p>ยังไม่มีบันทึกกิจกรรม</p>
                </div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex gap-4 p-4 bg-white/40 dark:bg-slate-800/40 rounded-2xl border border-white/40 dark:border-slate-700/40 hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <div className="flex-shrink-0 mt-1">
                      <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg">
                        {getIcon(log.type)}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          {getLabel(log.type)}
                        </span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(log.timestamp).toLocaleString('th-TH', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-200 font-medium">
                        {log.details}
                      </p>
                      {log.amount !== undefined && (
                        <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                          ฿{log.amount.toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <button
                onClick={onClose}
                className="w-full py-3 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
              >
                {t.close || 'ปิด'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
