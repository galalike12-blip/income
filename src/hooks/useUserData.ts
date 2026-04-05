import { useState, useEffect } from 'react';
import { collection, doc, onSnapshot, setDoc, deleteDoc, serverTimestamp, query, orderBy, getDoc, getDocs, where } from 'firebase/firestore';
import { db } from '../firebase';
import { JobEntry, ExpenseEntry, Goal, UserPreferences } from '../types';
import { User } from 'firebase/auth';
import { useLocalStorage } from './useLocalStorage';

export function useUserData(user: User | null) {
  const [localJobs, setLocalJobs] = useLocalStorage<any[]>('income-tracker-jobs', []);
  const [localIncentives, setLocalIncentives] = useLocalStorage<Record<string, { amount: number, transferred: boolean } | number>>('income-tracker-incentives', {});
  const [localExpenses, setLocalExpenses] = useLocalStorage<ExpenseEntry[]>('income-tracker-expenses', []);
  const [localGoals, setLocalGoals] = useLocalStorage<Goal[]>('income-tracker-goals', []);
  const [localPreferences, setLocalPreferences] = useLocalStorage<UserPreferences>('income-tracker-preferences', {});
  
  const [firestoreJobs, setFirestoreJobs] = useState<any[]>([]);
  const [firestoreIncentives, setFirestoreIncentives] = useState<Record<string, { amount: number, transferred: boolean }>>({});
  const [firestoreExpenses, setFirestoreExpenses] = useState<ExpenseEntry[]>([]);
  const [firestoreGoals, setFirestoreGoals] = useState<Goal[]>([]);
  const [firestorePreferences, setFirestorePreferences] = useState<UserPreferences>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setFirestoreJobs([]);
      setFirestoreIncentives({});
      setFirestoreExpenses([]);
      setFirestoreGoals([]);
      setFirestorePreferences({});
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // Listen to Jobs
    const jobsRef = collection(db, 'users', user.uid, 'jobs');
    const qJobs = query(jobsRef, orderBy('createdAt', 'asc'));
    const unsubscribeJobs = onSnapshot(qJobs, (snapshot) => {
      const jobsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFirestoreJobs(jobsData);
    }, (error) => {
      console.error("Error fetching jobs:", error);
    });

    // Listen to Incentives
    const incentivesRef = collection(db, 'users', user.uid, 'incentives');
    const unsubscribeIncentives = onSnapshot(incentivesRef, (snapshot) => {
      const incData: Record<string, { amount: number, transferred: boolean }> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.date && data.amount !== undefined) {
          incData[data.date] = {
            amount: data.amount,
            transferred: !!data.transferred
          };
        }
      });
      setFirestoreIncentives(incData);
    }, (error) => {
      console.error("Error fetching incentives:", error);
    });

    // Listen to Expenses
    const expensesRef = collection(db, 'users', user.uid, 'expenses');
    const qExpenses = query(expensesRef, orderBy('createdAt', 'asc'));
    const unsubscribeExpenses = onSnapshot(qExpenses, (snapshot) => {
      const expensesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ExpenseEntry[];
      setFirestoreExpenses(expensesData);
    }, (error) => {
      console.error("Error fetching expenses:", error);
    });

    // Listen to Goals
    const goalsRef = collection(db, 'users', user.uid, 'goals');
    const unsubscribeGoals = onSnapshot(goalsRef, (snapshot) => {
      const goalsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Goal[];
      setFirestoreGoals(goalsData);
    }, (error) => {
      console.error("Error fetching goals:", error);
    });

    // Listen to Preferences
    const prefRef = doc(db, 'users', user.uid, 'preferences', 'main');
    const unsubscribePreferences = onSnapshot(prefRef, (docSnap) => {
      if (docSnap.exists()) {
        setFirestorePreferences(docSnap.data() as UserPreferences);
      } else {
        setFirestorePreferences({});
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching preferences:", error);
      setLoading(false);
    });

    return () => {
      unsubscribeJobs();
      unsubscribeIncentives();
      unsubscribeExpenses();
      unsubscribeGoals();
      unsubscribePreferences();
    };
  }, [user]);

  const jobs = user ? firestoreJobs : localJobs;
  const rawIncentives = user ? firestoreIncentives : localIncentives;
  
  // Map rawIncentives to Record<string, number> for UI compatibility
  const incentives = Object.entries(rawIncentives).reduce((acc, [date, data]) => {
    acc[date] = typeof data === 'number' ? data : data.amount;
    return acc;
  }, {} as Record<string, number>);

  const expenses = user ? firestoreExpenses : localExpenses;
  const goals = user ? firestoreGoals : localGoals;
  const preferences = user ? firestorePreferences : localPreferences;

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
    } else {
      setLocalJobs(prev => [...prev, { ...job, id: newId }]);
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
    } else {
      setLocalJobs(prev => prev.map(j => j.id === id ? { ...updatedJob, id } : j));
    }
  };

  const deleteJob = async (id: string) => {
    if (user) {
      const jobRef = doc(db, 'users', user.uid, 'jobs', id);
      await deleteDoc(jobRef);
    } else {
      setLocalJobs(prev => prev.filter(j => j.id !== id));
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
    }
  };

  const addExpense = async (expense: Omit<ExpenseEntry, 'id'>) => {
    const newId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    const currentBalance = preferences.expenseBalance || 0;
    const newBalance = currentBalance - expense.amount;

    if (user) {
      const expenseRef = doc(db, 'users', user.uid, 'expenses', newId);
      
      // Filter out undefined values
      const cleanExpense = Object.fromEntries(
        Object.entries(expense).filter(([_, v]) => v !== undefined)
      );
      
      await setDoc(expenseRef, {
        ...cleanExpense,
        userId: user.uid,
        createdAt: serverTimestamp()
      });

      // Update balance in preferences
      const prefRef = doc(db, 'users', user.uid, 'preferences', 'main');
      await setDoc(prefRef, { expenseBalance: newBalance }, { merge: true });
    } else {
      setLocalExpenses(prev => [...prev, { ...expense, id: newId }]);
      setLocalPreferences(prev => ({ ...prev, expenseBalance: newBalance }));
    }
    return newId;
  };

  const updateExpense = async (id: string, updates: Partial<ExpenseEntry>) => {
    if (user) {
      const expenseRef = doc(db, 'users', user.uid, 'expenses', id);
      
      // If amount is updated, we need to adjust the balance
      if (updates.amount !== undefined) {
        const oldExpense = firestoreExpenses.find(e => e.id === id);
        if (oldExpense) {
          const diff = updates.amount - oldExpense.amount;
          const currentBalance = preferences.expenseBalance || 0;
          const newBalance = currentBalance - diff;
          
          const prefRef = doc(db, 'users', user.uid, 'preferences', 'main');
          await setDoc(prefRef, { expenseBalance: newBalance }, { merge: true });
        }
      }

      // Filter out undefined values
      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, v]) => v !== undefined)
      );
      
      await setDoc(expenseRef, cleanUpdates, { merge: true });
    } else {
      if (updates.amount !== undefined) {
        const oldExpense = localExpenses.find(e => e.id === id);
        if (oldExpense) {
          const diff = updates.amount - oldExpense.amount;
          const currentBalance = preferences.expenseBalance || 0;
          const newBalance = currentBalance - diff;
          setLocalPreferences(prev => ({ ...prev, expenseBalance: newBalance }));
        }
      }
      setLocalExpenses(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    }
  };

  const deleteExpense = async (id: string) => {
    const expenseToDelete = (user ? firestoreExpenses : localExpenses).find(e => e.id === id);
    if (expenseToDelete) {
      const currentBalance = preferences.expenseBalance || 0;
      const newBalance = currentBalance + expenseToDelete.amount;

      if (user) {
        const expenseRef = doc(db, 'users', user.uid, 'expenses', id);
        await deleteDoc(expenseRef);
        
        const prefRef = doc(db, 'users', user.uid, 'preferences', 'main');
        await setDoc(prefRef, { expenseBalance: newBalance }, { merge: true });
      } else {
        setLocalExpenses(prev => prev.filter(e => e.id !== id));
        setLocalPreferences(prev => ({ ...prev, expenseBalance: newBalance }));
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
      setLocalJobs([]);
      setLocalExpenses([]);
      setLocalIncentives({});
      setLocalGoals([]);
      setLocalPreferences(prev => ({ ...prev, expenseBalance: 0 }));
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
        return setDoc(jobRef, {
          ...job,
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
      await setDoc(prefRef, updates, { merge: true });
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
    untransferredIncentivesAmount
  };
}
