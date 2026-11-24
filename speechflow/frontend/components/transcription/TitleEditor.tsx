"use client";

import { useState } from "react";
import { Edit2, Check, X } from "lucide-react";

interface TitleEditorProps {
  title: string;
  onSaveTitle: (newTitle: string) => void;
  disabled?: boolean;
}

export function TitleEditor({ title, onSaveTitle, disabled = false }: TitleEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempTitle, setTempTitle] = useState(title);

  const handleStartEdit = () => {
    if (disabled) return;
    setTempTitle(title);
    setIsEditing(true);
  };

  const handleSave = () => {
    const trimmed = tempTitle.trim();
    if (trimmed) {
      onSaveTitle(trimmed);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTempTitle(title);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={tempTitle}
          onChange={(e) => setTempTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") handleCancel();
          }}
          autoFocus
          className="text-lg font-bold text-gray-900 bg-white border border-blue-400 rounded-md px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full max-w-md shadow-sm"
        />
        <button
          onClick={handleSave}
          title="Save Title"
          className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={handleCancel}
          title="Cancel"
          className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 group">
      <h2 className="text-xl font-bold text-gray-900 tracking-tight">{title}</h2>
      {!disabled && (
        <button
          onClick={handleStartEdit}
          title="Edit Title"
          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-700 p-1 rounded-md transition-opacity cursor-pointer"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
