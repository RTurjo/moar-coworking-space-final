import type { AttendanceLog, Member, UsageStats } from './types';

export const money = (amount: number) => `৳${Number(amount || 0).toLocaleString('en-BD')}`;
export const uid = (prefix = 'id') => `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;
export const todayKey = () => new Date().toISOString().slice(0, 10);
export const currentMonthKey = () => new Date().toISOString().slice(0, 7);
export const monthName = (monthKey: string) => {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
};
export const diffHours = (startIso: string, endIso = new Date().toISOString()) => {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  return Math.max(0, Math.round((ms / 36_000) ) / 100);
};
export const dateLabel = (date: string) => {
  if (!date) return '—';
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};
export const isCurrentWeek = (dateKey: string) => {
  const date = new Date(`${dateKey}T00:00:00`);
  const now = new Date();
  const start = new Date(now);
  const day = start.getDay() || 7;
  start.setDate(start.getDate() - day + 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return date >= start && date < end;
};
export const calculateUsage = (member: Member | undefined, logs: AttendanceLog[], monthKey: string): UsageStats => {
  const memberLogs = logs.filter((log) => log.memberId === member?.id && log.monthKey === monthKey);
  const days = new Set(memberLogs.map((log) => log.dateKey));
  const weekDays = new Set(memberLogs.filter((log) => isCurrentWeek(log.dateKey)).map((log) => log.dateKey));
  const totalHours = memberLogs.reduce((sum, log) => sum + (log.durationHours ?? diffHours(log.checkInAt, log.checkOutAt)), 0);
  const activeLog = logs.find((log) => log.memberId === member?.id && !log.checkOutAt);
  const limitHours = member?.usageLimitHours || 0;
  const limitDays = member?.usageLimitDays || 0;
  return {
    monthKey,
    daysUsed: days.size,
    totalHours: Math.round(totalHours * 10) / 10,
    avgHours: days.size ? Math.round((totalHours / days.size) * 10) / 10 : 0,
    weekDaysUsed: weekDays.size,
    remainingHours: Math.max(0, Math.round((limitHours - totalHours) * 10) / 10),
    remainingDays: Math.max(0, limitDays - days.size),
    activeLog,
  };
};
export const initials = (name?: string) => String(name || 'M').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
export const branchName = (branchId: string, branches: {id: string; name: string}[]) => branches.find((b) => b.id === branchId)?.name || branchId;
