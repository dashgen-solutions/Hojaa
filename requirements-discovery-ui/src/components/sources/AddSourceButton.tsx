'use client';

import { useState } from 'react';
import { PlusIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import SourceInputModal from './SourceInputModal';

interface AddSourceButtonProps {
  sessionId: string;
  onSourceAdded?: () => void;
}

export default function AddSourceButton({ sessionId, onSourceAdded }: AddSourceButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg 
                   bg-primary-600 text-white hover:bg-primary-700 
                   transition-colors shadow-sm text-sm font-medium"
      >
        <PlusIcon className="w-4 h-4" />
        Add Source
      </button>

      {isModalOpen && (
        <SourceInputModal
          sessionId={sessionId}
          onClose={() => setIsModalOpen(false)}
          onSourceAdded={() => {
            setIsModalOpen(false);
            onSourceAdded?.();
          }}
        />
      )}
    </>
  );
}
