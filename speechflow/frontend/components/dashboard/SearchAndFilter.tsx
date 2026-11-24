"use client";

import { Search, X, SlidersHorizontal } from "lucide-react";

interface SearchAndFilterProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  sort: string;
  onSortChange: (sort: string) => void;
}

export function SearchAndFilter({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sort,
  onSortChange,
}: SearchAndFilterProps) {
  const statusOptions = [
    { label: "All", value: "all" },
    { label: "Completed", value: "completed" },
    { label: "In Progress", value: "recording" },
    { label: "Paused", value: "paused" },
  ];

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
      {/* Search Input */}
      <div className="relative flex-1 max-w-md">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search transcriptions by title..."
          className="w-full pl-10 pr-9 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400 shadow-sm"
        />
        {search && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter and Sort Group */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Status Filter Tabs */}
        <div className="inline-flex items-center bg-gray-100/80 p-1 rounded-xl border border-gray-200/60">
          {statusOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onStatusFilterChange(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                statusFilter === opt.value
                  ? "bg-white text-gray-900 shadow-sm font-semibold"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Sort Dropdown */}
        <div className="relative inline-flex items-center">
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value)}
            className="appearance-none bg-white text-xs font-medium text-gray-700 pl-3 pr-8 py-2 border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
          >
            <option value="-created_at">Newest First</option>
            <option value="created_at">Oldest First</option>
            <option value="title">Title (A-Z)</option>
            <option value="-title">Title (Z-A)</option>
          </select>
          <div className="absolute right-2.5 pointer-events-none text-gray-400">
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    </div>
  );
}
