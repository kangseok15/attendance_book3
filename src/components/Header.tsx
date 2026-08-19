import React from 'react';
import { 
  Calendar, 
  LayoutGrid, 
  CheckSquare, 
  Users, 
  BarChart3, 
  FileSpreadsheet, 
  Settings2,
  ChevronLeft,
  ChevronRight,
  Eraser,
  ShieldCheck,
  GraduationCap,
  UserCheck,
  ChevronDown,
  Lock,
  Unlock
} from 'lucide-react';
import { SessionType, UserRole } from '../types/attendance';

export type ViewTab = 'monthly' | 'daily' | 'students' | 'analytics';

interface HeaderProps {
  activeTab: ViewTab;
  setActiveTab: (tab: ViewTab) => void;
  session: SessionType;
  setSession: (session: SessionType) => void;
  year: number;
  month: number;
  setYearMonth: (year: number, month: number) => void;
  onOpenExportModal: () => void;
  onOpenMonthConfigModal: () => void;
  onClearAttendance: () => void;
  studentCount?: number;
  userRole: UserRole;
  onOpenRoleModal: () => void;
  onDirectSelectRole?: (role: UserRole) => void;
  lockPastDates?: boolean;
  onToggleLockPastDates?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  session,
  setSession,
  year,
  month,
  setYearMonth,
  onOpenExportModal,
  onOpenMonthConfigModal,
  onClearAttendance,
  studentCount,
  userRole,
  onOpenRoleModal,
  onDirectSelectRole,
  lockPastDates = true,
  onToggleLockPastDates,
}) => {
  const handlePrevMonth = () => {
    if (month === 1) {
      setYearMonth(year - 1, 12);
    } else {
      setYearMonth(year, month - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setYearMonth(year + 1, 1);
    } else {
      setYearMonth(year, month + 1);
    }
  };

  // Primary semester months (8월 ~ 12월)
  const semesterMonths = [8, 9, 10, 11, 12];
  // Full school year months
  const allMonths = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  // Role metadata
  const roleBadgeConfig = {
    admin: {
      label: '관리자',
      badgeClass: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200/50',
      icon: ShieldCheck,
      desc: '모든 권한',
    },
    teacher: {
      label: '담임 교사',
      badgeClass: 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-200/50',
      icon: GraduationCap,
      desc: '조회 전용 (입력 불가)',
    },
    student: {
      label: '학생',
      badgeClass: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-200/50',
      icon: UserCheck,
      desc: '출결 체크 & 학원 요일 입력',
    },
  };

  const currentRoleConfig = roleBadgeConfig[userRole];
  const RoleIcon = currentRoleConfig.icon;

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top single-row navigation contract */}
        <div className="h-16 flex items-center justify-between gap-4">
          
          {/* Brand Zone */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200/50 dark:shadow-indigo-950 text-white font-black text-sm shrink-0">
              숭신
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap">
                숭신고등학교 미래인재반 출석부
              </span>
            </div>
          </div>

          {/* Center Navigation Zone: Role-based filtering */}
          <nav className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
            
            {/* 1. 월간 출석부: 관리자, 담임 교사, 학생 모두 접근 가능 */}
            <button
              onClick={() => setActiveTab('monthly')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0 ${
                activeTab === 'monthly'
                  ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-750'
              }`}
            >
              <LayoutGrid className="w-4 h-4 shrink-0" />
              월간 출석부
              {userRole === 'teacher' && <span className="text-[10px] bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300 px-1 py-0.2 rounded font-bold">조회</span>}
            </button>

            {/* 2. 일별 빠른 체크: 관리자, 학생만 접근 가능 (담임 교사는 비공개) */}
            {(userRole === 'admin' || userRole === 'student') && (
              <button
                onClick={() => setActiveTab('daily')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0 ${
                  activeTab === 'daily'
                    ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-750'
                }`}
              >
                <CheckSquare className="w-4 h-4 shrink-0" />
                일별 빠른 체크
              </button>
            )}

            {/* 3. 학생 명단: 관리자만 접근 가능 (담임 교사, 학생 비공개) */}
            {userRole === 'admin' && (
              <button
                onClick={() => setActiveTab('students')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0 ${
                  activeTab === 'students'
                    ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-750'
                }`}
              >
                <Users className="w-4 h-4 shrink-0" />
                학생 명단 ({studentCount ?? 45}명)
              </button>
            )}

            {/* 4. 통계 및 분석: 관리자, 담임 교사만 접근 가능 (학생 비공개) */}
            {(userRole === 'admin' || userRole === 'teacher') && (
              <button
                onClick={() => setActiveTab('analytics')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0 ${
                  activeTab === 'analytics'
                    ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-750'
                }`}
              >
                <BarChart3 className="w-4 h-4 shrink-0" />
                통계 및 분석
              </button>
            )}
          </nav>

          {/* Action Zone: Direct 3-Role Quick Selector & Admin tools */}
          <div className="flex items-center gap-2 shrink-0">
            
            {/* Quick 3-Role Toggle Segment */}
            <div className="inline-flex p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold shadow-2xs">
              <button
                type="button"
                onClick={() => {
                  if (userRole === 'admin') {
                    onOpenRoleModal();
                  } else {
                    onOpenRoleModal(); // Admin requires PIN
                  }
                }}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  userRole === 'admin'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                title="관리자 모드 (모든 기능 사용)"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">관리자</span>
              </button>

              <button
                type="button"
                onClick={() => onDirectSelectRole ? onDirectSelectRole('teacher') : onOpenRoleModal()}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  userRole === 'teacher'
                    ? 'bg-teal-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                title="담임 교사 모드 (조회 전용)"
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>담임 교사</span>
              </button>

              <button
                type="button"
                onClick={() => onDirectSelectRole ? onDirectSelectRole('student') : onOpenRoleModal()}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  userRole === 'student'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                title="학생 모드 (출결 체크 & 학원 요일)"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>학생</span>
              </button>
            </div>

            {/* Admin only: Google Sheets Export */}
            {userRole === 'admin' && (
              <button
                onClick={onOpenExportModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold transition-all shadow-xs whitespace-nowrap shrink-0 cursor-pointer"
                title="구글 스프레드시트 복사 및 엑셀 다운로드"
              >
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                <span className="hidden md:inline">스프레드시트</span>
              </button>
            )}

            {/* Admin only: Month & Calendar Config */}
            {userRole === 'admin' && (
              <button
                onClick={onOpenMonthConfigModal}
                className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-700 shadow-2xs shrink-0 cursor-pointer"
                title="월별 자습 운영일 및 학사일정 설정"
              >
                <Settings2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Secondary Bar: Session Switcher & 8월~12월 Month Bar */}
        <div className="py-2.5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 text-sm">
          
          {/* Session Switcher (Morning 07:30~08:40 / Night 17:30~21:30) */}
          <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
            <button
              onClick={() => setSession('morning')}
              className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                session === 'morning'
                  ? 'bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              아침 자율학습
            </button>
            <button
              onClick={() => setSession('night')}
              className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                session === 'night'
                  ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              야간 자율학습
            </button>
          </div>

          {/* 8월 ~ 12월 Month Quick Selector Bar & Year Control */}
          <div className="flex items-center gap-2 flex-wrap">
            
            {/* 8월, 9월, 10월, 11월, 12월 Fast Month Buttons */}
            <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
              {semesterMonths.map(m => (
                <button
                  key={m}
                  onClick={() => setYearMonth(year, m)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    month === m
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-indigo-600 hover:bg-white/60 dark:hover:bg-slate-700'
                  }`}
                >
                  {m}월
                </button>
              ))}
            </div>

            {/* Month Stepper & Full Month Dropdown */}
            <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-1.5 py-1 shadow-2xs">
              <button
                onClick={handlePrevMonth}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                title="이전 달"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <div className="flex items-center gap-1.5 px-2 font-black text-slate-900 dark:text-slate-100 text-xs sm:text-sm whitespace-nowrap">
                <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>{year}년</span>
                <select
                  value={month}
                  onChange={(e) => setYearMonth(year, Number(e.target.value))}
                  className="bg-transparent font-black text-slate-900 dark:text-slate-100 cursor-pointer focus:outline-hidden"
                >
                  {allMonths.map(m => (
                    <option key={m} value={m} className="text-slate-900 bg-white dark:bg-slate-800">
                      {m}월
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleNextMonth}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                title="다음 달"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Student lock rule info badge */}
            {userRole === 'student' && (
              <div 
                className="text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium"
                title="학생 출결 마감 기준: 아침자율학습 09:00 마감 / 야간자율학습 당일 마감"
              >
                <Lock className="w-3.5 h-3.5 text-indigo-500" />
                <span className="hidden sm:inline">출결 마감:</span> <span>아침 09시 / 야자 당일</span>
              </div>
            )}

            {/* Admin only: Clear Attendance Records button */}
            {userRole === 'admin' && (
              <button
                onClick={onClearAttendance}
                className="text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/40 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all font-bold"
                title="현재 출결 기록 비우기"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">출결</span> 비우기
              </button>
            )}

          </div>

        </div>
      </div>
    </header>
  );
};
