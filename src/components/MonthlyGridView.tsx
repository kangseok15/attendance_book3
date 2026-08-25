/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Student, 
  SessionType, 
  DayConfig, 
  AttendanceStatus, 
  AttendanceRecord,
  UserRole,
  STATUS_CYCLE, 
  STATUS_ICONS, 
  STATUS_LABELS
} from '../types/attendance';
import { 
  getRecordKey,
  isStudentExcluded,
  calculateStudentMonthlyStats,
  isPastDate,
  getTodayDateStr,
  isStudentAttendanceLocked
} from '../utils/attendanceHelpers';
import { Search, Printer, RotateCcw } from 'lucide-react';

interface MonthlyGridViewProps {
  students: Student[];
  session: SessionType;
  year: number;
  month: number;
  activeDays: DayConfig[];
  records: Record<string, AttendanceRecord>;
  onUpdateRecord: (studentId: string, dateStr: string, status: AttendanceStatus, reason?: string) => void;
  onBatchUpdateDay: (dateStr: string, status: AttendanceStatus, gradeFilter?: number) => void;
  onFillDayAbsent: (dateStr: string, gradeFilter?: number) => void;
  onUpdateStudents: (students: Student[]) => void;
  onSessionChange: (session: SessionType) => void;
  onClearDate?: (dateStr: string, gradeFilter?: number, targetSession?: SessionType | 'both') => void;
  onOpenClearModal?: () => void;
  userRole?: UserRole;
  lockPastDates?: boolean;
  onToggleLockPastDates?: () => void;
}

export const MonthlyGridView: React.FC<MonthlyGridViewProps> = ({
  students,
  session,
  activeDays,
  records,
  onUpdateRecord,
  onOpenClearModal,
  userRole = 'teacher',
  lockPastDates = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [gradeFilter, setGradeFilter] = useState<number | 'all'>('all');
  const todayStr = getTodayDateStr();

  const handleCellClick = (student: Student, dateStr: string) => {
    if (userRole === 'teacher') return;
    if (userRole === 'student') {
      const lockCheck = isStudentAttendanceLocked(session, dateStr);
      if (lockCheck.isLocked) return;
    }
    if (lockPastDates && isPastDate(dateStr, todayStr)) return;

    const key = getRecordKey(student.id, session, dateStr);
    const currentStatus = records[key]?.status || 'NONE';
    const currentIndex = STATUS_CYCLE.indexOf(currentStatus);
    const nextStatus = STATUS_CYCLE[(currentIndex + 1) % STATUS_CYCLE.length];
    onUpdateRecord(student.id, dateStr, nextStatus);
  };

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${student.grade}${student.classNum}${student.studentNum}`.includes(searchTerm);
    const matchesGrade = gradeFilter === 'all' || student.grade === gradeFilter;
    return matchesSearch && matchesGrade && student.active;
  });

  const grades = gradeFilter === 'all' ? [3, 2, 1] : [gradeFilter];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setGradeFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              gradeFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200'
            }`}
          >
            전체 학년
          </button>
          {[3, 2, 1].map(g => (
            <button
              key={g}
              onClick={() => setGradeFilter(g)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                gradeFilter === g ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {g}학년
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="학생 이름 / 번호 검색..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs border-none focus:ring-2 focus:ring-indigo-500 w-48 text-slate-800 dark:text-slate-100"
            />
          </div>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-200 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            인쇄
          </button>

          {userRole === 'admin' && onOpenClearModal && (
            <button
              onClick={onOpenClearModal}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 dark:bg-rose-950/30 text-rose-600 rounded-lg text-xs font-semibold hover:bg-rose-100 transition-colors border border-rose-200 dark:border-rose-900/50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              출결 비우기
            </button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-500 font-semibold">
                <th className="py-2.5 px-2 w-10">연번</th>
                <th className="py-2.5 px-2 w-10">학년</th>
                <th className="py-2.5 px-2 w-10">반</th>
                <th className="py-2.5 px-2 w-10">번호</th>
                <th className="py-2.5 px-3 w-20">이름</th>
                {activeDays.map(day => (
                  <th key={day.dateStr} className="py-2 px-1 min-w-[34px] border-l border-slate-100 dark:border-slate-800">
                    <div className="font-bold">{day.dayNum}</div>
                    <div className="text-3xs opacity-75">{day.dayOfWeek}</div>
                  </th>
                ))}
                <th className="py-2.5 px-2 w-12 text-emerald-600 border-l border-slate-200">출석</th>
                <th className="py-2.5 px-2 w-12 text-rose-600">결석</th>
                <th className="py-2.5 px-2 w-14 text-indigo-600">출석률</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {grades.map(grade => {
                const gradeStudents = filteredStudents.filter(s => s.grade === grade);
                if (gradeStudents.length === 0) return null;

                return (
                  <React.Fragment key={grade}>
                    {gradeStudents.map((student, idx) => {
                      const stats = calculateStudentMonthlyStats(student, session, activeDays, records);
                      return (
                        <tr key={student.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="py-2 px-1 text-slate-400 font-mono text-3xs">{idx + 1}</td>
                          <td className="py-2 px-1 font-semibold">{student.grade}</td>
                          <td className="py-2 px-1">{student.classNum}</td>
                          <td className="py-2 px-1">{student.studentNum}</td>
                          <td className="py-2 px-2 font-bold text-slate-900 dark:text-white text-left whitespace-nowrap">{student.name}</td>
                          
                          {activeDays.map(day => {
                            const key = getRecordKey(student.id, session, day.dateStr);
                            const rec = records[key];
                            const status = rec?.status || 'NONE';
                            const isExcluded = isStudentExcluded(student, session, day.dateStr);
                            const isLocked = (userRole === 'student' && isStudentAttendanceLocked(session, day.dateStr).isLocked) ||
                                             (lockPastDates && isPastDate(day.dateStr, todayStr));

                            return (
                              <td 
                                key={day.dateStr}
                                onClick={() => !isLocked && handleCellClick(student, day.dateStr)}
                                className={`py-1.5 px-1 border-l border-slate-100 dark:border-slate-800 text-center select-none ${
                                  isExcluded ? 'bg-slate-100/60 dark:bg-slate-800/40 text-slate-400' :
                                  isLocked ? 'cursor-not-allowed opacity-80' : 'cursor-pointer hover:bg-indigo-50/50'
                                }`}
                              >
                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded font-bold ${
                                  status === 'PRESENT' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40' :
                                  status === 'LATE' ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/40' :
                                  status === 'EARLY_LEAVE' ? 'text-purple-600 bg-purple-50 dark:bg-purple-950/40' :
                                  status === 'OFFICIAL_ABSENT' ? 'text-blue-600 bg-blue-50 dark:bg-blue-950/40' :
                                  status === 'ABSENT' ? 'text-rose-600 bg-rose-50 dark:bg-rose-950/40' : ''
                                }`}>
                                  {STATUS_ICONS[status]}
                                </span>
                              </td>
                            );
                          })}

                          <td className="py-2 px-1 font-bold text-emerald-600 border-l border-slate-200">{stats.attendedDays}</td>
                          <td className="py-2 px-1 font-bold text-rose-600">{stats.absentCount}</td>
                          <td className="py-2 px-1 font-bold text-indigo-600">{stats.rate}%</td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
