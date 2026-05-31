import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, Download, FileSpreadsheet, Layers, Info } from 'lucide-react';
import { JobEntry, ExpenseEntry } from '../types';
import { useSettings } from '../contexts/SettingsContext';
import { translations } from '../i18n/translations';
import { toast } from 'sonner';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobs: JobEntry[];
  expenses: ExpenseEntry[];
}

type RangeType = 'all' | 'month' | 'year';

export function ExportModal({ isOpen, onClose, jobs, expenses }: ExportModalProps) {
  const { currentLang } = useSettings();
  const t = translations[currentLang] as any;
  const [selectedRange, setSelectedRange] = useState<RangeType>('all');

  const filterByRange = <T extends { date: string }>(items: T[]): T[] => {
    const now = new Date();
    const currentY = now.getFullYear();
    const currentM = now.getMonth();

    return items.filter(item => {
      if (!item.date) return false;
      const dateStr = item.date.split('T')[0];
      const parts = dateStr.split('-');
      if (parts.length < 3) return false;
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;

      if (selectedRange === 'month') {
        return year === currentY && month === currentM;
      }
      if (selectedRange === 'year') {
        return year === currentY;
      }
      return true;
    });
  };

  const filteredJobs = useMemo(() => filterByRange(jobs), [jobs, selectedRange]);
  const filteredExpenses = useMemo(() => filterByRange(expenses), [expenses, selectedRange]);

  const handleExportIncome = () => {
    if (filteredJobs.length === 0) {
      toast.error(t.noDataToExport || 'ไม่มีข้อมูลที่จะส่งออกในเวลานี้');
      return;
    }

    const headers = [
      'Date (วันที่)',
      'Customer Pay (ยอดลูกค้าต้องจ่าย)',
      'Upfront Cost (สะสมสำรองจ่าย)',
      'App Net Income (รายได้สุทธิระบบ)',
      'Actual Received (รับจ่ายจริง)',
      'Transferred Status (สถานะโอนตัดยอด)'
    ];

    const rows = filteredJobs.map(j => [
      j.date,
      j.customerMustPay,
      j.upfrontCost,
      j.appNetIncome,
      j.actualReceived,
      j.transferred ? 'Transferred (โอนแล้ว)' : 'Pending (รอดำเนินการ)'
    ]);

    const formattedRangeName = selectedRange === 'all' 
      ? 'all_time' 
      : selectedRange === 'month' 
        ? `month_${new Date().getMonth() + 1}_${new Date().getFullYear()}` 
        : `year_${new Date().getFullYear()}`;

    downloadCSV(headers, rows, `income_report_${formattedRangeName}.csv`);
    toast.success(t.exportSuccess || 'ส่งออกข้อมูลสำเร็จแล้ว!');
  };

  const handleExportExpenses = () => {
    if (filteredExpenses.length === 0) {
      toast.error(t.noDataToExport || 'ไม่มีข้อมูลที่จะส่งออกในเวลานี้');
      return;
    }

    const headers = [
      'Date (วันที่)',
      'Category (หมวดหมู่)',
      'Payee/Recipient (ผู้จ่าย/ผู้รับ)',
      'Amount (จำนวนเงิน)',
      'Cost Type (ประเภทรายจ่าย)',
      'Necessity (ความจำเป็น)',
      'Paid Status (สถานะการจ่าย)',
      'Notes (หมายเหตุ/บันทึก)',
      'Balance After (ยอดคงเหลือหลังจากจ่าย)'
    ];

    const rows = filteredExpenses.map(e => [
      e.date,
      e.category,
      e.payee || '',
      e.amount,
      e.isFixed ? 'Fixed (รายจ่ายคงที่)' : 'Variable (รายจ่ายทั่วไป)',
      e.necessity === 'necessary' ? 'Necessary (จำเป็น)' : e.necessity === 'luxury' ? 'Luxury (ฟุ่มเฟือย)' : '',
      e.isPaid ? 'Paid (จ่ายแล้ว)' : 'Unpaid (ยังไม่จ่าย)',
      e.note || '',
      e.balanceAfter !== undefined ? e.balanceAfter : ''
    ]);

    const formattedRangeName = selectedRange === 'all' 
      ? 'all_time' 
      : selectedRange === 'month' 
        ? `month_${new Date().getMonth() + 1}_${new Date().getFullYear()}` 
        : `year_${new Date().getFullYear()}`;

    downloadCSV(headers, rows, `expenses_report_${formattedRangeName}.csv`);
    toast.success(t.exportSuccess || 'ส่งออกข้อมูลสำเร็จแล้ว!');
  };

  const downloadCSV = (headers: string[], rows: any[][], fileName: string) => {
    const BOM = "\uFEFF";
    const csvContent = BOM + [
      headers.map(h => `"${h.toString().replace(/"/g, '""')}"`).join(","),
      ...rows.map(row => row.map(val => {
        if (val === undefined || val === null) return '""';
        const str = String(val);
        return `"${str.replace(/"/g, '""')}"`;
      }).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="glass-panel w-full max-w-lg flex flex-col rounded-3xl overflow-hidden shadow-2xl bg-white/90 dark:bg-slate-900/95"
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white/50 dark:bg-slate-800/10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl">
                  <FileSpreadsheet className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 dark:text-white leading-snug">
                    {t.exportData || 'ส่งออกข้อมูล'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {t.exportDataDesc || 'ส่งออกข้อมูลรายได้และรายจ่ายเป็นไฟล์ CSV'}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Range Selector */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block ml-1">
                  {t.filterRange || 'กรองช่วงเวลา'}
                </label>
                <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-100/80 dark:bg-slate-800/60 rounded-2xl">
                  <button
                    onClick={() => setSelectedRange('all')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                      selectedRange === 'all'
                        ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    {t.allTimeOption || 'ทั้งหมด'}
                  </button>
                  <button
                    onClick={() => setSelectedRange('month')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                      selectedRange === 'month'
                        ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    {t.currentMonthOption || 'เฉพาะเดือนนี้'}
                  </button>
                  <button
                    onClick={() => setSelectedRange('year')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                      selectedRange === 'year'
                        ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    {t.currentYearOption || 'เฉพาะปีนี้'}
                  </button>
                </div>
              </div>

              {/* Informative banner */}
              <div className="flex gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100/50 dark:border-emerald-900/30">
                <Info className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-800/90 dark:text-emerald-300 font-medium leading-relaxed">
                  {currentLang === 'th' 
                    ? 'สลักรหัสอักษร UTF-8 BOM อัตโนมัติ ป้องกันปัญหาสระภาษาไทยเพี้ยนหรือเป็นต่างดาวเมื่อเปิดด้วยโปรแกรม Microsoft Excel'
                    : 'Features auto-injected UTF-8 BOM encoding so Microsoft Excel displays non-English characters cleanly.'}
                </p>
              </div>

              {/* Cards for Export Options */}
              <div className="space-y-4">
                {/* Income card */}
                <div className="p-4 bg-white/40 dark:bg-slate-800/40 rounded-3xl border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 hover:border-slate-200/80 dark:hover:border-slate-700/80 transition-all">
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-white">
                      {t.exportIncome || 'ส่งออกรายรับ (CSV)'}
                    </h4>
                    <p className="text-xs text-slate-400 dark:text-slate-500 block leading-normal pr-4">
                      {t.exportIncomeDesc || 'ประกอบไปด้วยรายละเอียดส่วนงาน สลิป และรายได้สุทธิประจำเครื่อง'}
                    </p>
                    <span className="inline-block text-[10px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md mt-1">
                      {filteredJobs.length} {currentLang === 'th' ? 'รายการในช่วงเวลานี้' : 'entries in range'}
                    </span>
                  </div>
                  <button
                    onClick={handleExportIncome}
                    className="p-3.5 bg-indigo-50 hover:bg-indigo-100/80 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 rounded-2xl transition-all shadow-sm hover:shadow shrink-0 cursor-pointer"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                </div>

                {/* Expenses card */}
                <div className="p-4 bg-white/40 dark:bg-slate-800/40 rounded-3xl border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 hover:border-slate-200/80 dark:hover:border-slate-700/80 transition-all">
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-white">
                      {t.exportExpenses || 'ส่งออกรายจ่าย (CSV)'}
                    </h4>
                    <p className="text-xs text-slate-400 dark:text-slate-400 block leading-normal pr-4">
                      {t.exportExpensesDesc || 'ประกอบไปด้วยรายละเอียดรายการจ่ายคงที่และแปรผันทั้งหมด'}
                    </p>
                    <span className="inline-block text-[10px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-md mt-1">
                      {filteredExpenses.length} {currentLang === 'th' ? 'รายการในช่วงเวลานี้' : 'entries in range'}
                    </span>
                  </div>
                  <button
                    onClick={handleExportExpenses}
                    className="p-3.5 bg-rose-50 hover:bg-rose-100/80 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 rounded-2xl transition-all shadow-sm hover:shadow shrink-0 cursor-pointer"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={onClose}
                className="py-2.5 px-6 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
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
