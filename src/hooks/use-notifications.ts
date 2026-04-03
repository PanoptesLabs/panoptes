"use client";

import { useState, useCallback } from "react";

const STORAGE_KEY = "panoptes_notifications";
const MAX_NOTIFICATIONS = 50;

export interface NotificationItem {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  read: boolean;
}

function loadNotifications(): NotificationItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as NotificationItem[]) : [];
  } catch {
    return [];
  }
}

function saveNotifications(items: NotificationItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_NOTIFICATIONS)));
  } catch {
    // localStorage full or unavailable
  }
}

const EVENT_LABELS: Record<string, string> = {
  "anomaly.created": "New anomaly detected",
  "validator.jailed": "Validator jailed",
  "endpoint.down": "Endpoint down",
  "slo.breached": "SLO breached",
  "incident.created": "New incident",
  "delegation.whale_detected": "Whale movement detected",
  "governance.proposal_created": "New governance proposal",
};

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationItem[]>(loadNotifications);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const addNotification = useCallback((type: string, data: string) => {
    const label = EVENT_LABELS[type];
    if (!label) return; // only show relevant events

    let detail = "";
    try {
      const parsed = JSON.parse(data);
      detail = parsed.title || parsed.moniker || parsed.entityId || "";
    } catch {
      // ignore
    }

    const item: NotificationItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      message: detail ? `${label}: ${detail}` : label,
      timestamp: new Date().toISOString(),
      read: false,
    };

    setNotifications((prev) => {
      const next = [item, ...prev].slice(0, MAX_NOTIFICATIONS);
      saveNotifications(next);
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }));
      saveNotifications(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    saveNotifications([]);
  }, []);

  return { notifications, unreadCount, addNotification, markAllRead, clearAll };
}
