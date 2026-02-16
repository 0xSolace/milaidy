import { useEffect, useRef, useState } from "react";
import { useApp } from "../AppContext.js";
import { TAB_GROUPS } from "../navigation";

export function Nav() {
  const { tab, setTab } = useApp();
  const navRef = useRef<HTMLElement>(null);
  const [showRightFade, setShowRightFade] = useState(false);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const updateFade = () => {
      const canScrollRight = nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 1;
      setShowRightFade(canScrollRight);
    };

    updateFade();
    nav.addEventListener("scroll", updateFade, { passive: true });
    window.addEventListener("resize", updateFade);

    return () => {
      nav.removeEventListener("scroll", updateFade);
      window.removeEventListener("resize", updateFade);
    };
  }, []);

  return (
    <div className="relative border-b border-border">
      <nav ref={navRef} className="py-2 px-5 flex gap-1 overflow-x-auto">
        {TAB_GROUPS.map((group: (typeof TAB_GROUPS)[number]) => {
          const primaryTab = group.tabs[0];
          const isActive = group.tabs.includes(tab);
          return (
            <button
              key={group.label}
              className={`inline-block flex-shrink-0 whitespace-nowrap px-2 py-1 sm:px-3 sm:py-1.5 text-[11px] sm:text-[13px] bg-transparent border-0 border-b-2 cursor-pointer transition-colors ${
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
      </nav>
      {showRightFade && (
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-bg to-transparent" />
      )}
    </div>
  );
}
