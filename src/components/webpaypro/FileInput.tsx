import { useRef, useState } from "react";
import { validateFile } from "./fileValidation";

type Props = {
  label: string;
  arabic: string;
  name: string;
  value: File | null;
  onChange: (file: File | null, error: string | null) => void;
  required?: boolean;
};

export function FileInput({ label, arabic, name, value, onChange, required }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setError(null);
      onChange(null, null);
      return;
    }
    const msg = validateFile(file);
    if (msg) {
      setError(msg);
      onChange(null, msg);
      e.target.value = "";
      return;
    }
    setError(null);
    onChange(file, null);
  };

  return (
    <div className="space-y-2">
      <label className="flex flex-col gap-0.5 text-sm font-medium text-[#003C18]">
        <span>
          {label} {required && <span className="text-[#2F9E32]">*</span>}
        </span>
        <span dir="rtl" className="text-xs font-normal text-[#00562B]/70">
          {arabic}
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-lg border-2 border-dashed border-[#2F9E32] bg-[#B7F000]/10 px-4 py-2 text-sm font-medium text-[#00562B] transition hover:bg-[#B7F000]/25"
        >
          Choisir un fichier
        </button>
        <span className="truncate text-xs text-[#003C18]/70">
          {value ? value.name : "Aucun fichier sélectionné"}
        </span>
      </div>
      <input
        ref={inputRef}
        type="file"
        name={name}
        accept="image/*,application/pdf"
        className="hidden"
        onChange={handleChange}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}