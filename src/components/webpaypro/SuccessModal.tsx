import { useEffect } from "react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
};

export function SuccessModal({ isOpen, onClose, title, message }: Props) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl ring-1 ring-black/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#B7F000]/30 text-[#2F9E32]">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-[#003C18]">{title}</h3>
        <p className="mt-2 text-sm text-[#00562B]/80">{message}</p>
        <button
          type="button"
          onClick={onClose}
          autoFocus
          className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-[#2F9E32] px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#00562B]"
        >
          OK
        </button>
      </div>
    </div>
  );
}
