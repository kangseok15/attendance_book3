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
  Printer, 
  RotateCcw, 
  HelpCircle, 
  Search, 
  FileText 
} from 'lucide-react';

interface MonthlyGridViewProps {
  students: Student[];
  session: SessionType;
  year: number;
  month: number;
  activeDays: DayConfig[];
  records: Record<string, AttendanceRecord>;
  onUpdateRecord: (studentId: string, dateStr: string, status: AttendanceStatus, reason?: string, checkInTime?: string) => void;
  onFillDayAbsent: (dateStr: string, gradeFilter?: number) => void;
  onUpdateStudents: (students: Student[]) => void;
  onSessionChange: (session: SessionType) => void;
  onOpenClearModal: () => void;
  userRole: UserRole;
}

// 🛡️ [핵심 방어 코드] 어떤 상태 문자열이 들어와도 에러 없이 렌더링되도록 기본 스타일 정의
const DEFAULT_STYLE = { label: '', icon: '', cellClass: 'bg-transparent text-slate-400 hover:bg-slate-100/50' };

const STATUS_STYLE_MAP: Record<string, { label: string; icon: string; cellClass: string }> = {
  PRESENT: { label: '출석', icon: '○', cellClass: 'bg-emerald-500/10 text-emerald-600 font-bold hover:bg-emerald-500/20' },
  LATE: { label: '지각', icon: '△', cellClass: 'bg-amber-500/10 text-amber-600 font-bold hover:bg-amber-500/20' },
  ABSENT: { label: '결석', icon: 'X', cellClass: 'bg-rose-500/10 text-rose-600 font-black hover:bg-rose-500/20' },
  EARLY_LEAVE: { label: '조퇴', icon: '∅', cellClass: 'bg-purple-500/10 text-purple-600 font-bold hover:bg-purple-500/20' },
  OFFICIAL_ABSENT: { label: '공결', icon: '공', cellClass: 'bg-blue-500/10 text-blue-600 font-bold hover:bg-blue-500/20' },
  EXCUSED: { label: '공결', icon: '공', cellClass: 'bg-blue-500/10 text-blue-600 font-bold hover:bg-blue-500/20' },
  NONE: { label: '미체크', icon: '', cellClass: 'bg-transparent text-slate-300 hover:bg-slate-100/50' }
};

const NEXT_STATUS: Record<AttendanceStatus, AttendanceStatus> = {
  NONE: 'PRESENT',
  PRESENT: 'LATE',
  LATE: 'EARLY_LEAVE',
  EARLY_LEAVE: 'OFFICIAL_ABSENT',
  OFFICIAL_ABSENT: 'ABSENT',
  ABSENT: 'NONE'
};

export const MonthlyGridView: React.FC<MonthlyGridViewProps> = ({
  students,
  session,
  month,
  activeDays,
  records,
  onUpdateRecord,
  onFillDayAbsent,
  onOpenClearModal,
  userRole
}) => {
  const [selectedGrade, setSelectedGrade] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // 학년 필터 및 검색 적용
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      if (!s.active) return false;
      if (selectedGrade !== 'all' && s.grade !== selectedGrade) return false;
      if (searchQuery.trim() !== '') {
        const query = searchQuery.trim();
        const matchName = s.name.includes(query);
        const matchNum = `${s.grade}${s.classNum}${s.studentNum}`.includes(query);
        if (!matchName && !matchNum) return false;
      }
      return true;
    });
  }, [students, selectedGrade, searchQuery]);

  // 학년별 그룹화
  const gradeGroups = useMemo(() => {
    const grades = [3, 2, 1];
    return grades.map(g => ({
      grade: g,
      list: filteredStudents.filter(s => s.grade === g)
    })).filter(group => group.list.length > 0);
  }, [filteredStudents]);

  // 셀 클릭 핸들러
  const handleCellClick = (student: Student, dateStr: string) => {
    if (userRole === 'teacher') return;
    const key = getRecordKey(student.id, session, dateStr);
    const currentRec = records[key];
    const currentStatus = (currentRec?.status as AttendanceStatus) || 'NONE';
    const nextStatus = NEXT_STATUS[currentStatus] || 'PRESENT';
    onUpdateRecord(student.id, dateStr, nextStatus, currentRec?.reason, currentRec?.checkInTime);
  };

  return (
    <div className="space-y-4">
      {/* 상단 툴바 */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setSelectedGrade('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${selectedGrade === 'all' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}
            >
              전체 학년
            </button>
            {[3, 2, 1].map(g => (
              <button
                key={g}
                onClick={() => setSelectedGrade(g)}
                className={`px-3 py-1.5 rounded-lg transition-all ${selectedGrade === g ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}
              >
                {g}학년
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="학생 이름 / 번호 검색..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 w-44"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 rounded-xl text-xs font-bold transition-all"
          >
            <Printer className="w-3.5 h-3.5" />
            인쇄
          </button>
          {userRole === 'admin' && (
            <button
              onClick={onOpenClearModal}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 hover:bg-rose-100 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs font-bold transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              출결 비우기
            </button>
          )}
        </div>
      </div>

      {/* 출결 범례 */}
      <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center gap-3 text-3xs font-bold text-slate-600 dark:text-slate-400">
        <span className="text-slate-700 dark:text-slate-300 font-extrabold">출결 기호:</span>
        <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">○</span> 출석</span>
        <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-amber-100 text-amber-700 flex items-center justify-center font-bold">△</span> 지각</span>
        <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-rose-100 text-rose-700 flex items-center justify-center font-black">X</span> 결석</span>
        <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-purple-100 text-purple-700 flex items-center justify-center font-bold">∅</span> 조퇴</span>
        <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-blue-100 text-blue-700 flex items-center justify-center font-bold">공</span> 공결</span>
        <span className="ml-auto text-slate-400 text-3xs font-normal">💡 셀을 클릭하면 출결 상태가 순차적으로 변경됩니다.</span>
      </div>

      {/* 메인 출석부 테이블 */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-center border-collapse">
            <thead>
              <tr className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                <th className="py-2.5 px-2 w-10">연번</th>
                <th className="py-2.5 px-2 w-10">학년</th>
                <th className="py-2.5 px-2 w-10">반</th>
                <th className="py-2.5 px-2 w-10">번호</th>
                <th className="py-2.5 px-3 w-20 text-left">이름</th>
                {activeDays.map(day => (
                  <th key={day.dateStr} className="py-2 px-1 min-w-[36px] border-l border-slate-200 dark:border-slate-700">
                    <div className="font-mono text-3xs font-bold text-slate-800 dark:text-slate-200">{day.dayNum}</div>
                    <div className="text-3xs text-slate-400 font-normal">({day.dayOfWeek})</div>
                    {userRole === 'admin' && (
                      <button
                        onClick={() => onFillDayAbsent(day.dateStr)}
                        title="전체 결석 처리"
                        className="mt-0.5 text-3xs text-rose-500 hover:text-rose-700 font-mono block mx-auto"
                      >
                        X
                      </button>
                    )}
                  </th>
                ))}
                <th className="py-2.5 px-2 w-12 text-emerald-600 border-l border-slate-200 dark:border-slate-700">출석</th>
                <th className="py-2.5 px-2 w-12 text-rose-600 border-l border-slate-200 dark:border-slate-700">결석</th>
                <th className="py-2.5 px-2 w-14 text-indigo-600 border-l border-slate-200 dark:border-slate-700">출석률</th>
                <th className="py-2.5 px-3 text-left border-l border-slate-200 dark:border-slate-700 min-w-[120px]">학원 요일 (야자 제외)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {gradeGroups.map(group => {
                let gradePresentCount = 0;
                let gradeAbsentCount = 0;

                return (
                  <React.Fragment key={group.grade}>
                    {group.list.map((student, idx) => {
                      let presentDays = 0;
                      let absentDays = 0;
                      let totalActiveDays = 0;

                      activeDays.forEach(d => {
                        const isExcluded = isStudentExcluded(student, session, d.dateStr);
                        if (!isExcluded) totalActiveDays++;

                        const recKey = getRecordKey(student.id, session, d.dateStr);
                        const rec = records[recKey];
                        const st = (rec?.status as string) || 'NONE';

                        if (st === 'PRESENT' || st === 'LATE' || st === 'EARLY_LEAVE' || st === 'OFFICIAL_ABSENT' || st === 'EXCUSED') {
                          presentDays++;
                        } else if (st === 'ABSENT') {
                          absentDays++;
                        }
                      });

                      gradePresentCount += presentDays;
                      gradeAbsentCount += absentDays;
                      const attendanceRate = totalActiveDays > 0 ? Math.round((presentDays / totalActiveDays) * 100) : 0;

                      return (
                        <tr key={student.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-2 px-1 font-mono text-slate-400 text-3xs">{idx + 1}</td>
                          <td className="py-2 px-1 font-mono text-3xs">{student.grade}</td>
                          <td className="py-2 px-1 font-mono text-3xs">{student.classNum}</td>
                          <td className="py-2 px-1 font-mono text-3xs">{student.studentNum}</td>
                          <td className="py-2 px-3 font-bold text-left text-slate-900 dark:text-slate-100">{student.name}</td>

                          {activeDays.map(day => {
                            const isExcluded = isStudentExcluded(student, session, day.dateStr);
                            const recKey = getRecordKey(student.id, session, day.dateStr);
                            const rec = records[recKey];
                            const statusKey = (rec?.status as string) || 'NONE';
                            
                            // 🛡️ 방어 로직 적용 (undefined 방지)
                            const config = STATUS_STYLE_MAP[statusKey] || DEFAULT_STYLE;

                            return (
                              <td 
                                key={day.dateStr}
                                onClick={() => handleCellClick(student, day.dateStr)}
                                className={`py-1.5 px-0.5 border-l border-slate-100 dark:border-slate-800 cursor-pointer select-none transition-all ${
                                  isExcluded ? 'bg-slate-100/60 dark:bg-slate-800/60 opacity-60' : config.cellClass
                                }`}
                                title={rec?.reason ? `사유: ${rec.reason}` : undefined}
                              >
                                <span className="font-bold text-xs inline-block">
                                  {isExcluded ? '학원' : config.icon}
                                </span>
                              </td>
                            );
                          })}

                          <td className="py-2 px-1 font-mono font-bold text-emerald-600 border-l border-slate-100 dark:border-slate-800">{presentDays}</td>
                          <td className="py-2 px-1 font-mono font-bold text-rose-600 border-l border-slate-100 dark:border-slate-800">{absentDays}</td>
                          <td className="py-2 px-1 font-mono font-extrabold text-indigo-600 border-l border-slate-100 dark:border-slate-800">
                            {totalActiveDays > 0 ? `${attendanceRate}%` : '-'}
                          </td>
                          <td className="py-2 px-3 text-left border-l border-slate-100 dark:border-slate-800">
                            <div className="flex gap-1">
                              {['월', '화', '수', '목', '금'].map(d => {
                                const isAca = student.academyDays?.includes(d);
                                return (
                                  <span
                                    key={d}
                                    className={`w-4 h-4 rounded text-3xs flex items-center justify-center font-bold ${
                                      isAca ? 'bg-rose-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                                    }`}
                                  >
                                    {d}
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {/* 학년별 소계 */}
                    <tr className="bg-indigo-50/30 dark:bg-indigo-950/20 font-bold text-3xs text-indigo-900 dark:text-indigo-300 border-t border-b border-indigo-100 dark:border-indigo-900/40">
                      <td colSpan={5} className="py-2 px-3 text-left">
                        {group.grade}학년 소계 ({group.list.length}명)
                      </td>
                      {activeDays.map(day => {
                        let dayCount = 0;
                        group.list.forEach(s => {
                          const k = getRecordKey(s.id, session, day.dateStr);
                          const st = (records[k]?.status as string) || 'NONE';
                          if (st === 'PRESENT' || st === 'LATE' || st === 'EARLY_LEAVE' || st === 'OFFICIAL_ABSENT' || st === 'EXCUSED') {
                            dayCount++;
                          }
                        });
                        return (
                          <td key={day.dateStr} className="py-2 font-mono text-center border-l border-indigo-100 dark:border-indigo-900/40">
                            {dayCount}
                          </td>
                        );
                      })}
                      <td className="py-2 font-mono text-center border-l border-indigo-100 dark:border-indigo-900/40">{gradePresentCount}</td>
                      <td className="py-2 font-mono text-center border-l border-indigo-100 dark:border-indigo-900/40">{gradeAbsentCount}</td>
                      <td colSpan={2} className="border-l border-indigo-100 dark:border-indigo-900/40"></td>
                    </tr>
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

export default MonthlyGridView;
