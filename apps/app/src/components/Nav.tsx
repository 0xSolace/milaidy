import { useApp } from "../AppContext.js";
import { TAB_GROUPS } from "../navigation";

export function Nav() {
  const { tab, setTab } = useApp();

  return (
    <nav className="relative border-b border-border py-2 px-3 sm:px-5">
      <div className="flex gap-1 overflow-x-auto scrollbar-none">
        {TAB_GROUPS.map((group: (typeof TAB_GROUPS)[number]) => {
          const primaryTab = group.tabs[0];
          const isActive = group.tabs.includes(tab);
          return (
            <button
              key={group.label}
              className={`inline-block whitespace-nowrap px-2 sm:px-3 py-1.5 text-[11px] sm:text-[13px] bg-transparent border-0 border-b-2 cursor-pointer transition-colors ${
                isActive
                  ? "text-accent font-medium border-b-accent"
                  : "text-muted border-b-transparent hover:text-txt"
              }`}
              onClick={() => setTab(primaryTab)}
            >
              {group.label}
            </button>
          );
        })}
      </div>
      {/* Fade hint for horizontal scroll */}
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-bg to-transparent sm:hidden" />
    </nav>
  );
}
