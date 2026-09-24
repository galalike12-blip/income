import { useState, useEffect, useMemo } from 'react';
import { collection, doc, onSnapshot, setDoc, deleteDoc, serverTimestamp, query, orderBy, getDoc, getDocs, where, limit, writeBatch, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { JobEntry, ExpenseEntry, Goal, UserPreferences, ActivityLog } from '../types';
import { User } from 'firebase/auth';
import { useLocalStorage } from './useLocalStorage';
import { safeStringify } from '../utils/safeStringify';
import { toast } from 'sonner';
import { speakText } from '../utils/speech';


const getTodayDateStr = () => {
  const d = new Date();
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${dy}`;
};

const computeUpdatedDailyBalances = (
  existingDailyBalances: Record<string, number> | undefined,
  transactionDate: string,
  balanceDelta: number,
  newCurrentBalance: number
) => {
  const updated = { ...(existingDailyBalances || {}) };
  const today = getTodayDateStr();

  // Sanitize existing
  Object.keys(updated).forEach(k => {
    if (updated[k] < 0) updated[k] = 0;
  });

  updated[today] = Math.max(0, newCurrentBalance);

  if (transactionDate) {
    const txDate = transactionDate.split('T')[0];
    if (balanceDelta !== 0) {
      Object.keys(updated).forEach(d => {
        if (d >= txDate && d < today) {
          updated[d] = Math.max(0, (updated[d] || 0) + balanceDelta);
        }
      });
    }

    if (updated[txDate] === undefined) {
      const datesBefore = Object.keys(updated).filter(d => d < txDate).sort();
      if (datesBefore.length > 0) {
        const closestBefore = datesBefore[datesBefore.length - 1];
        updated[txDate] = Math.max(0, updated[closestBefore] + balanceDelta);
      } else {
        updated[txDate] = Math.max(0, newCurrentBalance);
      }
    }
  }

  // Ensure all values are non-negative
  Object.keys(updated).forEach(k => {
    if (updated[k] < 0) updated[k] = 0;
  });

  return updated;
};


export function useUserData(user: User | null) {
  const [localJobs, setLocalJobs] = useLocalStorage<any[]>('income-tracker-jobs', []);
  const [localIncentives, setLocalIncentives] = useLocalStorage<Record<string, { amount: number, transferred: boolean } | number>>('income-tracker-incentives', {});
  const [localExpenses, setLocalExpenses] = useLocalStorage<ExpenseEntry[]>('income-tracker-expenses', []);
  const [localGoals, setLocalGoals] = useLocalStorage<Goal[]>('income-tracker-goals', []);
  const [localPreferences, setLocalPreferences] = useLocalStorage<UserPreferences>('income-tracker-preferences', {});
  const [localLogs, setLocalLogs] = useLocalStorage<ActivityLog[]>('income-tracker-logs', []);
  
  const [firestoreJobs, setFirestoreJobs] = useState<any[]>([]);
  const [firestoreIncentives, setFirestoreIncentives] = useState<Record<string, { amount: number, transferred: boolean }>>({});
  const [firestoreExpenses, setFirestoreExpenses] = useState<ExpenseEntry[]>([]);
  const [firestoreGoals, setFirestoreGoals] = useState<Goal[]>([]);
  const [firestorePreferences, setFirestorePreferences] = useState<UserPreferences>({});
  const [firestoreLogs, setFirestoreLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setFirestoreJobs([]);
      setFirestoreIncentives({});
      setFirestoreExpenses([]);
      setFirestoreGoals([]);
      setFirestorePreferences({});
      setFirestoreLogs([]);
      setLoading(false);
      return;
    }

    // Load from local cache instantly to prevent 0 or empty screen
    try {
      const cachedJobs = localStorage.getItem(`online-cache-jobs-${user.uid}`);
      if (cachedJobs) setFirestoreJobs(JSON.parse(cachedJobs));

      const cachedIncentives = localStorage.getItem(`online-cache-incentives-${user.uid}`);
      if (cachedIncentives) setFirestoreIncentives(JSON.parse(cachedIncentives));

      const cachedExpenses = localStorage.getItem(`online-cache-expenses-${user.uid}`);
      if (cachedExpenses) setFirestoreExpenses(JSON.parse(cachedExpenses));

      const cachedGoals = localStorage.getItem(`online-cache-goals-${user.uid}`);
      if (cachedGoals) setFirestoreGoals(JSON.parse(cachedGoals));

      const cachedPref = localStorage.getItem(`online-cache-preferences-${user.uid}`);
      if (cachedPref) {
        setFirestorePreferences(JSON.parse(cachedPref));
        setLoading(false);
      } else {
        setLoading(true);
      }

      const cachedLogs = localStorage.getItem(`online-cache-logs-${user.uid}`);
      if (cachedLogs) setFirestoreLogs(JSON.parse(cachedLogs));
    } catch (e) {
      console.warn("Failed to load cached online data:", e);
      setLoading(true);
    }
    
    let unsubscribes: (() => void)[] = [];
    
    try {
      // Listen to Logs
      const logsRef = collection(db, 'users', user.uid, 'logs');
      const qLogs = query(logsRef, orderBy('timestamp', 'desc'), limit(50));
      unsubscribes.push(onSnapshot(qLogs, (snapshot) => {
        const logsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ActivityLog[];
        setFirestoreLogs(logsData);
        localStorage.setItem(`online-cache-logs-${user.uid}`, safeStringify(logsData));
      }, (error) => {
        console.error("Error fetching logs:", error);
      }));

      // Listen to Jobs
      const jobsRef = collection(db, 'users', user.uid, 'jobs');
      const qJobs = query(jobsRef, orderBy('date', 'asc'));
      unsubscribes.push(onSnapshot(qJobs, (snapshot) => {
        const jobsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setFirestoreJobs(jobsData);
        localStorage.setItem(`online-cache-jobs-${user.uid}`, safeStringify(jobsData));
      }, (error) => {
        console.error("Error fetching jobs:", error);
      }));

      // Listen to Incentives
      const incentivesRef = collection(db, 'users', user.uid, 'incentives');
      unsubscribes.push(onSnapshot(incentivesRef, (snapshot) => {
        const incData: Record<string, { amount: number, transferred: boolean }> = {};
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.date && data.amount !== undefined) {
            incData[data.date] = { amount: data.amount, transferred: !!data.transferred };
          }
        });
        setFirestoreIncentives(incData);
        localStorage.setItem(`online-cache-incentives-${user.uid}`, safeStringify(incData));
      }, (error) => {
        console.error("Error fetching incentives:", error);
      }));

      // Listen to Expenses
      const expensesRef = collection(db, 'users', user.uid, 'expenses');
      const qExpenses = query(expensesRef, orderBy('createdAt', 'asc'));
      unsubscribes.push(onSnapshot(qExpenses, (snapshot) => {
        const expensesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ExpenseEntry[];
        setFirestoreExpenses(expensesData);
        localStorage.setItem(`online-cache-expenses-${user.uid}`, safeStringify(expensesData));
      }, (error) => {
        console.error("Error fetching expenses:", error);
      }));

      // Listen to Goals
      const goalsRef = collection(db, 'users', user.uid, 'goals');
      unsubscribes.push(onSnapshot(goalsRef, (snapshot) => {
        const goalsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Goal[];
        setFirestoreGoals(goalsData);
        localStorage.setItem(`online-cache-goals-${user.uid}`, safeStringify(goalsData));
      }, (error) => {
        console.error("Error fetching goals:", error);
      }));

      // Listen to Preferences
      const prefRef = doc(db, 'users', user.uid, 'preferences', 'main');
      unsubscribes.push(onSnapshot(prefRef, (docSnap) => {
        if (docSnap.exists()) {
          const prefData = docSnap.data() as UserPreferences;
          setFirestorePreferences(prefData);
          localStorage.setItem(`online-cache-preferences-${user.uid}`, safeStringify(prefData));
        } else {
          setFirestorePreferences({});
          localStorage.setItem(`online-cache-preferences-${user.uid}`, safeStringify({}));
        }
        setLoading(false);
      }, (error) => {
        console.error("Error fetching preferences:", error);
        setLoading(false);
      }));
    } catch (e) {
      console.error("Error initializing listeners:", e);
      setLoading(false);
    }

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [user]);

  const addLog = async (type: ActivityLog['type'], details: string, amount?: number) => {
    const newId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    const log: ActivityLog = {
      id: newId,
      type,
      details,
      amount,
      timestamp: new Date().toISOString()
    };

    if (user) {
      const logRef = doc(db, 'users', user.uid, 'logs', newId);
      
      const cleanLog = Object.fromEntries(
        Object.entries(log).filter(([_, v]) => v !== undefined)
      );
      
      await setDoc(logRef, {
        ...cleanLog,
        userId: user.uid,
        createdAt: serverTimestamp()
      });
    } else {
      setLocalLogs(prev => [log, ...prev].slice(0, 100));
    }
  };

  const jobs = useMemo(() => {
    const list = user ? firestoreJobs : localJobs;
    return [...list].sort((a, b) => {
      const cmp = (a.date || '').localeCompare(b.date || '');
      if (cmp !== 0) return cmp;
      const aTime = a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.seconds || 0;
      if (aTime !== bTime) return aTime - bTime;
      return (a.id || '').localeCompare(b.id || '');
    });
  }, [user, firestoreJobs, localJobs]);
  const rawIncentives = user ? firestoreIncentives : localIncentives;
  
  // Map rawIncentives to Record<string, number> for UI compatibility
  const incentives = Object.entries(rawIncentives).reduce((acc, [date, data]) => {
    acc[date] = typeof data === 'number' ? data : data.amount;
    return acc;
  }, {} as Record<string, number>);

  const expenses = user ? firestoreExpenses : localExpenses;
  const goals = user ? firestoreGoals : localGoals;
  const rawPreferences = user ? firestorePreferences : localPreferences;
  
  const preferences = {
    ...rawPreferences,
    customCategories: rawPreferences.customCategories && rawPreferences.customCategories.length > 0 
      ? rawPreferences.customCategories 
      : ['food', 'fuel', 'rent', 'utilities', 'shopping', 'maintenance', 'other']
  };

  const addJob = async (job: Omit<JobEntry, 'id'>) => {
    const newId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    
    if (user) {
      const jobRef = doc(db, 'users', user.uid, 'jobs', newId);
      
      // Filter out undefined values
      const cleanJob = Object.fromEntries(
        Object.entries(job).filter(([_, v]) => v !== undefined)
      );
      
      await setDoc(jobRef, {
        ...cleanJob,
        userId: user.uid,
        createdAt: serverTimestamp()
      });
      await addLog('add_job', `เพิ่มงาน: ${job.customerMustPay} บาท`, job.customerMustPay);
    } else {
      setLocalJobs(prev => [...prev, { ...job, id: newId }]);
      await addLog('add_job', `เพิ่มงาน: ${job.customerMustPay} บาท`, job.customerMustPay);
    }
    return newId;
  };

  const editJob = async (id: string, updatedJob: Omit<JobEntry, 'id'>) => {
    if (user) {
      const jobRef = doc(db, 'users', user.uid, 'jobs', id);
      
      // Filter out undefined values
      const cleanJob = Object.fromEntries(
        Object.entries(updatedJob).filter(([_, v]) => v !== undefined)
      );
      
      await setDoc(jobRef, {
        ...cleanJob,
        userId: user.uid,
        // We don't update createdAt here to preserve the original time, but we could add updatedAt
      }, { merge: true });
      await addLog('edit_job', `แก้ไขงาน: ${updatedJob.customerMustPay} บาท`, updatedJob.customerMustPay);
    } else {
      setLocalJobs(prev => prev.map(j => j.id === id ? { ...updatedJob, id } : j));
      await addLog('edit_job', `แก้ไขงาน: ${updatedJob.customerMustPay} บาท`, updatedJob.customerMustPay);
    }
  };

  const deleteJob = async (id: string) => {
    const jobToDelete = (user ? firestoreJobs : localJobs).find(j => j.id === id);
    if (user) {
      const jobRef = doc(db, 'users', user.uid, 'jobs', id);
      await deleteDoc(jobRef);
      if (jobToDelete) {
        await addLog('delete_job', `ลบงาน: ${jobToDelete.customerMustPay} บาท`, jobToDelete.customerMustPay);
      }
    } else {
      setLocalJobs(prev => prev.filter(j => j.id !== id));
      if (jobToDelete) {
        await addLog('delete_job', `ลบงาน: ${jobToDelete.customerMustPay} บาท`, jobToDelete.customerMustPay);
      }
    }
  };

  const setIncentive = async (date: string, amount: number) => {
    if (user) {
      const incRef = doc(db, 'users', user.uid, 'incentives', date);
      // Preserve transferred status if it exists
      const existing = firestoreIncentives[date];
      const transferred = existing && typeof existing !== 'number' ? existing.transferred : false;
      
      await setDoc(incRef, {
        userId: user.uid,
        date,
        amount,
        transferred,
        updatedAt: serverTimestamp()
      });
      await addLog('edit_incentive', `อัปเดตอินเซนต์ทีฟ: ${date} (${amount} บาท)`, amount);
    } else {
      const existing = localIncentives[date];
      const transferred = existing && typeof existing !== 'number' ? (existing as any).transferred : false;
      setLocalIncentives(prev => ({ ...prev, [date]: { amount, transferred } }));
      await addLog('edit_incentive', `อัปเดตอินเซนต์ทีฟ: ${date} (${amount} บาท)`, amount);
    }
  };

  const untransferredIncentivesAmount = Object.entries(rawIncentives)
    .filter(([_, data]) => {
      if (typeof data === 'number') return true;
      return !data.transferred;
    })
    .reduce((sum, [_, data]) => {
      return sum + (typeof data === 'number' ? data : data.amount);
    }, 0);

  const transferIncomeToExpenses = async () => {
    // Calculate total net income from all untransferred jobs
    const untransferredJobs = (user ? firestoreJobs : localJobs).filter(j => !j.transferred);
    const totalJobNet = untransferredJobs.reduce((sum, j) => {
      const amountToCollect = j.customerMustPay + j.upfrontCost;
      const diff = (j.actualReceived ?? amountToCollect) - amountToCollect;
      return sum + j.appNetIncome + diff;
    }, 0);

    // Calculate total from untransferred incentives
    const untransferredIncentives = Object.entries(rawIncentives)
      .filter(([_, data]) => {
        if (typeof data === 'number') return true;
        return !data.transferred;
      });
    
    const totalIncentiveNet = untransferredIncentives.reduce((sum, [_, data]) => {
      return sum + (typeof data === 'number' ? data : data.amount);
    }, 0);

    const totalNet = totalJobNet + totalIncentiveNet;

    const currentBalance = preferences.expenseBalance || 0;
    const newBalance = currentBalance + totalNet;

    if (user) {
      const batches: ReturnType<typeof writeBatch>[] = [];
      let currentBatch = writeBatch(db);
      let operationCount = 0;

      const incrementBatch = () => {
        operationCount++;
        if (operationCount === 490) { // Limit is 500
          batches.push(currentBatch);
          currentBatch = writeBatch(db);
          operationCount = 0;
        }
      };

      // Mark jobs as transferred in Firestore
      untransferredJobs.forEach(j => {
        const jobRef = doc(db, 'users', user.uid, 'jobs', j.id);
        currentBatch.set(jobRef, { transferred: true }, { merge: true });
        incrementBatch();
      });

      // Mark incentives as transferred in Firestore
      untransferredIncentives.forEach(([date, data]) => {
        const incRef = doc(db, 'users', user.uid, 'incentives', date);
        currentBatch.set(incRef, { transferred: true }, { merge: true });
        incrementBatch();
      });

      // Update balance in preferences
      const prefRef = doc(db, 'users', user.uid, 'preferences', 'main');
      const today = getTodayDateStr();
      const updatedDailyBalances = computeUpdatedDailyBalances(preferences.dailyBalances, today, totalNet, newBalance);
      currentBatch.set(prefRef, { 
        expenseBalance: newBalance,
        dailyBalances: updatedDailyBalances
      }, { merge: true });
      batches.push(currentBatch);
      
      try {
        await Promise.all(batches.map(batch => batch.commit()));
        await addLog('transfer_income', `โอนรายได้เข้าบัญชีรายจ่าย: ${totalNet} บาท`, totalNet);
      } catch (e) {
        console.error("Error committing transfer batch", e);
        throw e;
      }
    } else {
      // Mark jobs as transferred locally
      setLocalJobs(prev => prev.map(j => untransferredJobs.some(uj => uj.id === j.id) ? { ...j, transferred: true } : j));
      
      // Mark incentives as transferred locally
      setLocalIncentives(prev => {
        const next = { ...prev };
        untransferredIncentives.forEach(([date, data]) => {
          const amount = typeof data === 'number' ? data : data.amount;
          next[date] = { amount, transferred: true };
        });
        return next;
      });

      // Update balance locally
      const today = getTodayDateStr();
      setLocalPreferences(prev => {
        const updatedDailyBalances = computeUpdatedDailyBalances(prev.dailyBalances, today, totalNet, newBalance);
        return { 
          ...prev, 
          expenseBalance: newBalance,
          dailyBalances: updatedDailyBalances
        };
      });
      await addLog('transfer_income', `โอนรายได้เข้าบัญชีรายจ่าย: ${totalNet} บาท`, totalNet);
    }
  };

  const addExpense = async (expense: Omit<ExpenseEntry, 'id'>) => {
    const duration = expense.durationMonths || 1;
    const isMultiMonth = expense.isFixed && duration > 1 && !expense.isIndefinite;
    const groupId = isMultiMonth ? Date.now().toString() + Math.random().toString(36).substring(2, 9) : undefined;
    
    const entries: ExpenseEntry[] = [];
    let currentBalance = preferences.expenseBalance || 0;
    
    for (let i = 0; i < duration; i++) {
      const newId = Date.now().toString() + Math.random().toString(36).substring(2, 9) + i;
      
      // Only the first one is paid if requested
      const isPaid = i === 0 ? !!expense.isPaid : false;
      let balanceAfter;
      if (isPaid) {
        currentBalance -= expense.amount;
        balanceAfter = currentBalance;
      }

      const baseDate = new Date(expense.date);
      baseDate.setMonth(baseDate.getMonth() + i);
      const dateString = new Date(baseDate.getTime() - (baseDate.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);

      entries.push({
        ...expense,
        id: newId,
        date: dateString,
        isPaid,
        groupId,
        ...(balanceAfter !== undefined && { balanceAfter })
      });
    }

    if (user) {
      const promises = entries.map(entry => {
        const expenseRef = doc(db, 'users', user.uid, 'expenses', entry.id);
        const cleanExpense = Object.fromEntries(
          Object.entries(entry).filter(([_, v]) => v !== undefined)
        );
        return setDoc(expenseRef, {
          ...cleanExpense,
          userId: user.uid,
          createdAt: serverTimestamp()
        });
      });

      if (expense.isPaid) {
        const prefRef = doc(db, 'users', user.uid, 'preferences', 'main');
        const finalBal = (preferences.expenseBalance || 0) - expense.amount;
        const updatedDailyBalances = computeUpdatedDailyBalances(
          preferences.dailyBalances,
          expense.date,
          -expense.amount,
          finalBal
        );
        promises.push(setDoc(prefRef, { 
          expenseBalance: finalBal, 
          dailyBalances: updatedDailyBalances 
        }, { merge: true }));
      }

      await Promise.all(promises);
      await addLog('add_expense', `เพิ่มรายจ่าย: ${expense.payee || expense.category} (${expense.amount} บาท)${isMultiMonth ? ` จำนวน ${duration} เดือน` : ''}`, expense.amount * duration);
    } else {
      setLocalExpenses(prev => [...prev, ...entries]);
      if (expense.isPaid) {
        setLocalPreferences(prev => {
          const finalBal = (prev.expenseBalance || 0) - expense.amount;
          const updatedDailyBalances = computeUpdatedDailyBalances(
            prev.dailyBalances,
            expense.date,
            -expense.amount,
            finalBal
          );
          return {
            ...prev,
            expenseBalance: finalBal,
            dailyBalances: updatedDailyBalances
          };
        });
      }
      await addLog('add_expense', `เพิ่มรายจ่าย: ${expense.payee || expense.category} (${expense.amount} บาท)${isMultiMonth ? ` จำนวน ${duration} เดือน` : ''}`, expense.amount * duration);
    }
    
    return { id: entries[0].id, balanceAfter: entries[0].balanceAfter };
  };

  const updateExpense = async (
    id: string, 
    updates: Partial<ExpenseEntry>, 
    scope: 'single' | 'onwards' | 'all' = 'single'
  ) => {
    if (user) {
      const prefRef = doc(db, 'users', user.uid, 'preferences', 'main');
      const oldExpense = firestoreExpenses.find(e => e.id === id);
      if (!oldExpense) return;

      const currentBalance = preferences.expenseBalance || 0;
      const targetPayee = oldExpense.payee?.trim().toLowerCase();

      let matchingEntries = [oldExpense];
      if (scope !== 'single') {
        matchingEntries = firestoreExpenses.filter(e => {
          if (e.id === id) return true;
          if (oldExpense.groupId && e.groupId && e.groupId === oldExpense.groupId) {
            return true;
          }
          if (oldExpense.isFixed && e.isFixed) {
            if (targetPayee && e.payee?.trim() && e.payee.trim().toLowerCase() === targetPayee) {
              return true;
            }
            if (!targetPayee && !e.payee?.trim() && e.category === oldExpense.category && (e.note || '') === (oldExpense.note || '')) {
              return true;
            }
          }
          return false;
        });

        if (scope === 'onwards') {
          matchingEntries = matchingEntries.filter(e => e.date >= oldExpense.date);
        }
      }

      const sharedGroupId = oldExpense.groupId || (matchingEntries.length > 1 ? ('grp_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6)) : undefined);
      let totalBalanceChange = 0;
      const batch = writeBatch(db);

      matchingEntries.forEach(entry => {
        const expenseRef = doc(db, 'users', user.uid, 'expenses', entry.id);
        const wasPaid = entry.isPaid || false;
        const isPaid = entry.id === id && updates.isPaid !== undefined ? updates.isPaid : wasPaid;
        const oldAmount = entry.amount || 0;
        const newAmount = updates.amount !== undefined ? updates.amount : oldAmount;

        let entryBalanceChange = 0;
        if (!wasPaid && isPaid) {
          entryBalanceChange = -newAmount;
        } else if (wasPaid && !isPaid) {
          entryBalanceChange = oldAmount;
        } else if (wasPaid && isPaid && updates.amount !== undefined) {
          entryBalanceChange = -(newAmount - oldAmount);
        }

        totalBalanceChange += entryBalanceChange;

        let cleanEntryUpdates: Partial<ExpenseEntry>;
        if (entry.id === id) {
          cleanEntryUpdates = Object.fromEntries(
            Object.entries(updates).filter(([_, v]) => v !== undefined)
          );
          if (sharedGroupId) cleanEntryUpdates.groupId = sharedGroupId;
          if (entryBalanceChange !== 0 || updates.isPaid !== undefined) {
            if (isPaid) {
              cleanEntryUpdates.balanceAfter = currentBalance + entryBalanceChange;
            } else if (!isPaid) {
              (cleanEntryUpdates as any).balanceAfter = null;
            }
          }
        } else {
          cleanEntryUpdates = {};
          if (updates.amount !== undefined) cleanEntryUpdates.amount = updates.amount;
          if (updates.payee !== undefined) cleanEntryUpdates.payee = updates.payee;
          if (updates.category !== undefined) cleanEntryUpdates.category = updates.category;
          if (updates.note !== undefined) cleanEntryUpdates.note = updates.note;
          if (updates.websiteUrl !== undefined) cleanEntryUpdates.websiteUrl = updates.websiteUrl;
          if (updates.necessity !== undefined) cleanEntryUpdates.necessity = updates.necessity;
          if (updates.frequency !== undefined) cleanEntryUpdates.frequency = updates.frequency;
          if (sharedGroupId) cleanEntryUpdates.groupId = sharedGroupId;
          if (wasPaid && updates.amount !== undefined && entry.balanceAfter !== undefined) {
            cleanEntryUpdates.balanceAfter = entry.balanceAfter + entryBalanceChange;
          }
        }

        batch.set(expenseRef, cleanEntryUpdates, { merge: true });
      });

      if (totalBalanceChange !== 0) {
        const finalBalance = currentBalance + totalBalanceChange;
        const txDate = oldExpense.date;
        const updatedDailyBalances = computeUpdatedDailyBalances(
          preferences.dailyBalances,
          txDate,
          totalBalanceChange,
          finalBalance
        );
        batch.set(prefRef, { 
          expenseBalance: finalBalance,
          dailyBalances: updatedDailyBalances
        }, { merge: true });
      }

      await batch.commit();

      const finalBalance = currentBalance + totalBalanceChange;
      const expenseName = updates.payee || oldExpense.payee || updates.category || oldExpense.category;
      const newAmount = updates.amount !== undefined ? updates.amount : oldExpense.amount;

      if (matchingEntries.length > 1) {
        toast.success(`อัปเดตราคา "${expenseName}" เป็น ฿${newAmount.toLocaleString()} ทั้งหมด ${matchingEntries.length} งวด เรียบร้อยแล้ว`);
        await addLog('edit_expense', `อัปเดตราคาต่อเนื่อง: ${expenseName} (${newAmount} บาท) ทั้งหมด ${matchingEntries.length} งวด`, newAmount * matchingEntries.length);
      } else {
        const wasPaid = oldExpense.isPaid || false;
        const isPaid = updates.isPaid !== undefined ? updates.isPaid : wasPaid;
        if (!wasPaid && isPaid) {
          toast.success(`ชำระรายจ่ายสำเร็จ: ${expenseName} ฿${newAmount.toLocaleString()} (ยอดคงเหลือ ฿${finalBalance.toLocaleString()})`);
          if (preferences.enableVoiceFeedback !== false) {
            speakText(`จ่ายค่า ${expenseName} ${newAmount} บาท แล้วค่ะ ยอดคงเหลือ ${finalBalance} บาท ค่ะ`);
          }
          await addLog('edit_expense', `ชำระรายจ่าย: ${expenseName} (${newAmount} บาท) - ยอดคงเหลือ ฿${finalBalance.toLocaleString()}`, newAmount);
        } else if (wasPaid && !isPaid) {
          toast.info(`ยกเลิกการชำระรายจ่าย: ${expenseName} (ยอดคงเหลือ ฿${finalBalance.toLocaleString()})`);
          if (preferences.enableVoiceFeedback !== false) {
            speakText(`ยกเลิกการจ่ายค่า ${expenseName} แล้วค่ะ ยอดคงเหลือ ${finalBalance} บาท ค่ะ`);
          }
          await addLog('edit_expense', `ยกเลิกการชำระรายจ่าย: ${expenseName} (${oldExpense.amount} บาท) - ยอดคงเหลือ ฿${finalBalance.toLocaleString()}`, oldExpense.amount);
        } else {
          await addLog('edit_expense', `แก้ไขรายจ่าย: ${expenseName}`, updates.amount);
        }
      }
    } else {
      const oldEx = localExpenses.find(e => e.id === id);
      if (!oldEx) return;

      const targetPayee = oldEx.payee?.trim().toLowerCase();
      let matchingEntries = [oldEx];
      if (scope !== 'single') {
        matchingEntries = localExpenses.filter(e => {
          if (e.id === id) return true;
          if (oldEx.groupId && e.groupId && e.groupId === oldEx.groupId) return true;
          if (oldEx.isFixed && e.isFixed) {
            if (targetPayee && e.payee?.trim() && e.payee.trim().toLowerCase() === targetPayee) return true;
            if (!targetPayee && !e.payee?.trim() && e.category === oldEx.category && (e.note || '') === (oldEx.note || '')) return true;
          }
          return false;
        });

        if (scope === 'onwards') {
          matchingEntries = matchingEntries.filter(e => e.date >= oldEx.date);
        }
      }

      const sharedGroupId = oldEx.groupId || (matchingEntries.length > 1 ? ('grp_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6)) : undefined);
      let localBalanceChange = 0;

      matchingEntries.forEach(entry => {
        const wasPaid = entry.isPaid || false;
        const isPaid = entry.id === id && updates.isPaid !== undefined ? updates.isPaid : wasPaid;
        const oldAmount = entry.amount || 0;
        const newAmount = updates.amount !== undefined ? updates.amount : oldAmount;

        if (!wasPaid && isPaid) {
          localBalanceChange += -newAmount;
        } else if (wasPaid && !isPaid) {
          localBalanceChange += oldAmount;
        } else if (wasPaid && isPaid && updates.amount !== undefined) {
          localBalanceChange += -(newAmount - oldAmount);
        }
      });

      const finalLocalBalance = (preferences.expenseBalance || 0) + localBalanceChange;

      setLocalExpenses(prev => {
        const updated = [...prev];
        matchingEntries.forEach(entry => {
          const idx = updated.findIndex(e => e.id === entry.id);
          if (idx === -1) return;
          if (entry.id === id) {
            const clean = { ...updated[idx], ...updates };
            if (sharedGroupId) clean.groupId = sharedGroupId;
            updated[idx] = clean;
          } else {
            const clean: any = { ...updated[idx] };
            if (updates.amount !== undefined) clean.amount = updates.amount;
            if (updates.payee !== undefined) clean.payee = updates.payee;
            if (updates.category !== undefined) clean.category = updates.category;
            if (updates.note !== undefined) clean.note = updates.note;
            if (updates.websiteUrl !== undefined) clean.websiteUrl = updates.websiteUrl;
            if (updates.necessity !== undefined) clean.necessity = updates.necessity;
            if (updates.frequency !== undefined) clean.frequency = updates.frequency;
            if (sharedGroupId) clean.groupId = sharedGroupId;
            updated[idx] = clean;
          }
        });
        return updated;
      });

      if (localBalanceChange !== 0) {
        setLocalPreferences(prevPref => {
          const currentBalance = prevPref.expenseBalance || 0;
          const newBalance = currentBalance + localBalanceChange;
          const today = getTodayDateStr();
          const updatedDailyBalances = { ...(prevPref.dailyBalances || {}) };
          updatedDailyBalances[today] = newBalance;
          return { 
            ...prevPref, 
            expenseBalance: newBalance,
            dailyBalances: updatedDailyBalances
          };
        });
      }

      const expenseName = updates.payee || oldEx.payee || updates.category || oldEx.category;
      const newAmount = updates.amount !== undefined ? updates.amount : oldEx.amount;

      if (matchingEntries.length > 1) {
        toast.success(`อัปเดตราคา "${expenseName}" เป็น ฿${newAmount.toLocaleString()} ทั้งหมด ${matchingEntries.length} งวด เรียบร้อยแล้ว`);
        await addLog('edit_expense', `อัปเดตราคาต่อเนื่อง: ${expenseName} (${newAmount} บาท) ทั้งหมด ${matchingEntries.length} งวด`, newAmount * matchingEntries.length);
      } else {
        const wasPaid = oldEx.isPaid || false;
        const isPaid = updates.isPaid !== undefined ? updates.isPaid : wasPaid;
        if (!wasPaid && isPaid) {
          toast.success(`ชำระรายจ่ายสำเร็จ: ${expenseName} ฿${newAmount.toLocaleString()} (ยอดคงเหลือ ฿${finalLocalBalance.toLocaleString()})`);
          if (preferences.enableVoiceFeedback !== false) {
            speakText(`จ่ายค่า ${expenseName} ${newAmount} บาท แล้วค่ะ ยอดคงเหลือ ${finalLocalBalance} บาท ค่ะ`);
          }
          await addLog('edit_expense', `ชำระรายจ่าย: ${expenseName} (${newAmount} บาท) - ยอดคงเหลือ ฿${finalLocalBalance.toLocaleString()}`, newAmount);
        } else if (wasPaid && !isPaid) {
          toast.info(`ยกเลิกการชำระรายจ่าย: ${expenseName} (ยอดคงเหลือ ฿${finalLocalBalance.toLocaleString()})`);
          if (preferences.enableVoiceFeedback !== false) {
            speakText(`ยกเลิกการจ่ายค่า ${expenseName} แล้วค่ะ ยอดคงเหลือ ${finalLocalBalance} บาท ค่ะ`);
          }
          await addLog('edit_expense', `ยกเลิกการชำระรายจ่าย: ${expenseName} (${oldEx.amount} บาท) - ยอดคงเหลือ ฿${finalLocalBalance.toLocaleString()}`, oldEx.amount);
        } else {
          await addLog('edit_expense', `แก้ไขรายจ่าย: ${expenseName}`, updates.amount);
        }
      }
    }
  };

  const deleteExpense = async (id: string) => {
    if (user) {
      const expenseRef = doc(db, 'users', user.uid, 'expenses', id);
      const prefRef = doc(db, 'users', user.uid, 'preferences', 'main');
      
      const expenseToDelete = firestoreExpenses.find(e => e.id === id);
      if (!expenseToDelete) return;

      const batch = writeBatch(db);
      batch.delete(expenseRef);
      
      if (expenseToDelete.isPaid) {
        const finalBalance = (preferences.expenseBalance || 0) + expenseToDelete.amount;
        const updatedDailyBalances = computeUpdatedDailyBalances(
          preferences.dailyBalances,
          expenseToDelete.date,
          expenseToDelete.amount,
          finalBalance
        );
        batch.set(prefRef, { 
          expenseBalance: finalBalance,
          dailyBalances: updatedDailyBalances
        }, { merge: true });
      }

      await batch.commit();

      await addLog('delete_expense', `ลบรายจ่าย: ${expenseToDelete.payee || expenseToDelete.category}`, expenseToDelete.amount);
    } else {
      let expenseAmount = 0;
      let expensePayee = '';
      let expenseCategory = '';
      
      setLocalExpenses(prev => {
        const expenseToDelete = prev.find(e => e.id === id);
        if (expenseToDelete) {
          expenseAmount = expenseToDelete.amount;
          expensePayee = expenseToDelete.payee || '';
          expenseCategory = expenseToDelete.category || '';
          
          if (expenseToDelete.isPaid) {
            setLocalPreferences(prevPref => {
              const currentBalance = prevPref.expenseBalance || 0;
              const finalBalance = currentBalance + expenseToDelete.amount;
              const updatedDailyBalances = computeUpdatedDailyBalances(
                prevPref.dailyBalances,
                expenseToDelete.date,
                expenseToDelete.amount,
                finalBalance
              );
              return { 
                ...prevPref, 
                expenseBalance: finalBalance,
                dailyBalances: updatedDailyBalances
              };
            });
          }
        }
        return prev.filter(e => e.id !== id);
      });
      
      if (expenseAmount > 0 || expensePayee || expenseCategory) {
        await addLog('delete_expense', `ลบรายจ่าย: ${expensePayee || expenseCategory}`, expenseAmount);
      }
    }
  };

  const clearAllData = async () => {
    if (user) {
      try {
        const collections = ['jobs', 'expenses', 'incentives', 'goals', 'monthlyBudgets'];
        for (const colName of collections) {
          const colRef = collection(db, 'users', user.uid, colName);
          const snapshot = await getDocs(colRef);
          const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
          await Promise.all(deletePromises);
        }
        // Also reset balance
        const prefRef = doc(db, 'users', user.uid, 'preferences', 'main');
        await setDoc(prefRef, { expenseBalance: 0 }, { merge: true });
        await addLog('reset_data', 'ล้างข้อมูลทั้งหมด');
      } catch (error) {
        console.error("Error clearing all data:", error);
        throw error;
      }
    } else {
      localStorage.removeItem('income-tracker-jobs');
      localStorage.removeItem('income-tracker-expenses');
      localStorage.removeItem('income-tracker-incentives');
      localStorage.removeItem('income-tracker-goals');
      localStorage.removeItem('income-tracker-budgets');
      localStorage.removeItem('income-tracker-logs');
      setLocalJobs([]);
      setLocalExpenses([]);
      setLocalIncentives({});
      setLocalGoals([]);
      setLocalLogs([]);
      setLocalPreferences(prev => ({ ...prev, expenseBalance: 0 }));
      await addLog('reset_data', 'ล้างข้อมูลทั้งหมด');
    }
  };

  const setGoal = async (goal: Omit<Goal, 'id'>) => {
    // We use the type ('daily' or 'monthly') as the ID so there's only one of each
    const goalId = goal.type;
    if (user) {
      const goalRef = doc(db, 'users', user.uid, 'goals', goalId);
      await setDoc(goalRef, {
        ...goal,
        userId: user.uid,
        updatedAt: serverTimestamp()
      });
    } else {
      setLocalGoals(prev => {
        const existing = prev.filter(g => g.type !== goal.type);
        return [...existing, { ...goal, id: goalId }];
      });
    }
  };

  const importJobs = async (importedJobs: JobEntry[]) => {
    if (user) {
      // Batch writes would be better, but for simplicity we can do Promise.all
      // or just sequential writes if there aren't too many
      const promises = importedJobs.map(job => {
        const jobRef = doc(db, 'users', user.uid, 'jobs', job.id);
        const cleanJob = Object.fromEntries(
          Object.entries(job).filter(([_, v]) => v !== undefined)
        );
        return setDoc(jobRef, {
          ...cleanJob,
          userId: user.uid,
          createdAt: serverTimestamp() // Or parse from CSV if we had it
        }, { merge: true });
      });
      await Promise.all(promises);
    } else {
      setLocalJobs(prev => {
        const jobMap = new Map(prev.map(j => [j.id, j]));
        importedJobs.forEach(j => jobMap.set(j.id, j));
        return Array.from(jobMap.values());
      });
    }
  };

  const updatePreferences = async (updates: Partial<UserPreferences>) => {
    if (user) {
      const prefRef = doc(db, 'users', user.uid, 'preferences', 'main');
      let cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, v]) => v !== undefined)
      );
      if (updates.expenseBalance !== undefined) {
        const today = getTodayDateStr();
        const updatedDailyBalances = computeUpdatedDailyBalances(preferences.dailyBalances, today, 0, updates.expenseBalance);
        cleanUpdates = {
          ...cleanUpdates,
          dailyBalances: updatedDailyBalances
        };
      }
      await setDoc(prefRef, cleanUpdates, { merge: true });
    } else {
      setLocalPreferences(prev => {
        const next = { ...prev, ...updates };
        if (updates.expenseBalance !== undefined) {
          const today = getTodayDateStr();
          const updatedDailyBalances = computeUpdatedDailyBalances(prev.dailyBalances, today, 0, updates.expenseBalance);
          next.dailyBalances = updatedDailyBalances;
        }
        return next;
      });
    }

    if (updates.expenseBalance !== undefined) {
      await addLog('edit_balance', `ปรับปรุงยอดเงินคงเหลือในบัญชี: ${updates.expenseBalance} บาท`, updates.expenseBalance);
    }
  };

  return {
    rawJobs: jobs,
    incentives,
    rawIncentives,
    expenses,
    goals,
    preferences,
    loading,
    addJob,
    editJob,
    deleteJob,
    setIncentive,
    addExpense,
    updateExpense,
    deleteExpense,
    setGoal,
    importJobs,
    updatePreferences,
    clearAllData,
    transferIncomeToExpenses,
    untransferredIncentivesAmount,
    logs: user ? firestoreLogs : localLogs
  };
}
