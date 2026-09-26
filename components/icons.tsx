// Line icons from the legacy app, kept 1:1 for visual parity (24×24, currentColor).
import type { LibraryKey } from "@/config/libraries";

type IconProps = { size?: number; className?: string };

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const LIBRARY_PATHS: Record<LibraryKey, React.ReactNode> = {
  games: (
    <>
      <path d="M8 8.5h8a4.5 4.5 0 0 1 4.4 3.6l.8 4.3a2.4 2.4 0 0 1-4.3 1.9L15.6 16H8.4l-1.1 2.3a2.4 2.4 0 0 1-4.3-1.9l.8-4.3A4.5 4.5 0 0 1 8 8.5z" {...stroke} />
      <path d="M6.4 11.6v3M4.9 13.1h3" {...stroke} />
      <circle cx="16.4" cy="12.4" r="1.15" fill="currentColor" />
      <circle cx="18.2" cy="14.2" r="1.15" fill="currentColor" />
    </>
  ),
  books: (
    <>
      <path d="M12 6.3C10 4.9 7.3 4.6 4.8 5.4v11.9c2.5-.8 5.2-.5 7.2.9 2-1.4 4.7-1.7 7.2-.9V5.4c-2.5-.8-5.2-.5-7.2.9z" {...stroke} />
      <path d="M12 6.3v13.4" {...stroke} />
    </>
  ),
  wines: (
    <>
      <path d="M10 3.5h4v3.1l1.5 3.1c.3.6.5 1.3.5 2v7.3a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 8 19v-7.3c0-.7.2-1.4.5-2L10 6.6V3.5z" {...stroke} />
      <path d="M8 14.2h8" {...stroke} />
    </>
  ),
  movies: (
    <>
      <path d="M3.6 11.3h16.8v6.6a1.4 1.4 0 0 1-1.4 1.4H5a1.4 1.4 0 0 1-1.4-1.4z" {...stroke} strokeLinecap={undefined} />
      <path d="M4 11.1 18.6 6l.5-2.1L4.5 9z" {...stroke} strokeLinecap={undefined} />
      <path d="M9 9.4 9.5 7.3M13 8l.5-2.1" {...stroke} strokeLinejoin={undefined} />
    </>
  ),
  expenses: (
    <>
      <rect x="3.5" y="6.5" width="17" height="12" rx="2.4" {...stroke} strokeLinecap={undefined} strokeLinejoin={undefined} />
      <path d="M3.5 10h17" {...stroke} strokeLinejoin={undefined} />
      <circle cx="16.5" cy="14.4" r="1.3" fill="currentColor" />
    </>
  ),
  trips: (
    <>
      <path d="M12 21c4.2-4.2 6.3-7.6 6.3-10.5a6.3 6.3 0 0 0-12.6 0C5.7 13.4 7.8 16.8 12 21z" {...stroke} strokeLinecap={undefined} />
      <circle cx="12" cy="10.4" r="2.3" {...stroke} strokeLinecap={undefined} strokeLinejoin={undefined} />
    </>
  ),
};

/** Icon tint on the picker cards (trips uses a lighter teal than its accent). */
export const LIBRARY_ICON_COLOR: Record<LibraryKey, string> = {
  games: "#9ce6b0", books: "#d8b98f", wines: "#c6a9d6", movies: "#a9aee0", expenses: "#8ecfd6", trips: "#8ed6cf",
};

export function LibraryIcon({ lib, size = 23, className }: IconProps & { lib: LibraryKey }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={{ display: "block" }} aria-hidden>
      {LIBRARY_PATHS[lib]}
    </svg>
  );
}

/** Library-switcher FAB glyphs (legacy libIcon): home stack, close, and a card for expenses. */
export function FabIcon({ name, size = 21 }: { name: LibraryKey | "_home" | "_close"; size?: number }) {
  let body: React.ReactNode;
  if (name === "_home") {
    body = (
      <>
        <path d="M4.5 8.2 12 4.8l7.5 3.4L12 11.6 4.5 8.2z" {...stroke} />
        <path d="M4.5 12 12 15.4 19.5 12" {...stroke} />
        <path d="M4.5 15.8 12 19.2l7.5-3.4" {...stroke} />
      </>
    );
  } else if (name === "_close") {
    body = <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" {...stroke} />;
  } else if (name === "expenses") {
    body = (
      <>
        <path d="M3.5 6.8h17a1 1 0 0 1 1 1v8.4a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1V7.8a1 1 0 0 1 1-1z" {...stroke} />
        <path d="M2.5 10.4h19" {...stroke} />
        <circle cx="17" cy="14.2" r="1.15" fill="currentColor" />
      </>
    );
  } else body = LIBRARY_PATHS[name];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden style={{ display: "block" }}>
      {body}
    </svg>
  );
}

export function GearIcon({ size = 13, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={{ flexShrink: 0 }} aria-hidden>
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <path
        d="M19.4 13a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export function MoonIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.6 6.6 0 0 0 9.8 9.8z" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
    </svg>
  );
}

// ---------------------------------------------------------------- UI glyphs
// Small controls (search, sort, layout, menus). Same 24×24 grid and stroke as
// the library icons, drawn after Phosphor's regular set.

function Glyph({ size = 14, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={{ display: "block", flexShrink: 0 }} aria-hidden>
      {children}
    </svg>
  );
}

export const SearchIcon = (p: IconProps) => (
  <Glyph {...p}>
    <circle cx="10.8" cy="10.8" r="6.3" {...stroke} />
    <path d="m15.4 15.4 4.6 4.6" {...stroke} />
  </Glyph>
);

export const CloseIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" {...stroke} />
  </Glyph>
);

/** Counter-clockwise arrow: reset sort order. */
export const ResetIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M4.5 5.5v4.8h4.8" {...stroke} />
    <path d="M5.1 10.3A7.5 7.5 0 1 1 6.3 17" {...stroke} />
  </Glyph>
);

/** Table layout. */
export const RowsIcon = (p: IconProps) => (
  <Glyph {...p}>
    <rect x="3.8" y="4.8" width="16.4" height="14.4" rx="2" {...stroke} />
    <path d="M3.8 9.6h16.4M3.8 14.4h16.4" {...stroke} />
  </Glyph>
);

/** Card layout. */
export const GridIcon = (p: IconProps) => (
  <Glyph {...p}>
    <rect x="4" y="4" width="6.6" height="6.6" rx="1.6" {...stroke} />
    <rect x="13.4" y="4" width="6.6" height="6.6" rx="1.6" {...stroke} />
    <rect x="4" y="13.4" width="6.6" height="6.6" rx="1.6" {...stroke} />
    <rect x="13.4" y="13.4" width="6.6" height="6.6" rx="1.6" {...stroke} />
  </Glyph>
);

export const CaretRightIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="m9.5 5.5 6.5 6.5-6.5 6.5" {...stroke} />
  </Glyph>
);

export const ArrowUpIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M12 19.5v-15M6 10.5l6-6 6 6" {...stroke} />
  </Glyph>
);

export const ArrowDownIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M12 4.5v15M6 13.5l6 6 6-6" {...stroke} />
  </Glyph>
);

export const GlobeIcon = (p: IconProps) => (
  <Glyph {...p}>
    <circle cx="12" cy="12" r="9" {...stroke} />
    <path d="M3 12h18" {...stroke} />
    <path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18" {...stroke} />
  </Glyph>
);

/** Diagonal arrow: open. */
export const ArrowUpRightIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M7 17 17 7M8.5 7H17v8.5" {...stroke} />
  </Glyph>
);

/** Circled exclamation: an "important" marker. */
export const WarningCircleIcon = (p: IconProps) => (
  <Glyph {...p}>
    <circle cx="12" cy="12" r="9" {...stroke} />
    <path d="M12 7.5v5.5" {...stroke} />
    <circle cx="12" cy="16.4" r="1.15" fill="currentColor" />
  </Glyph>
);

export const PlusIcon = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M12 5v14M5 12h14" {...stroke} />
  </Glyph>
);

/** Horizontal dots: overflow menu. */
export const DotsIcon = (p: IconProps) => (
  <Glyph {...p}>
    <circle cx="5.5" cy="12" r="1.5" fill="currentColor" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    <circle cx="18.5" cy="12" r="1.5" fill="currentColor" />
  </Glyph>
);
