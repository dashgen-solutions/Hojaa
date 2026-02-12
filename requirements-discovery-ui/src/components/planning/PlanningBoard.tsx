'use client';

import { useEffect, useState } from 'react';
import { PlusIcon, UsersIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { useStore, PlanningCard, TeamMember } from '@/stores/useStore';
import PlanningCardComponent from './PlanningCard';
import TeamSelector from './TeamSelector';

interface PlanningBoardProps {
  sessionId: string;
}

const BOARD_COLUMNS = [
  { key: 'backlog', label: 'Backlog', color: 'border-neutral-300', bgColor: 'bg-neutral-50' },
  { key: 'todo', label: 'To Do', color: 'border-blue-300', bgColor: 'bg-blue-50' },
  { key: 'in_progress', label: 'In Progress', color: 'border-amber-300', bgColor: 'bg-amber-50' },
  { key: 'review', label: 'Review', color: 'border-purple-300', bgColor: 'bg-purple-50' },
  { key: 'done', label: 'Done', color: 'border-green-300', bgColor: 'bg-green-50' },
];

export default function PlanningBoard({ sessionId }: PlanningBoardProps) {
  const {
    board, teamMembers, isLoadingBoard,
    fetchBoard, bulkAddCards, moveCard, assignTeamMember,
    addMember, removeMember, unassignTeamMember,
  } = useStore();

  const [showTeamManager, setShowTeamManager] = useState(false);
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);

  useEffect(() => {
    fetchBoard(sessionId);
  }, [sessionId, fetchBoard]);

  const handleBulkCreate = async () => {
    await bulkAddCards({ session_id: sessionId, node_types: ['feature'], include_details: false });
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

  if (isLoadingBoard) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  const totalCards = board?.total_cards || 0;
  const completedCards = board?.completed_cards || 0;
  const progressPercentage = totalCards > 0 ? Math.round((completedCards / totalCards) * 100) : 0;

  return (
    <div className="h-full flex flex-col">
      {/* Board Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-white">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Planning Board</h2>
          <div className="flex items-center gap-4 mt-1">
            <span className="text-sm text-neutral-500">{totalCards} cards</span>
            {totalCards > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 rounded-full bg-neutral-200 overflow-hidden">
                  <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${progressPercentage}%` }} />
                </div>
                <span className="text-xs text-neutral-500">{progressPercentage}% done</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowTeamManager(!showTeamManager)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                       bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition-colors"
          >
            <UsersIcon className="w-4 h-4" />
            Team ({teamMembers.length})
          </button>
          {totalCards === 0 && (
            <button
              onClick={handleBulkCreate}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium
                         bg-primary-600 text-white hover:bg-primary-700 transition-colors shadow-sm"
            >
              <SparklesIcon className="w-4 h-4" />
              Generate Cards from Graph
            </button>
          )}
        </div>
      </div>

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

      {/* Board Columns */}
      <div className="flex-1 overflow-x-auto p-4">
        <div className="flex gap-4 h-full min-w-max">
          {BOARD_COLUMNS.map((column) => {
            const columnCards = board?.columns?.[column.key] || [];

            return (
              <div
                key={column.key}
                className="w-72 flex flex-col rounded-xl bg-neutral-50/80 border border-neutral-200"
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(column.key)}
              >
                {/* Column Header */}
                <div className={`px-4 py-3 border-b-2 ${column.color} rounded-t-xl ${column.bgColor}`}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-neutral-800">{column.label}</h3>
                    <span className="text-xs font-medium text-neutral-500 bg-white px-2 py-0.5 rounded-full">
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
                      onDragStart={() => handleDragStart(card.id)}
                      onAssign={(teamMemberId) => assignTeamMember(card.id, teamMemberId)}
                      onUnassign={(teamMemberId) => unassignTeamMember(card.id, teamMemberId)}
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
    </div>
  );
}
