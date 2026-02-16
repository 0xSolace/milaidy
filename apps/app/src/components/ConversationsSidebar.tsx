/**
 * Conversations sidebar component — left sidebar with conversation list.
 * On mobile (<640px): hidden by default, slides in as an overlay drawer.
 * Parent controls open/close via props.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useApp } from "../AppContext.js";

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

interface ConversationsSidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function ConversationsSidebar({ mobileOpen = false, onMobileClose }: ConversationsSidebarProps) {
  const {
    conversations,
    activeConversationId,
    unreadConversations,
    handleNewConversation,
    handleSelectConversation,
    handleDeleteConversation,
    handleRenameConversation,
  } = useApp();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const sortedConversations = [...conversations].sort((a, b) => {
    const aTime = new Date(a.updatedAt).getTime();
    const bTime = new Date(b.updatedAt).getTime();
    return bTime - aTime;
  });

  const handleDoubleClick = (conv: { id: string; title: string }) => {
    setEditingId(conv.id);
    setEditingTitle(conv.title);
  };

  const handleEditSubmit = async (id: string) => {
    const trimmed = editingTitle.trim();
    if (trimmed && trimmed !== conversations.find((c) => c.id === id)?.title) {
      await handleRenameConversation(id, trimmed);
    }
    setEditingId(null);
    setEditingTitle("");
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditingTitle("");
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, id: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleEditSubmit(id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleEditCancel();
    }
  };

  const handleSelect = useCallback(
    (id: string) => {
      void handleSelectConversation(id);
      onMobileClose?.();
    },
    [handleSelectConversation, onMobileClose],
  );

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="sm:hidden fixed inset-0 bg-black/50 z-40"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={`
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          sm:translate-x-0
          fixed sm:relative
          top-0 left-0
          z-40 sm:z-auto
          w-64 sm:w-60 sm:min-w-60
          h-full sm:h-auto
          transition-transform duration-200 ease-in-out
          border-r border-border bg-bg flex flex-col overflow-y-auto text-[13px]
        `}
        data-testid="conversations-sidebar"
      >
        {/* Mobile drawer header */}
        <div className="sm:hidden flex items-center justify-between px-3 py-3 border-b border-border">
          <span className="text-sm font-bold text-txt-strong">Chats</span>
          <button
            className="w-7 h-7 flex items-center justify-center border border-border bg-bg rounded text-muted hover:text-txt cursor-pointer"
            onClick={onMobileClose}
          >
            ✕
          </button>
        </div>

        <div className="p-3 border-b border-border">
          <button
            className="w-full px-3 py-2 border border-border rounded-md bg-accent text-accent-fg text-[13px] font-medium cursor-pointer transition-opacity hover:opacity-90"
            onClick={() => { handleNewConversation(); onMobileClose?.(); }}
          >
            + New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {sortedConversations.length === 0 ? (
            <div className="px-3 py-6 text-center text-muted text-xs">No conversations yet</div>
          ) : (
            sortedConversations.map((conv) => {
              const isActive = conv.id === activeConversationId;
              const isEditing = editingId === conv.id;

              return (
                <div
                  key={conv.id}
                  data-testid="conv-item"
                  data-active={isActive || undefined}
                  className={`flex items-center px-3 py-2 gap-2 cursor-pointer transition-colors border-l-[3px] ${
                    isActive ? "bg-bg-hover border-l-accent" : "border-l-transparent hover:bg-bg-hover"
                  } group`}
                  onClick={() => {
                    if (!isEditing) handleSelect(conv.id);
                  }}
                  onDoubleClick={() => handleDoubleClick(conv)}
                >
                  {isEditing ? (
                    <input
                      ref={inputRef}
                      className="w-full px-1.5 py-1 border border-accent rounded bg-card text-txt text-[13px] outline-none"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={() => void handleEditSubmit(conv.id)}
                      onKeyDown={(e) => handleEditKeyDown(e, conv.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <>
                      {unreadConversations.has(conv.id) && (
                        <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate text-txt">{conv.title}</div>
                        <div className="text-[11px] text-muted mt-0.5">{formatRelativeTime(conv.updatedAt)}</div>
                      </div>
                      <button
                        data-testid="conv-delete"
                        className="opacity-0 group-hover:opacity-100 transition-opacity border-none bg-transparent text-muted hover:text-danger hover:bg-destructive-subtle cursor-pointer text-sm px-1 py-0.5 rounded flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDeleteConversation(conv.id);
                        }}
                        title="Delete conversation"
                      >
                        ×
                      </button>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>
    </>
  );
}
