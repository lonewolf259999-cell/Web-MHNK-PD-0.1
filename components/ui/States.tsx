export function Loading({ label = 'กำลังโหลด...' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14">
      <div className="loader" />
      <div className="text-sm text-ink-dim">{label}</div>
    </div>
  );
}

export function EmptyState({
  icon = '📭',
  title = 'ไม่พบข้อมูล',
  message = 'ลองค้นหาด้วยคำอื่น',
}: {
  icon?: string;
  title?: string;
  message?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-14 text-center">
      <div className="mb-1 text-3xl">{icon}</div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="text-sm text-ink-dim">{message}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
      <div className="text-3xl">⚠️</div>
      <h3 className="text-base font-semibold text-danger">โหลดข้อมูลไม่สำเร็จ</h3>
      <p className="max-w-md text-sm text-ink-dim">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-1 cursor-pointer rounded-sm border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent transition hover:bg-accent/20"
        >
          ลองใหม่
        </button>
      )}
    </div>
  );
}

export function SectionHeader({
  icon,
  title,
  trailing,
}: {
  icon: string;
  title: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
        <span className="text-accent">{icon}</span>
        {title}
      </h2>
      {trailing}
    </div>
  );
}
