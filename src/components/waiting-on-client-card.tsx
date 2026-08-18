function daysWaiting(since: Date | string): number {
  const ms = Date.now() - new Date(since).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

export function WaitingOnClientCard({
  tasks,
}: {
  tasks: { id: string; title: string; waitingOnClientSince: Date | string | null }[];
}) {
  if (tasks.length === 0) return null;

  return (
    <div className="mb-4 rounded-lg border border-border bg-[#fef4de] p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#8a5c00]">Waiting on client</h2>
        <span className="text-[11px] font-semibold text-[#8a5c00]">
          Oldest · {Math.max(...tasks.map((t) => (t.waitingOnClientSince ? daysWaiting(t.waitingOnClientSince) : 0)))}d
        </span>
      </div>
      <ul className="space-y-1">
        {tasks.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-foreground">{t.title}</span>
            <span className="shrink-0 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold text-[#8a5c00]">
              {t.waitingOnClientSince ? daysWaiting(t.waitingOnClientSince) : 0}d
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
