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
  DayOfWeek
} from '../types/attendance';
import { 
  getRecordKey,
  isStudentExcluded,
  isPastDate,
  getTodayDateStr,
  isStudentAttendanceLocked
} from '../utils/attendanceHelpers';
import { Search, Printer, RotateCcw, Lightbulb } from 'lucide-react';

const STATUS_CYCLE: AttendanceStatus[] = ['PRESENT', 'LATE', 'EARLY_LEAVE', 'OFFICIAL_ABSENT', 'ABSENT', 'NONE'];

const STATUS_ICONS: Record<AttendanceStatus, string> = {
  PRESENT: '○',
  LATE: '△',
  EARLY_LEAVE: '∅',
  OFFICIAL_ABSENT: '공',
  ABSENT: 'X',
  NONE: ''
};

const WEEKDAYS: DayOfWeek[] = ['월', '화', '수', '목', '금'];

export const MonthlyGridView: React.FC<any> = (props) => {
  const {
    students = [],
    session = 'morning',
    year = 2026,
    month = 8,
    activeDays = [],
    records = {},
    onUpdateRecord,
    onFillDayAbsent,
    onUpdateStudents,
    onOpenClearModal,
    onSessionChange,
    userRole = 'teacher',
    lockPastDates = false,
  } = props;

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
    if (onUpdateRecord) {
      onUpdateRecord(student.id, dateStr, nextStatus);
    }
  };

  const handleToggleAcademyDay = (student: Student, day: DayOfWeek) => {
    if (userRole === 'teacher' || userRole === 'student') return;
    const currentDays = student.academyDays || [];
    const nextDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day];

    const nextStudents = (students as Student[]).map(s =>
      s.id === student.id ? { ...s, academyDays: nextDays } : s
    );
    if (onUpdateStudents) {
      onUpdateStudents(nextStudents);
    }
  };

  const filteredStudents = (students as Student[]).filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${student.grade}${student.classNum}${student.studentNum}`.includes(searchTerm);
    const matchesGrade = gradeFilter === 'all' || student.grade === gradeFilter;
    return matchesSearch && matchesGrade && student.active;
  });

  const grades = gradeFilter === 'all' ? [3, 2, 1] : [gradeFilter];

  const getStudentStats = (student: Student) => {
    let eligibleDays = 0;
    let present = 0;
    let late = 0;
    let early = 0;
    let official = 0;
    let absent = 0;

    (activeDays as DayConfig[]).forEach(day => {
      if (!isStudentExcluded(student, session, day.dateStr)) {
        eligibleDays += 1;
        const key = getRecordKey(student.id, session, day.dateStr);
        const status = records[key]?.status;
        if (status === 'PRESENT') present += 1;
        else if (status === 'LATE') late += 1;
        else if (status === 'EARLY_LEAVE') early += 1;
        else if (status === 'OFFICIAL_ABSENT') official += 1;
        else if (status === 'ABSENT') absent += 1;
      }
    });

    const attendedDays = present + late + early + official;
    const effectivePresent = present + (late * 0.7) + (early * 0.7) + official;
    const rate = eligibleDays > 0 ? Math.min(100, Math.round((effectivePresent / eligibleDays) * 100)) : 0;

    return {
      attendedDays: Math.min(attendedDays, eligibleDays),
      absentCount: absent,
      rate
    };
  };

  return (
    <div className="space-y-4">
      {/* 1. 상단 타이틀 및 안내 박스 */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              숭신고등학교 미래인재반 {month}월 {session === 'morning' ? '아침 자율학습' : '야간 자율학습'} 출석부
            </h2>
            <span className="text-3xs bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 px-2 py-0.5 rounded-full font-bold">
              총 {filteredStudents.length}명 재적
            </span>
            <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-3xs font-bold">
              <button
                onClick={() => onSessionChange && onSessionChange('morning')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  session === 'morning' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                아침
              </button>
              <button
                onClick={() => onSessionChange && onSessionChange('night')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  session === 'night' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                야간(야자)
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-3xs">
          <div className="bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
            <span className="font-bold mr-1">셀 클릭 순서:</span>
            <span>빈칸 → </span>
            <span className="text-emerald-600 font-bold">출석(○)</span> → 
            <span className="text-amber-600 font-bold"> 지각(△)</span> → 
            <span className="text-purple-600 font-bold"> 조퇴(∅)</span> → 
            <span className="text-blue-600 font-bold"> 공결(공)</span> → 
            <span className="text-rose-600 font-bold"> 결석(X)</span> → 빈칸
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-300 px-2.5 py-1 rounded-md flex items-center gap-1 font-medium">
            <Lightbulb className="w-3 h-3 text-amber-500 shrink-0" />
            <span>학원 가는 날(음영 셀)에도 필요 시 출결을 자유롭게 클릭하여 체크할 수 있습니다.</span>
          </div>
        </div>

        {/* 필터 및 검색 바 */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setGradeFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                gradeFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200'
              }`}
            >
              전체 학년
            </button>
            {[3, 2, 1].map(g => (
              <button
                key={g}
                onClick={() => setGradeFilter(g)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  gradeFilter === g ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {g}학년
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="학생 이름 / 번호 검색..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 pr-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs border-none focus:ring-2 focus:ring-indigo-500 w-44 text-slate-800 dark:text-slate-100"
              />
            </div>

            <button
              onClick={() => window.print()}
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-200 transition-colors"
            >
              <Printer className="w-3 h-3" />
              인쇄
            </button>

            {userRole === 'admin' && onOpenClearModal && (
              <button
                onClick={onOpenClearModal}
                className="flex items-center gap-1 px-2.5 py-1 bg-rose-50 dark:bg-rose-950/30 text-rose-600 rounded-lg text-xs font-semibold hover:bg-rose-100 transition-colors border border-rose-200 dark:border-rose-900/50"
              >
                <RotateCcw className="w-3 h-3" />
                출결 비우기
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. 출결 기호 범례 바 */}
      <div className="bg-white dark:bg-slate-900 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center gap-3 text-3xs font-medium text-slate-600 dark:text-slate-300">
        <span className="font-bold text-slate-800 dark:text-slate-200">출결 기호:</span>
        <span className="inline-flex items-center gap-1"><span className="w-4 h-4 rounded bg-emerald-50 text-emerald-600 font-bold flex items-center justify-center border border-emerald-200">○</span> 출석</span>
        <span className="inline-flex items-center gap-1"><span className="w-4 h-4 rounded bg-amber-50 text-amber-600 font-bold flex items-center justify-center border border-amber-200">△</span> 지각</span>
        <span className="inline-flex items-center gap-1"><span className="w-4 h-4 rounded bg-rose-50 text-rose-600 font-bold flex items-center justify-center border border-rose-200">X</span> 결석 (또는 빈칸)</span>
        <span className="inline-flex items-center gap-1"><span className="w-4 h-4 rounded bg-purple-50 text-purple-600 font-bold flex items-center justify-center border border-purple-200">∅</span> 조퇴 (∅)</span>
        <span className="inline-flex items-center gap-1"><span className="w-4 h-4 rounded bg-blue-50 text-blue-600 font-bold flex items-center justify-center border border-blue-200">공</span> 공결</span>
        <span className="inline-flex items-center gap-1 ml-auto text-slate-400">
          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold border border-slate-300">학원</span> 음영 셀: 학원/미참여일 (클릭 시 정상 출결 입력 가능)
        </span>
      </div>

      {/* 3. 메인 출석부 테이블 */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-500 font-semibold">
                <th className="py-2.5 px-2 w-10">연번</th>
                <th className="py-2.5 px-2 w-10">학년</th>
                <th className="py-2.5 px-2 w-10">반</th>
                <th className="py-2.5 px-2 w-10">번호</th>
                <th className="py-2.5 px-3 w-20 text-left">이름</th>

                {/* 날짜 헤더 + 전체 결석 일괄 처리(X 버튼) */}
                {(activeDays as DayConfig[]).map(day => (
                  <th key={day.dateStr} className="py-2 px-1 min-w-[34px] border-l border-slate-100 dark:border-slate-800">
                    <div className="font-bold text-slate-800 dark:text-slate-200">{day.dayNum}</div>
                    <button
                      type="button"
                      title={`${day.dayNum}일 미체크 학생 전체 결석(X) 처리`}
                      onClick={() => onFillDayAbsent && onFillDayAbsent(day.dateStr, gradeFilter === 'all' ? undefined : gradeFilter)}
                      className="inline-block text-3xs font-black text-rose-500 hover:text-rose-700 cursor-pointer transition-transform hover:scale-125 select-none"
                    >
                      ✕
                    </button>
                    <div className="text-3xs text-slate-400 font-normal">{day.dayOfWeek}</div>
                  </th>
                ))}

                <th className="py-2.5 px-2 w-12 text-emerald-600 border-l border-slate-200">출석</th>
                <th className="py-2.5 px-2 w-12 text-rose-600">결석</th>
                <th className="py-2.5 px-2 w-14 text-indigo-600">출석률</th>
                <th className="py-2.5 px-3 border-l border-slate-200 text-slate-600 font-bold">
                  <div>학원 가는 요일</div>
                  <div className="text-3xs font-normal text-rose-500">월·화·수·목·금 (체크 시 미참여)</div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {grades.map(grade => {
                const gradeStudents = filteredStudents.filter(s => s.grade === grade);
                if (gradeStudents.length === 0) return null;

                return (
                  <React.Fragment key={grade}>
                    {gradeStudents.map((student, idx) => {
                      const stats = getStudentStats(student);
                      return (
                        <tr key={student.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="py-2 px-1 text-slate-400 font-mono text-3xs">{idx + 1}</td>
                          <td className="py-2 px-1 font-semibold">{student.grade}</td>
                          <td className="py-2 px-1">{student.classNum}</td>
                          <td className="py-2 px-1">{student.studentNum}</td>
                          <td className="py-2 px-3 font-bold text-slate-900 dark:text-white text-left whitespace-nowrap">{student.name}</td>

                          {/* 출결 셀 */}
                          {(activeDays as DayConfig[]).map(day => {
                            const key = getRecordKey(student.id, session as SessionType, day.dateStr);
                            const rec = records[key];
                            const status = rec?.status || 'NONE';
                            const isExcluded = isStudentExcluded(student, session as SessionType, day.dateStr);
                            const isLocked = (userRole === 'student' && isStudentAttendanceLocked(session, day.dateStr).isLocked) ||
                                             (lockPastDates && isPastDate(day.dateStr, todayStr));

                            return (
                              <td 
                                key={day.dateStr}
                                onClick={() => !isLocked && handleCellClick(student, day.dateStr)}
                                className={`py-1.5 px-1 border-l border-slate-100 dark:border-slate-800 text-center select-none ${
                                  isExcluded ? 'bg-slate-100/70 dark:bg-slate-800/50' :
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

                          {/* 통계 열 */}
                          <td className="py-2 px-1 font-bold text-emerald-600 border-l border-slate-200">{stats.attendedDays}</td>
                          <td className="py-2 px-1 font-bold text-rose-600">{stats.absentCount}</td>
                          <td className="py-2 px-1 font-bold text-indigo-600">{stats.rate}%</td>

                          {/* 학원 요일 선택 버튼 열 */}
                          <td className="py-1.5 px-3 border-l border-slate-200 whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              {WEEKDAYS.map(day => {
                                const isSelected = (student.academyDays || []).includes(day);
                                return (
                                  <button
                                    key={day}
                                    type="button"
                                    onClick={() => handleToggleAcademyDay(student, day)}
                                    className={`w-5 h-5 rounded text-3xs font-bold transition-colors ${
                                      isSelected
                                        ? 'bg-rose-600 text-white'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'
                                    }`}
                                  >
                                    {day}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
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
