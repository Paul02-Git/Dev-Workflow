import Link from "next/link";

function SplitBar({
  leftLabel,
  leftValue,
  leftColor,
  rightLabel,
  rightValue,
  rightColor,
}: {
  leftLabel: string;
  leftValue: number;
  leftColor: string;
  rightLabel: string;
  rightValue: number;
  rightColor: string;
}) {
  const total = leftValue + rightValue;
  const leftPercent = total > 0 ? (leftValue / total) * 100 : 50;

  return (
    <div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-black/5">
        {leftValue > 0 && <div className="h-full" style={{ width: `${leftPercent}%`, backgroundColor: leftColor }} />}
        {rightValue > 0 && (
          <div className="h-full" style={{ width: `${100 - leftPercent}%`, backgroundColor: rightColor }} />
        )}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <div>
          <div className="text-sm font-bold" style={{ color: leftColor }}>
            {leftValue}
          </div>
          <div className="text-xs text-muted-foreground">{leftLabel}</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold" style={{ color: rightColor }}>
            {rightValue}
          </div>
          <div className="text-xs text-muted-foreground">{rightLabel}</div>
        </div>
      </div>
    </div>
  );
}

export type NeedsAttentionItem = { clientId: string; clientName: string; reason: string };

/**
 * Portfolio-wide rollups, deliberately unaffected by the main grid's
 * filter/search — this is "how's the whole client base doing," not "how do
 * the currently-filtered results look."
 */
export function ClientsSidebar({
  activeProjectCount,
  otherProjectCount,
  clientsOnRetainerCount,
  clientsTotal,
  needsAttention,
}: {
  activeProjectCount: number;
  otherProjectCount: number;
  clientsOnRetainerCount: number;
  clientsTotal: number;
  needsAttention: NeedsAttentionItem[];
}) {
  return (
    <div className="flex w-full flex-col gap-4 xl:w-80 xl:shrink-0">
      <div className="app-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Project Status</h2>
        <SplitBar
          leftLabel="Active"
          leftValue={activeProjectCount}
          leftColor="#2a78d6"
          rightLabel="Launched / Other"
          rightValue={otherProjectCount}
          rightColor="#0ca30c"
        />
      </div>

      <div className="app-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Retainer Coverage</h2>
        <SplitBar
          leftLabel="On retainer"
          leftValue={clientsOnRetainerCount}
          leftColor="#0ca30c"
          rightLabel="No retainer"
          rightValue={Math.max(0, clientsTotal - clientsOnRetainerCount)}
          rightColor="#c9720a"
        />
      </div>

      <div className="app-card p-4">
        <h2 className="mb-2 text-sm font-semibold">Needs Attention</h2>
        {needsAttention.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing flagged across any client right now.</p>
        ) : (
          <ul className="space-y-1">
            {needsAttention.map((item) => (
              <li key={item.clientId}>
                <Link
                  href={`/clients/${item.clientId}`}
                  className="block rounded-md p-2 text-xs hover:bg-muted"
                >
                  <span className="font-semibold text-foreground">{item.clientName}</span>
                  <span className="block text-muted-foreground">{item.reason}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
