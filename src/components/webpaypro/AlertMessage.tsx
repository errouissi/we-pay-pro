type Props = {
  type: "success" | "error" | "info";
  children: React.ReactNode;
};

export function AlertMessage({ type, children }: Props) {
  const styles =
    type === "success"
      ? "bg-[#B7F000]/20 border-[#2F9E32] text-[#003C18]"
      : type === "error"
        ? "bg-red-50 border-red-400 text-red-700"
        : "bg-[#C8D0C4]/30 border-[#C8D0C4] text-[#003C18]";
  return (
    <div className={`rounded-lg border-l-4 px-4 py-3 text-sm ${styles}`} role="alert">
      {children}
    </div>
  );
}