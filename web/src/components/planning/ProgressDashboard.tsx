'use client';

import { useMemo } from 'react';
import {
  CheckCircleIcon,
  ClockIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { PlanningBoard, PlanningCard, WorkloadEntry } from '@/stores/useStore';

interface ProgressDashboardProps {
  board: PlanningBoard | null;
  workload: WorkloadEntry[];
}

const COLUMN_LABELS: Record<string, { label: string; color: string }> = {
  backlog: { label: 'Backlog', color: 'bg-neutral-400' },
  todo: { label: 'To Do', color: 'bg-blue-500' },
  in_progress: { label: 'In Progress', color: 'bg-amber-500' },
  review: { label: 'Review', color: 'bg-purple-500' },
  done: { label: 'Done', color: 'bg-green-500' },
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-amber-500',
  medium: 'bg-blue-500',
  low: 'bg-neutral-400',
};

export default function ProgressDashboard({ board, workload }: ProgressDashboardProps) {
  const stats = useMemo(() => {
    if (!board) return null;

    const allCards: PlanningCard[] = Object.values(board.columns).flat();
    const total = allCards.length;
    const done = (board.columns['done'] || []).length;
    const inProgress = (board.columns['in_progress'] || []).length;
    const inReview = (board.columns['review'] || []).length;
    const todo = (board.columns['todo'] || []).length;

    // Weighted progress: backlog 0%, todo 20%, in_progress 50%, review 80%, done 100%
    const WEIGHTS: Record<string, number> = { backlog: 0, todo: 20, in_progress: 50, review: 80, done: 100 };
    const weightedSum = Object.entries(board.columns).reduce((sum, [col, cards]) => {
      return sum + (cards as PlanningCard[]).length * (WEIGHTS[col] || 0);
    }, 0);
    const pct = total > 0 ? Math.round(weightedSum / total) : 0;

    // Per-column counts
    const columnCounts = Object.entries(COLUMN_LABELS).map(([key, meta]) => ({
      key,
      label: meta.label,
      color: meta.color,
      count: (board.columns[key] || []).length,
    }));

    // Priority breakdown
    const priorityCounts: Record<string, number> = {};
    allCards.forEach((c) => {
      priorityCounts[c.priority] = (priorityCounts[c.priority] || 0) + 1;
    });

    // Hours
    const totalEstimated = allCards.reduce((s, c) => s + (c.estimated_hours || 0), 0);
    const totalActual = allCards.reduce((s, c) => s + (c.actual_hours || 0), 0);

    // AC progress
    const totalAC = allCards.reduce((s, c) => s + c.ac_total, 0);
    const completedAC = allCards.reduce((s, c) => s + c.ac_completed, 0);
    const acPct = totalAC > 0 ? Math.round((completedAC / totalAC) * 100) : 0;

    // Deferred / out-of-scope
    const deferredCount = allCards.filter((c) => c.node_status === 'deferred').length;
    const oosCount = allCards.filter((c) => c.is_out_of_scope).length;

    return {
      total, done, inProgress, inReview, todo, pct,
      columnCounts, priorityCounts,
      totalEstimated, totalActual,
      totalAC, completedAC, acPct,
      deferredCount, oosCount,
    };
  }, [board]);

  if (!stats) {
    return (
      <div className="flex items-center justify-center py-12 text-neutral-400 text-sm">
        No board data available.
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Top-level KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI label="Total Cards" value={stats.total} icon={ChartBarIcon} color="text-neutral-700" />
        <KPI label="Done" value={stats.done} icon={CheckCircleIcon} color="text-green-600" />
        <KPI label="Active" value={stats.todo + stats.inProgress + stats.inReview} icon={ClockIcon} color="text-amber-600" />
        <KPI
          label="Progress"
          value={`${stats.pct}%`}
          icon={CheckCircleIcon}
          color={stats.pct >= 75 ? 'text-green-600' : stats.pct >= 40 ? 'text-amber-600' : 'text-neutral-600'}
        />
      </div>

      {/* Overall progress bar — stacked by column */}
      <div>
        <div className="flex items-center justify-between text-xs text-neutral-500 mb-1">
          <span>Overall Progress (weighted)</span>
          <span>{stats.pct}% — {stats.done} done, {stats.inReview} review, {stats.inProgress} in progress, {stats.todo} to do</span>
        </div>
        <div className="w-full h-3 rounded-full bg-neutral-200 overflow-hidden flex">
          {/* stacked segments: done → review → in_progress → todo */}
          {stats.total > 0 && (
            <>
              {stats.done > 0 && (
                <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${(stats.done / stats.total) * 100}%` }} />
              )}
              {stats.inReview > 0 && (
                <div className="h-full bg-purple-500 transition-all duration-500" style={{ width: `${(stats.inReview / stats.total) * 100}%` }} />
              )}
              {stats.inProgress > 0 && (
                <div className="h-full bg-amber-500 transition-all duration-500" style={{ width: `${(stats.inProgress / stats.total) * 100}%` }} />
              )}
              {stats.todo > 0 && (
                <div className="h-full bg-blue-400 transition-all duration-500" style={{ width: `${(stats.todo / stats.total) * 100}%` }} />
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-neutral-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />Done</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500" />Review</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />In Progress</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" />To Do</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-neutral-200" />Backlog</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cards per column */}
        <div className="rounded-md border border-neutral-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-neutral-800 mb-3">Cards per Status</h4>
          <div className="space-y-2">
            {stats.columnCounts.map((col) => (
              <div key={col.key} className="flex items-center gap-3">
                <span className="text-xs text-neutral-600 w-20">{col.label}</span>
                <div className="flex-1 h-2 rounded-full bg-neutral-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${col.color} transition-all`}
                    style={{ width: stats.total > 0 ? `${(col.count / stats.total) * 100}%` : '0%' }}
                  />
                </div>
                <span className="text-xs font-medium text-neutral-700 w-6 text-right">{col.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Priority breakdown */}
        <div className="rounded-md border border-neutral-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-neutral-800 mb-3">Priority Breakdown</h4>
          <div className="space-y-2">
            {Object.entries(PRIORITY_COLORS).map(([priority, color]) => {
              const count = stats.priorityCounts[priority] || 0;
              return (
                <div key={priority} className="flex items-center gap-3">
                  <span className="text-xs text-neutral-600 w-20 capitalize">{priority}</span>
                  <div className="flex-1 h-2 rounded-full bg-neutral-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${color} transition-all`}
                      style={{ width: stats.total > 0 ? `${(count / stats.total) * 100}%` : '0%' }}
                    />
                  </div>
                  <span className="text-xs font-medium text-neutral-700 w-6 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Hours tracking */}
        <div className="rounded-md border border-neutral-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-neutral-800 mb-3">Time Tracking</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-neutral-400">Estimated</p>
              <p className="text-xl font-bold text-neutral-800">{stats.totalEstimated}h</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-neutral-400">Actual</p>
              <p className="text-xl font-bold text-neutral-800">{stats.totalActual}h</p>
            </div>
          </div>
          {stats.totalEstimated > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-[10px] text-neutral-400 mb-1">
                <span>Hours used</span>
                <span>{Math.round((stats.totalActual / stats.totalEstimated) * 100)}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    stats.totalActual > stats.totalEstimated ? 'bg-red-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min(100, (stats.totalActual / stats.totalEstimated) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* AC progress + flags */}
        <div className="rounded-md border border-neutral-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-neutral-800 mb-3">Acceptance Criteria</h4>
          <div className="flex items-center gap-4 mb-3">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-neutral-400">Completed</p>
              <p className="text-xl font-bold text-neutral-800">{stats.completedAC}/{stats.totalAC}</p>
            </div>
            <div className="flex-1 h-2 rounded-full bg-neutral-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${stats.acPct}%` }}
              />
            </div>
            <span className="text-xs font-medium text-neutral-600">{stats.acPct}%</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-neutral-500">
            {stats.deferredCount > 0 && (
              <span className="flex items-center gap-1">
                <ClockIcon className="w-3.5 h-3.5" />
                {stats.deferredCount} deferred
              </span>
            )}
            {stats.oosCount > 0 && (
              <span className="flex items-center gap-1">
                <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                {stats.oosCount} out-of-scope
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Team workload */}
      {workload.length > 0 && (
        <div className="rounded-md border border-neutral-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-neutral-800 mb-3">Team Workload</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-neutral-500 border-b border-neutral-100">
                  <th className="py-2 font-medium">Member</th>
                  <th className="py-2 font-medium text-center">Cards</th>
                  <th className="py-2 font-medium text-center">In Progress</th>
                  <th className="py-2 font-medium text-center">Done</th>
                  <th className="py-2 font-medium text-center">Est h</th>
                  <th className="py-2 font-medium text-center">Actual h</th>
                  <th className="py-2 font-medium">Progress</th>
                </tr>
              </thead>
              <tbody>
                {workload.map((w) => {
                  const pct = w.progress_percentage ?? (w.total_cards > 0 ? Math.round((w.completed_cards / w.total_cards) * 100) : 0);
                  return (
                    <tr key={w.team_member_id} className="border-b border-neutral-50">
                      <td className="py-2 font-medium text-neutral-800">{w.team_member_name}</td>
                      <td className="py-2 text-center text-neutral-600">{w.total_cards}</td>
                      <td className="py-2 text-center text-amber-600">{w.in_progress_cards}</td>
                      <td className="py-2 text-center text-green-600">{w.completed_cards}</td>
                      <td className="py-2 text-center text-neutral-600">{w.estimated_hours}</td>
                      <td className="py-2 text-center text-neutral-600">{w.actual_hours}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                            <div className="h-full rounded-full bg-green-500" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-neutral-500 w-8 text-right">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function KPI({ label, value, icon: Icon, color }: {
  label: string;
  value: string | number;
  icon: typeof ChartBarIcon;
  color: string;
}) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-[10px] uppercase tracking-wide text-neutral-400">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
