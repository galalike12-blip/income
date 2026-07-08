/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Dashboard } from './components/Dashboard';
import { Expenses } from './components/Expenses';
import { Summary } from './components/Summary';
import { Chatbot } from './components/Chatbot';
import { FloatingNav } from './components/FloatingNav';
import { AddIncomeModal } from './components/AddIncomeModal';
import { AddExpenseModal } from './components/AddExpenseModal';
import { Header } from './components/Header';
import { OnboardingModal } from './components/OnboardingModal';
import { GoalModal } from './components/GoalModal';
import { LeaveModal } from './components/LeaveModal';
import { ActivityLogModal } from './components/ActivityLogModal';
import { ExportModal } from './components/ExportModal';
import { IosInstallPrompt } from './components/IosInstallPrompt';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useUserData } from './hooks/useUserData';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { GoogleSheetsService } from './services/googleSheets';
import { translations } from './i18n/translations';
import { JobEntry, ExpenseEntry } from './types';
import { Toaster } from 'sonner';

function MainContent() {
  const { currentLang } = useSettings();
  const { user, googleAccessToken, spreadsheetId } = useAuth();
  const t = translations[currentLang];
  
  const { rawJobs, incentives, rawIncentives, expenses, goals, preferences, loading, updatePreferences, addJob: firestoreAddJob, editJob: firestoreEditJob, deleteJob: firestoreDeleteJob, setIncentive, addExpense, updateExpense, deleteExpense, setGoal, clearAllData, transferIncomeToExpenses, untransferredIncentivesAmount, logs } = useUserData(user);
  
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  });
  const [activeTab, setActiveTab] = useState<'dashboard' | 'expenses' | 'summary'>('dashboard');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [showLayoutSettings, setShowLayoutSettings] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetInput, setResetInput] = useState('');
  const chatbotRef = useRef<any>(null);

  const handleResetData = async () => {
    if (resetInput === 'RESET') {
      await clearAllData();
      setShowResetConfirm(false);
      setResetInput('');
    }
  };
  const [editingJob, setEditingJob] = useState<JobEntry | null>(null);
  const [editingExpense, setEditingExpense] = useState<ExpenseEntry | null>(null);
  const [sharedFile, setSharedFile] = useState<File | null>(null);

  useEffect(() => {
    // Hide the CSS splash screen once React has mounted
    const loader = document.getElementById('app-loader');
    if (loader) {
      loader.style.opacity = '0';
      setTimeout(() => loader.remove(), 500); // Wait for transition
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'SHARE_TARGET_FILE') {
        const file = event.data.file;
        if (file) {
          console.log('Received shared file from SW:', file);
          setSharedFile(file);
          setIsExpenseModalOpen(false);
          setIsChatOpen(true);
        }
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleMessage);
      
      const requestSharedFile = () => {
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'GET_SHARED_FILE' });
        }
        navigator.serviceWorker.ready.then((registration) => {
          if (registration.active) {
            registration.active.postMessage({ type: 'GET_SHARED_FILE' });
          }
        });
      };

      // Request immediately
      requestSharedFile();
      
      // Request again with minor delays to handle slow Safari service worker boots
      const timer1 = setTimeout(requestSharedFile, 500);
      const timer2 = setTimeout(requestSharedFile, 1500);
      const timer3 = setTimeout(requestSharedFile, 3000);

      return () => {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    }
  }, []);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleEditJob = (job: JobEntry) => {
    setEditingJob(job);
    setIsIncomeModalOpen(true);
  };

  const handleEditExpense = (expense: ExpenseEntry) => {
    setEditingExpense(expense);
    setIsExpenseModalOpen(true);
  };

  // Migrate old data format to new format
  const jobs: JobEntry[] = rawJobs.map(j => {
    // If it's the newest format (no customerActuallyPays, no fullFare)
    if (j.customerMustPay !== undefined && j.customerActuallyPays === undefined && j.fullFare === undefined) {
      return j as JobEntry;
    }
    
    // Migrate from the 5-field version (customerMustPay, customerActuallyPays, upfrontCost, appNetIncome, actualReceived)
    if (j.customerActuallyPays !== undefined) {
      return {
        id: j.id,
        date: j.date,
        customerMustPay: j.customerActuallyPays, // The amount after discount is what they really had to pay
        upfrontCost: j.upfrontCost || 0,
        appNetIncome: j.appNetIncome || 0,
        actualReceived: j.actualReceived || 0,
        transferred: j.transferred
      };
    }
    
    // Migrate from previous version (fullFare, appNetIncome, customerMustPay, upfrontCost, actualReceived)
    if (j.fullFare !== undefined) {
      return {
        id: j.id,
        date: j.date,
        customerMustPay: j.customerMustPay || j.fullFare,
        upfrontCost: j.upfrontCost || 0,
        appNetIncome: j.appNetIncome || 0,
        actualReceived: j.actualReceived || 0,
        transferred: j.transferred
      };
    }
    
    // If migrating from the very first version (baseIncome, tip, deduction)
    if (j.baseIncome !== undefined) {
      return {
        id: j.id,
        date: j.date,
        customerMustPay: j.baseIncome,
        upfrontCost: 0,
        appNetIncome: j.baseIncome - (j.deduction || 0),
        actualReceived: j.baseIncome + (j.tip || 0),
        transferred: j.transferred
      };
    }
    
    // If migrating from the second version (billedAmount, receivedAmount, upfrontCost, deduction)
    return {
      id: j.id,
      date: j.date,
      customerMustPay: j.billedAmount || 0,
      upfrontCost: j.upfrontCost || 0,
      appNetIncome: (j.billedAmount || 0) - (j.deduction || 0),
      actualReceived: j.receivedAmount || 0,
      transferred: j.transferred
    };
  });

  const addJob = async (job: Omit<JobEntry, 'id'>) => {
    const newId = await firestoreAddJob(job);
    const newJob: JobEntry = {
      ...job,
      id: newId,
    };

    // Sync to Google Sheets if connected
    if (user && googleAccessToken && spreadsheetId) {
      try {
        const sheetsService = new GoogleSheetsService(googleAccessToken);
        const amountToCollect = (newJob.customerMustPay ?? 0) + (newJob.upfrontCost ?? 0);
        const diff = (newJob.actualReceived ?? amountToCollect) - amountToCollect;
        const tip = diff > 0 ? diff : 0;
        const loss = diff < 0 ? Math.abs(diff) : 0;
        const totalNet = (newJob.appNetIncome ?? 0) + diff;
        
        await sheetsService.appendRow(spreadsheetId, 'Jobs', [
          newJob.id,
          newJob.date,
          (newJob.customerMustPay ?? 0).toString(),
          (newJob.upfrontCost ?? 0).toString(),
          (newJob.appNetIncome ?? 0).toString(),
          (newJob.actualReceived ?? 0).toString(),
          (tip ?? 0).toString(),
          (loss ?? 0).toString(),
          (totalNet ?? 0).toString()
        ]);
      } catch (error) {
        console.error("Failed to sync to Google Sheets:", error);
      }
    }
  };

  const editJob = (id: string, updatedJob: Omit<JobEntry, 'id'>) => {
    firestoreEditJob(id, updatedJob);
  };

  const deleteJob = (id: string) => {
    firestoreDeleteJob(id);
  };

  useEffect(() => {
    const handleSyncAll = async () => {
      if (!user || !googleAccessToken || !spreadsheetId) return;
      try {
        const sheetsService = new GoogleSheetsService(googleAccessToken);
        const headers = ['ID', 'Date', 'Customer Must Pay', 'Upfront Cost', 'App Net Income', 'Actual Received', 'Tip', 'Loss', 'Total Net Income'];
        
        const allValues = jobs.map(j => {
          const amountToCollect = (j.customerMustPay ?? 0) + (j.upfrontCost ?? 0);
          const diff = (j.actualReceived ?? amountToCollect) - amountToCollect;
          const tip = diff > 0 ? diff : 0;
          const loss = diff < 0 ? Math.abs(diff) : 0;
          const totalNet = (j.appNetIncome ?? 0) + diff;
          return [
            j.id,
            j.date,
            (j.customerMustPay ?? 0).toString(),
            (j.upfrontCost ?? 0).toString(),
            (j.appNetIncome ?? 0).toString(),
            (j.actualReceived ?? 0).toString(),
            (tip ?? 0).toString(),
            (loss ?? 0).toString(),
            (totalNet ?? 0).toString()
          ];
        });

        await sheetsService.clearAndAppendAll(spreadsheetId, 'Jobs', headers, allValues);
      } catch (error) {
        console.error("Failed to sync all to Google Sheets:", error);
      }
    };

    window.addEventListener('sync-all-sheets', handleSyncAll);
    return () => {
      window.removeEventListener('sync-all-sheets', handleSyncAll);
    };
  }, [jobs, user, googleAccessToken, spreadsheetId]);

  return (
    <div 
      className="h-[100dvh] flex flex-col font-sans text-slate-900 dark:text-slate-100 transition-colors duration-200 relative overflow-hidden"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* Fixed Background */}
      <div className="liquid-bg fixed inset-0 pointer-events-none">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>

      {/* Header (Top) */}
      <Header 
        onInstall={deferredPrompt ? handleInstallApp : undefined} 
        setShowResetConfirm={setShowResetConfirm} 
        setShowActivityLog={setIsActivityLogOpen}
        setShowGoalModal={setIsGoalModalOpen}
        setShowExportModal={setIsExportOpen}
        setShowLeaveModal={setIsLeaveModalOpen}
        preferences={preferences}
        updatePreferences={updatePreferences}
      />
      
      {/* Main Content Area (Scrollable) */}
      <main className="flex-1 overflow-y-auto relative custom-scrollbar pb-32">
        {showResetConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-xl">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">ล้างข้อมูลทั้งหมด?</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-4">การดำเนินการนี้ไม่สามารถย้อนกลับได้ พิมพ์ "RESET" เพื่อยืนยัน</p>
              <input 
                type="text" 
                value={resetInput} 
                onChange={(e) => setResetInput(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg mb-4 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                placeholder="RESET"
              />
              <div className="flex gap-2">
                <button onClick={() => setShowResetConfirm(false)} className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg">ยกเลิก</button>
                <button onClick={handleResetData} className="flex-1 px-4 py-2 bg-rose-600 text-white rounded-lg">ล้างข้อมูล</button>
              </div>
            </div>
          </div>
        )}
        
        <div className="max-w-5xl mx-auto overflow-hidden">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                <Dashboard 
                  jobs={jobs} 
                  expenses={expenses}
                  editJob={handleEditJob}
                  deleteJob={deleteJob} 
                  selectedDate={selectedDate}
                  setSelectedDate={setSelectedDate}
                  incentives={incentives}
                  setIncentive={setIncentive}
                  goals={goals}
                  setGoal={setGoal}
                  preferences={preferences}
                  updatePreferences={updatePreferences}
                  transferIncomeToExpenses={transferIncomeToExpenses}
                  untransferredIncentivesAmount={untransferredIncentivesAmount}
                  showSettings={showLayoutSettings}
                  onToggleSettings={() => setShowLayoutSettings(!showLayoutSettings)}
                />
              </motion.div>
            )}
            {activeTab === 'expenses' && (
              <motion.div
                key="expenses"
                initial={{ opacity: 0, x: (activeTab as string) === 'summary' ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: (activeTab as string) === 'summary' ? 20 : -20 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                <Expenses 
                  jobs={jobs}
                  expenses={expenses}
                  incentives={incentives}
                  onEditExpense={handleEditExpense}
                  updateExpense={updateExpense}
                  deleteExpense={deleteExpense}
                  preferences={preferences}
                  updatePreferences={updatePreferences}
                  showResetConfirm={showResetConfirm}
                  setShowResetConfirm={setShowResetConfirm}
                  resetInput={resetInput}
                  setResetInput={setResetInput}
                  handleResetData={handleResetData}
                  showSettings={showLayoutSettings}
                  onToggleSettings={() => setShowLayoutSettings(!showLayoutSettings)}
                />
              </motion.div>
            )}
            {activeTab === 'summary' && (
              <motion.div
                key="summary"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                <Summary 
                  jobs={jobs}
                  expenses={expenses}
                  incentives={incentives}
                  rawIncentives={rawIncentives}
                  expenseBalance={preferences?.expenseBalance || 0}
                  logs={logs}
                  showSettings={showLayoutSettings}
                  onToggleSettings={() => setShowLayoutSettings(!showLayoutSettings)}
                  preferences={preferences}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <Chatbot 
        ref={chatbotRef}
        jobs={jobs} 
        expenses={expenses}
        incentives={incentives} 
        untransferredIncentivesAmount={untransferredIncentivesAmount}
        addExpense={addExpense} 
        setIncentive={setIncentive} 
        addJob={addJob} 
        updateJob={(job) => editJob(job.id, job)}
        preferences={preferences}
        updatePreferences={updatePreferences}
        isOpen={isChatOpen}
        setIsOpen={setIsChatOpen}
        sharedFile={sharedFile}
        onClearSharedFile={() => setSharedFile(null)}
      />
      <AddIncomeModal 
        isOpen={isIncomeModalOpen}
        onClose={() => {
          setIsIncomeModalOpen(false);
          setEditingJob(null);
        }}
        onAdd={addJob}
        onEdit={editJob}
        selectedDate={selectedDate}
        editingJob={editingJob}
        workType={preferences?.workType || 'rider'}
      />
      <AddExpenseModal 
        isOpen={isExpenseModalOpen}
        onClose={() => {
          setIsExpenseModalOpen(false);
          setEditingExpense(null);
          setSharedFile(null);
        }}
        onAdd={addExpense}
        onEdit={updateExpense}
        customCategories={preferences.customCategories || []}
        setCustomCategories={(cats) => updatePreferences({ customCategories: cats })}
        editingExpense={editingExpense}
        sharedFile={sharedFile}
        expenses={expenses}
      />
      <FloatingNav 
        onAddIncome={() => {
          setEditingJob(null);
          setIsIncomeModalOpen(true);
        }}
        onAddExpense={() => {
          setEditingExpense(null);
          setIsExpenseModalOpen(true);
        }}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAI={() => {
          if (!isChatOpen) setIsChatOpen(true);
          setTimeout(() => {
            chatbotRef.current?.toggleListening();
          }, 300);
        }}
        onLongPressAI={() => {
          setIsChatOpen(prev => !prev);
        }}
      />
      <ActivityLogModal 
        isOpen={isActivityLogOpen} 
        onClose={() => setIsActivityLogOpen(false)} 
        logs={logs} 
      />
      <GoalModal
        isOpen={isGoalModalOpen}
        onClose={() => setIsGoalModalOpen(false)}
        goals={goals}
        onSetGoal={setGoal}
        preferences={preferences}
        updatePreferences={updatePreferences}
      />
      {isLeaveModalOpen && (
        <LeaveModal
          onClose={() => setIsLeaveModalOpen(false)}
          preferences={preferences || {}}
          updatePreferences={updatePreferences}
          t={t}
        />
      )}
      <ExportModal 
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        jobs={jobs}
        expenses={expenses}
      />
      <OnboardingModal
        isOpen={!loading && !preferences?.workType}
        onComplete={(onboardingPrefs) => {
          updatePreferences(onboardingPrefs);
        }}
      />
      <IosInstallPrompt />
      <Toaster position="top-center" richColors />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <SettingsProvider>
          <MainContent />
        </SettingsProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
