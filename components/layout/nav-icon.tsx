import type { NavIcon as NavIconName } from "@/lib/nav";

const paths: Record<NavIconName, string> = {
  today: "M4 6h16M4 12h16M4 18h10",
  find: "M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Zm5-2 4 4",
  ship: "M3 7l9-4 9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4M12 11v10",
  list: "M4 8h3l2-3h6l2 3h3v11H4V8Zm8 9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
};

export function NavIcon({ name }: { name: NavIconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
