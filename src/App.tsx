/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Student, 
  SessionType, 
  DayConfig, 
  AttendanceRecord, 
  AttendanceStatus,
  UserRole,
  TabType 
} from './types/attendance';
import { 
  getRecordKey, 
  getTodayDateStr, 
  isStudentExcluded 
} from './utils/attendanceHelpers';
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
  X,
  Phone,
  Search
} from 'lucide-react';

const ADMIN_PASSWORD = '4706';

const QUICK_STATUS_ICONS: Record<AttendanceStatus, string> = {
  PRESENT: '○',
  LATE: '△',
  EARLY_LEAVE: '∅',
  OFFICIAL_ABSENT: '공',
  ABSENT: 'X',
  NONE: ''
};

const QUICK_STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: '출석',
  LATE: '지각',
  EARLY_LEAVE: '조퇴',
  OFFICIAL_ABSENT: '공결',
  ABSENT: '결석',
  NONE: '미체크'
};

const getInitialRoleFromURL = (): UserRole => {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const roleParam = params.get('role');
    if (roleParam === 'teacher') return 'teacher';
    if (roleParam === 'admin') return 'admin';
    if (roleParam === 'student') return 'student';
  }
  return 'student';
};

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>('monthly');
  const [session, setSession] = useState<SessionType>('morning');
  const [userRole, setUserRole] = useState<UserRole>(getInitialRoleFromURL);
  const [year, setYear] = useState<number>(2026);
  const [month, setMonth] = useState<number>(8);
  const [selectedDateStr, setSelectedDateStr] = useState<string>(getTodayDateStr());
  
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [quickGradeFilter, setQuickGradeFilter] = useState<number | 'all'>('all');

  const [isClearModalOpen, setIsClearModalOpen] = useState<boolean>(false);
  const [clearTargetDate, setClearTargetDate] = useState<string>('ALL');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');

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

  const loadData = async () => {
    setIsSyncing(true);
    const data = await fetchFromGoogleSheets();
    if (data) {
      if (data.students && data.students.length > 0) {
        setStudents(data.students);
        localStorage.setItem('mirae_students_backup', JSON.stringify(data.students));
      }
      if (data.records) {
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
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const handleRoleChange = (targetRole: UserRole) => {
    if (targetRole === 'admin') {
      if (userRole === 'admin') return;
      setPasswordInput('');
      setAuthError('');
      setIsAuthModalOpen(true);
    } else {
      setUserRole(targetRole);
      // 담임 모드로 변경 시 혹시 빠른체크 탭에 있었다면 월간 출석부로 이동
      if (targetRole === 'teacher' && activeTab === 'quick') {
        setActiveTab('monthly');
      }
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

  // 출결 수정 및 저장 (담임 교사 모드 업로드 차단 적용)
  const handleUpdateRecord = async (
    studentId: string, 
    dateStr: string, 
    status: AttendanceStatus, 
    reason?: string,
    checkInTime?: string
  ) => {
    // 🔒 담임 교사(teacher)는 조회 전용 모드로 차단
    if (userRole === 'teacher') {
      alert('담임 교사 모드는 [조회 전용]입니다. 출결 수정은 태블릿 또는 관리자 모드에서 진행해 주세요.');
      return;
    }
    // 🔒 학생(student) 모드 수정 차단
    if (userRole === 'student') {
      return;
    }

    const key = `${studentId}_${session}_${dateStr}`;
    const nowTime = checkInTime || `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;
    
    const singleRecord: AttendanceRecord = {
      studentId,
      session,
      dateStr,
      status,
      reason: reason !== undefined ? reason : records[key]?.reason,
      checkInTime: records[key]?.checkInTime || nowTime,
      updatedAt: new Date().toISOString(),
    };

    setRecords(prev => {
      const nextRecords = {
        ...prev,
        [key]: singleRecord
      };
      localStorage.setItem('mirae_records_backup', JSON.stringify(nextRecords));
      return nextRecords;
    });

    // 관리자(admin) 모드에서만 구글 시트로 실시간 전송
    syncToGoogleSheets({ 
      recordKey: key, 
      record: singleRecord,
      records: { ...records, [key]: singleRecord } 
    });
  };

  const handleFillDayAbsent = (dateStr: string, gradeFilter?: number) => {
    if (userRole !== 'admin') return;

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
    if (userRole !== 'admin') return;

    setStudents(updatedStudents);
    localStorage.setItem('mirae_students_backup', JSON.stringify(updatedStudents));
    syncToGoogleSheets({ students: updatedStudents });
  };

  const handleExecuteClear = () => {
    if (userRole !== 'admin') return;

    setRecords(prev => {
      const nextRecords = { ...prev };
      Object.keys(nextRecords).forEach(k => {
        if (clearTargetDate === 'ALL') {
          if (k.includes(`_${session}_`)) {
            delete nextRecords[k];
          }
        } else {
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

  const quickFilteredStudents = students.filter(s => {
    if (!s.active) return false;
    if (quickGradeFilter !== 'all' && s.grade !== quickGradeFilter) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      
      {/* 1. 최상단 네비게이션 바 */}
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
            
            {/* 담임 교사 모드에서는 '일별 빠른 체크' 탭 숨김 */}
            {userRole !== 'teacher' && (
              <button
                onClick={() => setActiveTab('quick')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
                  activeTab === 'quick' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <CheckSquare className="w-4 h-4 text-slate-400" />
                일별 빠른 체크
              </button>
            )}

            <button
              onClick={() => setActiveTab('students')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
                activeTab === 'students' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
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

      {/* 2. 서브 컨트롤 바 */}
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
        
        {/* 탭 1: 월간 출석부 */}
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

        {/* 탭 2: 일별 빠른 체크 (담임 교사 모드에서는 숨김) */}
        {activeTab === 'quick' && userRole !== 'teacher' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl text-indigo-600">
                  <CheckSquare className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    일별 빠른 출결 체크 ({selectedDateStr})
                  </h2>
                  <p className="text-3xs text-slate-400 mt-0.5">
                    버튼을 클릭하여 출석, 지각, 결석, 조퇴, 공결 상태를 바로 입력할 수 있습니다.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedDateStr}
                  onChange={e => setSelectedDateStr(e.target.value)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold border-none"
                >
                  {activeDays.map(d => (
                    <option key={d.dateStr} value={d.dateStr}>
                      {d.dayNum}일 ({d.dayOfWeek})
                    </option>
                  ))}
                </select>

                <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
                  <button
                    onClick={() => setQuickGradeFilter('all')}
                    className={`px-3 py-1 rounded-lg ${quickGradeFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}
                  >
                    전체
                  </button>
                  {[3, 2, 1].map(g => (
                    <button
                      key={g}
                      onClick={() => setQuickGradeFilter(g)}
                      className={`px-3 py-1 rounded-lg ${quickGradeFilter === g ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}
                    >
                      {g}학년
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {quickFilteredStudents.map(student => {
                const key = getRecordKey(student.id, session, selectedDateStr);
                const rec = records[key];
                const currentStatus = rec?.status || 'NONE';
                const isExcluded = isStudentExcluded(student, session, selectedDateStr);

                return (
                  <div 
                    key={student.id} 
                    className={`p-4 rounded-2xl border transition-all ${
                      isExcluded ? 'bg-slate-100/80 border-slate-300 opacity-75' :
                      currentStatus === 'PRESENT' ? 'bg-emerald-50/40 border-emerald-200' :
                      currentStatus === 'LATE' ? 'bg-amber-50/40 border-amber-200' :
                      currentStatus === 'ABSENT' ? 'bg-rose-50/40 border-rose-200' :
                      'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2.5">
                      <div>
                        <span className="text-3xs font-mono text-slate-400 block">
                          {student.grade}-{student.classNum}-{student.studentNum}
                        </span>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                          {student.name}
                        </h4>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-3xs font-black ${
                        currentStatus === 'PRESENT' ? 'bg-emerald-100 text-emerald-700' :
                        currentStatus === 'LATE' ? 'bg-amber-100 text-amber-700' :
                        currentStatus === 'ABSENT' ? 'bg-rose-100 text-rose-700' :
                        currentStatus === 'EARLY_LEAVE' ? 'bg-purple-100 text-purple-700' :
                        currentStatus === 'OFFICIAL_ABSENT' ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-400'
                      }`}>
                        {QUICK_STATUS_LABELS[currentStatus]}
                      </span>
                    </div>

                    <div className="grid grid-cols-5 gap-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                      {(['PRESENT', 'LATE', 'ABSENT', 'EARLY_LEAVE', 'OFFICIAL_ABSENT'] as AttendanceStatus[]).map(st => (
                        <button
                          key={st}
                          disabled={userRole === 'student' || userRole === 'teacher'}
                          onClick={() => handleUpdateRecord(student.id, selectedDateStr, st)}
                          className={`py-1 text-3xs font-bold rounded-lg transition-colors ${
                            currentStatus === st
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {QUICK_STATUS_ICONS[st]}
                        </button>
                      ))}
                    </div>

                    {rec?.checkInTime && (
                      <p className="text-3xs text-slate-400 font-mono mt-2 text-right">
                        🕒 {rec.checkInTime}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 탭 3: 학생 명단 및 비상 연락망 */}
        {activeTab === 'students' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/60">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  미래인재반 전체 학생 명단 및 비상 연락망
                </h3>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="이름 / 학번 검색..."
                  value={studentSearch}
                  onChange={e => setStudentSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 w-48"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 text-center w-12">연번</th>
                    <th className="py-3 px-4 w-28">학년-반-번호</th>
                    <th className="py-3 px-4 w-24">이름</th>
                    <th className="py-3 px-4">학생 연락처</th>
                    <th className="py-3 px-4">학부모 연락처</th>
                    <th className="py-3 px-4">학원 요일 (야자 제외)</th>
                    <th className="py-3 px-4">비고</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {students
                    .filter(s => 
                      s.name.includes(studentSearch) || 
                      `${s.grade}${s.classNum}${s.studentNum}`.includes(studentSearch)
                    )
                    .map((student, idx) => (
                      <tr key={student.id} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-4 text-center font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-4 font-mono font-semibold">{student.grade}학년 {student.classNum}반 {student.studentNum}번</td>
                        <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-white">{student.name}</td>
                        <td className="py-2.5 px-4 font-mono text-slate-600">
                          {student.phone ? (
                            <a href={`tel:${student.phone}`} className="flex items-center gap-1 hover:text-indigo-600">
                              <Phone className="w-3 h-3 text-indigo-500" />
                              {student.phone}
                            </a>
                          ) : '-'}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-600">
                          {student.parentPhone ? (
                            <a href={`tel:${student.parentPhone}`} className="flex items-center gap-1 hover:text-emerald-600 font-semibold text-emerald-700">
                              <Phone className="w-3 h-3 text-emerald-500" />
                              {student.parentPhone}
                            </a>
                          ) : '-'}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="flex gap-1">
                            {student.academyDays && student.academyDays.length > 0 ? (
                              student.academyDays.map(d => (
                                <span key={d} className="px-1.5 py-0.5 bg-rose-50 text-rose-600 rounded text-3xs font-bold border border-rose-200">
                                  {d}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-400 text-3xs">없음 (매일 참여)</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-slate-500 text-3xs">{student.notes || '-'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 탭 4: 통계 및 분석 */}
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

      {/* 5. 출결 비우기 모달 */}
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
