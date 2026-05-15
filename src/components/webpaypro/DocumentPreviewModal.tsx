import { useEffect, useState } from "react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  fileUrl: string;
};

function extractDriveFileId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m && m[1]) return m[1];
  }
  return null;
}

function toThumbnailUrl(url: string): string {
  const id = extractDriveFileId(url);
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w1600` : url;
}

function toIframePreviewUrl(url: string): string | null {
  const id = extractDriveFileId(url);
  return id ? `https://drive.google.com/file/d/${id}/preview` : null;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const STEP = 0.25;

export function DocumentPreviewModal({ isOpen, onClose, title, fileUrl }: Props) {
  const [zoom, setZoom] = useState(1);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setZoom(1);
    setFailed(false);
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

  const thumbnailUrl = toThumbnailUrl(fileUrl);
  const iframeUrl = toIframePreviewUrl(fileUrl);
  const showIframeFallback = failed && iframeUrl !== null;

  const zoomIn = () => setZoom((z) => Math.min(MAX_ZOOM, +(z + STEP).toFixed(2)));
  const zoomOut = () => setZoom((z) => Math.max(MIN_ZOOM, +(z - STEP).toFixed(2)));
  const resetZoom = () => setZoom(1);

  const ctrlBtn =
    "inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#C8D0C4] bg-white text-[#003C18] transition hover:bg-[#B7F000]/30 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 border-b border-[#C8D0C4] bg-white px-5 py-3">
          <h3 className="text-base font-bold text-[#003C18]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[#003C18] transition hover:bg-[#C8D0C4]/40"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div className="relative flex-1 overflow-auto bg-[#003C18]/5">
          {showIframeFallback ? (
            <iframe
              src={iframeUrl!}
              title={title}
              className="block h-[70vh] w-full border-0 bg-white"
              allow="autoplay"
            />
          ) : failed ? (
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 p-8 text-center">
              <p className="text-sm text-[#003C18]">
                Impossible d’afficher l’aperçu. Vous pouvez ouvrir le fichier dans Google Drive.
              </p>
            </div>
          ) : (
            <div className="flex min-h-[300px] items-center justify-center p-6">
              <img
                src={thumbnailUrl}
                alt={title}
                referrerPolicy="no-referrer"
                onError={() => setFailed(true)}
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: "center center",
                }}
                className="max-h-[70vh] max-w-full object-contain transition-transform"
              />
            </div>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#C8D0C4] bg-white px-5 py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={zoomOut}
              disabled={failed || zoom <= MIN_ZOOM}
              aria-label="Zoom arrière"
              className={ctrlBtn}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14" />
              </svg>
            </button>
            <button
              type="button"
              onClick={resetZoom}
              disabled={failed}
              className="inline-flex h-9 items-center rounded-md border border-[#C8D0C4] bg-white px-3 text-xs font-medium text-[#003C18] transition hover:bg-[#B7F000]/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {failed ? "—" : `${Math.round(zoom * 100)}%`}
            </button>
            <button
              type="button"
              onClick={zoomIn}
              disabled={failed || zoom >= MAX_ZOOM}
              aria-label="Zoom avant"
              className={ctrlBtn}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-lg border border-[#2F9E32] bg-white px-4 py-2 text-sm font-medium text-[#00562B] transition hover:bg-[#2F9E32] hover:text-white"
          >
            Ouvrir dans Google Drive
          </a>
        </footer>
      </div>
    </div>
  );
}
