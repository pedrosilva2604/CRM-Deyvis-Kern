import { useEffect, useId, type ReactNode } from 'react';
import { X } from 'lucide-react';

type ModalSize = 'medium' | 'large';

const modalWidths: Record<ModalSize, string> = {
  medium: 'max-w-md',
  large: 'max-w-3xl',
};

interface ModalProps {
  title: string;
  description?: string;
  size?: ModalSize;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ title, description, size = 'medium', onClose, children }: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative max-h-full w-full ${modalWidths[size]} overflow-y-auto rounded-xl bg-white p-6 shadow-xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800`}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
