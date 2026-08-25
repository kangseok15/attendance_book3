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
  UserRole,
  TabType 
} from './types/attendance';
import { getTodayDateStr } from './utils/attendanceHelpers';
import { fetchFromGoogleSheets, syncToGoogleSheets } from './utils/googleSync';
import { MonthlyGridView } from './components/MonthlyGridView';
import { AnalyticsView } from './components/AnalyticsView';
import { 
  Calendar, 
  Users, 
  BarChart3, 
  ShieldCheck, 
  GraduationCap, 
  User, 
  FileSpreadsheet, 
  RefreshCw,
  Sun,
  Moon
} from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>('monthly');
  const [session, setSession] = useState<SessionType>('morning');
  const [userRole, setUserRole] = useState<UserRole>('admin');
  const [year, setYear] = useState<number>(2026);
  const [month, setMonth] = useState<number>(8);

  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<Record<string, AttendanceRecord>>({});
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSynced, setLastSynced] = useState<string>('');

  // 8월 운영일 설정 예시 (필요에 따라 조율 가능)
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

  // 초기 구글 시트 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      setIsSyncing(true);
      const data = await fetchFromGoogleSheets();
      if (data) {
        if (data.students && data.students.length > 0) {
          setStudents(data.students);
        }
        if (data.records) {
          setRecords(data.records);
        }
        setLastSynced(new Date().toLocaleTimeString());
      }
      setIsSyncing(false);
    };
    loadData();
  }, []);

  // 출결 상태 업데이트 핸들러
  const handleUpdateRecord = async (
    studentId: string, 
    dateStr: string, 
    status: AttendanceStatus, 
    reason?: string,
    checkInTime?: string
  ) => {
    const key = `${studentId}_${session}_${dateStr}`;
    const nowTime = checkInTime || `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;
    
    const nextRecords = {
      ...records,
      [key]: {
        studentId,
        session,
        dateStr,
        status,
        reason: reason !== undefined ? reason : records[key]?.reason,
        checkInTime: records[key]?.checkInTime || nowTime,
        updatedAt: new Date().toISOString(),
      }
    };
    setRecords(nextRecords);

    // 구글 시트 백그라운드 동기화
    syncToGoogleSheets({ records: nextRecords });
  };

  // 일괄 결석 처리
  const handleFillDayAbsent = (dateStr: string, gradeFilter?: number) => {
    const nextRecords = { ...records };
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
    setRecords(nextRecords);
    syncToGoogleSheets({ records: nextRecords });
  };

  // 학생 학원 요일 업데이트
  const handleUpdateStudents = (updatedStudents: Student[]) => {
    setStudents(updatedStudents);
    syncToGoogleSheets({ students: updatedStudents });
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      {/* 상단 네비게이션 바 */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          
          {/* 로고 & 변경된 타이틀 */}
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

          {/* 중앙 메뉴 탭 */}
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

          {/* 우측 권한 및 동기화 상태 */}
          <div className="flex items-center gap-2.5">
            <div className="hidden lg:flex items-center gap-1.5 text-3xs text-slate-400 font-mono">
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-indigo-500' : ''}`} />
              <span>{lastSynced ? `동기화: ${lastSynced}` : '대기 중'}</span>
            </div>

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

      {/* 메인 컨텐츠 영역 */}
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
