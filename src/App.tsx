/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Student, 
  SessionType, 
  DayConfig, 
  AttendanceRecord, 
  AttendanceStatus,
  UserRole,
  TabType 
} from './types/attendance';
import { getTodayDateStr } from './utils/attendanceHelpers';
import { fetchFromGoogleSheets, syncToGoogleSheets } from './utils/googleSync';
import { MonthlyGridView } from './components/MonthlyGridView';
import { AnalyticsView } from './components/AnalyticsView';
import { 
  Calendar as CalendarIcon, 
  CheckSquare, 
  Users, 
  BarChart3, 
  ShieldCheck, 
  GraduationCap, 
  User, 
  FileSpreadsheet, 
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Lock,
  X
} from 'lucide-react';

// 관리자 접근 비밀번호
const ADMIN_PASSWORD = '4706';

// URL 파라미터(?role=teacher 등)에서 초기 역할 감지 함수
const getInitialRoleFromURL = (): UserRole => {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const roleParam = params.get('role');
    if (roleParam === 'teacher') return 'teacher';
    if (roleParam === 'admin') return 'admin';
    if (roleParam === 'student') return 'student';
  }
  return 'student'; // 기본값: 학생
};

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>('monthly');
  const [session, setSession] = useState<SessionType>('morning');
  const [userRole, setUserRole] = useState<UserRole>(getInitialRoleFromURL);
  const [year, setYear] = useState<number>(2026);
  const [month, setMonth] = useState<number>(8);
  
  // 모달 상태
  const [isClearModalOpen, setIsClearModalOpen] = useState<boolean>(false);
  const [clearTargetDate, setClearTargetDate] = useState<string>('ALL'); // 'ALL' 또는 특정 'YYYY-MM-DD'
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');

  // 로컬 백업 기반 안전 로딩
  const [students, setStudents] = useState<Student[]>(() => {
    const saved = localStorage.getItem('mirae_students_backup');
    return saved ? JSON.parse(saved) : [];
  });
  const [records, setRecords] = useState<Record<string, AttendanceRecord>>(() => {
    const saved = localStorage.getItem('mirae_records_backup');
    return saved ? JSON.parse(saved) : {};
  });

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSynced, setLastSynced] = useState<string>('');

  // 8월 운영일 설정
  const activeDays: DayConfig[] = useMemo(() => {
    return [
      { dateStr: '2026-08-19', dayNum: 19, dayOfWeek: '수' },
      { dateStr: '2026-08-20', dayNum: 20, dayOfWeek: '목' },
      { dateStr: '2026-08-21', dayNum: 21, dayOfWeek: '금' },
      { dateStr: '2026-08-24', dayNum: 24, dayOfWeek: '월' },
      { dateStr: '2026-08-25', dayNum: 25, dayOfWeek: '화' },
      { dateStr: '2026-08-26', dayNum: 26, dayOfWeek: '수' },
      { dateStr: '2026-08-27', dayNum: 27, dayOfWeek: '목' },
      { dateStr: '2026-08-28', dayNum: 28, dayOfWeek: '금' },
      { dateStr: '2026-08-31', dayNum: 31, dayOfWeek: '월' },
    ];
  }, []);

  // 구글 시트 안전 병합 동기화
  const loadData = async () => {
    setIsSyncing(true);
    const data = await fetchFromGoogleSheets();
    if (data) {
      if (data.students && data.students.length > 0) {
        setStudents(data.students);
        localStorage.setItem('mirae_students_backup', JSON.stringify(data.students));
      }
      if (data.records && Object.keys(data.records).length > 0) {
        setRecords(prev => {
          const merged = { ...prev, ...data.records };
          localStorage.setItem('mirae_records_backup', JSON.stringify(merged));
          return merged;
        });
      }
      setLastSynced(new Date().toLocaleTimeString());
    }
    setIsSyncing(false);
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(() => {
      loadData();
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // 역할 전환 핸들러 (관리자 전환 시 비밀번호 검증 + URL 파라미터 동기화)
  const handleRoleChange = (targetRole: UserRole) => {
    if (targetRole === 'admin') {
      if (userRole === 'admin') return;
      setPasswordInput('');
      setAuthError('');
      setIsAuthModalOpen(true);
    } else {
      setUserRole(targetRole);
      const url = new URL(window.location.href);
      if (targetRole === 'student') {
        url.searchParams.delete('role');
      } else {
        url.searchParams.set('role', targetRole);
      }
      window.history.replaceState({}, '', url.toString());
    }
  };

  const handleVerifyAdminPassword = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (passwordInput === ADMIN_PASSWORD) {
      setUserRole('admin');
      setIsAuthModalOpen(false);
      setPasswordInput('');
      setAuthError('');
      const url = new URL(window.location.href);
      url.searchParams.set('role', 'admin');
      window.history.replaceState({}, '', url.toString());
    } else {
      setAuthError('비밀번호가 올바르지 않습니다.');
    }
  };

  const handleUpdateRecord = async (
    studentId: string, 
    dateStr: string, 
    status: AttendanceStatus, 
    reason?: string,
    checkInTime?: string
  ) => {
    const key = `${studentId}_${session}_${dateStr}`;
    const nowTime = checkInTime || `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;
    
    setRecords(prev => {
      const nextRecords = {
        ...prev,
        [key]: {
          studentId,
          session,
          dateStr,
          status,
          reason: reason !== undefined ? reason : prev[key]?.reason,
          checkInTime: prev[key]?.checkInTime || nowTime,
          updatedAt: new Date().toISOString(),
        }
      };
      localStorage.setItem('mirae_records_backup', JSON.stringify(nextRecords));
      syncToGoogleSheets({ records: nextRecords });
      return nextRecords;
    });
  };

  const handleFillDayAbsent = (dateStr: string, gradeFilter?: number) => {
    setRecords(prev => {
      const nextRecords = { ...prev };
      students.forEach(st => {
        if (!st.active) return;
        if (gradeFilter !== undefined && st.grade !== gradeFilter) return;

        const key = `${st.id}_${session}_${dateStr}`;
        if (!nextRecords[key] || nextRecords[key].status === 'NONE') {
          nextRecords[key] = {
            studentId: st.id,
            session,
            dateStr,
            status: 'ABSENT',
            updatedAt: new Date().toISOString(),
          };
        }
      });
      localStorage.setItem('mirae_records_backup', JSON.stringify(nextRecords));
      syncToGoogleSheets({ records: nextRecords });
      return nextRecords;
    });
  };

  const handleUpdateStudents = (updatedStudents: Student[]) => {
    setStudents(updatedStudents);
    localStorage.setItem('mirae_students_backup', JSON.stringify(updatedStudents));
    syncToGoogleSheets({ students: updatedStudents });
  };

  // 출결 데이터 선택 삭제 실행 (특정 날짜 또는 전체)
  const handleExecuteClear = () => {
    setRecords(prev => {
      const nextRecords = { ...prev };
      Object.keys(nextRecords).forEach(k => {
        if (clearTargetDate === 'ALL') {
          // 해당 세션의 모든 날짜 초기화
          if (k.includes(`_${session}_`)) {
            delete nextRecords[k];
          }
        } else {
          // 선택한 특정 날짜의 세션 기록만 초기화
          if (k.includes(`_${session}_${clearTargetDate}`)) {
            delete nextRecords[k];
          }
        }
      });
      localStorage.setItem('mirae_records_backup', JSON.stringify(nextRecords));
      syncToGoogleSheets({ records: nextRecords });
      return nextRecords;
    });
    setIsClearModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      
      {/* 1. 최상단 메인 네비게이션 헤더 바 */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-40 shadow-2xs">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          
          <div className="flex items-center gap-3 shrink-0">
            <div className="h-9 px-2.5 py-1 bg-[#801B2B] rounded-xl flex items-center justify-center shadow-xs">
              <svg viewBox="0 0 240 105" className="h-full w-auto text-white fill-current">
                <text x="15" y="75" fontFamily="serif" fontSize="68" fontWeight="bold" fill="currentColor">崇</text>
                <polygon points="120,45 230,88 230,96 120,70 10,96 10,88" fill="currentColor" />
                <text x="175" y="75" fontFamily="serif" fontSize="68" fontWeight="bold" fill="currentColor">信</text>
              </svg>
            </div>
            <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
              숭신고등학교 미래인재반 출석부
            </h1>
          </div>

          <nav className="hidden xl:flex items-center gap-1.5 bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200/60 dark:border-slate-700 text-xs font-bold">
            <button
              onClick={() => setActiveTab('monthly')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
                activeTab === 'monthly' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <CalendarIcon className="w-4 h-4 text-indigo-500" />
              월간 출석부
            </button>
            <button
              onClick={() => setActiveTab('quick' as any)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
                activeTab === ('quick' as any) ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <CheckSquare className="w-4 h-4 text-slate-400" />
              일별 빠른 체크
            </button>
            <button
              onClick={() => setActiveTab('students' as any)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
                activeTab === ('students' as any) ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Users className="w-4 h-4 text-slate-400" />
              학생 명단 ({students.length || 45}명)
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
                activeTab === 'analytics' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-4 h-4 text-slate-400" />
              통계 및 분석
            </button>
          </nav>

          <div className="flex items-center gap-2">
            <div className="inline-flex bg-slate-100/90 dark:bg-slate-800/90 p-1 rounded-xl text-3xs font-bold border border-slate-200/50">
              <button
                onClick={() => handleRoleChange('admin')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all ${
                  userRole === 'admin' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <ShieldCheck className="w-3 h-3" />
                관리자
              </button>
              <button
                onClick={() => handleRoleChange('teacher')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all ${
                  userRole === 'teacher' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <GraduationCap className="w-3 h-3" />
                담임 교사
              </button>
              <button
                onClick={() => handleRoleChange('student')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all ${
                  userRole === 'student' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <User className="w-3 h-3" />
                학생
              </button>
            </div>

            <a
              href="https://docs.google.com/spreadsheets"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-3xs font-bold transition-all shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              스프레드시트
            </a>

            <button
              onClick={loadData}
              title={`구글 시트 동기화 (최근: ${lastSynced || '연결 대기'})`}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-indigo-500' : ''}`} />
            </button>
          </div>

        </div>
      </header>

      {/* 2. 2열 서브 컨트롤 바 */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs border-b border-slate-200/80 dark:border-slate-800 px-4 sm:px-6 py-2.5">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-3">
          
          <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setSession('morning')}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                session === 'morning' ? 'bg-white dark:bg-slate-900 text-amber-600 shadow-xs font-extrabold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              아침 자율학습
            </button>
            <button
              onClick={() => setSession('night')}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                session === 'night' ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs font-extrabold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              야간 자율학습
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-3xs font-bold">
              {[8, 9, 10, 11, 12].map(m => (
                <button
                  key={m}
                  onClick={() => setMonth(m)}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    month === m ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {m}월
                </button>
              ))}
            </div>

            <div className="flex items-center bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
              <button onClick={() => setMonth(prev => Math.max(1, prev - 1))} className="p-1 hover:text-indigo-600">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <div className="flex items-center gap-1.5 px-2 font-mono">
                <CalendarIcon className="w-3.5 h-3.5 text-indigo-500" />
                <span>{year}년 {month}월</span>
              </div>
              <button onClick={() => setMonth(prev => Math.min(12, prev + 1))} className="p-1 hover:text-indigo-600">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {userRole === 'admin' && (
              <button
                onClick={() => {
                  setClearTargetDate('ALL');
                  setIsClearModalOpen(true);
                }}
                className="flex items-center gap-1 px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs font-bold hover:bg-rose-100 transition-colors shadow-2xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                출결 비우기
              </button>
            )}
          </div>

        </div>
      </div>

      {/* 3. 메인 콘텐츠 뷰 */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-5 flex-1 w-full space-y-6">
        {activeTab === 'monthly' && (
          <MonthlyGridView
            students={students}
            session={session}
            year={year}
            month={month}
            activeDays={activeDays}
            records={records}
            onUpdateRecord={handleUpdateRecord}
            onFillDayAbsent={handleFillDayAbsent}
            onUpdateStudents={handleUpdateStudents}
            onSessionChange={setSession}
            onOpenClearModal={() => {
              setClearTargetDate('ALL');
              setIsClearModalOpen(true);
            }}
            userRole={userRole}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsView
            students={students}
            session={session}
            year={year}
            month={month}
            activeDays={activeDays}
            records={records}
            userRole={userRole}
          />
        )}
      </main>

      {/* 4. 관리자 비밀번호 입력 모달 */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xs w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex justify-between items-center border-b pb-3 border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-indigo-600" />
                관리자 인증
              </h3>
              <button 
                onClick={() => setIsAuthModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleVerifyAdminPassword} className="space-y-3">
              <div>
                <label className="text-3xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">
                  관리자 비밀번호를 입력해 주세요
                </label>
                <input
                  type="password"
                  autoFocus
                  placeholder="비밀번호 입력..."
                  value={passwordInput}
                  onChange={e => {
                    setPasswordInput(e.target.value);
                    setAuthError('');
                  }}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
                />
                {authError && (
                  <p className="text-3xs text-rose-500 font-bold mt-1">{authError}</p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAuthModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs"
                >
                  확인
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. 출결 비우기 모달 (전체 or 특정 날짜 선택 기능 복원) */}
      {isClearModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-rose-600" />
                출결 데이터 비우기
              </h3>
              <button 
                onClick={() => setIsClearModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  초기화할 범위 선택 ({session === 'morning' ? '아침 자율학습' : '야간 자율학습'})
                </label>
                <select
                  value={clearTargetDate}
                  onChange={e => setClearTargetDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-medium text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-rose-500"
                >
                  <option value="ALL">📌 {month}월 전체 일자 일괄 비우기</option>
                  {activeDays.map(day => (
                    <option key={day.dateStr} value={day.dateStr}>
                      📅 {day.dayNum}일({day.dayOfWeek}) 기록만 비우기
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-rose-50 dark:bg-rose-950/40 p-3 rounded-xl border border-rose-200 dark:border-rose-900/50">
                <p className="text-3xs text-rose-700 dark:text-rose-300 leading-relaxed font-medium">
                  {clearTargetDate === 'ALL'
                    ? `⚠️ ${month}월 ${session === 'morning' ? '아침' : '야간'} 세션의 모든 출결 기록이 삭제됩니다.`
                    : `⚠️ 선택한 날짜(${clearTargetDate})의 ${session === 'morning' ? '아침' : '야간'} 출결 기록만 삭제됩니다.`}
                  <br />(이 작업은 복구할 수 없습니다.)
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setIsClearModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200"
              >
                취소
              </button>
              <button
                onClick={handleExecuteClear}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 shadow-xs"
              >
                비우기 실행
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

export default App;
