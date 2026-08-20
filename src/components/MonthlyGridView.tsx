import React, { useState } from 'react';
import { 
  Student, 
  SessionType, 
  DayConfig, 
  AttendanceStatus, 
  AttendanceRecord 
} from '../types/attendance';
import { 
  STATUS_META, 
  NEXT_STATUS_CYCLE, 
  getNextAttendanceStatus,
  getRecordKey,
  isStudentExcludedOnDate,
  isStudentExcluded,
  getStudentAcademyDays,
  calculateStudentMonthStats,
  getGradeOrder,
  WEEKDAYS,
  sortStudents,
  isPastDate,
  getTodayDateStr,
  isStudentAttendanceLocked
} from '../utils/attendanceHelpers';
import { 
  Search, 
  Printer, 
  MessageSquare,
  AlertCircle,
  X,
  Check,
  Eraser,
  Lock,
  Unlock
} from 'lucide-react';
import { PrintAttendanceModal } from './PrintAttendanceModal';

interface MonthlyGridViewProps {
  students: Student[];
  session: SessionType;
  year: number;
  month: number;
  activeDays: DayConfig[];
  records: Record<string, AttendanceRecord>;
  onUpdateRecord: (studentId: string, dateStr: string, status: AttendanceStatus, reason?: string, checkInTime?: string) => void;
  onBatchUpdateDay: (dateStr: string, status: AttendanceStatus, gradeFilter?: number) => void;
  onFillDayAbsent: (dateStr: string, gradeFilter?: number) => void;
  onUpdateStudents?: (students: Student[]) => void;
  onSessionChange?: (session: SessionType) => void;
  onClearDate?: (dateStr: string, gradeFilter?: number, targetSession?: SessionType | 'both') => void;
  onOpenClearModal?: () => void;
  userRole?: import('../types/attendance').UserRole;
  lockPastDates?: boolean;
  onToggleLockPastDates?: () => void;
  todayDateStr?: string;
}

export const MonthlyGridView: React.FC<MonthlyGridViewProps> = ({
  students,
  session,
  month,
  year,
  activeDays,
  records,
  onUpdateRecord,
  onBatchUpdateDay,
  onFillDayAbsent,
  onUpdateStudents,
  onSessionChange,
  onClearDate,
  onOpenClearModal,
  userRole = 'admin',
  lockPastDates = true,
  onToggleLockPastDates,
  todayDateStr,
}) => {
  const [selectedGrade, setSelectedGrade] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [roleWarning, setRoleWarning] = useState<string>('');
  const [editingCell, setEditingCell] = useState<{
    studentId: string;
    studentName: string;
    dateStr: string;
    dayNum: number;
    currentStatus: AttendanceStatus;
    currentReason?: string;
    currentCheckInTime?: string;
  } | null>(null);

  const sessionLabel = session === 'morning' ? '아침' : '야간';

  const showTeacherWarning = () => {
    setRoleWarning('담임 교사 모드는 조회 전용입니다. 출결 입력 및 수정은 불가합니다.');
    setTimeout(() => setRoleWarning(''), 3000);
  };

  // Toggle student's night self-study day (월, 화, 수, 목, 금) - 관리자만 수정 가능
  const handleToggleAcademyDay = (studentId: string, dayName: string) => {
    if (userRole === 'teacher' || userRole === 'student') {
      setRoleWarning('학원 가는 요일은 관리자(선생님)만 수정할 수 있습니다.');
      setTimeout(() => setRoleWarning(''), 3000);
      return;
    }
    if (!onUpdateStudents) return;
    const updated = students.map(s => {
      if (s.id !== studentId) return s;
      const currentAcademyDays = getStudentAcademyDays(s);
      const nextAcademyDays = currentAcademyDays.includes(dayName)
        ? currentAcademyDays.filter(d => d !== dayName)
        : [...currentAcademyDays, dayName];
      const allWeekdays = ['월', '화', '수', '목', '금'];
      const nextNightDays = allWeekdays.filter(d => !nextAcademyDays.includes(d));
      return {
        ...s,
        academyDays: nextAcademyDays,
        nightDays: nextNightDays,
      };
    });
    onUpdateStudents(updated);
  };

  const gradeOrder = getGradeOrder(month);

  const filteredStudents = React.useMemo(() => {
    const list = students.filter(s => {
      if (!s.active) return false;
      if (selectedGrade !== 'all' && s.grade !== selectedGrade) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = s.name.toLowerCase().includes(q);
        const matchNum = `${s.grade}${s.classNum}${s.studentNum}`.includes(q);
        return matchName || matchNum;
      }
      return true;
    });
    return sortStudents(list, gradeOrder, true);
  }, [students, selectedGrade, searchQuery, gradeOrder]);

  const [cellFeedback, setCellFeedback] = useState<{ studentName: string; dayNum: number; statusText: string; time: string } | null>(null);

  const effectiveToday = todayDateStr || getTodayDateStr();

  const handleCellClick = (student: Student, day: DayConfig) => {
    if (userRole === 'teacher') {
      showTeacherWarning();
      return;
    }
    if (isStudentExcluded(student, session, day.dateStr, day.dayOfWeek)) {
      return;
    }
    if (userRole === 'student') {
      const lockCheck = isStudentAttendanceLocked(session, day.dateStr);
      if (lockCheck.isLocked) {
        setRoleWarning(`🔒 ${lockCheck.lockReason}`);
        setTimeout(() => setRoleWarning(''), 3500);
        return;
      }
    }
    const key = getRecordKey(student.id, session, day.dateStr);
    const curStatus = records[key]?.status || 'NONE';
    const { nextStatus, checkInTime } = getNextAttendanceStatus(curStatus, session);
    
    onUpdateRecord(student.id, day.dateStr, nextStatus, undefined, checkInTime);

    if (nextStatus !== 'NONE') {
      const meta = STATUS_META[nextStatus];
      setCellFeedback({
        studentName: student.name,
        dayNum: day.dayNum,
        statusText: `${meta.symbol} ${meta.label}`,
        time: checkInTime,
      });
      setTimeout(() => setCellFeedback(null), 2500);
    } else {
      setCellFeedback(null);
    }
  };

  const handleCellContextMenu = (e: React.MouseEvent, student: Student, day: DayConfig) => {
    e.preventDefault();
    if (userRole === 'teacher') {
      showTeacherWarning();
      return;
    }
    if (isStudentExcluded(student, session, day.dateStr, day.dayOfWeek)) {
      return;
    }
    if (userRole === 'student') {
      const lockCheck = isStudentAttendanceLocked(session, day.dateStr);
      if (lockCheck.isLocked) {
        setRoleWarning(`🔒 ${lockCheck.lockReason}`);
        setTimeout(() => setRoleWarning(''), 3500);
        return;
      }
    }
    const key = getRecordKey(student.id, session, day.dateStr);
    const curRecord = records[key];
    setEditingCell({
      studentId: student.id,
      studentName: student.name,
      dateStr: day.dateStr,
      dayNum: day.dayNum,
      currentStatus: curRecord?.status || 'NONE',
      currentReason: curRecord?.reason || '',
      currentCheckInTime: curRecord?.checkInTime || '',
    });
  };

  const grades = selectedGrade === 'all' ? gradeOrder : [selectedGrade];

  const defaultStatDay = activeDays.find(d => d.dateStr === effectiveToday) || activeDays[0];
  const [selectedStatDateStr, setSelectedStatDateStr] = useState<string>('');
  const currentStatDay = activeDays.find(d => d.dateStr === (selectedStatDateStr || defaultStatDay?.dateStr)) || defaultStatDay;

  const nightAttendanceStats = React.useMemo(() => {
    if (!currentStatDay) {
      return { g1: 0, g2: 0, g3: 0, total: 0 };
    }
    const targetDateStr = currentStatDay.dateStr;
    const targetDayOfWeek = currentStatDay.dayOfWeek;

    let g1 = 0;
    let g2 = 0;
    let g3 = 0;

    students.forEach(st => {
      if (!st.active) return;
      const isExcluded = isStudentExcluded(st, 'night', targetDateStr, targetDayOfWeek);
      if (isExcluded) return;

      const key = getRecordKey(st.id, 'night', targetDateStr);
      const status = records[key]?.status;

      let score = 0;
      if (status === 'PRESENT' || status === 'LATE' || status === 'EARLY_LEAVE' || status === 'EXCUSED') {
        score = 1;
      }

      if (st.grade === 1) g1 += score;
      else if (st.grade === 2) g2 += score;
      else if (st.grade === 3) g3 += score;
    });

    return { g1, g2, g3, total: g1 + g2 + g3 };
  }, [students, currentStatDay, records]);

  return (
    <div className="space-y-4">
      {cellFeedback && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 dark:bg-slate-100/95 text-white dark:text-slate-900 px-4 py-2.5 rounded-2xl shadow-xl border border-slate-700 dark:border-slate-300 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="w-8 h-8 rounded-xl bg-indigo-500 text-white flex items-center justify-center font-bold text-sm shrink-0">
            🕒
          </div>
          <div>
            <div className="text-xs font-black flex items-center gap-1.5">
              <span>{cellFeedback.studentName}</span>
              <span className="text-[11px] font-normal opacity-80">({cellFeedback.dayNum}일)</span>
              <span className="px-1.5 py-0.2 rounded bg-indigo-600 dark:bg-indigo-700 text-white text-[10px] font-extrabold">
                {cellFeedback.statusText}
              </span>
            </div>
            <p className="text-[11px] font-mono text-indigo-300 dark:text-indigo-700 font-bold mt-0.5">
              체크 시간: {cellFeedback.time}
            </p>
          </div>
        </div>
      )}

      {roleWarning && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{roleWarning}</span>
        </div>
      )}

      {userRole === 'teacher' && (
        <div className="p-2.5 bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/80 rounded-xl text-xs font-semibold text-teal-800 dark:text-teal-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
            <span><strong>담임 교사 모드</strong>: 월간 출석부 및 통계 조회 전용 모드입니다. (출결 입력 및 수정 불가)</span>
          </div>
          <span className="text-[11px] bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300 px-2 py-0.5 rounded-md font-bold">읽기 전용</span>
        </div>
      )}

      {userRole === 'student' && (
        <div className="p-2.5 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-xl text-xs font-semibold text-amber-800 dark:text-amber-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span><strong>학생 모드</strong>: 본인 출결 체크가 가능합니다. (학원 가는 요일 수정은 관리자 선생님께 문의)</span>
          </div>
          <span className="text-[11px] bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-md font-bold">출결 체크</span>
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>숭신고등학교 미래인재반 {month}월 {sessionLabel} 자율학습 출석부</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                총 {filteredStudents.length}명 재적
              </span>
            </h2>

            {onSessionChange && (
              <div className="inline-flex p-0.5 bg-slate-100 dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => onSessionChange('morning')}
                  className={`px-3 py-1 rounded-lg transition-all flex items-center cursor-pointer ${
                    session === 'morning'
                      ? 'bg-amber-500 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  <span>아침</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSessionChange('night')}
                  className={`px-3 py-1 rounded-lg transition-all flex items-center cursor-pointer ${
                    session === 'night'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  <span>야간(야자)</span>
                </button>
              </div>
            )}
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 flex items-center gap-2 flex-wrap">
            <span>셀 클릭 순서: <span className="font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">빈칸</span> → <span className="font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">출석(○)</span> → <span className="font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded">지각(△)</span> → <span className="font-bold text-purple-600 bg-purple-50 dark:bg-purple-950/40 px-1.5 py-0.5 rounded">조퇴(⊘)</span> → <span className="font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded">공결(공)</span> → <span className="font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded">결석(X)</span> → <span className="font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">빈칸</span></span>
            {session === 'morning' ? (
              <span className="text-amber-700 dark:text-amber-300 font-bold bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                💡 아침 자율학습은 수요일 포함 전원 정상 참여입니다. ('학원 가는 요일' 음영 처리는 야간 자율학습에만 적용)
              </span>
            ) : (
              <span className="text-indigo-700 dark:text-indigo-300 font-bold bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
                💡 야간 자율학습은 매주 수요일 미실시(출석부에서 수요일 제외)이며, 학생별 '학원 가는 요일'은 야자 미참여로 진회색 음영 처리됩니다.
              </span>
            )}
          </p>

          <div className="flex flex-wrap items-center gap-2.5 mt-3">
            <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-700/60 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setSelectedGrade('all')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  selectedGrade === 'all'
                    ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                전체 학년
              </button>
              {gradeOrder.map(g => (
                <button
                  key={g}
                  onClick={() => setSelectedGrade(g)}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    selectedGrade === g
                      ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
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
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 w-44"
              />
            </div>

            <button
              type="button"
              onClick={() => setIsPrintModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl border border-slate-200 dark:border-slate-600 transition-colors shadow-2xs cursor-pointer"
              title="출석부 인쇄 및 미리보기"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="font-bold">인쇄</span>
            </button>

            {userRole === 'admin' && onOpenClearModal && (
              <button
                type="button"
                onClick={onOpenClearModal}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-xl border border-rose-200 dark:border-rose-800/80 transition-colors shadow-2xs cursor-pointer"
                title="출결 기록 비우기"
              >
                <Eraser className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                <span className="font-bold">출결 비우기</span>
              </button>
            )}
          </div>
        </div>

        {session === 'night' && currentStatDay && (
          <div className="bg-slate-900 text-white rounded-2xl p-3.5 border border-slate-700 shadow-sm flex flex-col justify-between gap-2.5 shrink-0 self-stretch sm:self-auto sm:min-w-[330px]">
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-extrabold text-slate-100">
                  {currentStatDay.dayNum}일({currentStatDay.dayOfWeek}) 야간 자율학습 참석 현황
                </span>
              </div>
              {activeDays.length > 1 && (
                <select
                  value={currentStatDay.dateStr}
                  onChange={(e) => setSelectedStatDateStr(e.target.value)}
                  className="text-3xs font-bold px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 cursor-pointer focus:outline-hidden hover:border-slate-500"
                >
                  {activeDays.map(d => (
                    <option key={`stat-day-${d.dateStr}`} value={d.dateStr}>
                      {d.dayNum}일({d.dayOfWeek})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-slate-800/90 border border-slate-700/60">
                <span className="text-slate-300 font-medium">1학년 출석인원</span>
                <span className="font-extrabold text-indigo-300 font-mono text-sm">: {nightAttendanceStats.g1}명</span>
              </div>
              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-slate-800/90 border border-slate-700/60">
                <span className="text-slate-300 font-medium">2학년 출석인원</span>
                <span className="font-extrabold text-emerald-300 font-mono text-sm">: {nightAttendanceStats.g2}명</span>
              </div>
              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-slate-800/90 border border-slate-700/60">
                <span className="text-slate-300 font-medium">3학년 출석인원</span>
                <span className="font-extrabold text-purple-300 font-mono text-sm">: {nightAttendanceStats.g3}명</span>
              </div>
              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-indigo-600 text-white border border-indigo-500 font-bold shadow-xs">
                <span className="text-indigo-100 font-bold">전체 출석인원</span>
                <span className="font-black text-white font-mono text-sm">: {nightAttendanceStats.total}명</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 rounded-2xl text-xs text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shadow-2xs">
        <div className="flex items-center gap-3.5 flex-wrap">
          <span className="font-bold text-slate-800 dark:text-slate-200">출결 기호:</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-5 h-5 rounded bg-emerald-100 text-emerald-800 text-center leading-5 text-xs font-black">○</span>
            <span>출석</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-5 h-5 rounded bg-amber-100 text-amber-800 text-center leading-5 text-xs font-black">△</span>
            <span>지각</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-5 h-5 rounded bg-rose-100 text-rose-800 text-center leading-5 text-xs font-black">X</span>
            <span className="font-bold text-rose-600 dark:text-rose-400">결석 (또는 빈칸)</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-5 h-5 rounded bg-purple-100 text-purple-800 text-center leading-5 text-xs font-black">⊘</span>
            <span className="font-bold text-purple-700 dark:text-purple-300">조퇴 (⊘)</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-5 h-5 rounded bg-blue-100 text-blue-800 text-center leading-5 text-xs font-bold">공</span>
            <span>공결</span>
          </span>
          <span className="inline-flex items-center gap-1.5 border-l border-slate-300 dark:border-slate-600 pl-3">
            <span className="w-5 h-5 rounded bg-slate-400 dark:bg-slate-600 border border-slate-500 text-slate-100 text-center leading-5 text-xs font-bold shadow-2xs">/</span>
            <span className="font-bold text-slate-700 dark:text-slate-300">진회색 음영: 미신청 요일/수능후 제외</span>
          </span>
        </div>
        
        {month === 11 && (
          <div className="text-2xs text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            11월 17일 이후는 3학년 출석부에서 모두 제외 처리됩니다.
          </div>
        )}
        {month === 12 && (
          <div className="text-2xs text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            12월은 3학년 수능 후 자율학습 미실시로 1·2학년만 운영됩니다.
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs bg-white dark:bg-slate-900">
        <table className="w-full text-xs border-collapse text-center">
          <thead>
            <tr className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold border-b border-slate-200 dark:border-slate-700">
              <th colSpan={5 + activeDays.length + 4} className="py-3 text-base tracking-wider font-extrabold uppercase">
                숭신고등학교 미래인재반 {month}월 {sessionLabel} 자율학습 출석부
              </th>
            </tr>

            <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700">
              <th className="w-10 py-2 px-1 border-r border-slate-200 dark:border-slate-700">연번</th>
              <th className="w-9 py-2 px-1 border-r border-slate-200 dark:border-slate-700">학년</th>
              <th className="w-9 py-2 px-1 border-r border-slate-200 dark:border-slate-700">반</th>
              <th className="w-10 py-2 px-1 border-r border-slate-200 dark:border-slate-700">번호</th>
              <th className="w-20 py-2 px-2 border-r-2 border-slate-300 dark:border-slate-600 text-left font-bold">이름</th>

              {activeDays.map(day => {
                const studentLock = userRole === 'student' ? isStudentAttendanceLocked(session, day.dateStr) : { isLocked: false };
                const isLockedForStudent = studentLock.isLocked;

                return (
                  <th 
                    key={`h1-${day.dateStr}`}
                    className={`min-w-9 max-w-11 py-1.5 px-0.5 border-r border-slate-200 dark:border-slate-700 select-none ${
                      isLockedForStudent ? 'bg-slate-100/60 dark:bg-slate-800/90' : ''
                    }`}
                    title={
                      isLockedForStudent
                        ? `${day.dateStr} (${day.dayOfWeek}) [🔒 학생 수정 마감]`
                        : userRole === 'admin' 
                          ? `${day.dateStr} (${day.dayOfWeek}) - 클릭 시 미체크 빈칸을 'X'(결석)으로 채웁니다` 
                          : `${day.dateStr} (${day.dayOfWeek})`
                    }
                  >
                    {userRole === 'admin' ? (
                      <button
                        onClick={() => {
                          onFillDayAbsent(day.dateStr, selectedGrade === 'all' ? undefined : Number(selectedGrade));
                        }}
                        className="w-full py-1 rounded-lg font-black transition-colors flex flex-col items-center justify-center hover:bg-rose-100 dark:hover:bg-rose-950/60 text-slate-900 dark:text-slate-100 hover:text-rose-600 cursor-pointer group"
                        title={`${day.dayNum}일: 클릭하면 미체크 빈칸을 'X'(결석)으로 채웁니다`}
                      >
                        <div className="flex items-center justify-center gap-0.5">
                          <span>{day.dayNum}</span>
                        </div>
                        <span className="text-3xs leading-none font-bold text-rose-500 opacity-60 group-hover:opacity-100">
                          X
                        </span>
                      </button>
                    ) : (
                      <div className="w-full py-1 flex flex-col items-center justify-center font-black text-slate-900 dark:text-slate-100">
                        <div className="flex items-center justify-center gap-0.5">
                          <span>{day.dayNum}</span>
                          {isLockedForStudent && <Lock className="w-2.5 h-2.5 text-slate-400 dark:text-slate-500" />}
                        </div>
                      </div>
                    )}
                  </th>
                );
              })}

              <th className="w-10 py-2 px-1 border-l-2 border-slate-300 dark:border-slate-600 border-r border-slate-200 dark:border-slate-700 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 font-bold">출석</th>
              <th className="w-10 py-2 px-1 border-r border-slate-200 dark:border-slate-700 bg-rose-50/70 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 font-bold">결석</th>
              <th className="w-12 py-2 px-1 border-r border-slate-200 dark:border-slate-700 bg-amber-50/70 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 font-bold">출석률</th>
              <th className="min-w-36 py-2 px-2 text-center font-bold">
                <div className="flex flex-col items-center justify-center leading-tight">
                  <span className="text-slate-900 dark:text-slate-100">학원 가는 요일</span>
                  <span className="text-3xs font-medium text-slate-500 dark:text-slate-400">월·화·수·목·금 (체크 시 미참여)</span>
                </div>
              </th>
            </tr>

            <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 font-medium border-b-2 border-slate-300 dark:border-slate-600">
              <th className="py-1 px-1 border-r border-slate-200 dark:border-slate-700"></th>
              <th className="py-1 px-1 border-r border-slate-200 dark:border-slate-700"></th>
              <th className="py-1 px-1 border-r border-slate-200 dark:border-slate-700"></th>
              <th className="py-1 px-1 border-r border-slate-200 dark:border-slate-700"></th>
              <th className="py-1 px-2 border-r-2 border-slate-300 dark:border-slate-600"></th>

              {activeDays.map(day => {
                const isSat = day.dayOfWeek === '토';
                const isSun = day.dayOfWeek === '일';
                return (
                  <th 
                    key={`h2-${day.dateStr}`}
                    className={`py-1 px-0.5 border-r border-slate-200 dark:border-slate-700 text-2xs ${
                      isSun ? 'text-rose-600 font-bold' : isSat ? 'text-blue-600 font-bold' : ''
                    }`}
                  >
                    {day.dayOfWeek}
                  </th>
                );
              })}

              <th className="py-1 px-1 border-l-2 border-slate-300 dark:border-slate-600 border-r border-slate-200 dark:border-slate-700 bg-emerald-50/50 dark:bg-emerald-950/20"></th>
              <th className="py-1 px-1 border-r border-slate-200 dark:border-slate-700 bg-rose-50/50 dark:bg-rose-950/20"></th>
              <th className="py-1 px-1 border-r border-slate-200 dark:border-slate-700 bg-amber-50/50 dark:bg-amber-950/20"></th>
              <th className="py-1 px-2 text-center text-3xs text-rose-500 font-bold">체크 시 음영</th>
            </tr>
          </thead>

          <tbody>
            {grades.map(grade => {
              const gradeStudents = filteredStudents.filter(s => s.grade === grade);
              if (gradeStudents.length === 0) return null;

              const gradeRowBg =
                grade === 3
                  ? 'hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20'
                  : grade === 2
                  ? 'hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20'
                  : 'hover:bg-purple-50/30 dark:hover:bg-purple-950/20';

              return (
                <React.Fragment key={`grade-group-${grade}`}>
                  {gradeStudents.map((student, idx) => {
                    const stats = calculateStudentMonthStats(student, session, activeDays, records);
                    const academyDays = getStudentAcademyDays(student);

                    return (
                      <tr 
                        key={student.id}
                        className={`border-b border-slate-200 dark:border-slate-800 transition-colors ${gradeRowBg}`}
                      >
                        <td className="py-1 px-1 border-r border-slate-200 dark:border-slate-800 text-slate-500 font-mono">
                          {student.seq || idx + 1}
                        </td>
                        <td className="py-1 px-1 border-r border-slate-200 dark:border-slate-800 font-semibold">
                          {student.grade}
                        </td>
                        <td className="py-1 px-1 border-r border-slate-200 dark:border-slate-800">
                          {student.classNum}
                        </td>
                        <td className="py-1 px-1 border-r border-slate-200 dark:border-slate-800 font-mono">
                          {student.studentNum}
                        </td>
                        <td className="py-1 px-2 border-r-2 border-slate-300 dark:border-slate-600 text-center font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {student.name}
                        </td>

                        {activeDays.map(day => {
                          const isExcluded = isStudentExcluded(student, session, day.dateStr, day.dayOfWeek);

                          if (isExcluded) {
                            const isPostNov17 = isStudentExcludedOnDate(student.grade, day.dateStr);
                            const reasonText = isPostNov17 
                              ? '11월 17일 이후 3학년 자습 제외' 
                              : `${day.dayOfWeek}요일 학원 (야자 미참여)`;

                            return (
                              <td
                                key={`${student.id}-${day.dateStr}`}
                                className="py-1 px-0.5 border-r border-slate-300 dark:border-slate-700 bg-slate-300 dark:bg-slate-700 select-none cursor-not-allowed"
                                title={`${student.name} - ${reasonText}`}
                                style={{
                                  backgroundImage: 'repeating-linear-gradient(45deg, rgba(100, 116, 139, 0.22), rgba(100, 116, 139, 0.22) 4px, rgba(148, 163, 184, 0.45) 4px, rgba(148, 163, 184, 0.45) 8px)'
                                }}
                              >
                                <div className="flex items-center justify-center h-6 w-full" />
                              </td>
                            );
                          }

                          const key = getRecordKey(student.id, session, day.dateStr);
                          const rec = records[key];
                          const status = rec?.status || 'NONE';
                          const meta = STATUS_META[status];
                          const studentLock = userRole === 'student' ? isStudentAttendanceLocked(session, day.dateStr) : { isLocked: false };
                          const isCellDisabled = userRole === 'teacher' || (userRole === 'student' && studentLock.isLocked);

                          return (
                            <td
                              key={`${student.id}-${day.dateStr}`}
                              onClick={() => handleCellClick(student, day)}
                              onContextMenu={(e) => handleCellContextMenu(e, student, day)}
                              className={`py-1 px-0.5 border-r border-slate-200 dark:border-slate-800 select-none transition-colors font-bold text-sm ${meta.cellClass} ${
                                isCellDisabled
                                  ? 'cursor-default opacity-90'
                                  : `cursor-pointer ${meta.bgHover}`
                              }`}
                              title={
                                (userRole === 'student' && studentLock.isLocked
                                  ? `[🔒 ${studentLock.lockReason}] `
                                  : '') +
                                `${student.name} (${day.dayNum}일) - ${meta.label || '미체크'}` +
                                (rec?.checkInTime && status !== 'NONE' ? ` [체크 시간: ${rec.checkInTime}]` : '') +
                                (rec?.reason ? ` [사유: ${rec.reason}]` : '') +
                                (isCellDisabled
                                  ? userRole === 'teacher' ? ' (담임 교사 조회 전용)' : ''
                                  : userRole === 'admin'
                                    ? ' (클릭: 상태변경 / 우클릭: 사유 및 시간입력)'
                                    : ' (클릭하여 본인 출결 체크)')
                              }
                            >
                              <div className="relative flex items-center justify-center h-6.5 w-full">
                                <span className="font-black">{meta.symbol}</span>
                                {rec?.reason && (
                                  <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-indigo-500 ring-1 ring-white dark:ring-slate-900" />
                                )}
                              </div>
                            </td>
                          );
                        })}

                        <td className="py-1 px-1 border-l-2 border-slate-300 dark:border-slate-600 border-r border-slate-200 dark:border-slate-800 font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/10">
                          {stats.presentCount}
                        </td>
                        <td className="py-1 px-1 border-r border-slate-200 dark:border-slate-800 font-mono font-bold text-rose-700 dark:text-rose-400 bg-rose-50/30 dark:bg-rose-950/10">
                          {stats.absentCount}
                        </td>
                        <td className="py-1 px-1 border-r border-slate-200 dark:border-slate-800 font-mono font-bold text-slate-800 dark:text-slate-200 bg-amber-50/30 dark:bg-amber-950/10">
                          {stats.rate}
                        </td>

                        {/* Academy Days - 관리자만 클릭 수정 가능 / 교사 및 학생은 클릭 방지 */}
                        <td className="py-1 px-1 text-center select-none whitespace-nowrap">
                          <div className="inline-flex items-center gap-1 justify-center">
                            {WEEKDAYS.map(dayName => {
                              const isAcademy = academyDays.includes(dayName);
                              return (
                                <button
                                  key={dayName}
                                  type="button"
                                  disabled={userRole !== 'admin'}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleAcademyDay(student.id, dayName);
                                  }}
                                  className={`w-5 h-5 rounded text-3xs font-black transition-all flex items-center justify-center border ${
                                    userRole === 'admin' ? 'cursor-pointer' : 'cursor-default opacity-90'
                                  } ${
                                    isAcademy
                                      ? 'bg-rose-600 border-rose-700 text-white shadow-2xs'
                                      : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400'
                                  }`}
                                  title={
                                    userRole !== 'admin'
                                      ? `${student.name}: ${dayName}요일 ${isAcademy ? '학원 (야자 미참여 음영)' : '학원 없음 (정상 야자 참여)'} [수정 불가]`
                                      : `${student.name}: ${dayName}요일 ${isAcademy ? '학원 (클릭 시 해제)' : '학원 없음 (클릭 시 등록)'}`
                                  }
                                >
                                  {dayName}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  <tr className="bg-slate-100/90 dark:bg-slate-800/90 font-bold border-b border-slate-200 dark:border-slate-700 text-2xs text-slate-700 dark:text-slate-300">
                    <td colSpan={5} className="py-1.5 px-2 text-center border-r-2 border-slate-300 dark:border-slate-600">
                      {grade}학년 재적 ({gradeStudents.length}명)
                    </td>
                    {activeDays.map(day => {
                      const activeGradeCount = gradeStudents.filter(st => !isStudentExcluded(st, session, day.dateStr, day.dayOfWeek)).length;
                      return (
                        <td key={`cnt-tot-${grade}-${day.dateStr}`} className="py-1 px-0.5 border-r border-slate-200 dark:border-slate-700 font-mono">
                          {activeGradeCount > 0 ? activeGradeCount : '-'}
                        </td>
                      );
                    })}
                    <td colSpan={4} className="border-l-2 border-slate-300 dark:border-slate-600 bg-slate-200/50 dark:bg-slate-700/50"></td>
                  </tr>

                  <tr className="bg-slate-50 dark:bg-slate-800/50 font-bold border-b-2 border-slate-300 dark:border-slate-600 text-2xs text-indigo-900 dark:text-indigo-200">
                    <td colSpan={5} className="py-1.5 px-2 text-center border-r-2 border-slate-300 dark:border-slate-600 text-indigo-700 dark:text-indigo-300 font-extrabold">
                      {grade}학년 현원(출석)
                    </td>
                    {activeDays.map(day => {
                      let presentCount = 0;
                      let hasEligibleStudents = false;
                      gradeStudents.forEach(st => {
                        if (isStudentExcluded(st, session, day.dateStr, day.dayOfWeek)) return;
                        hasEligibleStudents = true;
                        const k = getRecordKey(st.id, session, day.dateStr);
                        const s = records[k]?.status;
                        if (s === 'PRESENT' || s === 'LATE' || s === 'EARLY_LEAVE' || s === 'EXCUSED') {
                          presentCount += 1;
                        }
                      });
                      return (
                        <td 
                          key={`cnt-pres-${grade}-${day.dateStr}`} 
                          className="py-1 px-0.5 border-r border-slate-200 dark:border-slate-700 font-mono font-bold text-indigo-600 dark:text-indigo-400"
                        >
                          {hasEligibleStudents ? presentCount : '-'}
                        </td>
                      );
                    })}
                    <td colSpan={4} className="border-l-2 border-slate-300 dark:border-slate-600 bg-slate-200/50 dark:bg-slate-700/50"></td>
                  </tr>

                  {grade === 2 && selectedGrade === 'all' && (
                    <tr className="bg-slate-100/70 dark:bg-slate-800/70 font-bold border-b border-slate-200 dark:border-slate-700 text-2xs text-slate-800 dark:text-slate-200">
                      <td colSpan={5} className="py-1.5 px-2 text-center border-r-2 border-slate-300 dark:border-slate-600 font-bold">
                        2,3학년 재적 ({filteredStudents.filter(s => s.grade === 3 || s.grade === 2).length}명)
                      </td>
                      {activeDays.map(day => {
                        let g23Pres = 0;
                        let hasEligible = false;
                        filteredStudents
                          .filter(s => s.grade === 3 || s.grade === 2)
                          .forEach(st => {
                            if (isStudentExcluded(st, session, day.dateStr, day.dayOfWeek)) return;
                            hasEligible = true;
                            const k = getRecordKey(st.id, session, day.dateStr);
                            const s = records[k]?.status;
                            if (s === 'PRESENT' || s === 'LATE' || s === 'EARLY_LEAVE' || s === 'EXCUSED') {
                              g23Pres += 1;
                            }
                          });
                        return (
                          <td 
                            key={`cnt-pres-23-${day.dateStr}`} 
                            className="py-1 px-0.5 border-r border-slate-200 dark:border-slate-700 font-mono font-bold text-slate-700 dark:text-slate-300"
                          >
                            {hasEligible ? g23Pres : '-'}
                          </td>
                        );
                      })}
                      <td colSpan={4} className="border-l-2 border-slate-300 dark:border-slate-600 bg-slate-200/50 dark:bg-slate-700/50"></td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}

            {selectedGrade === 'all' && (
              <tr className="bg-indigo-50 dark:bg-indigo-950/60 font-extrabold border-t-2 border-indigo-500 text-xs text-indigo-950 dark:text-indigo-100">
                <td colSpan={5} className="py-2.5 px-2 text-center border-r-2 border-slate-300 dark:border-slate-600 font-extrabold">
                  1~3학년 총 재적 및 출석
                </td>
                {activeDays.map(day => {
                  let totalPresent = 0;
                  let activeEnrolled = 0;
                  filteredStudents.forEach(st => {
                    if (isStudentExcluded(st, session, day.dateStr, day.dayOfWeek)) return;
                    activeEnrolled++;
                    const k = getRecordKey(st.id, session, day.dateStr);
                    const s = records[k]?.status;
                    if (s === 'PRESENT' || s === 'LATE' || s === 'EARLY_LEAVE' || s === 'EXCUSED') {
                      totalPresent += 1;
                    }
                  });
                  return (
                    <td key={`tot-${day.dateStr}`} className="py-2 px-0.5 border-r border-slate-200 dark:border-slate-700 font-mono">
                      <div className="leading-tight">
                        <span className="text-emerald-700 dark:text-emerald-300 font-bold">{totalPresent}</span>
                        <span className="text-slate-400 text-3xs block font-normal">/{activeEnrolled}</span>
                      </div>
                    </td>
                  );
                })}
                <td colSpan={4} className="border-l-2 border-slate-300 dark:border-slate-600 text-center text-indigo-800 dark:text-indigo-200 font-bold">
                  전체 현황
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editingCell && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
          onClick={() => setEditingCell(null)}
        >
          <div 
            className="bg-white dark:bg-slate-800 rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-base">
                  {editingCell.studentName} ({editingCell.dayNum}일 {sessionLabel})
                </h3>
                <p className="text-xs text-slate-500 font-mono">{editingCell.dateStr}</p>
              </div>
              <button 
                onClick={() => setEditingCell(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                출결 상태 선택
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['PRESENT', 'LATE', 'ABSENT', 'EARLY_LEAVE', 'EXCUSED', 'NONE'] as AttendanceStatus[]).map(st => {
                  const m = STATUS_META[st];
                  const isSelected = editingCell.currentStatus === st;
                  return (
                    <button
                      key={st}
                      onClick={() => setEditingCell({ ...editingCell, currentStatus: st })}
                      className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl border text-xs font-bold transition-all ${
                        isSelected 
                          ? `${m.badgeClass} ring-2 ring-indigo-500 shadow-xs` 
                          : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span className="font-bold text-sm">{m.symbol || '빈칸'}</span>
                      <span>{st === 'NONE' ? '빈칸' : m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <span className="text-indigo-500 font-mono">🕒</span> 체크 시간 (HH:mm)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const cur = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                    setEditingCell({ ...editingCell, currentCheckInTime: cur });
                  }}
                  className="text-3xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                >
                  현재 시각 자동입력
                </button>
              </label>
              <input
                type="text"
                value={editingCell.currentCheckInTime || ''}
                onChange={e => setEditingCell({ ...editingCell, currentCheckInTime: e.target.value })}
                placeholder="예: 07:40, 17:35"
                className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
                사유 및 특이사항 입력
              </label>
              <input
                type="text"
                value={editingCell.currentReason || ''}
                onChange={e => setEditingCell({ ...editingCell, currentReason: e.target.value })}
                placeholder="예: 병원 진료, 조퇴(학원), 보강, 컨디션 난조..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {['병원 진료', '조퇴 (학원)', '수행평가', '가족 행사', '컨디션 난조', '등교 지각'].map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setEditingCell({ ...editingCell, currentReason: tag })}
                    className="text-3xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 font-medium transition-colors"
                  >
                    +{tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
              <button
                onClick={() => setEditingCell(null)}
                className="px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 font-medium cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={() => {
                  onUpdateRecord(
                    editingCell.studentId,
                    editingCell.dateStr,
                    editingCell.currentStatus,
                    editingCell.currentReason,
                    editingCell.currentCheckInTime
                  );
                  setEditingCell(null);
                }}
                className="px-4 py-2 text-xs rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all shadow-xs cursor-pointer"
              >
                저장 완료
              </button>
            </div>
          </div>
        </div>
      )}

      <PrintAttendanceModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        year={year}
        month={month}
        session={session}
        students={students}
        activeDays={activeDays}
        records={records}
      />
    </div>
  );
};
