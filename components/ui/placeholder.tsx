// Stand-in body for pages whose milestone has not been built yet.
export function Placeholder({ milestone }: { milestone: string }) {
  return <p className="text-aux text-ink-2">這一頁會在 {milestone} 完成。</p>;
}
