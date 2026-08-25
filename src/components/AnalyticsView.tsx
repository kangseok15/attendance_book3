/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { Student, SessionType, DayConfig, AttendanceRecord } from '../types/attendance';
import { getRecordKey, isStudentExcludedOnDate } from '../utils/attendanceHelpers';
import { TrendingUp, Award } from 'lucide-react';

interface AnalyticsViewProps {
  students: Student[];
  session: SessionType;
  year: number;
  month: number;
  activeDays: DayConfig[];
  records: Record<string, AttendanceRecord>;
  userRole: string;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  students,
  session,
  activeDays,
  records,
}) => {
  const activeStudents = useMemo(() => students.filter(s => s.active), [students]);

  const gradeStats = useMemo(() => {
    return [3, 2, 1].map(grade => {
      const gStudents = activeStudents.filter(s => s.grade === grade);
      let totalSlots = 0;
      let presentCount = 0;
      let lateCount = 0;
      let earlyLeaveCount = 0;
      let officialAbsentCount = 0;
      let absentCount = 0;

      gStudents.forEach(st => {
        activeDays.forEach(day => {
          if (!isStudentExcludedOnDate(st, session, day.dateStr)) {
            totalSlots += 1;
            const key = getRecordKey(st.id, session, day.dateStr);
            const status = records[key]?.status;
            if (status === 'PRESENT') presentCount += 1;
            else if (status === 'LATE') lateCount += 1;
            else if (status === 'EARLY_LEAVE') earlyLeaveCount += 1;
            else if (status === 'OFFICIAL_ABSENT') officialAbsentCount += 1;
            else if (status === 'ABSENT') absentCount += 1;
          }
        });
      });

      const effectivePresent = presentCount + (lateCount * 0.7) + (earlyLeaveCount * 0.7) + officialAbsentCount;
      const rate = totalSlots > 0 ? Math.min(100, Math.round((effectivePresent / totalSlots) * 100)) : 0;
      const totalAttended = presentCount + lateCount + earlyLeaveCount + officialAbsentCount;

      return {
        grade,
        studentCount: gStudents.length,
        rate,
        totalSlots,
        totalAttended: Math.min(totalAttended, totalSlots),
      };
    });
  }, [activeStudents, activeDays, session, records]);

  const studentRankings = useMemo(() => {
    return activeStudents.map(st => {
      let eligibleDays = 0;
      let attendedDays = 0;
      let present = 0;
      let late = 0;
      let early = 0;
      let official = 0;
      let absent = 0;

      activeDays.forEach(day => {
        if (!isStudentExcludedOnDate(st, session, day.dateStr)) {
          eligibleDays += 1;
          const key = getRecordKey(st.id, session, day.dateStr);
          const s = records[key]?.status;
          if (s === 'PRESENT') { present += 1; attendedDays += 1; }
          else if (s === 'LATE') { late += 1; attendedDays += 1; }
          else if (s === 'EARLY_LEAVE') { early += 1; attendedDays += 1; }
          else if (s === 'OFFICIAL_ABSENT') { official += 1; attendedDays += 1; }
          else if (s === 'ABSENT') { absent += 1; }
        }
      });

      const effectivePresent = present + (late * 0.7) + (early * 0.7) + official;
      const rate = eligibleDays > 0 ? Math.min(100, Math.round((effectivePresent / eligibleDays) * 100)) : 0;

      return {
        student: st,
        eligibleDays,
        attendedDays: Math.min(attendedDays, eligibleDays),
        rate,
        present,
        late,
        absent
      };
    }).sort((a, b) => b.rate - a.rate || a.student.grade - b.student.grade);
  }, [activeStudents, activeDays, session, records]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {gradeStats.map(stat => (
          <div key={stat.grade} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <span className="font-bold text-slate-800 dark:text-slate-100">{stat.grade}학년 자율학습 현황</span>
              <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full font-medium text-slate-600 dark:text-slate-400">
                {stat.studentCount}명
              </span>
            </div>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-3xl font-black text-slate-900 dark:text-white">{stat.rate}%</span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {stat.totalAttended} / {stat.totalSlots} 누적 출석
              </span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  stat.grade === 3 ? 'bg-indigo-600' : stat.grade === 2 ? 'bg-emerald-500' : 'bg-purple-600'
                }`} 
                style={{ width: `${stat.rate}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-500" />
            <h3 className="font-bold text-slate-800 dark:text-slate-100">학생별 성실도 및 출석 현황</h3>
          </div>
          <span className="text-xs text-slate-500">총 {studentRankings.length}명</span>
        </div>

        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold sticky top-0 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-3 px-4 text-center">순위</th>
                <th className="py-3 px-4">학년-반-번호</th>
                <th className="py-3 px-4">이름</th>
                <th className="py-3 px-4 text-center">출석률</th>
                <th className="py-3 px-4 text-center">출석</th>
                <th className="py-3 px-4 text-center">지각</th>
                <th className="py-3 px-4 text-center">결석</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {studentRankings.map((item, index) => (
                <tr key={item.student.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4 text-center font-bold">
                    {index === 0 ? <Award className="w-4 h-4 text-amber-500 inline" /> : index + 1}
                  </td>
                  <td className="py-3 px-4 font-mono">{item.student.grade}-{item.student.classNum}-{item.student.studentNum}</td>
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{item.student.name}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded font-bold ${
                      item.rate >= 90 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40' :
                      item.rate >= 80 ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40' :
                      'bg-rose-50 text-rose-600 dark:bg-rose-950/40'
                    }`}>
                      {item.rate}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center text-emerald-600 font-semibold">{item.present}</td>
                  <td className="py-3 px-4 text-center text-amber-600 font-semibold">{item.late}</td>
                  <td className="py-3 px-4 text-center text-rose-600 font-semibold">{item.absent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
