interface ConfidenceBannerProps {
  confidence: number;
  notes: string | null;
}

export function ConfidenceBanner({ confidence, notes }: ConfidenceBannerProps) {
  const pct = Math.round(confidence * 100);

  const config =
    confidence >= 0.9
      ? { bg: "bg-green-50", border: "border-green-200", text: "text-green-800", label: "Clear read" }
      : confidence >= 0.7
      ? { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-800", label: "Good read" }
      : confidence >= 0.5
      ? { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-800", label: "Some items unclear — check below" }
      : { bg: "bg-red-50", border: "border-red-200", text: "text-red-800", label: "Hard to read — review every item" };

  return (
    <div className={`rounded-xl border p-3 ${config.bg} ${config.border} mb-4`}>
      <div className="flex items-center justify-between mb-1">
        <span className={`text-sm font-medium ${config.text}`}>{config.label}</span>
        <span className={`text-xs font-mono ${config.text}`}>{pct}% confident</span>
      </div>
      {notes && <p className={`text-xs ${config.text} opacity-80`}>{notes}</p>}
    </div>
  );
}
