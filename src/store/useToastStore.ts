import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastStore {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  addToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast: Toast = { ...toast, id };
    set({ toasts: [...get().toasts, newToast] });
    
    const duration = toast.duration ?? 4000;
    if (duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, duration);
    }
  },
  removeToast: (id) => {
    set({ toasts: get().toasts.filter(t => t.id !== id) });
  },
  clearToasts: () => set({ toasts: [] }),
}));

export const toast = {
  success: (title: string, message?: string, options?: Partial<Toast>) => {
    useToastStore.getState().addToast({ type: 'success', title, message, ...options });
  },
  error: (title: string, message?: string, options?: Partial<Toast>) => {
    useToastStore.getState().addToast({ type: 'error', title, message, duration: 6000, ...options });
  },
  info: (title: string, message?: string, options?: Partial<Toast>) => {
    useToastStore.getState().addToast({ type: 'info', title, message, ...options });
  },
  warning: (title: string, message?: string, options?: Partial<Toast>) => {
    useToastStore.getState().addToast({ type: 'warning', title, message, ...options });
  },
};
