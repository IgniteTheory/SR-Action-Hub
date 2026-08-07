import { useEffect } from 'react';

interface Props {
  message: string;
  variant?: 'success' | 'error';
  onDismiss: () => void;
}

export default function Toast({ message, variant = 'success', onDismiss }: Props) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className={`toast toast-${variant}`} onClick={onDismiss} role="status">
      {message}
    </div>
  );
}
