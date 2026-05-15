type Props = {
  isVisible: boolean;
  title: string;
  message?: string;
};

export function FullScreenLoadingOverlay({ isVisible, title, message }: Props) {
  if (!isVisible) return null;

  return (
    <div
      role="alertdialog"
      aria-busy="true"
      aria-live="assertive"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#003C18]/70 p-4 backdrop-blur-sm"
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl bg-white px-6 py-8 text-center shadow-2xl ring-1 ring-black/5">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#C8D0C4] border-t-[#2F9E32]" />
        <p className="text-base font-semibold text-[#003C18]">{title}</p>
        {message && <p className="text-sm text-[#00562B]/80">{message}</p>}
      </div>
    </div>
  );
}
