/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { Expenses } from './components/Expenses';
import { Summary } from './components/Summary';
import { Chatbot } from './components/Chatbot';
import { Header } from './components/Header';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useUserData } from './hooks/useUserData';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { GoogleSheetsService } from './services/googleSheets';
import { translations } from './i18n/translations';
import { JobEntry } from './types';
import { Toaster } from 'sonner';

function MainContent() {
  const { currentLang } = useSettings();
  const { user, googleAccessToken, spreadsheetId } = useAuth();
  const t = translations[currentLang];
  
  const { rawJobs, incentives, expenses, goals, monthlyBudgets, preferences, updatePreferences, addJob: firestoreAddJob, editJob: firestoreEditJob, deleteJob: firestoreDeleteJob, setIncentive, addExpense, updateExpense, deleteExpense, setGoal, setMonthlyBudget, clearAllData } = useUserData(user);
  
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  });
  const [activeTab, setActiveTab] = useState<'dashboard' | 'expenses' | 'summary'>('dashboard');

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
        actualReceived: j.actualReceived || 0
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
        actualReceived: j.actualReceived || 0
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
        actualReceived: j.baseIncome + (j.tip || 0)
      };
    }
    
    // If migrating from the second version (billedAmount, receivedAmount, upfrontCost, deduction)
    return {
      id: j.id,
      date: j.date,
      customerMustPay: j.billedAmount || 0,
      upfrontCost: j.upfrontCost || 0,
      appNetIncome: (j.billedAmount || 0) - (j.deduction || 0),
      actualReceived: j.receivedAmount || 0
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
        const amountToCollect = newJob.customerMustPay + newJob.upfrontCost;
        const diff = (newJob.actualReceived ?? amountToCollect) - amountToCollect;
        const tip = diff > 0 ? diff : 0;
        const loss = diff < 0 ? Math.abs(diff) : 0;
        const totalNet = newJob.appNetIncome + diff;
        
        await sheetsService.appendRow(spreadsheetId, 'Jobs', [
          newJob.id,
          newJob.date,
          newJob.customerMustPay.toString(),
          newJob.upfrontCost.toString(),
          newJob.appNetIncome.toString(),
          newJob.actualReceived.toString(),
          tip.toString(),
          loss.toString(),
          totalNet.toString()
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
          const amountToCollect = j.customerMustPay + j.upfrontCost;
          const diff = (j.actualReceived ?? amountToCollect) - amountToCollect;
          const tip = diff > 0 ? diff : 0;
          const loss = diff < 0 ? Math.abs(diff) : 0;
          const totalNet = j.appNetIncome + diff;
          return [
            j.id,
            j.date,
            j.customerMustPay.toString(),
            j.upfrontCost.toString(),
            j.appNetIncome.toString(),
            j.actualReceived.toString(),
            tip.toString(),
            loss.toString(),
            totalNet.toString()
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
    <div className="min-h-screen font-sans text-slate-900 dark:text-slate-100 pb-20 transition-colors duration-200 relative">
      <div className="liquid-bg">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>
      <Header />
      
      <div className="max-w-5xl mx-auto px-4 mt-3 mb-2 flex justify-center">
        <div className="flex w-full max-w-md glass-panel-subtle p-1 rounded-full overflow-hidden">
          <button onClick={() => setActiveTab('dashboard')} className={`flex-1 px-2 py-2.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'dashboard' ? 'bg-white/80 dark:bg-slate-700/80 text-indigo-600 dark:text-indigo-400 shadow-sm backdrop-blur-md' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}>
            {t.income || 'รายรับ'}
          </button>
          <button onClick={() => setActiveTab('expenses')} className={`flex-1 px-2 py-2.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'expenses' ? 'bg-white/80 dark:bg-slate-700/80 text-indigo-600 dark:text-indigo-400 shadow-sm backdrop-blur-md' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}>
            {t.expenses || 'รายจ่าย'}
          </button>
          <button onClick={() => setActiveTab('summary')} className={`flex-1 px-2 py-2.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'summary' ? 'bg-white/80 dark:bg-slate-700/80 text-indigo-600 dark:text-indigo-400 shadow-sm backdrop-blur-md' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}>
            {t.summary || 'สรุป'}
          </button>
        </div>
      </div>

      {activeTab === 'dashboard' && (
        <Dashboard 
          jobs={jobs} 
          addJob={addJob} 
          editJob={editJob}
          deleteJob={deleteJob} 
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          incentives={incentives}
          setIncentive={setIncentive}
          goals={goals}
          setGoal={setGoal}
          preferences={preferences}
          updatePreferences={updatePreferences}
        />
      )}
      {activeTab === 'expenses' && (
        <Expenses 
          jobs={jobs}
          expenses={expenses}
          addExpense={addExpense}
          updateExpense={updateExpense}
          deleteExpense={deleteExpense}
          monthlyBudgets={monthlyBudgets}
          setMonthlyBudget={setMonthlyBudget}
          preferences={preferences}
          updatePreferences={updatePreferences}
          clearAllData={clearAllData}
        />
      )}
      {activeTab === 'summary' && (
        <Summary 
          jobs={jobs}
          expenses={expenses}
          incentives={incentives}
        />
      )}
      <Chatbot jobs={jobs} incentives={incentives} addExpense={addExpense} setIncentive={setIncentive} />
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
