"use client";

import { useState, useRef, useEffect } from "react";
import { Bell } from "lucide-react";
import { useNotifications } from "@/hooks/use-notifications";
import { useEventStream } from "@/hooks/use-event-stream";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, addNotification, markAllRead, clearAll } =
    useNotifications();

  useEventStream({
    url: "/api/stream",
    onEvent: addNotification,
  });

  // Close panel on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => {
          setOpen((prev) => !prev);
          if (!open && unreadCount > 0) markAllRead();
        }}
        className="relative flex items-center justify-center rounded-md p-1.5 text-dusty-lavender/60 transition-colors hover:bg-deep-iris/20 hover:text-dusty-lavender"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-rose-DEFAULT text-[9px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-slate-DEFAULT/20 bg-midnight-plum shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-DEFAULT/10 px-4 py-2.5">
            <span className="text-xs font-medium text-mist">Notifications</span>
            {notifications.length > 0 && (
              <button
                onClick={clearAll}
                className="text-[10px] text-dusty-lavender/40 hover:text-dusty-lavender/70"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-dusty-lavender/40">
                No notifications yet
              </p>
            ) : (
              notifications.slice(0, 20).map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "border-b border-slate-DEFAULT/5 px-4 py-2.5",
                    !n.read && "bg-deep-iris/10",
                  )}
                >
                  <p className="text-xs text-mist">{n.message}</p>
                  <p className="mt-0.5 text-[10px] text-dusty-lavender/40">
                    {timeAgo(n.timestamp)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
