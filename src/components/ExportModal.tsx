import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, Download, FileSpreadsheet, Layers, Info, Filter } from 'lucide-react';
import { JobEntry, ExpenseEntry } from '../types';
import { useSettings } from '../contexts/SettingsContext';
import { translations } from '../i18n/translations';
import { toast } from 'sonner';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobs: JobEntry[];
  expenses: ExpenseEntry[];
}

type RangeType = 'all' | 'month' | 'year';
type PaidFilterType = 'all' | 'paid_only';

export function ExportModal({ isOpen, onClose, jobs, expenses }: ExportModalProps) {
  const { currentLang } = useSettings();
  const t = translations[currentLang] as any;
  const [selectedRange, setSelectedRange] = useState<RangeType>('all');
  const [paidFilter, setPaidFilter] = useState<PaidFilterType>('all');

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
  const baseFilteredExpenses = useMemo(() => filterByRange(expenses), [expenses, selectedRange]);
  
  const filteredExpenses = useMemo(() => {
    if (paidFilter === 'paid_only') {
      return baseFilteredExpenses.filter(e => e.isPaid);
    }
    return baseFilteredExpenses;
  }, [baseFilteredExpenses, paidFilter]);

  const handleExportExcel = async () => {
    if (filteredJobs.length === 0 && filteredExpenses.length === 0) {
      toast.error(t.noDataToExport || 'ไม่มีข้อมูลที่จะส่งออกในเวลานี้');
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'App';
      workbook.created = new Date();

      // --- 1. Income Sheet ---
      const incomeSheet = workbook.addWorksheet(currentLang === 'th' ? 'รายรับ (Income)' : 'Income', { views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }] });
      incomeSheet.columns = [
        { header: 'Date (วันที่)', key: 'date', width: 15 },
        { header: 'Customer Pay (ยอดลูกค้าต้องจ่าย)', key: 'custPay', width: 25 },
        { header: 'Upfront Cost (สะสมสำรองจ่าย)', key: 'upfront', width: 25 },
        { header: 'App Net Income (รายได้สุทธิระบบ)', key: 'netIncome', width: 25 },
        { header: 'Actual Received (รับจ่ายจริง)', key: 'actual', width: 25 },
        { header: 'Transferred Status (สถานะโอนตัดยอด)', key: 'status', width: 25 },
      ];
      
      const headerRow1 = incomeSheet.getRow(1);
      headerRow1.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }; // Indigo 600
      
      filteredJobs.forEach(j => {
        incomeSheet.addRow({
          date: j.date.split('T')[0],
          custPay: j.customerMustPay,
          upfront: j.upfrontCost,
          netIncome: j.appNetIncome,
          actual: j.actualReceived ?? (j.customerMustPay + j.upfrontCost),
          status: j.transferred ? 'Transferred (โอนแล้ว)' : 'Pending (รอดำเนินการ)'
        });
      });

      // --- 2. Expenses Sheet ---
      const expenseSheet = workbook.addWorksheet(currentLang === 'th' ? 'รายจ่าย (Expenses)' : 'Expenses', { views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }] });
      expenseSheet.columns = [
        { header: 'Date (วันที่)', key: 'date', width: 15 },
        { header: 'Category (หมวดหมู่)', key: 'category', width: 25 },
        { header: 'Payee/Recipient (ผู้จ่าย/ผู้รับ)', key: 'payee', width: 25 },
        { header: 'Amount (จำนวนเงิน)', key: 'amount', width: 20 },
        { header: 'Cost Type (ประเภทรายจ่าย)', key: 'costType', width: 25 },
        { header: 'Necessity (ความจำเป็น)', key: 'necessity', width: 20 },
        { header: 'Paid Status (สถานะการจ่าย)', key: 'paidStatus', width: 20 },
        { header: 'Notes (หมายเหตุ)', key: 'note', width: 35 },
        { header: 'Balance After (ยอดคงเหลือหลังจากจ่าย)', key: 'balanceAfter', width: 25 },
      ];
      
      const headerRow2 = expenseSheet.getRow(1);
      headerRow2.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE11D48' } }; // Rose 600

      filteredExpenses.forEach(e => {
        expenseSheet.addRow({
          date: e.date,
          category: t[e.category] || e.category,
          payee: e.payee || '',
          amount: e.amount,
          costType: e.isFixed ? 'Fixed (รายจ่ายคงที่)' : 'Variable (รายจ่ายทั่วไป)',
          necessity: e.necessity === 'necessary' ? 'Necessary (จำเป็น)' : e.necessity === 'luxury' ? 'Luxury (ฟุ่มเฟือย)' : '',
          paidStatus: e.isPaid ? 'Paid (จ่ายแล้ว)' : 'Unpaid (ยังไม่จ่าย)',
          note: e.note || '',
          balanceAfter: e.balanceAfter !== undefined ? e.balanceAfter : ''
        });
      });

      // --- 3. Summary Sheet ---
      const summarySheet = workbook.addWorksheet(currentLang === 'th' ? 'สรุป (Summary)' : 'Summary', { views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }] });
      summarySheet.columns = [
        { header: 'Item (รายการ)', key: 'item', width: 35 },
        { header: 'Amount (จำนวนเงิน)', key: 'amount', width: 25 },
      ];
      
      const headerRow3 = summarySheet.getRow(1);
      headerRow3.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } }; // Emerald 500

      const totalActualIncome = filteredJobs.reduce((sum, j) => sum + (j.actualReceived ?? (j.customerMustPay + j.upfrontCost)), 0);
      const totalExpenseAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
      const netBalance = totalActualIncome - totalExpenseAmount;

      summarySheet.addRow({ item: 'Total Income (ยอดรับจริงทั้งหมด)', amount: totalActualIncome });
      summarySheet.addRow({ item: 'Total Expenses (รายจ่ายทั้งหมด)', amount: totalExpenseAmount });
      summarySheet.addRow({ item: 'Net Balance (คงเหลือสุทธิ)', amount: netBalance });

      summarySheet.getRow(2).font = { bold: true };
      summarySheet.getRow(3).font = { bold: true };
      summarySheet.getRow(4).font = { bold: true };

      // Generate & Download
      const buffer = await workbook.xlsx.writeBuffer();
      const formattedRangeName = selectedRange === 'all' 
        ? 'all_time' 
        : selectedRange === 'month' 
          ? `month_${new Date().getMonth() + 1}_${new Date().getFullYear()}` 
          : `year_${new Date().getFullYear()}`;
          
      saveAs(new Blob([buffer]), `financial_report_${formattedRangeName}.xlsx`);
      toast.success(t.exportSuccess || 'ส่งออกข้อมูลสำเร็จแล้ว!');
      
    } catch (err) {
      console.error("Export error", err);
      toast.error('Export failed');
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

              {/* Expense Filter Selector */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block ml-1 flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5" />
                  {currentLang === 'th' ? 'ตัวกรองรายจ่าย' : 'Expense Filter'}
                </label>
                <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100/80 dark:bg-slate-800/60 rounded-2xl">
                  <button
                    onClick={() => setPaidFilter('all')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                      paidFilter === 'all'
                        ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    {currentLang === 'th' ? 'ทั้งหมด (จ่ายแล้วและยังไม่จ่าย)' : 'All (Paid & Unpaid)'}
                  </button>
                  <button
                    onClick={() => setPaidFilter('paid_only')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                      paidFilter === 'paid_only'
                        ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    {currentLang === 'th' ? 'เฉพาะที่จ่ายแล้ว' : 'Paid Only'}
                  </button>
                </div>
              </div>

              {/* Informative banner */}
              <div className="flex gap-3 p-4 bg-indigo-50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/30">
                <Info className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <p className="text-xs text-indigo-800/90 dark:text-indigo-300 font-medium leading-relaxed">
                  {currentLang === 'th' 
                    ? 'รูปแบบไฟล์ Excel จะถูกแบ่งออกเป็น 3 Sheet อัตโนมัติ (รายรับ, รายจ่าย, สรุป) พร้อมตกแต่งสีสันให้สวยงามและอ่านง่าย'
                    : 'Excel file will be generated with 3 tabs (Income, Expenses, Summary) and formatted nicely.'}
                </p>
              </div>

              {/* Cards for Export Options */}
              <div className="space-y-4">
                {/* Export Excel card */}
                <div className="p-4 bg-white/40 dark:bg-slate-800/40 rounded-3xl border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 hover:border-slate-200/80 dark:hover:border-slate-700/80 transition-all">
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-white">
                      {currentLang === 'th' ? 'ส่งออกข้อมูลทั้งหมดเป็น Excel' : 'Export All to Excel'}
                    </h4>
                    <p className="text-xs text-slate-400 dark:text-slate-500 block leading-normal pr-4">
                      {currentLang === 'th' ? 'ประกอบด้วยรายรับ รายจ่าย และหน้าสรุปยอดรวมตารางในไฟล์เดียว' : 'Combined Income, Expenses, and Summary sheets in a single file'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-block text-[10px] font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
                        {filteredJobs.length} {currentLang === 'th' ? 'รายรับ' : 'incomes'}
                      </span>
                      <span className="inline-block text-[10px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-md">
                        {filteredExpenses.length} {currentLang === 'th' ? 'รายจ่าย' : 'expenses'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={handleExportExcel}
                    className="p-3.5 bg-emerald-50 hover:bg-emerald-100/80 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 rounded-2xl transition-all shadow-sm hover:shadow shrink-0 cursor-pointer"
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
