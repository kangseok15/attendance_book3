import React, { useRef, useState } from 'react';
import { 
  Printer, 
  X, 
  Copy, 
  Check, 
  ExternalLink,
  FileText,
  Calendar,
  Layers,
  Settings
} from 'lucide-react';
import { 
  Student, 
  SessionType, 
  DayConfig, 
  AttendanceRecord 
} from '../types/attendance';
import { 
  calculateStudentMonthStats, 
  STATUS_META, 
  getRecordKey, 
  isStudentExcluded,
  isStudentExcludedOnDate,
  sortStudents 
} from '../utils/attendanceHelpers';

interface PrintAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  year: number;
  month: number;
  session: SessionType;
  students: Student[];
  activeDays: DayConfig[];
  records: Record<string, AttendanceRecord>;
}

export const PrintAttendanceModal: React.FC<PrintAttendanceModalProps> = ({
  isOpen,
  onClose,
  year,
  month,
  session,
  students,
  activeDays,
  records,
}) => {
  const [selectedGrade, setSelectedGrade] = useState<number | 'all'>('all');
  const [includeApprovalBox, setIncludeApprovalBox] = useState(true);
  const [copied, setCopied] = useState(false);
  const [printFontSize, setPrintFontSize] = useState<'compact' | 'normal' | 'large'>('compact');

  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const sessionName = session === 'morning' ? '아침 자율학습' : '야간 자율학습(야자)';
  const grades = selectedGrade === 'all' ? [3, 2, 1] : [selectedGrade];

  const filteredStudents = sortStudents(
    students.filter(s => selectedGrade === 'all' || s.grade === selectedGrade),
    [3, 2, 1],
    true
  );

  // Generate pure self-contained HTML for printing in hidden iframe or popup
  const generatePrintableHTML = () => {
    const title = `${year}학년도 숭신고등학교 미래인재반 ${month}월 ${sessionName} 출석부`;
    
    let tableHeaderCells = `
      <th style="width: 26px;">연번</th>
      <th style="width: 26px;">학년</th>
      <th style="width: 26px;">반</th>
      <th style="width: 26px;">번호</th>
      <th style="width: 60px;">이름</th>
    `;

    activeDays.forEach(d => {
      const isSun = d.dayOfWeek === '일';
      const isSat = d.dayOfWeek === '토';
      const dayColor = isSun ? 'color: #dc2626;' : isSat ? 'color: #2563eb;' : '';
      tableHeaderCells += `<th style="width: 20px; font-size: 8pt; ${dayColor}">${d.dayNum}<br/><span style="font-size: 7pt; font-weight: normal;">${d.dayOfWeek}</span></th>`;
    });

    tableHeaderCells += `
      <th style="width: 28px; background-color: #f0fdf4;">출석</th>
      <th style="width: 28px; background-color: #fef2f2;">결석</th>
      <th style="width: 38px; background-color: #fffbeb;">출석률</th>
      <th style="width: 70px;">학원/미참여</th>
    `;

    let rowsHTML = '';
    filteredStudents.forEach((student, idx) => {
      const stats = calculateStudentMonthStats(student, session, activeDays, records);
      const academyDaysStr = (student.academyDays && student.academyDays.length > 0)
        ? student.academyDays.join(',')
        : '-';

      let cellsHTML = `
        <td style="text-align: center; font-size: 8pt; color: #555;">${student.seq || idx + 1}</td>
        <td style="text-align: center; font-weight: bold;">${student.grade}</td>
        <td style="text-align: center;">${student.classNum}</td>
        <td style="text-align: center;">${student.studentNum}</td>
        <td style="text-align: center; font-weight: bold; white-space: nowrap;">${student.name}</td>
      `;

      activeDays.forEach(day => {
        const isExcluded = isStudentExcluded(student, session, day.dateStr, day.dayOfWeek);
        if (isExcluded) {
          cellsHTML += `<td style="background-color: #e2e8f0; color: #94a3b8; text-align: center; font-size: 7pt;">/</td>`;
          return;
        }

        const key = getRecordKey(student.id, session, day.dateStr);
        const rec = records[key];
        const status = rec?.status || 'NONE';
        const meta = STATUS_META[status];

        let sym = meta.symbol || '';
        let color = '#333';
        if (status === 'PRESENT') color = '#059669';
        else if (status === 'LATE') color = '#d97706';
        else if (status === 'EARLY_LEAVE') color = '#9333ea';
        else if (status === 'OFFICIAL_ABSENT') color = '#2563eb';
        else if (status === 'ABSENT') color = '#dc2626';

        cellsHTML += `<td style="text-align: center; font-weight: bold; font-size: 9pt; color: ${color};">${sym}</td>`;
      });

      cellsHTML += `
        <td style="text-align: center; font-weight: bold; color: #059669; background-color: #f0fdf4;">${stats.presentCount}</td>
        <td style="text-align: center; font-weight: bold; color: #dc2626; background-color: #fef2f2;">${stats.absentCount}</td>
        <td style="text-align: center; font-weight: bold; color: #b45309; background-color: #fffbeb;">${stats.rate}%</td>
        <td style="text-align: center; font-size: 7.5pt; color: #666;">${academyDaysStr}</td>
      `;

      rowsHTML += `<tr style="page-break-inside: avoid; height: 22px;">${cellsHTML}</tr>`;
    });

    const approvalBoxHTML = includeApprovalBox ? `
      <table style="border-collapse: collapse; border: 1px solid #000; font-size: 8pt; text-align: center; margin-left: auto;">
        <tr>
          <th rowspan="2" style="border: 1px solid #000; padding: 4px 6px; background-color: #f8fafc; width: 22px; writing-mode: vertical-rl; letter-spacing: 2px;">결재</th>
          <th style="border: 1px solid #000; padding: 2px 8px; width: 50px;">담 당</th>
          <th style="border: 1px solid #000; padding: 2px 8px; width: 50px;">부 장</th>
          <th style="border: 1px solid #000; padding: 2px 8px; width: 50px;">교 감</th>
          <th style="border: 1px solid #000; padding: 2px 8px; width: 50px;">교 장</th>
        </tr>
        <tr>
          <td style="border: 1px solid #000; height: 35px;"></td>
          <td style="border: 1px solid #000; height: 35px;"></td>
          <td style="border: 1px solid #000; height: 35px;"></td>
          <td style="border: 1px solid #000; height: 35px;"></td>
        </tr>
      </table>
    ` : '';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 8mm 6mm;
    }
    body {
      font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Malgun Gothic', '맑은 고딕', sans-serif;
      margin: 0;
      padding: 0;
      color: #111;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .print-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-bottom: 8px;
      border-bottom: 2px solid #000;
      padding-bottom: 6px;
    }
    .print-title h1 {
      font-size: 16pt;
      margin: 0 0 4px 0;
      font-weight: 900;
      letter-spacing: -0.5px;
    }
    .print-title p {
      font-size: 8pt;
      margin: 0;
      color: #444;
    }
    table.attendance-table {
      width: 100%;
      border-collapse: collapse;
      border: 1.5px solid #000;
      font-size: 8pt;
    }
    table.attendance-table th, 
    table.attendance-table td {
      border: 1px solid #94a3b8;
      padding: 2px 1px;
      text-align: center;
      vertical-align: middle;
    }
    table.attendance-table th {
      background-color: #f1f5f9;
      font-weight: bold;
      border-bottom: 1.5px solid #000;
    }
    .legend-box {
      margin-top: 6px;
      display: flex;
      justify-content: space-between;
      font-size: 7.5pt;
      color: #333;
      border-top: 1px solid #cbd5e1;
      padding-top: 4px;
    }
  </style>
</head>
<body>
  <div class="print-header">
    <div class="print-title">
      <h1>${title}</h1>
      <p>출석 기준: ${activeDays.length}일 운영 (재적인원: ${filteredStudents.length}명) | 출력일시: ${new Date().toLocaleDateString('ko-KR')}</p>
    </div>
    <div>${approvalBoxHTML}</div>
  </div>

  <table class="attendance-table">
    <thead>
      <tr>${tableHeaderCells}</tr>
    </thead>
    <tbody>
      ${rowsHTML}
    </tbody>
  </table>

  <div class="legend-box">
    <div><strong>기호 범례:</strong> ○ 출석 | △ 지각 | ⊘ 조퇴 | 공 공결 | X 결석 | / 학원·학사일정 미참여 요일</div>
    <div>숭신고등학교 미래인재반</div>
  </div>
</body>
</html>`;
  };

  // 1. Direct Print using hidden iframe (works 100% inside iframe sandboxes)
  const handleDirectPrint = () => {
    try {
      const printHTML = generatePrintableHTML();
      let iframe = document.getElementById('attendance-print-iframe') as HTMLIFrameElement | null;
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'attendance-print-iframe';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
      }

      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (doc) {
        doc.open();
        doc.write(printHTML);
        doc.close();

        setTimeout(() => {
          try {
            iframe?.contentWindow?.focus();
            iframe?.contentWindow?.print();
          } catch (e) {
            console.warn('Iframe print focus failed, falling back to window.print', e);
            window.print();
          }
        }, 300);
      } else {
        window.print();
      }
    } catch (err) {
      console.error('Print execution failed:', err);
      // Fallback
      window.print();
    }
  };

  // 2. Open printable page in a clean popup / standalone window
  const handleOpenPrintWindow = () => {
    const printHTML = generatePrintableHTML();
    const blob = new Blob([printHTML], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) {
      win.focus();
    } else {
      // If popup blocked, create a temporary download or direct print
      handleDirectPrint();
    }
  };

  // 3. Copy formatted table HTML to clipboard
  const handleCopyTable = async () => {
    try {
      const printHTML = generatePrintableHTML();
      await navigator.clipboard.writeText(printHTML);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Clipboard copy failed:', e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-5xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/80 dark:bg-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>월간 출석부 인쇄 및 출력 설정</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                  A4 가로 양식
                </span>
              </h2>
              <p className="text-2xs sm:text-xs text-slate-500">
                {year}년 {month}월 {sessionName} (재적: {filteredStudents.length}명)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar & Options */}
        <div className="p-3 sm:px-5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* Grade Filter */}
            <div className="inline-flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold">
              <button
                onClick={() => setSelectedGrade('all')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  selectedGrade === 'all'
                    ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                전체 학년 ({students.length}명)
              </button>
              {[3, 2, 1].map(g => (
                <button
                  key={g}
                  onClick={() => setSelectedGrade(g)}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    selectedGrade === g
                      ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {g}학년 ({students.filter(s => s.grade === g).length}명)
                </button>
              ))}
            </div>

            {/* Approval Box Toggle */}
            <label className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer select-none text-slate-700 dark:text-slate-300 font-medium">
              <input
                type="checkbox"
                checked={includeApprovalBox}
                onChange={e => setIncludeApprovalBox(e.target.checked)}
                className="rounded text-indigo-600 w-3.5 h-3.5"
              />
              <span>결재란 포함 (담당/부장/교감/교장)</span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopyTable}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-slate-700 dark:text-slate-300 transition-colors shadow-2xs"
              title="한글(HWP) 또는 엑셀에 붙여넣을 수 있는 HTML 복사"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '복사 완료!' : '양식 복사'}</span>
            </button>

            <button
              onClick={handleOpenPrintWindow}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-slate-700 dark:text-slate-300 transition-colors shadow-2xs"
              title="새 창에서 깨끗하게 열기"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>새 창 인쇄</span>
            </button>

            <button
              onClick={handleDirectPrint}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-extrabold shadow-sm transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>바로 인쇄하기</span>
            </button>
          </div>
        </div>

        {/* Print Preview Canvas (Live Preview) */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-100 dark:bg-slate-950 flex justify-center">
          <div 
            ref={printAreaRef}
            className="bg-white text-slate-900 shadow-md border border-slate-300 p-6 rounded-lg w-full max-w-4xl text-xs select-none"
            style={{ minWidth: '700px' }}
          >
            {/* Sheet Header */}
            <div className="flex justify-between items-end border-b-2 border-slate-900 pb-2 mb-3">
              <div>
                <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  {year}학년도 숭신고등학교 미래인재반 {month}월 {sessionName} 출석부
                </h1>
                <p className="text-2xs text-slate-500 mt-0.5">
                  총 운영일수: {activeDays.length}일 | 대상 학생: {filteredStudents.length}명
                </p>
              </div>

              {includeApprovalBox && (
                <table className="border-collapse border border-slate-900 text-2xs text-center">
                  <thead>
                    <tr>
                      <th rowSpan={2} className="border border-slate-900 px-1 py-2 bg-slate-100 text-3xs font-bold [writing-mode:vertical-rl]">결재</th>
                      <th className="border border-slate-900 px-2 py-0.5 w-12 font-bold">담 당</th>
                      <th className="border border-slate-900 px-2 py-0.5 w-12 font-bold">부 장</th>
                      <th className="border border-slate-900 px-2 py-0.5 w-12 font-bold">교 감</th>
                      <th className="border border-slate-900 px-2 py-0.5 w-12 font-bold">교 장</th>
                    </tr>
                    <tr>
                      <td className="border border-slate-900 h-8"></td>
                      <td className="border border-slate-900 h-8"></td>
                      <td className="border border-slate-900 h-8"></td>
                      <td className="border border-slate-900 h-8"></td>
                    </tr>
                  </thead>
                </table>
              )}
            </div>

            {/* Table Preview */}
            <div className="overflow-x-auto border border-slate-400">
              <table className="w-full border-collapse text-3xs text-center">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-400 font-bold text-slate-800">
                    <th className="border border-slate-300 py-1 px-1 w-6">연번</th>
                    <th className="border border-slate-300 py-1 px-1 w-6">학년</th>
                    <th className="border border-slate-300 py-1 px-1 w-6">반</th>
                    <th className="border border-slate-300 py-1 px-1 w-6">번호</th>
                    <th className="border border-slate-300 py-1 px-1.5 w-14 font-extrabold">이름</th>

                    {activeDays.map(d => (
                      <th 
                        key={`prev-h-${d.dateStr}`} 
                        className={`border border-slate-300 py-0.5 px-0.5 min-w-4.5 ${
                          d.dayOfWeek === '일' ? 'text-rose-600' : d.dayOfWeek === '토' ? 'text-blue-600' : ''
                        }`}
                      >
                        <div className="font-bold">{d.dayNum}</div>
                        <div className="text-3xs font-normal scale-90">{d.dayOfWeek}</div>
                      </th>
                    ))}

                    <th className="border border-slate-300 py-1 px-1 w-7 bg-emerald-50 text-emerald-800 font-bold">출석</th>
                    <th className="border border-slate-300 py-1 px-1 w-7 bg-rose-50 text-rose-800 font-bold">결석</th>
                    <th className="border border-slate-300 py-1 px-1 w-8 bg-amber-50 text-amber-800 font-bold">출석률</th>
                    <th className="border border-slate-300 py-1 px-1 w-14 font-medium">학원/미참여</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student, idx) => {
                    const stats = calculateStudentMonthStats(student, session, activeDays, records);
                    const academyDaysStr = (student.academyDays && student.academyDays.length > 0)
                      ? student.academyDays.join(',')
                      : '-';

                    return (
                      <tr key={`prev-row-${student.id}`} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="border border-slate-300 py-0.5 px-1 font-mono text-slate-500">{student.seq || idx + 1}</td>
                        <td className="border border-slate-300 py-0.5 px-1 font-bold">{student.grade}</td>
                        <td className="border border-slate-300 py-0.5 px-1">{student.classNum}</td>
                        <td className="border border-slate-300 py-0.5 px-1 font-mono">{student.studentNum}</td>
                        <td className="border border-slate-300 py-0.5 px-1 font-extrabold whitespace-nowrap text-slate-900">{student.name}</td>

                        {activeDays.map(day => {
                          const isExcluded = isStudentExcluded(student, session, day.dateStr, day.dayOfWeek);
                          if (isExcluded) {
                            return (
                              <td 
                                key={`prev-cell-${student.id}-${day.dateStr}`} 
                                className="border border-slate-300 bg-slate-200 text-slate-400 font-mono text-3xs"
                              >
                                /
                              </td>
                            );
                          }

                          const key = getRecordKey(student.id, session, day.dateStr);
                          const rec = records[key];
                          const status = rec?.status || 'NONE';
                          const meta = STATUS_META[status];

                          return (
                            <td 
                              key={`prev-cell-${student.id}-${day.dateStr}`} 
                              className={`border border-slate-300 font-bold ${meta.cellClass}`}
                            >
                              {meta.symbol}
                            </td>
                          );
                        })}

                        <td className="border border-slate-300 font-bold text-emerald-700 bg-emerald-50/50">{stats.presentCount}</td>
                        <td className="border border-slate-300 font-bold text-rose-700 bg-rose-50/50">{stats.absentCount}</td>
                        <td className="border border-slate-300 font-bold text-amber-700 bg-amber-50/50">{stats.rate}%</td>
                        <td className="border border-slate-300 text-slate-500 text-3xs">{academyDaysStr}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Sheet Footer */}
            <div className="mt-3 flex justify-between items-center text-3xs text-slate-500 border-t border-slate-200 pt-2">
              <div><strong>출결 기호:</strong> ○ 출석 | △ 지각 | ⊘ 조퇴 | 공 공결 | X 결석 | / 미참여 요일</div>
              <div className="font-bold">숭신고등학교 미래인재반</div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:px-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-500 text-2xs sm:text-xs">
            💡 [바로 인쇄하기]를 누르면 A4 가로 최적화 레이아웃으로 브라우저 인쇄창이 호출됩니다.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold text-slate-700 dark:text-slate-300 transition-colors"
          >
            닫기
          </button>
        </div>

      </div>
    </div>
  );
};
