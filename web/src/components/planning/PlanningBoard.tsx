'use client';

import { useEffect, useState } from 'react';
import { PlusIcon, UsersIcon, SparklesIcon, FunnelIcon, ChartBarIcon, XMarkIcon, ClockIcon } from '@heroicons/react/24/outline';
import { useStore, PlanningCard, TeamMember, WorkloadEntry } from '@/stores/useStore';
import PlanningCardComponent from './PlanningCard';
import TeamSelector from './TeamSelector';
import ProgressDashboard from './ProgressDashboard';

interface PlanningBoardProps {
  sessionId: string;
  readOnly?: boolean;
}

const BOARD_COLUMNS = [
  { key: 'backlog', label: 'Backlog', color: 'border-neutral-300 dark:border-neutral-600', bgColor: 'bg-neutral-50 dark:bg-neutral-800' },
  { key: 'todo', label: 'To Do', color: 'border-blue-300 dark:border-blue-700', bgColor: 'bg-blue-50 dark:bg-blue-950' },
  { key: 'in_progress', label: 'In Progress', color: 'border-amber-300 dark:border-amber-700', bgColor: 'bg-amber-50 dark:bg-amber-950' },
  { key: 'review', label: 'Review', color: 'border-purple-300 dark:border-purple-700', bgColor: 'bg-purple-50 dark:bg-purple-950' },
  { key: 'done', label: 'Done', color: 'border-green-300 dark:border-green-700', bgColor: 'bg-green-50 dark:bg-green-950' },
];

export default function PlanningBoard({ sessionId, readOnly = false }: PlanningBoardProps) {
  const {
    board, teamMembers, isLoadingBoard, workload,
    fetchBoard, bulkAddCards, moveCard, assignTeamMember, addCard,
    addMember, removeMember, unassignTeamMember,
    toggleAC, addAC, deleteAC, addComment,
    updateCardDetails, convertOutOfScope, fetchWorkload, removeCard,
  } = useStore();

  const [showTeamManager, setShowTeamManager] = useState(false);
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState<string>('');
  const [showWorkload, setShowWorkload] = useState(false);
  const [showNewCard, setShowNewCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [newCardDesc, setNewCardDesc] = useState('');
  const [newCardIsOOS, setNewCardIsOOS] = useState(false);
  const [newCardEstHours, setNewCardEstHours] = useState<string>('');
  const [creatingCard, setCreatingCard] = useState(false);
  const [activeView, setActiveView] = useState<'board' | 'workload' | 'dashboard'>('board');
  const [hideDeferred, setHideDeferred] = useState(false);

  useEffect(() => {
    fetchBoard(sessionId, assigneeFilter || undefined);
  }, [sessionId, fetchBoard, assigneeFilter]);

  const handleBulkCreate = async () => {
    await bulkAddCards({ session_id: sessionId, node_types: ['feature'], include_details: false });
  };

  const handleCreateManualCard = async () => {
    if (!newCardTitle.trim()) return;
    setCreatingCard(true);
    try {
      await addCard({
        session_id: sessionId,
        title: newCardTitle.trim(),
        description: newCardDesc.trim() || undefined,
        is_out_of_scope: newCardIsOOS,
        estimated_hours: newCardEstHours ? parseFloat(newCardEstHours) : undefined,
      });
      setNewCardTitle('');
      setNewCardDesc('');
      setNewCardIsOOS(false);
      setNewCardEstHours('');
      setShowNewCard(false);
    } finally {
      setCreatingCard(false);
    }
  };

  const handleDragStart = (cardId: string) => {
    setDraggedCardId(cardId);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const handleDrop = async (columnKey: string) => {
    if (draggedCardId) {
      await moveCard(draggedCardId, columnKey);
      setDraggedCardId(null);
    }
  };

  const handleShowWorkload = async () => {
    await fetchWorkload(sessionId);
    setActiveView('workload');
  };

  if (isLoadingBoard) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-neutral-200 border-t-neutral-600 rounded-full animate-spin" />
      </div>
    );
  }

  const totalCards = board?.total_cards || 0;
  const completedCards = board?.completed_cards || 0;
  const progressPercentage = totalCards > 0 ? Math.round((completedCards / totalCards) * 100) : 0;

  return (
    <div className="h-full flex flex-col">
      {/* Board Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Planning Board</h2>
          <div className="flex items-center gap-4 mt-1">
            <span className="text-sm text-neutral-500 dark:text-neutral-400">{totalCards} cards</span>
            {totalCards > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
                  <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${progressPercentage}%` }} />
                </div>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">{progressPercentage}% done</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Assignee Filter */}
          <div className="flex items-center gap-1">
            <FunnelIcon className="w-4 h-4 text-neutral-400" />
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="text-sm border border-neutral-200 dark:border-neutral-700 rounded-md px-2 py-1.5 bg-white dark:bg-neutral-800 dark:text-neutral-300"
            >
              <option value="">All Members</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* Hide Deferred Toggle */}
          <button
            onClick={() => setHideDeferred(!hideDeferred)}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
              hideDeferred
                ? 'bg-neutral-700 text-white border-neutral-700'
                : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700'
            }`}
          >
            <ClockIcon className="w-3.5 h-3.5" />
            {hideDeferred ? 'Deferred Hidden' : 'Hide Deferred'}
          </button>

          {/* View Toggles */}
          <div className="flex bg-neutral-100 dark:bg-neutral-800 rounded-md p-0.5">
            <button
              onClick={() => setActiveView('board')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeView === 'board' ? 'bg-white dark:bg-neutral-700 shadow-sm text-neutral-900 dark:text-neutral-100' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
              }`}
            >
              Board
            </button>
            <button
              onClick={handleShowWorkload}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeView === 'workload' ? 'bg-white dark:bg-neutral-700 shadow-sm text-neutral-900 dark:text-neutral-100' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
              }`}
            >
              <ChartBarIcon className="w-3.5 h-3.5 inline mr-1" />
              Workload
            </button>
            <button
              onClick={() => { fetchWorkload(sessionId); setActiveView('dashboard'); }}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeView === 'dashboard' ? 'bg-white dark:bg-neutral-700 shadow-sm text-neutral-900 dark:text-neutral-100' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
              }`}
            >
              Dashboard
            </button>
          </div>

          <button
            onClick={() => setShowTeamManager(!showTeamManager)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium
                       bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
          >
            <UsersIcon className="w-4 h-4" />
            Team ({teamMembers.length})
          </button>

          {!readOnly && (
            <>
              <button
                onClick={() => setShowNewCard(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium
                           bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                New Card
              </button>

              <button
                onClick={handleBulkCreate}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium
                           bg-neutral-900 text-white hover:bg-neutral-800 transition-colors shadow-sm"
              >
                <SparklesIcon className="w-4 h-4" />
                Generate Cards from Graph
              </button>
            </>
          )}
        </div>
      </div>

      {/* Manual Card Creation Dialog */}
      {showNewCard && !readOnly && (
        <div className="px-6 py-3 border-b border-neutral-200 dark:border-neutral-700 bg-blue-50/50 dark:bg-neutral-800/50">
          <div className="flex items-start gap-3">
            <div className="flex-1 space-y-2">
              <input
                type="text"
                placeholder="Card title..."
                value={newCardTitle}
                onChange={(e) => setNewCardTitle(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 dark:text-neutral-100 focus:ring-2 focus:ring-neutral-400 focus:border-transparent"
              />
              <textarea
                placeholder="Description (optional)..."
                value={newCardDesc}
                onChange={(e) => setNewCardDesc(e.target.value)}
                rows={2}
                className="w-full px-3 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 dark:text-neutral-100 focus:ring-2 focus:ring-neutral-400 focus:border-transparent"
              />
              <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                <input
                  type="checkbox"
                  checked={newCardIsOOS}
                  onChange={(e) => setNewCardIsOOS(e.target.checked)}
                  className="rounded border-neutral-300"
                />
                Mark as out-of-scope
              </label>
              <div className="flex items-center gap-2">
                <label className="text-sm text-neutral-600 dark:text-neutral-400">Estimated hours:</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="0"
                  value={newCardEstHours}
                  onChange={(e) => setNewCardEstHours(e.target.value)}
                  className="w-20 px-2 py-1 text-sm border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 dark:text-neutral-100 focus:ring-2 focus:ring-neutral-400 focus:border-transparent"
                />
              </div>
              {!newCardIsOOS && (
                <p className="text-xs text-neutral-400">AI will automatically place this card in the requirements tree.</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreateManualCard}
                disabled={!newCardTitle.trim() || creatingCard}
                className="px-3 py-1.5 text-sm font-medium bg-neutral-900 text-white rounded-md hover:bg-neutral-800 disabled:opacity-50"
              >
                {creatingCard ? 'Placing…' : 'Create'}
              </button>
              <button
                onClick={() => setShowNewCard(false)}
                className="px-3 py-1.5 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Team Manager Panel */}
      {showTeamManager && (
        <TeamSelector
          sessionId={sessionId}
          teamMembers={teamMembers}
          onAddMember={(data) => addMember(sessionId, data)}
          onRemoveMember={removeMember}
          onClose={() => setShowTeamManager(false)}
        />
      )}

      {/* Workload View */}
      {activeView === 'workload' && (
        <div className="flex-1 overflow-auto p-6">
          <h3 className="text-md font-semibold text-neutral-800 dark:text-neutral-100 mb-4">Team Workload</h3>
          {workload.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">No team members or assignments yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workload.map((w: WorkloadEntry) => {
                const pct = w.progress_percentage ?? (w.total_cards > 0 ? Math.round((w.completed_cards / w.total_cards) * 100) : 0);
                return (
                  <div key={w.team_member_id} className="rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-full bg-neutral-50 dark:bg-neutral-800 flex items-center justify-center text-sm font-bold text-neutral-900 dark:text-neutral-100">
                        {w.team_member_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{w.team_member_name}</p>
                        {w.role && <p className="text-xs text-neutral-500 dark:text-neutral-400">{w.role}</p>}
                      </div>
                    </div>
                    <div className="space-y-2 text-xs text-neutral-600 dark:text-neutral-400">
                      <div className="flex justify-between">
                        <span>Total Cards</span><span className="font-medium">{w.total_cards}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>In Progress</span><span className="font-medium text-amber-600">{w.in_progress_cards}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Completed</span><span className="font-medium text-green-600">{w.completed_cards}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Est. Hours</span><span className="font-medium">{w.estimated_hours}h</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Actual Hours</span><span className="font-medium">{w.actual_hours}h</span>
                      </div>
                      <div className="mt-2">
                        <div className="w-full h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
                          <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-neutral-400 mt-0.5">{pct}% complete</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Dashboard View */}
      {activeView === 'dashboard' && (
        <div className="flex-1 overflow-auto">
          <ProgressDashboard board={board} workload={workload} />
        </div>
      )}

      {/* Board Columns */}
      {activeView === 'board' && (
        <div className="flex-1 overflow-x-auto p-4">
          <div className="flex gap-4 h-full min-w-max">
            {BOARD_COLUMNS.map((column) => {
              const rawCards = board?.columns?.[column.key] || [];
              const columnCards = hideDeferred
                ? rawCards.filter((c: PlanningCard) => c.node_status !== 'deferred')
                : rawCards;

              return (
                <div
                  key={column.key}
                  className="w-72 flex flex-col rounded-md bg-neutral-50 dark:bg-[#0a0a0a] border border-neutral-200 dark:border-neutral-700"
                  onDragOver={readOnly ? undefined : handleDragOver}
                  onDrop={readOnly ? undefined : () => handleDrop(column.key)}
                >
                  {/* Column Header */}
                  <div className={`px-4 py-3 border-b-2 ${column.color} rounded-t-md ${column.bgColor}`}>
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">{column.label}</h3>
                      <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 bg-white dark:bg-neutral-800 px-2 py-0.5 rounded-full">
                        {columnCards.length}
                      </span>
                    </div>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {columnCards.map((card: PlanningCard) => (
                      <PlanningCardComponent
                        key={card.id}
                        card={card}
                        teamMembers={teamMembers}
                        onDragStart={readOnly ? undefined : () => handleDragStart(card.id)}
                        onAssign={readOnly ? undefined : (teamMemberId) => assignTeamMember(card.id, teamMemberId)}
                        onUnassign={readOnly ? undefined : (teamMemberId) => unassignTeamMember(card.id, teamMemberId)}
                        onToggleAC={readOnly ? undefined : (criterionId, checked) => toggleAC(criterionId, checked)}
                        onAddAC={readOnly ? undefined : (desc) => addAC(card.id, desc)}
                        onDeleteAC={readOnly ? undefined : (criterionId) => deleteAC(criterionId)}
                        onAddComment={readOnly ? undefined : (content) => addComment(card.id, content)}
                        onUpdateCard={readOnly ? undefined : (updates) => updateCardDetails(card.id, updates)}
                        onConvertOutOfScope={readOnly ? undefined : (card.is_out_of_scope ? (parentNodeId) => convertOutOfScope(card.id, parentNodeId) : undefined)}
                        onDelete={readOnly ? undefined : () => removeCard(card.id)}
                      />
                    ))}

                    {columnCards.length === 0 && (
                      <div className="text-center py-8 text-neutral-400 text-xs">
                        Drop cards here
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
