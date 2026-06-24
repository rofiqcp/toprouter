/**
 * Notification Store — Zustand-based global toast notification system.
 * Centralized feedback for dashboard actions.
 */

import { create } from "zustand";

let idCounter = 0;
const timers = new Map();

export const useNotificationStore = create((set, get) => ({
  notifications: [],

  addNotification: (notification) => {
    const id = ++idCounter;
    const entry = {
      id,
      type: notification.type || "info",
      message: notification.message,
      title: notification.title || null,
      duration: notification.duration ?? 5000,
      dismissible: notification.dismissible ?? true,
      createdAt: Date.now(),
    };

    set((s) => ({ notifications: [...s.notifications, entry] }));

    // Auto-dismiss with tracked timer
    if (entry.duration > 0) {
      const timerId = setTimeout(() => {
        timers.delete(id);
        get().removeNotification(id);
      }, entry.duration);
      timers.set(id, timerId);
    }

    return id;
  },

  removeNotification: (id) => {
    // Clear auto-dismiss timer if present
    const timerId = timers.get(id);
    if (timerId) {
      clearTimeout(timerId);
      timers.delete(id);
    }
    set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) }));
  },

  clearAll: () => {
    // Clear all pending timers
    for (const timerId of timers.values()) clearTimeout(timerId);
    timers.clear();
    set({ notifications: [] });
  },

  success: (message, title) => get().addNotification({ type: "success", message, title }),
  error: (message, title) => get().addNotification({ type: "error", message, title, duration: 8000 }),
  warning: (message, title) => get().addNotification({ type: "warning", message, title }),
  info: (message, title) => get().addNotification({ type: "info", message, title }),
}));
