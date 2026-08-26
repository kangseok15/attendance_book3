/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Student, 
  SessionType, 
  DayConfig, 
  AttendanceRecord, 
  AttendanceStatus, 
  UserRole 
} from '../types/attendance';
import { 
  getRecordKey, 
  isStudentExcluded 
} from '../utils/attendanceHelpers';
import { 
  Search, 
  Printer, 
  RotateCcw, 
  HelpCircle,
  ChevronDown
} from 'lucide-react';

interface MonthlyGridViewProps {
  students: Student[];
  session: SessionType;
  year: number;
  month: number;
  activeDays: DayConfig[];
  records: Record<string, AttendanceRecord>;
  onUpdateRecord: (studentId: string, dateStr: string, status: AttendanceStatus, reason?: string) => void;
  onFillDayAbsent: (dateStr: string, gradeFilter?: number) => void;
  onUpdateStudents: (students: Student[]) => void;
  onSessionChange: (session: SessionType) => void;
  onOpenClearModal: () => void;
  userRole: UserRole;
}

// 다음 출결 상태 순환 로직
const getNextStatus = (current: AttendanceStatus): AttendanceStatus => {
  switch (current) {
    case 'NONE': return 'PRESENT';
    case 'PRESENT': return 'LATE';
    case 'LATE': return 'EARLY_LEAVE';
    case 'EARLY_LEAVE': return 'OFFICIAL_ABSENT';
    case 'OFFICIAL_ABSENT': return 'ABSENT';
    case 'ABSENT': return 'NONE';
    default: return 'PRESENT';
  }
};

// 출결 상태 뱃지 렌더러
const renderStatusBadge = (status: AttendanceStatus, isExcluded?: boolean) => {
  switch (status) {
    case 'PRESENT':
      return <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-black text-xs">○</span>;
    case 'LATE':
      return <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700 font-black text-xs">△</span>;
    case 'EARLY_LEAVE':
      return <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-purple-700 font-black text-xs">∅</span>;
    case 'OFFICIAL_ABSENT':
      return <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-black text-xs">공</span>;
    case 'ABSENT':
      return <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-rose-100 text-rose-700 font-black text-xs">X</span>;
    default:
      return isExcluded ? (
        <span className="inline-block w-2.5 h-0.5 bg-slate-300 rounded-full" />
      ) : (
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700" />
      );
  }
};

export const MonthlyGridView: React.FC<MonthlyGridViewProps> = ({
  students,
  session,
  month,
  activeDays,
  records,
  onUpdateRecord,
  onOpenClearModal,
  userRole,
}) => {
  const [selectedGrade, setSelectedGrade] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // 기본 선택 날짜
  const [selectedStatDate, setSelectedStatDate] = useState<string>(() => {
    return activeDays.find(d => d.dateStr === '2026-08-26')?.dateStr || activeDays[0]?.dateStr || '2026-08-26';
  });

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      if (!s.active) return false;
      if (selectedGrade !== 'all' && s.grade !== selectedGrade) return false;
      if (searchQuery) {
        const query = searchQuery.trim().toLowerCase();
        const matchName = s.name.toLowerCase().includes(query);
        const matchNum = `${s.grade}${s.classNum}${s.studentNum}`.includes(query);
        return matchName || matchNum;
      }
      return true;
    });
  }, [students, selectedGrade, searchQuery]);

  // 참석 현황 통계 계산 (아침 / 야간 공통 적용)
  const attendanceStats = useMemo(() => {
    const stats = { g1: 0, g2: 0, g3: 0, total: 0 };
    students.forEach(s => {
      if (!s.active) return;
      const key = getRecordKey(s.id, session, selectedStatDate);
      const rec = records[key];
      if (rec?.status === 'PRESENT') {
        if (s.grade === 1) stats.g1++;
        if (s.grade === 2) stats.g2++;
        if (s.grade === 3) stats.g3++;
        stats.total++;
      }
    });
    return stats;
  }, [students, records, session, selectedStatDate]);

  const selectedDayConfig = activeDays.find(d => d.dateStr === selectedStatDate) || activeDays[0];

  const handleCellClick = (student: Student, day: DayConfig) => {
    if (userRole === 'student' || userRole === 'teacher') return;

    const key = getRecordKey(student.id, session, day.dateStr);
    const currentRec = records[key];
    const currentStatus = currentRec?.status || 'NONE';
    const nextStatus = getNextStatus(currentStatus);

    onUpdateRecord(student.id, day.dateStr, nextStatus, currentRec?.reason);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      
      {/* 1. 상단 안내 및 필터 헤더 */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
              숭신고등학교 미래인재반 {month}월 {session === 'morning' ? '아침' : '야간'} 자율학습 출석부
            </h2>
            <span className="px-2.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-full text-3xs font-black">
              총 {students.filter(s => s.active).length}명 재적
            </span>
            <span className={`px-2 py-0.5 rounded-lg text-3xs font-bold ${
              session === 'morning' ? 'bg-amber-500 text-white' : 'bg-indigo-600 text-white'
            }`}>
              {session === 'morning' ? '아침' : '야간(야자)'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {userRole === 'admin' && (
              <button
                onClick={onOpenClearModal}
                className="flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold transition-all shadow-2xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                출결 비우기
              </button>
            )}
          </div>
        </div>

        {/* 범례 안내 */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
          <div className="flex flex-wrap items-center gap-1.5 text-slate-600 dark:text-slate-400 text-3xs">
            <span className="font-semibold text-slate-400">셀 클릭 순서:</span>
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">빈칸</span>
            <span>→</span>
            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">출석(○)</span>
            <span>→</span>
            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-bold border border-amber-200">지각(△)</span>
            <span>→</span>
            <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-bold border border-purple-200">조퇴(∅)</span>
            <span>→</span>
            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold border border-blue-200">공결(공)</span>
            <span>→</span>
            <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-bold border border-rose-200">결석(X)</span>
            <span>→</span>
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600">빈칸</span>
          </div>

          <div className="flex items-center gap-1.5 text-3xs text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-900/50">
            <HelpCircle className="w-3.5 h-3.5 shrink-0" />
            <span>학원 가는 날(음영 셀)에도 필요 시 출결을 자유롭게 클릭하여 체크할 수 있습니다.</span>
          </div>
        </div>

        {/* 학년 필터 및 검색 */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setSelectedGrade('all')}
              className={`px-3 py-1 rounded-lg transition-all ${
                selectedGrade === 'all' ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-2xs' : 'text-slate-500'
              }`}
            >
              전체 학년
            </button>
            {[3, 2, 1].map(g => (
              <button
                key={g}
                onClick={() => setSelectedGrade(g)}
                className={`px-3 py-1 rounded-lg transition-all ${
                  selectedGrade === g ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-2xs' : 'text-slate-500'
                }`}
              >
                {g}학년
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="학생 이름 / 번호 검색..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 w-44"
              />
            </div>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5" />
              인쇄
            </button>
          </div>
        </div>
      </div>

      {/* 2. 참석 현황 위젯 (아침 / 야간 모두 표시) */}
      <div className="bg-[#111827] text-white p-4 rounded-2xl shadow-md border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
            <span className="font-bold text-sm tracking-tight text-slate-100">
              {selectedDayConfig ? `${selectedDayConfig.dayNum}일(${selectedDayConfig.dayOfWeek})` : ''} {session === 'morning' ? '아침' : '야간'} 자율학습 참석 현황
            </span>
          </div>

          <div className="relative inline-block">
            <select
              value={selectedStatDate}
              onChange={e => setSelectedStatDate(e.target.value)}
              className="appearance-none bg-slate-800 text-slate-200 pl-3 pr-8 py-1 rounded-xl text-xs font-bold border border-slate-700 focus:outline-hidden cursor-pointer"
            >
              {activeDays.map(d => (
                <option key={d.dateStr} value={d.dateStr}>
                  {d.dayNum}일({d.dayOfWeek})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs font-bold">
          <div className="bg-slate-800/90 border border-slate-700/80 px-3.5 py-1.5 rounded-xl flex items-center gap-2 text-slate-300">
            <span>1학년 출석인원 :</span>
            <span className="text-emerald-400 font-mono font-black">{attendanceStats.g1}명</span>
          </div>
          <div className="bg-slate-800/90 border border-slate-700/80 px-3.5 py-1.5 rounded-xl flex items-center gap-2 text-slate-300">
            <span>2학년 출석인원 :</span>
            <span className="text-emerald-400 font-mono font-black">{attendanceStats.g2}명</span>
          </div>
          <div className="bg-slate-800/90 border border-slate-700/80 px-3.5 py-1.5 rounded-xl flex items-center gap-2 text-slate-300">
            <span>3학년 출석인원 :</span>
            <span className="text-emerald-400 font-mono font-black">{attendanceStats.g3}명</span>
          </div>
          <div className="bg-indigo-600 px-4 py-1.5 rounded-xl flex items-center gap-2 text-white shadow-sm font-black">
            <span>전체 출석인원 :</span>
            <span className="font-mono text-amber-300">{attendanceStats.total}명</span>
          </div>
        </div>
      </div>

      {/* 3. 메인 월간 테이블 */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-center border-collapse">
            <thead>
              <tr className="bg-slate-50/90 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 font-bold">
                <th className="py-3 px-2 w-10 sticky left-0 bg-slate-50 dark:bg-slate-800 z-10">연번</th>
                <th className="py-3 px-2 w-20 sticky left-10 bg-slate-50 dark:bg-slate-800 z-10">학번</th>
                <th className="py-3 px-3 w-20 sticky left-30 bg-slate-50 dark:bg-slate-800 z-10 border-r border-slate-200 dark:border-slate-700">이름</th>
                
                {activeDays.map(day => (
                  <th key={day.dateStr} className="py-2.5 px-1.5 min-w-[50px] border-r border-slate-100 dark:border-slate-800">
                    <div className="font-mono text-xs">{day.dayNum}</div>
                    <div className={`text-3xs font-semibold ${
                      day.dayOfWeek === '토' ? 'text-blue-500' :
                      day.dayOfWeek === '일' ? 'text-rose-500' : 'text-slate-400'
                    }`}>
                      ({day.dayOfWeek})
                    </div>
                  </th>
                ))}
                
                <th className="py-3 px-3 w-16 bg-slate-100/70 dark:bg-slate-800/90 text-slate-700 font-bold">출석률</th>
              </tr>
            </thead>
            
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredStudents.map((student, idx) => {
                let presentCount = 0;
                let targetDaysCount = 0;

                return (
                  <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2 px-1 font-mono text-slate-400 text-3xs sticky left-0 bg-white dark:bg-slate-900 z-10">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-1 font-mono font-medium text-slate-600 dark:text-slate-400 sticky left-10 bg-white dark:bg-slate-900 z-10">
                      {student.grade}-{student.classNum}-{student.studentNum}
                    </td>
                    <td className="py-2 px-3 font-bold text-slate-900 dark:text-white sticky left-30 bg-white dark:bg-slate-900 z-10 border-r border-slate-200 dark:border-slate-700">
                      {student.name}
                    </td>

                    {activeDays.map(day => {
                      const key = getRecordKey(student.id, session, day.dateStr);
                      const rec = records[key];
                      const status = rec?.status || 'NONE';
                      const isExcluded = isStudentExcluded(student, session, day.dateStr);
                      
                      if (!isExcluded) {
                        targetDaysCount++;
                        if (status === 'PRESENT') presentCount++;
                      }

                      return (
                        <td
                          key={day.dateStr}
                          onClick={() => handleCellClick(student, day)}
                          className={`py-1 px-1 border-r border-slate-100 dark:border-slate-800 transition-colors ${
                            userRole === 'admin' ? 'cursor-pointer hover:bg-indigo-50/50' : 'cursor-default'
                          } ${isExcluded ? 'bg-slate-100/60 dark:bg-slate-800/40' : ''}`}
                        >
                          <div className="flex flex-col items-center justify-center min-h-[30px]">
                            {renderStatusBadge(status, isExcluded)}
                            {rec?.reason && (
                              <span className="text-[9px] text-slate-500 truncate max-w-[42px] block mt-0.5 font-medium" title={rec.reason}>
                                {rec.reason}
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}

                    <td className="py-2 px-2 bg-slate-50/50 dark:bg-slate-800/40 font-mono font-bold text-3xs text-indigo-600 dark:text-indigo-400">
                      {targetDaysCount > 0 ? `${Math.round((presentCount / targetDaysCount) * 100)}%` : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
