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
  getRecordKey, 
  calculateDayStats,
  isStudentExcludedOnDate,
  isStudentExcluded,
  getGradeOrder,
  sortStudents,
  isPastDate,
  getTodayDateStr,
  isStudentAttendanceLocked
} from '../utils/attendanceHelpers';
import { 
  XCircle, 
  Clock, 
  Sparkles, 
  Send, 
  Search, 
  Calendar,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Ban,
  UserX,
  Eraser,
  Lock,
  Unlock
} from 'lucide-react';

interface DailyCheckinViewProps {
  students: Student[];
  session: SessionType;
  setSession: (s: SessionType) => void;
  activeDays: DayConfig[];
  selectedDateStr: string;
  setSelectedDateStr: (date: string) => void;
  records: Record<string, AttendanceRecord>;
  onUpdateRecord: (studentId: string, dateStr: string, status: AttendanceStatus, reason?: string) => void;
  onBatchUpdateDay: (dateStr: string, status: AttendanceStatus, gradeFilter?: number) => void;
  onFillDayAbsent: (dateStr: string, gradeFilter?: number) => void;
  onOpenParentModal: (absentStudents: { student: Student; status: AttendanceStatus; reason?: string }[]) => void;
  onClearDate?: (dateStr: string, gradeFilter?: number, targetSession?: SessionType | 'both') => void;
  onOpenClearModal?: () => void;
  userRole?: import('../types/attendance').UserRole;
  lockPastDates?: boolean;
  onToggleLockPastDates?: () => void;
  todayDateStr?: string;
}

export const DailyCheckinView: React.FC<DailyCheckinViewProps> = ({
  students,
  session,
  activeDays,
  selectedDateStr,
  setSelectedDateStr,
  records,
  onUpdateRecord,
  onBatchUpdateDay,
  onFillDayAbsent,
  onOpenParentModal,
  onClearDate,
  onOpenClearModal,
  userRole = 'admin',
  lockPastDates = true,
  onToggleLockPastDates,
  todayDateStr,
}) => {
  const [selectedGrade, setSelectedGrade] = useState<number | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingReasonId, setEditingReasonId] = useState<string | null>(null);
  const [tempReason, setTempReason] = useState('');

  // Active day object
  const currentDayConfig = activeDays.find(d => d.dateStr === selectedDateStr) || activeDays[0];
  const currentDate = currentDayConfig ? currentDayConfig.dateStr : selectedDateStr;
  const currentDayName = currentDayConfig?.dayOfWeek;
  const currentMonth = parseInt(currentDate.split('-')[1], 10) || 8;
  const gradeOrder = getGradeOrder(currentMonth);

  const effectiveToday = todayDateStr || getTodayDateStr();
  const studentLock = userRole === 'student' ? isStudentAttendanceLocked(session, currentDate) : { isLocked: false };
  const isLockedForStudent = studentLock.isLocked;

  // Day Stats
  const dayStats = calculateDayStats(students, session, currentDate, records, currentDayName);

  // Filter students
  const filteredStudents = students.filter(st => {
    if (!st.active) return false;
    if (selectedGrade !== 'all' && st.grade !== selectedGrade) return false;

    const isExcluded = isStudentExcluded(st, session, currentDate, currentDayName);
    const key = getRecordKey(st.id, session, currentDate);
    const recStatus = records[key]?.status || 'NONE';

    if (statusFilter === 'EXCLUDED' && !isExcluded) return false;
    if (statusFilter === 'ABSENT' && (isExcluded || recStatus !== 'ABSENT')) return false;
    if (statusFilter === 'LATE' && (isExcluded || recStatus !== 'LATE')) return false;
    if (statusFilter === 'PRESENT' && (isExcluded || recStatus !== 'PRESENT')) return false;
    if (statusFilter === 'EARLY_LEAVE' && (isExcluded || recStatus !== 'EARLY_LEAVE')) return false;
    if (statusFilter === 'EXCUSED' && (isExcluded || recStatus !== 'EXCUSED')) return false;
    if (statusFilter === 'NONE' && (isExcluded || recStatus !== 'NONE')) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return st.name.toLowerCase().includes(q) || `${st.grade}${st.classNum}${st.studentNum}`.includes(q);
    }

    return true;
  });

  // Sort students according to grade order, classNum, studentNum, and name
  const sortedStudents = React.useMemo(() => {
    return sortStudents(filteredStudents, gradeOrder, false);
  }, [filteredStudents, gradeOrder]);

  // Absent & late students for parent notification (excluding already excluded students)
  const absentAndLateList = students
    .filter(st => st.active && !isStudentExcluded(st, session, currentDate, currentDayName))
    .map(st => {
      const key = getRecordKey(st.id, session, currentDate);
      const rec = records[key];
      const status = rec?.status || 'NONE';
      return {
        student: st,
        status: (status === 'NONE' || status === 'ABSENT') ? ('ABSENT' as AttendanceStatus) : status,
        reason: rec?.reason,
      };
    })
    .filter(item => item.status === 'ABSENT' || item.status === 'LATE');

  // Change date helpers
  const curIdx = activeDays.findIndex(d => d.dateStr === currentDate);
  const handlePrevDay = () => {
    if (curIdx > 0) {
      setSelectedDateStr(activeDays[curIdx - 1].dateStr);
    }
  };
  const handleNextDay = () => {
    if (curIdx < activeDays.length - 1) {
      setSelectedDateStr(activeDays[curIdx + 1].dateStr);
    }
  };

  const sessionLabel = session === 'morning' ? '아침' : '야간';

  return (
    <div className="space-y-6">
      
      {/* Bento Grid Top Summary Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        
        {/* Main Bento Hero Card: Live Attendance Rate */}
        <div className="md:col-span-5 bg-indigo-600 rounded-2xl p-6 text-white shadow-xl shadow-indigo-100 dark:shadow-indigo-950 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-indigo-500/30 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-start justify-between">
            <div>
              <div className="text-indigo-100 text-xs font-semibold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                실시간 자율학습 출석률
              </div>
              <div className="text-4xl sm:text-5xl font-black tracking-tight font-mono">
                {dayStats.overallRate}%
              </div>
            </div>

            <div className="bg-indigo-500/40 border border-indigo-400/30 rounded-xl px-3 py-1.5 text-right">
              <div className="text-2xs text-indigo-200 font-medium">운영 세션</div>
              <div className="text-xs font-bold text-white">{sessionLabel}</div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-indigo-500/40 flex items-end justify-between">
            <div className="text-xs text-indigo-100 leading-relaxed">
              자습 대상 <span className="font-bold text-white">{dayStats.totalEnrolled}명</span> 중 <br />
              <span className="font-extrabold text-white text-sm">{dayStats.totalPresent}명</span> 출석 완료 (결석: {dayStats.totalAbsent}명)
            </div>
            
            <div className="px-3 py-1 bg-white/15 backdrop-blur-xs rounded-lg border border-white/20 text-xs font-bold text-white">
              {currentDayConfig ? `${currentDayConfig.dayNum}일 (${currentDayConfig.dayOfWeek})` : currentDate}
            </div>
          </div>
        </div>

        {/* Bento Stat Tile: Absent (Unchecked/Blank + Explicit Absent) */}
        <div className="md:col-span-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs flex flex-col justify-between items-center text-center">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5 text-rose-500" />
            결석 인원 (X)
          </div>
          <div className="my-2">
            <div className="text-4xl font-black text-rose-500 font-mono">
              {String(dayStats.totalAbsent).padStart(2, '0')}
            </div>
            <div className="text-2xs text-slate-400 mt-1">미입실자 확인</div>
          </div>
          <div className="w-full text-3xs font-semibold py-1 px-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300">
            {dayStats.totalAbsent > 0 ? `${dayStats.totalAbsent}명 결석` : '결석자 없음'}
          </div>
        </div>

        {/* Bento Stat Tile: Late */}
        <div className="md:col-span-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs flex flex-col justify-between items-center text-center">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            지각 인원 (△)
          </div>
          <div className="my-2">
            <div className="text-4xl font-black text-amber-500 font-mono">
              {String(dayStats.totalLate).padStart(2, '0')}
            </div>
            <div className="text-2xs text-slate-400 mt-1">지각 입실 기록</div>
          </div>
          <div className="w-full text-3xs font-semibold py-1 px-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">
            {dayStats.totalLate > 0 ? `${dayStats.totalLate}명 지각` : '지각자 없음'}
          </div>
        </div>

        {/* Bento Quick Actions & Notice Tile */}
        <div className="md:col-span-3 bg-slate-900 dark:bg-slate-800 rounded-2xl p-5 text-white shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                {userRole === 'admin' ? '원클릭 일괄 출결' : '학생 출결 체크 안내'}
              </div>
              <span className="text-3xs bg-slate-800 dark:bg-slate-700 px-2 py-0.5 rounded-full text-slate-300 border border-slate-700">
                {userRole === 'admin' ? '관리자 도구' : '학생 모드'}
              </span>
            </div>

            {userRole === 'admin' ? (
              <div className="space-y-2">
                <button
                  onClick={() => onFillDayAbsent(currentDate, selectedGrade === 'all' ? undefined : Number(selectedGrade))}
                  className="w-full py-2.5 px-3 rounded-xl text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs bg-rose-600 hover:bg-rose-500 active:bg-rose-700 cursor-pointer"
                  title="해당 일자의 미체크 빈칸을 모두 결석(X)으로 채웁니다"
                >
                  <UserX className="w-4 h-4" />
                  미체크 빈칸 'X'(결석)으로 채우기
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onOpenParentModal(absentAndLateList)}
                    disabled={absentAndLateList.length === 0}
                    className="py-2.5 px-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-30 disabled:hover:bg-indigo-600 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer truncate"
                  >
                    <Send className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">학부모 문자 ({absentAndLateList.length}건)</span>
                  </button>

                  <button
                    onClick={() => {
                      if (onOpenClearModal) {
                        onOpenClearModal();
                      } else if (onClearDate) {
                        if (window.confirm(`${currentDate} 출결 기록을 초기화하시겠습니까?`)) {
                          onClearDate(currentDate, selectedGrade === 'all' ? undefined : Number(selectedGrade));
                        }
                      }
                    }}
                    className="py-2.5 px-2 rounded-xl bg-slate-800 hover:bg-rose-950/80 border border-slate-700 hover:border-rose-500/60 text-slate-200 hover:text-rose-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer truncate"
                    title="해당 날짜의 출결을 비우거나 전체 초기화 창을 엽니다"
                  >
                    <Eraser className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span className="truncate">출결 비우기</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/80 text-xs text-slate-300 space-y-1.5">
                <p className="font-bold text-amber-400 flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5" /> 본인 출결 체크 안내
                </p>
                <p className="text-2xs text-slate-300">
                  {isLockedForStudent
                    ? (studentLock.lockReason || '해당 일자의 출결 입력이 마감되었습니다.')
                    : '본인 이름을 찾은 후 출석(○), 지각(△), 조퇴(⊘) 버튼을 눌러 출결을 기록하세요.'}
                </p>
              </div>
            )}
          </div>

          <div className="text-3xs text-slate-400 mt-2">
            * 3학년 {students.filter(s => s.grade === 3 && s.active).length}명 · 2학년 {students.filter(s => s.grade === 2 && s.active).length}명 · 1학년 {students.filter(s => s.grade === 1 && s.active).length}명
          </div>
        </div>

      </div>

      {/* Student Locked Notice Banner (Only shown for student role when session/date is locked) */}
      {userRole === 'student' && isLockedForStudent && (
        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700/80 rounded-2xl flex items-center gap-3 text-xs font-semibold text-amber-900 dark:text-amber-200 shadow-xs">
          <div className="p-2 bg-amber-200/80 dark:bg-amber-900/80 rounded-xl text-amber-900 dark:text-amber-100 shrink-0">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <div className="font-extrabold text-sm text-amber-950 dark:text-amber-100 flex items-center gap-1.5">
              <span>학생 출결 마감 안내 ({sessionLabel}자율학습 - {currentDate})</span>
              <span className="text-3xs px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 font-bold">수정 마감</span>
            </div>
            <p className="text-2xs text-amber-800 dark:text-amber-300 mt-0.5">
              {studentLock.lockReason}
            </p>
          </div>
        </div>
      )}

      {/* Date Navigation Bar & Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
        
        {/* Date Selector */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-100 dark:bg-slate-700/60 rounded-xl p-1 border border-slate-200 dark:border-slate-600">
            <button
              onClick={handlePrevDay}
              disabled={curIdx <= 0}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-600 disabled:opacity-30 text-slate-700 dark:text-slate-200 transition-colors"
              title="이전 출석일"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            <select
              value={currentDate}
              onChange={e => setSelectedDateStr(e.target.value)}
              className="bg-transparent font-bold text-sm px-2 py-1 text-slate-900 dark:text-slate-100 focus:outline-hidden cursor-pointer"
            >
              {activeDays.map(d => (
                <option key={d.dateStr} value={d.dateStr} className="text-slate-900 bg-white dark:bg-slate-800">
                  {d.dayNum}일 ({d.dayOfWeek}요일) - {d.dateStr}
                </option>
              ))}
            </select>

            <button
              onClick={handleNextDay}
              disabled={curIdx >= activeDays.length - 1}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-600 disabled:opacity-30 text-slate-700 dark:text-slate-200 transition-colors"
              title="다음 출석일"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <span>선택 일자: {currentDate}</span>
          </div>
        </div>

        {/* Grade tabs & Search */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-700/60 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setSelectedGrade('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedGrade === 'all'
                  ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              전체 ({students.filter(s => s.active).length})
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
                {g}학년 ({students.filter(s => s.active && s.grade === g).length})
              </button>
            ))}
          </div>

          {/* Status Quick Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-hidden font-medium"
          >
            <option value="all">전체 상태</option>
            <option value="PRESENT">출석자만 보기 (○)</option>
            <option value="LATE">지각자만 보기 (△)</option>
            <option value="EARLY_LEAVE">조퇴자만 보기 (⊘)</option>
            <option value="EXCUSED">공결자만 보기 (공)</option>
            <option value="ABSENT">결석자만 보기 (X)</option>
            <option value="NONE">미체크만 보기 (빈칸)</option>
            <option value="EXCLUDED">자습 제외 대상만</option>
          </select>

          {/* Search Bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="이름/학번 검색..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 w-40 sm:w-48"
            />
          </div>
        </div>

      </div>

      {/* Student Fast Roll-Call Bento Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedStudents.map(student => {
          const isExcluded = isStudentExcluded(student, session, currentDate, currentDayName);
          const isPostNov17 = isStudentExcludedOnDate(student.grade, currentDate);
          const key = getRecordKey(student.id, session, currentDate);
          const rec = records[key];
          const curStatus = rec?.status || 'NONE';
          const statusMeta = STATUS_META[curStatus];
          const isEditingReason = editingReasonId === student.id;

          const gradeColor =
            student.grade === 3
              ? 'border-indigo-200 bg-indigo-50/60 text-indigo-900 dark:border-indigo-800/60 dark:bg-indigo-950/40 dark:text-indigo-200'
              : student.grade === 2
              ? 'border-emerald-200 bg-emerald-50/60 text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200'
              : 'border-purple-200 bg-purple-50/60 text-purple-900 dark:border-purple-800/60 dark:bg-purple-950/40 dark:text-purple-200';

          if (isExcluded) {
            return (
              <div
                key={student.id}
                className="bg-slate-50/80 dark:bg-slate-800/50 rounded-2xl p-4 border border-dashed border-slate-300 dark:border-slate-700 opacity-60 flex flex-col justify-between gap-3"
              >
                <div className="flex items-center justify-between">
                  <span className={`text-2xs px-2 py-0.5 rounded-lg font-bold border ${gradeColor}`}>
                    {student.grade}학년 {student.classNum}반 {String(student.studentNum).padStart(2, '0')}번
                  </span>
                  <span className="text-2xs px-2 py-0.5 rounded-full font-bold bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Ban className="w-3 h-3" />
                    {isPostNov17 ? '수능 후 제외' : `${currentDayName || ''}요일 학원 (야자 미참여)`}
                  </span>
                </div>
                <div>
                  <span className="text-base font-extrabold text-slate-600 dark:text-slate-300">
                    {student.name}
                  </span>
                </div>
                <div className="text-2xs text-slate-400 font-medium py-1.5 px-2 bg-white/60 dark:bg-slate-700/60 rounded-xl">
                  {isPostNov17 
                    ? '11월 17일 이후 3학년 자율학습 미실시' 
                    : `${currentDayName || ''}요일 학원 일정으로 야자 미참여 학생(음영)입니다.`}
                </div>
              </div>
            );
          }

          return (
            <div
              key={student.id}
              className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-xs hover:border-slate-300 dark:hover:border-slate-600 transition-all flex flex-col justify-between gap-3"
            >
              {/* Student Header Info */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-2xs px-2 py-0.5 rounded-lg font-bold border ${gradeColor}`}>
                    {student.grade}학년 {student.classNum}반 {String(student.studentNum).padStart(2, '0')}번
                  </span>
                  {student.seatNum && (
                    <span className="text-3xs text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md font-medium">
                      좌석 {student.seatNum}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {rec?.checkInTime && curStatus !== 'NONE' && (
                    <span className="text-3xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                      🕒 {rec.checkInTime}
                    </span>
                  )}
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${statusMeta.badgeClass}`}>
                    {statusMeta.symbol ? `${statusMeta.symbol} ${statusMeta.label}` : '미체크'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                    {student.name}
                  </span>
                  {student.notes && (
                    <span className="text-2xs text-slate-400 ml-2">({student.notes})</span>
                  )}
                </div>

                {student.parentPhone && (
                  <div className="text-3xs font-mono text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800" title={`학부모: ${student.parentPhone}`}>
                    학부모 {student.parentPhone.slice(-4)}
                  </div>
                )}
              </div>

              {/* Status Action Buttons: Present(○), Late(△), Early(⊘), Excused(공), Absent(X) */}
              <div className="grid grid-cols-5 gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                {(['PRESENT', 'LATE', 'EARLY_LEAVE', 'EXCUSED', 'ABSENT'] as AttendanceStatus[]).map(st => {
                  const m = STATUS_META[st];
                  const isSelected = curStatus === st;
                  const isDisabled = userRole === 'teacher' || (userRole === 'student' && isLockedForStudent);

                  return (
                    <button
                      key={st}
                      disabled={isDisabled}
                      onClick={() => onUpdateRecord(student.id, currentDate, st, rec?.reason)}
                      className={`py-2 px-1 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center border ${
                        isSelected
                          ? `${m.badgeClass} ring-2 ring-indigo-500 scale-[1.02] shadow-xs`
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:border-slate-300'
                      } ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      title={
                        userRole === 'student' && isLockedForStudent
                          ? (studentLock.lockReason || '마감된 출결은 수정할 수 없습니다.')
                          : userRole === 'teacher'
                            ? '담임 교사는 조회 전용입니다'
                            : `${student.name}: ${m.label} 체크`
                      }
                    >
                      <span className="text-sm leading-none font-bold">{m.symbol}</span>
                      <span className="text-3xs mt-1 font-medium">{m.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Reason / Notes section */}
              {isEditingReason && userRole !== 'teacher' && !(userRole === 'student' && isLockedForStudent) ? (
                <div className="mt-1 pt-1 flex items-center gap-1.5">
                  <input
                    type="text"
                    value={tempReason}
                    onChange={e => setTempReason(e.target.value)}
                    placeholder="사유 입력 (예: 병결, 학원, 조퇴 등)"
                    className="flex-1 px-2.5 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-hidden"
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      onUpdateRecord(student.id, currentDate, curStatus, tempReason);
                      setEditingReasonId(null);
                    }}
                    className="px-2.5 py-1 text-xs rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 cursor-pointer"
                  >
                    저장
                  </button>
                  <button
                    onClick={() => setEditingReasonId(null)}
                    className="px-2.5 py-1 text-xs rounded-lg border border-slate-300 text-slate-500 hover:bg-slate-100 cursor-pointer"
                  >
                    취소
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between text-2xs text-slate-500 pt-1">
                  <span className="truncate">
                    {rec?.reason ? (
                      <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                        사유: {rec.reason}
                      </span>
                    ) : (
                      <span className="text-slate-400">사유 없음</span>
                    )}
                  </span>
                  {userRole !== 'teacher' && !(userRole === 'student' && isLockedForStudent) && (
                    <button
                      onClick={() => {
                        setTempReason(rec?.reason || '');
                        setEditingReasonId(student.id);
                      }}
                      className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 text-3xs font-medium underline cursor-pointer"
                    >
                      {rec?.reason ? '수정' : '+ 사유입력'}
                    </button>
                  )}
                </div>
              )}

            </div>
          );
        })}
      </div>

    </div>
  );
};
