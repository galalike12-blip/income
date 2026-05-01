import { useState, useEffect } from 'react';
import { collection, doc, onSnapshot, setDoc, deleteDoc, serverTimestamp, query, orderBy, getDoc, getDocs, where, limit, writeBatch, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { JobEntry, ExpenseEntry, Goal, UserPreferences, ActivityLog } from '../types';
import { User } from 'firebase/auth';
import { useLocalStorage } from './useLocalStorage';

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

    setLoading(true);
    
    let unsubscribes: (() => void)[] = [];
    
    // Small delay to allow Firebase Auth state to propagate
    const initTimer = setTimeout(() => {
      try {
        // Listen to Logs
        const logsRef = collection(db, 'users', user.uid, 'logs');
        const qLogs = query(logsRef, orderBy('timestamp', 'desc'), limit(50));
        unsubscribes.push(onSnapshot(qLogs, (snapshot) => {
          const logsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ActivityLog[];
          setFirestoreLogs(logsData);
        }, (error) => {
          console.error("Error fetching logs:", error);
        }));

        // Listen to Jobs
        const jobsRef = collection(db, 'users', user.uid, 'jobs');
        const qJobs = query(jobsRef, orderBy('createdAt', 'asc'));
        unsubscribes.push(onSnapshot(qJobs, (snapshot) => {
          const jobsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setFirestoreJobs(jobsData);
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
        }, (error) => {
          console.error("Error fetching incentives:", error);
        }));

        // Listen to Expenses
        const expensesRef = collection(db, 'users', user.uid, 'expenses');
        const qExpenses = query(expensesRef, orderBy('createdAt', 'asc'));
        unsubscribes.push(onSnapshot(qExpenses, (snapshot) => {
          const expensesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ExpenseEntry[];
          setFirestoreExpenses(expensesData);
        }, (error) => {
          console.error("Error fetching expenses:", error);
        }));

        // Listen to Goals
        const goalsRef = collection(db, 'users', user.uid, 'goals');
        unsubscribes.push(onSnapshot(goalsRef, (snapshot) => {
          const goalsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Goal[];
          setFirestoreGoals(goalsData);
        }, (error) => {
          console.error("Error fetching goals:", error);
        }));

        // Listen to Preferences
        const prefRef = doc(db, 'users', user.uid, 'preferences', 'main');
        unsubscribes.push(onSnapshot(prefRef, (docSnap) => {
          if (docSnap.exists()) {
            setFirestorePreferences(docSnap.data() as UserPreferences);
          } else {
            setFirestorePreferences({});
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
    }, 1200);

    return () => {
      clearTimeout(initTimer);
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

  const jobs = user ? firestoreJobs : localJobs;
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
    } else {
      const existing = localIncentives[date];
      const transferred = existing && typeof existing !== 'number' ? (existing as any).transferred : false;
      setLocalIncentives(prev => ({ ...prev, [date]: { amount, transferred } }));
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
      // Mark jobs as transferred in Firestore
      const jobPromises = untransferredJobs.map(j => {
        const jobRef = doc(db, 'users', user.uid, 'jobs', j.id);
        return setDoc(jobRef, { transferred: true }, { merge: true });
      });

      // Mark incentives as transferred in Firestore
      const incPromises = untransferredIncentives.map(([date, data]) => {
        const incRef = doc(db, 'users', user.uid, 'incentives', date);
        return setDoc(incRef, { transferred: true }, { merge: true });
      });

      await Promise.all([...jobPromises, ...incPromises]);
      
      // Update balance in preferences
      const prefRef = doc(db, 'users', user.uid, 'preferences', 'main');
      await setDoc(prefRef, { expenseBalance: newBalance }, { merge: true });
      await addLog('transfer_income', `โอนรายได้เข้าบัญชีรายจ่าย: ${totalNet} บาท`, totalNet);
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
      setLocalPreferences(prev => ({ ...prev, expenseBalance: newBalance }));
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
      if (isPaid) {
        currentBalance -= expense.amount;
      }

      const baseDate = new Date(expense.date);
      baseDate.setMonth(baseDate.getMonth() + i);
      const dateString = new Date(baseDate.getTime() - (baseDate.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);

      entries.push({
        ...expense,
        id: newId,
        date: dateString,
        isPaid,
        groupId
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
        promises.push(setDoc(prefRef, { expenseBalance: increment(-expense.amount) }, { merge: true }));
      }

      await Promise.all(promises);
      await addLog('add_expense', `เพิ่มรายจ่าย: ${expense.payee || expense.category} (${expense.amount} บาท)${isMultiMonth ? ` จำนวน ${duration} เดือน` : ''}`, expense.amount * duration);
    } else {
      setLocalExpenses(prev => [...prev, ...entries]);
      if (expense.isPaid) {
        setLocalPreferences(prev => ({ ...prev, expenseBalance: currentBalance }));
      }
      await addLog('add_expense', `เพิ่มรายจ่าย: ${expense.payee || expense.category} (${expense.amount} บาท)${isMultiMonth ? ` จำนวน ${duration} เดือน` : ''}`, expense.amount * duration);
    }
    
    return entries[0].id;
  };

  const updateExpense = async (id: string, updates: Partial<ExpenseEntry>) => {
    if (user) {
      const expenseRef = doc(db, 'users', user.uid, 'expenses', id);
      const prefRef = doc(db, 'users', user.uid, 'preferences', 'main');
      
      const oldExpense = firestoreExpenses.find(e => e.id === id);
      if (!oldExpense) return;
      
      const wasPaid = oldExpense.isPaid || false;
      const isPaid = updates.isPaid !== undefined ? updates.isPaid : wasPaid;
      const oldAmount = oldExpense.amount || 0;
      const newAmount = updates.amount !== undefined ? updates.amount : oldAmount;
      
      let balanceChange = 0;
      
      if (!wasPaid && isPaid) {
        // Just paid: deduct full new amount
        balanceChange = -newAmount;
      } else if (wasPaid && !isPaid) {
        // Unpaid: add back old amount
        balanceChange = oldAmount;
      } else if (wasPaid && isPaid && updates.amount !== undefined) {
        // Still paid but amount changed: adjust by difference
        balanceChange = -(newAmount - oldAmount);
      }

      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, v]) => v !== undefined)
      );

      const batch = writeBatch(db);
      batch.set(expenseRef, cleanUpdates, { merge: true });
      
      if (balanceChange !== 0) {
        batch.set(prefRef, { expenseBalance: increment(balanceChange) }, { merge: true });
      }
      
      await batch.commit();

      await addLog('edit_expense', `แก้ไขรายจ่าย: ${updates.payee || oldExpense.payee || updates.category || oldExpense.category}`, updates.amount);
    } else {
      setLocalExpenses(prev => {
        const currentExpenses = [...prev];
        const index = currentExpenses.findIndex(e => e.id === id);
        if (index === -1) return currentExpenses;

        const oldExpense = currentExpenses[index];
        const wasPaid = oldExpense.isPaid;
        const isPaid = updates.isPaid !== undefined ? updates.isPaid : wasPaid;
        const oldAmount = oldExpense.amount;
        const newAmount = updates.amount !== undefined ? updates.amount : oldAmount;

        setLocalPreferences(prevPref => {
          const currentBalance = prevPref.expenseBalance || 0;
          let newBalance = currentBalance;

          if (!wasPaid && isPaid) {
            newBalance = currentBalance - newAmount;
          } else if (wasPaid && !isPaid) {
            newBalance = currentBalance + oldAmount;
          } else if (wasPaid && isPaid && updates.amount !== undefined) {
            const diff = newAmount - oldAmount;
            newBalance = currentBalance - diff;
          }

          if (newBalance !== currentBalance) {
            return { ...prevPref, expenseBalance: newBalance };
          }
          return prevPref;
        });

        currentExpenses[index] = { ...oldExpense, ...updates };
        return currentExpenses;
      });
      
      const oldEx = localExpenses.find(e => e.id === id);
      await addLog('edit_expense', `แก้ไขรายจ่าย: ${updates.payee || oldEx?.payee || updates.category || oldEx?.category}`, updates.amount);
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
        batch.set(prefRef, { expenseBalance: increment(expenseToDelete.amount) }, { merge: true });
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
              return { ...prevPref, expenseBalance: currentBalance + expenseToDelete.amount };
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
      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, v]) => v !== undefined)
      );
      await setDoc(prefRef, cleanUpdates, { merge: true });
    } else {
      setLocalPreferences(prev => ({ ...prev, ...updates }));
    }
  };

  return {
    rawJobs: jobs,
    incentives,
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
