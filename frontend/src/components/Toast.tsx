import { useEffect } from "react";
import styles from "./Toast.module.css";

export interface ToastMessage {
  id: number;
  type: "success" | "error";
  text: string;
}

export function Toast({
  toast,
  onDismiss,
}: {
  toast?: ToastMessage;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(onDismiss, 4200);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div className={`${styles.toast} ${styles[toast.type]}`} role="status">
      <span>{toast.type === "success" ? "✓" : "!"}</span>
      <p>{toast.text}</p>
      <button type="button" aria-label="Dismiss notification" onClick={onDismiss}>
        ×
      </button>
    </div>
  );
}
