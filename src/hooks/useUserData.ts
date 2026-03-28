import { useState, useEffect } from 'react';
import { collection, doc, onSnapshot, setDoc, deleteDoc, serverTimestamp, query, orderBy, getDoc, getDocs, where } from 'firebase/firestore';
import { db } from '../firebase';
import { JobEntry, ExpenseEntry, Goal, MonthlyBudget, UserPreferences } from '../types';
import { User } from 'firebase/auth';
import { useLocalStorage } from './useLocalStorage';

export function useUserData(user: User | null) {
  const [localJobs, setLocalJobs] = useLocalStorage<any[]>('income-tracker-jobs', []);
  const [localIncentives, setLocalIncentives] = useLocalStorage<Record<string, number>>('income-tracker-incentives', {});
  const [localExpenses, setLocalExpenses] = useLocalStorage<ExpenseEntry[]>('income-tracker-expenses', []);
  const [localGoals, setLocalGoals] = useLocalStorage<Goal[]>('income-tracker-goals', []);
  const [localMonthlyBudgets, setLocalMonthlyBudgets] = useLocalStorage<MonthlyBudget[]>('income-tracker-budgets', []);
  const [localPreferences, setLocalPreferences] = useLocalStorage<UserPreferences>('income-tracker-preferences', {});
  
  const [firestoreJobs, setFirestoreJobs] = useState<any[]>([]);
  const [firestoreIncentives, setFirestoreIncentives] = useState<Record<string, number>>({});
  const [firestoreExpenses, setFirestoreExpenses] = useState<ExpenseEntry[]>([]);
  const [firestoreGoals, setFirestoreGoals] = useState<Goal[]>([]);
  const [firestoreMonthlyBudgets, setFirestoreMonthlyBudgets] = useState<MonthlyBudget[]>([]);
  const [firestorePreferences, setFirestorePreferences] = useState<UserPreferences>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setFirestoreJobs([]);
      setFirestoreIncentives({});
      setFirestoreExpenses([]);
      setFirestoreGoals([]);
      setFirestoreMonthlyBudgets([]);
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
      const incData: Record<string, number> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.date && data.amount !== undefined) {
          incData[data.date] = data.amount;
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

    // Listen to Monthly Budgets
    const budgetsRef = collection(db, 'users', user.uid, 'monthlyBudgets');
    const unsubscribeBudgets = onSnapshot(budgetsRef, (snapshot) => {
      const bData = snapshot.docs.map(doc => ({ month: doc.id, amount: doc.data().amount })) as MonthlyBudget[];
      setFirestoreMonthlyBudgets(bData);
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
      unsubscribeBudgets();
      unsubscribePreferences();
    };
  }, [user]);

  const jobs = user ? firestoreJobs : localJobs;
  const incentives = user ? firestoreIncentives : localIncentives;
  const expenses = user ? firestoreExpenses : localExpenses;
  const goals = user ? firestoreGoals : localGoals;
  const monthlyBudgets = user ? firestoreMonthlyBudgets : localMonthlyBudgets;
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
      await setDoc(incRef, {
        userId: user.uid,
        date,
        amount,
        updatedAt: serverTimestamp()
      });
    } else {
      setLocalIncentives(prev => ({ ...prev, [date]: amount }));
    }
  };

  const addExpense = async (expense: Omit<ExpenseEntry, 'id'>) => {
    const newId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
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
    } else {
      setLocalExpenses(prev => [...prev, { ...expense, id: newId }]);
    }
    return newId;
  };

  const updateExpense = async (id: string, updates: Partial<ExpenseEntry>) => {
    if (user) {
      const expenseRef = doc(db, 'users', user.uid, 'expenses', id);
      
      // Filter out undefined values
      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, v]) => v !== undefined)
      );
      
      await setDoc(expenseRef, cleanUpdates, { merge: true });
    } else {
      setLocalExpenses(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    }
  };

  const deleteExpense = async (id: string) => {
    if (user) {
      const expenseRef = doc(db, 'users', user.uid, 'expenses', id);
      await deleteDoc(expenseRef);
    } else {
      setLocalExpenses(prev => prev.filter(e => e.id !== id));
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
      } catch (error) {
        console.error("Error clearing all data:", error);
        throw error;
      }
    } else {
      localStorage.removeItem('jobs');
      localStorage.removeItem('expenses');
      localStorage.removeItem('incentives');
      localStorage.removeItem('goals');
      localStorage.removeItem('monthlyBudgets');
      setLocalJobs([]);
      setLocalExpenses([]);
      setLocalIncentives({});
      setLocalGoals([]);
      setLocalMonthlyBudgets([]);
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

  const setMonthlyBudget = async (budget: MonthlyBudget) => {
    if (user) {
      const budgetRef = doc(db, 'users', user.uid, 'monthlyBudgets', budget.month);
      await setDoc(budgetRef, {
        amount: budget.amount,
        userId: user.uid,
        updatedAt: serverTimestamp()
      });
    } else {
      setLocalMonthlyBudgets(prev => {
        const existing = prev.filter(b => b.month !== budget.month);
        return [...existing, budget];
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
    monthlyBudgets,
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
    setMonthlyBudget,
    importJobs,
    updatePreferences,
    clearAllData
  };
}
