import React, { useState, useEffect, useRef } from 'react';
import { Student, AttendanceRecord, Role, MonthKey } from './types/attendance';
import { initialStudents } from './data/initialData';
import { Header } from './components/Header';
import { MonthlyGridView } from './components/MonthlyGridView';
import { DailyCheckinView } from './components/DailyCheckinView';
import { StudentRosterView } from './components/StudentRosterView';
import { AnalyticsView } from './components/AnalyticsView';
import { RoleAuthModal } from './components/RoleAuthModal';
import { MonthConfigModal } from './components/MonthConfigModal';
import { ClearAttendanceModal } from './components/ClearAttendanceModal';
import { PrintAttendanceModal } from './components/PrintAttendanceModal';
import { ParentNotificationModal } from './components/ParentNotificationModal';
import { GoogleSheetsExportModal } from './components/GoogleSheetsExportModal';
import { syncToGoogleSheets, fetchFromGoogleSheets } from './utils/googleSync';
import { loadFromStorage, saveToStorage } from './utils/storage';

export function App() {
  const [role, setRole] = useState<Role>('teacher');
  const [activeTab, setActiveTab] = useState<'monthly' | 'daily' | 'roster' | 'analytics'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState<MonthKey>('8');
  const [session, setSession] = useState<'morning' | 'night'>('morning');
  const [selectedGrade, setSelectedGrade] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // 상태 관리
  const [students, setStudents] = useState<Student[]>(() => {
    return loadFromStorage('mirae_students', initialStudents);
  });

  const [records, setRecords] = useState<Record<string, AttendanceRecord>>(() => {
    return loadFromStorage('mirae_records', {});
  });

  // 모달 상태
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isMonthConfigOpen, setIsMonthConfigOpen] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isParentModalOpen, setIsParentModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // 로컬 저장소 동기화
  useEffect(() => {
    saveToStorage('mirae_students', students);
  }, [students]);

  useEffect(() => {
    saveToStorage('mirae_records', records);
  }, [records]);

  // 🔄 [핵심] 10초 주기 구글 스프레드시트 실시간 자동 동기화 (Auto Polling)
  useEffect(() => {
    const runAutoSync = async () => {
      try {
        const cloudData = await fetchFromGoogleSheets();
        if (cloudData) {
          if (cloudData.records && Object.keys(cloudData.records).length > 0) {
            setRecords(prev => {
              const prevJson = JSON.stringify(prev);
              const nextJson = JSON.stringify(cloudData.records);
              if (prevJson !== nextJson) {
                return cloudData.records!;
              }
              return prev;
            });
          }
          if (cloudData.students && cloudData.students.length > 0) {
            setStudents(prev => {
              const prevJson = JSON.stringify(prev);
              const nextJson = JSON.stringify(cloudData.students);
              if (prevJson !== nextJson) {
                return cloudData.students!;
              }
              return prev;
            });
          }
        }
      } catch (err) {
        console.warn('구글 시트 자동 동기화 대기 중...', err);
      }
    };

    // 1) 페이지 진입 시 즉시 1회 로드
    runAutoSync();

    // 2) 10초마다 백그라운드 자동 동기화
    const interval = setInterval(runAutoSync, 10000);
    return () => clearInterval(interval);
  }, []);

  // 단일 출결 수정 핸들러 (수정 즉시 구글 시트로 전송)
  const handleRecordChange = (recordKey: string, newRecord: AttendanceRecord) => {
    setRecords(prev => {
      const updated = { ...prev, [recordKey]: newRecord };
      // 백엔드로 단일 레코드 즉시 동기화
      syncToGoogleSheets({ recordKey, record: newRecord });
      return updated;
    });
  };

  // 학생 명단 변경 핸들러
  const handleStudentsChange = (newStudents: Student[]) => {
    setStudents(newStudents);
    syncToGoogleSheets({ students: newStudents, records });
  };

  // 출결 초기화 핸들러
  const handleClearRecords = (keysToRemove: string[]) => {
    setRecords(prev => {
      const next = { ...prev };
      keysToRemove.forEach(k => delete next[k]);
      syncToGoogleSheets({ records: next });
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      {/* 헤더 */}
      <Header
        role={role}
        activeTab={activeTab}
        selectedMonth={selectedMonth}
        session={session}
        onRoleClick={() => setIsAuthModalOpen(true)}
        onTabChange={setActiveTab}
        onMonthChange={setSelectedMonth}
        onSessionChange={setSession}
        onOpenMonthConfig={() => setIsMonthConfigOpen(true)}
        onOpenExport={() => setIsExportModalOpen(true)}
      />

      {/* 메인 뷰 */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {activeTab === 'monthly' && (
          <MonthlyGridView
            role={role}
            month={selectedMonth}
            session={session}
            students={students}
            records={records}
            selectedGrade={selectedGrade}
            searchQuery={searchQuery}
            onGradeChange={setSelectedGrade}
            onSearchChange={setSearchQuery}
            onRecordChange={handleRecordChange}
            onOpenClearModal={() => setIsClearModalOpen(true)}
            onOpenPrintModal={() => setIsPrintModalOpen(true)}
            onOpenParentModal={() => setIsParentModalOpen(true)}
          />
        )}

        {activeTab === 'daily' && (
          <DailyCheckinView
            role={role}
            session={session}
            students={students}
            records={records}
            onRecordChange={handleRecordChange}
          />
        )}

        {activeTab === 'roster' && (
          <StudentRosterView
            role={role}
            students={students}
            onStudentsChange={handleStudentsChange}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsView
            students={students}
            records={records}
            selectedMonth={selectedMonth}
          />
        )}
      </main>

      {/* 권한 변경 모달 */}
      <RoleAuthModal
        isOpen={isAuthModalOpen}
        currentRole={role}
        onClose={() => setIsAuthModalOpen(false)}
        onRoleChange={setRole}
      />

      {/* 월별 설정 모달 */}
      <MonthConfigModal
        isOpen={isMonthConfigOpen}
        month={selectedMonth}
        onClose={() => setIsMonthConfigOpen(false)}
      />

      {/* 출결 비우기 모달 */}
      <ClearAttendanceModal
        isOpen={isClearModalOpen}
        month={selectedMonth}
        session={session}
        records={records}
        onClose={() => setIsClearModalOpen(false)}
        onClear={handleClearRecords}
      />

      {/* 인쇄 모달 */}
      <PrintAttendanceModal
        isOpen={isPrintModalOpen}
        month={selectedMonth}
        session={session}
        students={students}
        records={records}
        onClose={() => setIsPrintModalOpen(false)}
      />

      {/* 학부모 알림 모달 */}
      <ParentNotificationModal
        isOpen={isParentModalOpen}
        month={selectedMonth}
        session={session}
        students={students}
        records={records}
        onClose={() => setIsParentModalOpen(false)}
      />

      {/* 구글 시트 내보내기 모달 */}
      <GoogleSheetsExportModal
        isOpen={isExportModalOpen}
        students={students}
        records={records}
        onClose={() => setIsExportModalOpen(false)}
      />
    </div>
  );
}

export default App;
