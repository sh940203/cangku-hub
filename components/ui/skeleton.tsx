// Loading placeholder (design.md §10: skeleton list, no full-screen spinner).
export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <ul aria-hidden="true" className="-mx-4 divide-y divide-line border-y border-line bg-surface lg:mx-0 lg:max-w-4xl">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex min-h-14 items-center gap-3 px-4">
          <span className="h-4 flex-1 animate-pulse rounded bg-line" style={{ maxWidth: `${60 + ((i * 17) % 30)}%` }} />
          <span className="h-5 w-16 animate-pulse rounded-tag bg-line" />
        </li>
      ))}
    </ul>
  );
}

export function PageSkeleton() {
  return (
    <div role="status" aria-label="載入中">
      <div className="mb-4 h-7 w-28 animate-pulse rounded bg-line" />
      <SkeletonList />
    </div>
  );
}
