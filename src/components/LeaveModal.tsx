import React, { useState } from 'react';
import { X, Calendar, MessageSquare, Trash2, CheckCircle2 } from 'lucide-react';
import { UserPreferences } from '../types';

interface LeaveModalProps {
  onClose: () => void;
  preferences: UserPreferences;
  updatePreferences: (updates: Partial<UserPreferences>) => void;
  t: any;
}

export function LeaveModal({ onClose, preferences, updatePreferences, t }: LeaveModalProps) {
  const [startDate, setStartDate] = useState(
    new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Parse leave days and merge with reasons
  const leaveDaysList = preferences?.leaveDays || [];
  const leaveReasons = preferences?.leaveReasons || {};

  const handleAddLeave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate) return;

    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date(startDate);
    
    if (end < start) {
      // If end date is before start date, ignore end date or handle error. We'll just use start date.
      end.setTime(start.getTime());
    }

    const newLeaveDays = [...leaveDaysList];
    const newLeaveReasons = { ...leaveReasons };

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      if (!newLeaveDays.includes(dateStr)) {
        newLeaveDays.push(dateStr);
      }
      if (reason.trim()) {
        newLeaveReasons[dateStr] = reason.trim();
      } else {
        delete newLeaveReasons[dateStr];
      }
    }

    // Sort descending
    newLeaveDays.sort((a, b) => b.localeCompare(a));

    updatePreferences({ leaveDays: newLeaveDays, leaveReasons: newLeaveReasons });
    setShowForm(false);
    setReason('');
    setEndDate('');
  };

  const handleRemoveLeaveGroup = (dates: string[]) => {
    const newLeaveDays = leaveDaysList.filter(d => !dates.includes(d));
    const newLeaveReasons = { ...leaveReasons };
    dates.forEach(d => delete newLeaveReasons[d]);
    
    updatePreferences({ leaveDays: newLeaveDays, leaveReasons: newLeaveReasons });
  };

  const handleEditGroup = (dates: string[], startDateStr: string, endDateStr: string, groupReason: string) => {
    setStartDate(startDateStr);
    setEndDate(startDateStr !== endDateStr ? endDateStr : '');
    setReason(groupReason);
    setShowForm(true);
    handleRemoveLeaveGroup(dates);
  };

  // Group consecutive days with the same reason
  const sortedDays = [...leaveDaysList].sort((a, b) => a.localeCompare(b));
  const groups: { startDate: string; endDate: string; reason: string; dates: string[] }[] = [];

  if (sortedDays.length > 0) {
    let currentGroup = { startDate: sortedDays[0], endDate: sortedDays[0], reason: leaveReasons[sortedDays[0]] || '', dates: [sortedDays[0]] };
    
    for (let i = 1; i < sortedDays.length; i++) {
        const dStr = sortedDays[i];
        const prevStr = sortedDays[i-1];
        const reasonStr = leaveReasons[dStr] || '';
        
        const d = new Date(dStr);
        const prev = new Date(prevStr);
        const diffDays = Math.round((d.getTime() - prev.getTime()) / (1000 * 3600 * 24));
        
        if (diffDays === 1 && reasonStr === currentGroup.reason) {
            currentGroup.endDate = dStr;
            currentGroup.dates.push(dStr);
        } else {
            groups.push(currentGroup);
            currentGroup = { startDate: dStr, endDate: dStr, reason: reasonStr, dates: [dStr] };
        }
    }
    groups.push(currentGroup);
  }
  
  // order groups by start date descending
  groups.sort((a, b) => b.startDate.localeCompare(a.startDate));

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div 
        className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">วางแผนวันหยุด (ลาล่วงหน้า)</h2>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {!showForm ? (
            <button 
              onClick={() => setShowForm(true)}
              className="w-full flex justify-center items-center gap-2 px-4 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 dark:text-indigo-400 rounded-2xl transition-colors font-semibold border border-indigo-100 dark:border-indigo-800/30 mb-6"
            >
              + เพิ่มการลาล่วงหน้า
            </button>
          ) : (
            <form onSubmit={handleAddLeave} className="mb-8 bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-700">
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">วันที่เริ่มต้น</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        if (endDate && new Date(e.target.value) > new Date(endDate)) {
                          setEndDate('');
                        }
                      }}
                      className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all dark:text-white"
                      style={{ colorScheme: 'light dark' }}
                      required
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">ถึงวันที่ (ไม่บังคับ)</label>
                    <input
                      type="date"
                      value={endDate}
                      min={startDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all dark:text-white"
                      style={{ colorScheme: 'light dark' }}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">เหตุผล (ไม่บังคับ)</label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="เช่น ไปเที่ยว, ธุระส่วนตัว, พักผ่อน..."
                    className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all dark:text-white"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setShowForm(false)} 
                    className="flex-1 py-3 px-4 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    ยกเลิก
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium shadow-md shadow-indigo-200 dark:shadow-none transition-all active:scale-95"
                  >
                    บันทึกการลา
                  </button>
                </div>
              </div>
            </form>
          )}

          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              การลาที่บันทึกไว้ ({leaveDaysList.length})
            </h3>
            
            {leaveDaysList.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                ยังไม่มีการบันทึกวันลา
              </div>
            ) : (
              <div className="space-y-3">
                {groups.map((group, index) => {
                  const startObj = new Date(group.startDate);
                  const endObj = new Date(group.endDate);
                  const isSameDay = group.startDate === group.endDate;
                  
                  const startStr = startObj.toLocaleDateString('th-TH', { 
                    day: 'numeric', 
                    month: 'short', 
                    year: 'numeric' 
                  });
                  const endStr = endObj.toLocaleDateString('th-TH', { 
                    day: 'numeric', 
                    month: 'short', 
                    year: 'numeric' 
                  });
                  
                  const displayDate = isSameDay ? startStr : `${startStr} - ${endStr}`;
                  
                  return (
                    <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-sm gap-3 group">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400 flex flex-col items-center justify-center flex-shrink-0 font-bold border border-amber-100 dark:border-amber-800/30">
                          <span className="text-sm leading-none pt-1">{startObj.getDate()}</span>
                          <span className="text-[9px] leading-none pb-1 uppercase">{startObj.toLocaleString('default', { month: 'short' })}</span>
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                            {displayDate} <span className="text-xs font-normal text-slate-400 ml-1">({group.dates.length} วัน)</span>
                          </div>
                          {group.reason && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium bg-slate-50 dark:bg-slate-900/50 px-2 py-0.5 rounded-lg inline-flex">
                              <MessageSquare className="w-3 h-3" />
                              {group.reason}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-auto sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleEditGroup(group.dates, group.startDate, group.endDate, group.reason)}
                          className="px-3 py-1.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 rounded-lg text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                        >
                          แก้ไข
                        </button>
                        <button 
                          onClick={() => handleRemoveLeaveGroup(group.dates)}
                          className="px-3 py-1.5 bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400 rounded-lg text-xs font-semibold hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors"
                        >
                          ลบ
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
