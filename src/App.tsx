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
  Calendar, 
  BarChart3, 
  RefreshCw 
} from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>('monthly');
  const [session, setSession] = useState<SessionType>('morning');
  const [userRole, setUserRole] = useState<UserRole>('admin');
  const [year] = useState<number>(2026);
  const [month] = useState<number>(8);

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
  const isInitialLoaded = useRef<boolean>(false);

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

  // 서버 데이터와 태블릿 로컬 데이터 안전 병합(Merge) 로드 함수
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
      isInitialLoaded.current = true;
    }
    setIsSyncing(false);
  };

  // 초기 1회 로드 및 태블릿 간 30초 주기 자동 동기화 (충돌 방지)
  useEffect(() => {
    loadData();
    const timer = setInterval(() => {
      loadData();
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // 출결 상태 업데이트 (로컬 즉시 저장 + 시트 전송)
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

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="h-9 px-2.5 py-1 bg-[#801B2B] rounded-xl flex items-center justify-center shadow-xs">
              <svg viewBox="0 0 240 105" className="h-full w-auto text-white fill-current">
                <text x="15" y="75" fontFamily="serif" fontSize="68" fontWeight="bold" fill="currentColor">崇</text>
                <polygon points="120,45 230,88 230,96 120,70 10,96 10,88" fill="currentColor" />
                <text x="175" y="75" fontFamily="serif" fontSize="68" fontWeight="bold" fill="currentColor">信</text>
              </svg>
            </div>
            <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
              숭신고 미래인재반 출석부
            </h1>
          </div>

          <nav className="hidden md:flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setActiveTab('monthly')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg transition-all ${
                activeTab === 'monthly' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-4 h-4" />
              월간 출석부
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg transition-all ${
                activeTab === 'analytics' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              통계 및 분석
            </button>
          </nav>

          <div className="flex items-center gap-2.5">
            <button
              onClick={loadData}
              title="구글 시트 최신 데이터 수동 동기화"
              className="flex items-center gap-1.5 text-3xs text-slate-500 font-mono bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 rounded-lg hover:bg-slate-200 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-indigo-500' : ''}`} />
              <span className="hidden sm:inline">{lastSynced ? `동기화: ${lastSynced}` : '동기화'}</span>
            </button>

            <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-3xs font-bold">
              <button
                onClick={() => setUserRole('admin')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  userRole === 'admin' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                관리자
              </button>
              <button
                onClick={() => setUserRole('student')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  userRole === 'student' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                학생
              </button>
            </div>
          </div>

        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full space-y-6">
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
    </div>
  );
}

export default App;
