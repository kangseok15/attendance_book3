/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Student, 
  SessionType, 
  DayConfig, 
  AttendanceStatus, 
  AttendanceRecord,
  UserRole
} from './types/attendance';
import { 
  generateMonthDays 
} from './data/initialData';
import { 
  loadStudents, 
  saveStudents, 
  loadAttendanceRecords, 
  saveAttendanceRecords,
  loadUserRole,
  saveUserRole,
  loadLockPastDates,
  saveLockPastDates
} from './utils/storage';
import { fetchFromGoogleSheets, syncToGoogleSheets } from './utils/googleSync';
import { Header, ViewTab } from './components/Header';
import { MonthlyGridView } from './components/MonthlyGridView';
import { DailyCheckinView } from './components/DailyCheckinView';
import { StudentRosterView } from './components/StudentRosterView';
import { AnalyticsView } from './components/AnalyticsView';
import { ParentNotificationModal } from './components/ParentNotificationModal';
import { GoogleSheetsExportModal } from './components/GoogleSheetsExportModal';
import { MonthConfigModal } from './components/MonthConfigModal';
import { RoleAuthModal } from './components/RoleAuthModal';
import { ClearAttendanceModal } from './components/ClearAttendanceModal';
import { 
  getRecordKey, 
  isStudentExcluded, 
  isStudentExcludedOnDate, 
  sortStudents, 
  isPastDate, 
  getTodayDateStr,
  isStudentAttendanceLocked
} from './utils/attendanceHelpers';
import { RefreshCw } from 'lucide-react';

export default function App() {
  const getInitialRole = (): UserRole => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlRole = params.get('role');
      if (urlRole === 'admin' || urlRole === 'teacher' || urlRole === 'student') {
        return urlRole as UserRole;
      }
      const hash = window.location.hash.replace(/^#/, '');
      if (hash === 'admin' || hash === 'teacher' || hash === 'student') {
        return hash as UserRole;
      }
      const hashParams = new URLSearchParams(hash);
      const hashRole = hashParams.get('role');
      if (hashRole === 'admin' || hashRole === 'teacher' || hashRole === 'student') {
        return hashRole as UserRole;
      }
    }
    return loadUserRole();
  };

  const [userRole, setUserRole] = useState<UserRole>(() => getInitialRole());
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [targetRoleToSwitch, setTargetRoleToSwitch] = useState<UserRole>(userRole);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.get('role') !== userRole) {
        url.searchParams.set('role', userRole);
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, [userRole]);

  useEffect(() => {
    const handleUrlChange = () => {
      const params = new URLSearchParams(window.location.search);
      let urlRole = params.get('role');
      if (!urlRole) {
        const hash = window.location.hash.replace(/^#/, '');
        if (hash === 'admin' || hash === 'teacher' || hash === 'student') {
          urlRole = hash;
        } else {
          const hashParams = new URLSearchParams(hash);
          urlRole = hashParams.get('role');
        }
      }
      if (urlRole === 'admin' || urlRole === 'teacher' || urlRole === 'student') {
        setUserRole(urlRole as UserRole);
        saveUserRole(urlRole as UserRole);
      }
    };
    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);

  const [activeTab, setActiveTab] = useState<ViewTab>('monthly');
  const [session, setSession] = useState<SessionType>('morning');

  const todayStr = getTodayDateStr();
  const todayYear = parseInt(todayStr.split('-')[0], 10) || 2026;
  const todayMonth = parseInt(todayStr.split('-')[1], 10) || 8;

  const [year, setYear] = useState<number>(todayYear);
  const [month, setMonth] = useState<number>(todayMonth);

  const handleRoleChange = (newRole: UserRole) => {
    setUserRole(newRole);
    saveUserRole(newRole);
    if (newRole === 'teacher' && (activeTab === 'daily' || activeTab === 'students')) {
      setActiveTab('monthly');
    } else if (newRole === 'student' && (activeTab === 'students' || activeTab === 'analytics')) {
      setActiveTab('monthly');
    }
  };

  const handleOpenRoleModal = (targetRole?: UserRole) => {
    setTargetRoleToSwitch(targetRole || userRole);
    setIsRoleModalOpen(true);
  };

  const [students, setStudents] = useState<Student[]>(() => loadStudents());
  const [records, setRecords] = useState<Record<string, AttendanceRecord>>(() => 
    loadAttendanceRecords()
  );

  // 최신 상태를 실시간 보존하는 ref (비동기 병목 및 덮어쓰기 방지)
  const studentsRef = useRef(students);
  studentsRef.current = students;
  const recordsRef = useRef(records);
  recordsRef.current = records;

  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncText, setLastSyncText] = useState<string>('');
  const isInitialRemoteLoadDone = useRef(false);
  const debounceTimerRef = useRef<any>(null);

  // 구글 시트로 안전하게 디바운스 전송 (빠른 클릭 시 마지막 상태만 전송)
  const triggerRemoteSync = () => {
    if (!isInitialRemoteLoadDone.current) return;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      syncToGoogleSheets({ 
        students: studentsRef.current, 
        records: recordsRef.current 
      });
      const now = new Date();
      setLastSyncText(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`);
    }, 800);
  };

  // 구글 시트 원격 데이터 불러오기
  const refreshRemoteData = async (showLoading = true) => {
    if (showLoading) setIsSyncing(true);
    try {
      const remote = await fetchFromGoogleSheets();
      if (remote) {
        if (remote.students && remote.students.length > 0) {
          setStudents(remote.students);
          saveStudents(remote.students);
        }
        if (remote.records && Object.keys(remote.records).length > 0) {
          // 로컬에 방금 입력된 상태가 있으면 병합 보존
          setRecords(prev => {
            const merged = { ...remote.records, ...prev };
            saveAttendanceRecords(merged);
            return merged;
          });
        }
        const now = new Date();
        setLastSyncText(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`);
      }
    } finally {
      if (showLoading) setIsSyncing(false);
      isInitialRemoteLoadDone.current = true;
    }
  };

  useEffect(() => {
    refreshRemoteData(true);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      refreshRemoteData(false);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateStudents = (newStudents: Student[]) => {
    const sorted = sortStudents(newStudents, [3, 2, 1], true);
    setStudents(sorted);
    saveStudents(sorted);
    triggerRemoteSync();
  };

  const [daysConfig, setDaysConfig] = useState<{
    morning: DayConfig[];
    night: DayConfig[];
  }>(() => ({
    morning: generateMonthDays(todayYear, todayMonth, 'morning', (todayYear === 2026 && todayMonth === 8) ? [19, 20, 21, 24, 25, 26, 27, 28, 31] : undefined),
    night: generateMonthDays(todayYear, todayMonth, 'night', (todayYear === 2026 && todayMonth === 8) ? [20, 21, 24, 25, 27, 28, 31] : undefined),
  }));

  const allDaysInMonth = daysConfig[session] || [];
  const activeDays = useMemo(() => allDaysInMonth.filter(d => d.enabled), [allDaysInMonth]);

  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    const today = getTodayDateStr();
    const initActive = generateMonthDays(todayYear, todayMonth, 'morning', (todayYear === 2026 && todayMonth === 8) ? [19, 20, 21, 24, 25, 26, 27, 28, 31] : undefined).filter(d => d.enabled);
    if (initActive.some(d => d.dateStr === today)) {
      return today;
    }
    return initActive[0]?.dateStr || today;
  });

  useEffect(() => {
    const today = getTodayDateStr();
    if (activeDays.some(d => d.dateStr === today)) {
      setSelectedDateStr(today);
    } else if (activeDays.length > 0 && !activeDays.some(d => d.dateStr === selectedDateStr)) {
      setSelectedDateStr(activeDays[0].dateStr);
    }
  }, [session, activeDays]);

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isMonthConfigModalOpen, setIsMonthConfigModalOpen] = useState(false);
  const [isClearAttendanceModalOpen, setIsClearAttendanceModalOpen] = useState(false);

  const [lockPastDates, setLockPastDates] = useState<boolean>(() => loadLockPastDates());
  const handleToggleLockPastDates = () => {
    setLockPastDates(prev => {
      const next = !prev;
      saveLockPastDates(next);
      return next;
    });
  };

  const [parentModalData, setParentModalData] = useState<{
    isOpen: boolean;
    dateStr: string;
    list: { student: Student; status: AttendanceStatus; reason?: string }[];
  }>({
    isOpen: false,
    dateStr: selectedDateStr,
    list: [],
  });

  const handleSetYearMonth = (newYear: number, newMonth: number) => {
    setYear(newYear);
    setMonth(newMonth);
    const newMorningDays = (newMonth === 8 && newYear === 2026)
      ? generateMonthDays(newYear, newMonth, 'morning', [19, 20, 21, 24, 25, 26, 27, 28, 31])
      : generateMonthDays(newYear, newMonth, 'morning');
    const newNightDays = (newMonth === 8 && newYear === 2026)
      ? generateMonthDays(newYear, newMonth, 'night', [20, 21, 24, 25, 27, 28, 31])
      : generateMonthDays(newYear, newMonth, 'night');
    setDaysConfig({ morning: newMorningDays, night: newNightDays });
    
    const currentActive = (session === 'morning' ? newMorningDays : newNightDays).filter(d => d.enabled);
    const today = getTodayDateStr();
    if (currentActive.some(d => d.dateStr === today)) {
      setSelectedDateStr(today);
    } else if (currentActive.length > 0) {
      setSelectedDateStr(currentActive[0].dateStr);
    }
  };

  // ★ 연속 클릭 시에도 이전 상태가 덮어써지지 않도록 함수형 갱신 적용
  const handleUpdateRecord = (
    studentId: string,
    dateStr: string,
    status: AttendanceStatus,
    reason?: string,
    checkInTime?: string
  ) => {
    if (userRole === 'teacher') return;
    if (userRole === 'student') {
      const lockCheck = isStudentAttendanceLocked(session, dateStr);
      if (lockCheck.isLocked) return;
    }

    const key = getRecordKey(studentId, session, dateStr);
    const now = new Date();
    const currentTimestamp = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    setRecords(prev => {
      let finalCheckInTime: string | undefined = undefined;
      if (status !== 'NONE') {
        finalCheckInTime = checkInTime !== undefined ? checkInTime : (prev[key]?.checkInTime || currentTimestamp);
      }

      const updated = {
        ...prev,
        [key]: {
          status,
          reason: reason !== undefined ? reason : prev[key]?.reason,
          checkInTime: finalCheckInTime,
        },
      };

      saveAttendanceRecords(updated);
      return updated;
    });

    triggerRemoteSync();
  };

  const handleBatchUpdateDay = (dateStr: string, status: AttendanceStatus, gradeFilter?: number) => {
    if (userRole === 'teacher' || userRole === 'student') return;
    const now = new Date();
    const currentTimestamp = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    setRecords(prev => {
      const updated = { ...prev };
      students
        .filter(st => st.active && !isStudentExcluded(st, session, dateStr) && (gradeFilter === undefined || st.grade === gradeFilter))
        .forEach(st => {
          const key = getRecordKey(st.id, session, dateStr);
          updated[key] = {
            status,
            reason: prev[key]?.reason,
            checkInTime: status !== 'NONE' ? (prev[key]?.checkInTime || currentTimestamp) : undefined,
          };
        });
      saveAttendanceRecords(updated);
      return updated;
    });

    triggerRemoteSync();
  };

  const handleFillDayAbsent = (dateStr: string, gradeFilter?: number) => {
    if (userRole === 'teacher' || userRole === 'student') return;
    const now = new Date();
    const currentTimestamp = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    setRecords(prev => {
      const updated = { ...prev };
      students
        .filter(st => st.active && !isStudentExcluded(st, session, dateStr) && (gradeFilter === undefined || st.grade === gradeFilter))
        .forEach(st => {
          const key = getRecordKey(st.id, session, dateStr);
          const currentStatus = prev[key]?.status;
          if (!currentStatus || currentStatus === 'NONE') {
            updated[key] = {
              status: 'ABSENT',
              reason: prev[key]?.reason,
              checkInTime: currentTimestamp,
            };
          }
        });
      saveAttendanceRecords(updated);
      return updated;
    });

    triggerRemoteSync();
  };

  const handleToggleDay = (dateStr: string) => {
    setDaysConfig(prev => ({
      ...prev,
      [session]: prev[session].map(d => (d.dateStr === dateStr ? { ...d, enabled: !d.enabled } : d)),
    }));
  };

  const handleSetPreset = (preset: 'standard' | 'weekdays' | 'sample8' | 'all' | 'none') => {
    if (preset === 'standard') {
      const stdDays = month === 8 && year === 2026
        ? (session === 'morning'
            ? generateMonthDays(year, month, 'morning', [19, 20, 21, 24, 25, 26, 27, 28, 31])
            : generateMonthDays(year, month, 'night', [20, 21, 24, 25, 27, 28, 31]))
        : generateMonthDays(year, month, session);
      setDaysConfig(prev => ({ ...prev, [session]: stdDays }));
      return;
    }
    setDaysConfig(prev => ({
      ...prev,
      [session]: prev[session].map(d => {
        let isEn = false;
        if (preset === 'weekdays') {
          isEn = session === 'night' 
            ? (d.dayOfWeek !== '토' && d.dayOfWeek !== '일' && d.dayOfWeek !== '수')
            : (d.dayOfWeek !== '토' && d.dayOfWeek !== '일');
        } else if (preset === 'sample8') {
          isEn = session === 'night'
            ? [20, 21, 24, 25, 27, 28, 31].includes(d.dayNum)
            : [19, 20, 21, 24, 25, 26, 27, 28, 31].includes(d.dayNum);
        } else if (preset === 'all') isEn = true;
        return { ...d, enabled: isEn };
      }),
    }));
  };

  const handleClearDate = (dateStr: string, gradeFilter?: number, targetSession?: SessionType | 'both') => {
    const sessionToClear = targetSession || session;
    setRecords(prev => {
      const updated = { ...prev };
      students
        .filter(st => gradeFilter === undefined || st.grade === gradeFilter)
        .forEach(st => {
          if (sessionToClear === 'both') {
            delete updated[getRecordKey(st.id, 'morning', dateStr)];
            delete updated[getRecordKey(st.id, 'night', dateStr)];
          } else {
            delete updated[getRecordKey(st.id, sessionToClear, dateStr)];
          }
        });
      saveAttendanceRecords(updated);
      return updated;
    });
    triggerRemoteSync();
  };

  const handleClearMonthSession = (targetYear: number, targetMonth: number, targetSession: SessionType | 'both') => {
    const monthPrefix = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
    setRecords(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(key => {
        const parts = key.split('_');
        if (parts.length >= 3) {
          const keySession = parts[1] as SessionType;
          const keyDate = parts[2];
          const isMatchingSession = targetSession === 'both' || keySession === targetSession;
          if (isMatchingSession && keyDate.startsWith(monthPrefix)) {
            delete updated[key];
          }
        }
      });
      saveAttendanceRecords(updated);
      return updated;
    });
    triggerRemoteSync();
  };

  const handleClearAll = () => {
    setRecords({});
    saveAttendanceRecords({});
    triggerRemoteSync();
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      
      {/* Realtime Sync Status Indicator */}
      <div className="bg-slate-900 text-slate-300 text-3xs px-4 py-1 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-amber-400 animate-spin' : 'bg-emerald-400'}`} />
          <span>{isSyncing ? '구글 스프레드시트 동기화 중...' : '구글 시트 실시간 연결됨'}</span>
          {lastSyncText && <span className="opacity-60">(마지막 동기화: {lastSyncText})</span>}
        </div>
        <button 
          onClick={() => refreshRemoteData(true)} 
          className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer text-indigo-300 font-bold"
        >
          <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>지금 동기화</span>
        </button>
      </div>

      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        session={session}
        setSession={setSession}
        year={year}
        month={month}
        setYearMonth={handleSetYearMonth}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onOpenMonthConfigModal={() => setIsMonthConfigModalOpen(true)}
        onClearAttendance={() => setIsClearAttendanceModalOpen(true)}
        studentCount={students.length}
        userRole={userRole}
        onOpenRoleModal={handleOpenRoleModal}
        onDirectSelectRole={handleRoleChange}
        lockPastDates={lockPastDates}
        onToggleLockPastDates={handleToggleLockPastDates}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'monthly' && (
          <MonthlyGridView
            students={students}
            session={session}
            year={year}
            month={month}
            activeDays={activeDays}
            records={records}
            onUpdateRecord={handleUpdateRecord}
            onBatchUpdateDay={handleBatchUpdateDay}
            onFillDayAbsent={handleFillDayAbsent}
            onUpdateStudents={handleUpdateStudents}
            onSessionChange={setSession}
            onClearDate={handleClearDate}
            onOpenClearModal={() => setIsClearAttendanceModalOpen(true)}
            userRole={userRole}
            lockPastDates={lockPastDates}
            onToggleLockPastDates={handleToggleLockPastDates}
          />
        )}

        {activeTab === 'daily' && (
          <DailyCheckinView
            students={students}
            session={session}
            setSession={setSession}
            activeDays={activeDays}
            selectedDateStr={selectedDateStr}
            setSelectedDateStr={setSelectedDateStr}
            records={records}
            onUpdateRecord={handleUpdateRecord}
            onBatchUpdateDay={handleBatchUpdateDay}
            onFillDayAbsent={handleFillDayAbsent}
            onOpenParentModal={list => {
              setParentModalData({
                isOpen: true,
                dateStr: selectedDateStr,
                list,
              });
            }}
            onClearDate={handleClearDate}
            onOpenClearModal={() => setIsClearAttendanceModalOpen(true)}
            userRole={userRole}
            lockPastDates={lockPastDates}
            onToggleLockPastDates={handleToggleLockPastDates}
          />
        )}

        {activeTab === 'students' && (
          <StudentRosterView
            students={students}
            onUpdateStudents={handleUpdateStudents}
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

      <RoleAuthModal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        targetRole={targetRoleToSwitch}
        currentRole={userRole}
        onConfirmRole={handleRoleChange}
      />

      <GoogleSheetsExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        session={session}
        year={year}
        month={month}
        activeDays={activeDays}
        students={students}
        records={records}
      />

      <MonthConfigModal
        isOpen={isMonthConfigModalOpen}
        onClose={() => setIsMonthConfigModalOpen(false)}
        session={session}
        year={year}
        month={month}
        allDaysInMonth={allDaysInMonth}
        onToggleDay={handleToggleDay}
        onSetPreset={handleSetPreset}
      />

      <ParentNotificationModal
        isOpen={parentModalData.isOpen}
        onClose={() => setParentModalData(prev => ({ ...prev, isOpen: false }))}
        session={session}
        dateStr={parentModalData.dateStr}
        absentList={parentModalData.list}
      />

      <ClearAttendanceModal
        isOpen={isClearAttendanceModalOpen}
        onClose={() => setIsClearAttendanceModalOpen(false)}
        year={year}
        month={month}
        session={session}
        activeDays={activeDays}
        currentSelectedDateStr={selectedDateStr}
        onClearDate={handleClearDate}
        onClearMonthSession={handleClearMonthSession}
        onClearAll={handleClearAll}
        userRole={userRole}
        onOpenRoleModal={() => handleOpenRoleModal('admin')}
      />

    </div>
  );
}
