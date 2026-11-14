/** Line icons used across the app; they take the text colour. No emoji in the UI. */
const Svg = ({ children, fill }: { children: React.ReactNode; fill?: boolean }) => (
  <svg className="icon" viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'}
    strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);

export const HomeIcon = () => <Svg><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /></Svg>;
export const CalendarIcon = () => <Svg><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></Svg>;
export const HistoryIcon = () => <Svg><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></Svg>;
export const DumbbellIcon = () => <Svg><path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12" /></Svg>;
export const SlidersIcon = () => (
  <Svg><path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" /><circle cx="15" cy="6" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="17" cy="18" r="2" /></Svg>
);
/** Kept for older imports; the tab bar uses SlidersIcon. */
export const GearIcon = SlidersIcon;
export const PlusIcon = () => <Svg><path d="M12 5v14M5 12h14" /></Svg>;
export const SparkIcon = () => <Svg><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" /></Svg>;
export const ScaleIcon = () => <Svg><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M8.5 9a5 5 0 0 1 7 0l-2 2.5h-3z" /></Svg>;
export const FlameIcon = () => <Svg><path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.3 1.5 1 2.5 2 2.5 0-3 0-5.5 1-8z" /></Svg>;
export const TrophyIcon = () => <Svg><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5a2.5 2.5 0 0 0 3.5 3.5M16 6h3.5A2.5 2.5 0 0 1 16 9.5M12 13v4M8 21h8M9.5 17h5" /></Svg>;
export const CheckIcon = () => <Svg><path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>;
export const XIcon = () => <Svg><path d="M6 6l12 12M18 6 6 18" /></Svg>;
export const ChevronRight = () => <Svg><path d="m9 6 6 6-6 6" /></Svg>;
export const ChevronLeft = () => <Svg><path d="m15 6-6 6 6 6" /></Svg>;
export const ChevronDown = () => <Svg><path d="m6 9 6 6 6-6" /></Svg>;
export const ArrowUp = () => <Svg><path d="M12 19V5M6 11l6-6 6 6" /></Svg>;
export const ArrowDown = () => <Svg><path d="M12 5v14M6 13l6 6 6-6" /></Svg>;
export const ArrowRight = () => <Svg><path d="M5 12h14M13 6l6 6-6 6" /></Svg>;
export const PlayIcon = () => <Svg fill><path d="M7 4.5v15l13-7.5z" /></Svg>;
export const SwapIcon = () => <Svg><path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" /></Svg>;
export const MoreIcon = () => <Svg fill><circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" /></Svg>;
export const NoteIcon = () => <Svg><path d="M5 4h14v11l-5 5H5z" /><path d="M14 20v-5h5" /></Svg>;
export const CameraIcon = () => <Svg><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13.5" r="3.5" /></Svg>;
export const VideoIcon = () => <Svg><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3z" /></Svg>;
export const BoxIcon = () => <Svg><path d="M4 7l8-4 8 4v10l-8 4-8-4z" /><path d="M4 7l8 4 8-4M12 11v10" /></Svg>;
export const PlateIcon = () => <Svg><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" /></Svg>;
export const TimerIcon = () => <Svg><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2M9 2h6" /></Svg>;
export const TrendIcon = () => <Svg><path d="M4 17l6-6 4 4 6-7M14 8h6v6" /></Svg>;
export const UserIcon = () => <Svg><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Svg>;
export const CloudIcon = () => <Svg><path d="M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 9.5a4.25 4.25 0 0 1-.5 8.5z" /></Svg>;
export const SearchIcon = () => <Svg><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>;
export const TargetIcon = () => <Svg><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.5" /></Svg>;
export const PaletteIcon = () => <Svg><path d="M12 3a9 9 0 0 0 0 18c1.2 0 1.8-.9 1.4-2l-.3-.8c-.5-1.2.4-2.2 1.6-2.2H17a4 4 0 0 0 4-4c0-5-4-9-9-9z" /><circle cx="7.5" cy="11" r="1.2" /><circle cx="10.5" cy="7" r="1.2" /><circle cx="15.5" cy="7.5" r="1.2" /></Svg>;
export const MoonIcon = () => <Svg><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></Svg>;
export const ShuffleIcon = () => <Svg><path d="M3 7h3.5a5 5 0 0 1 4 2l3 4a5 5 0 0 0 4 2H21M3 17h3.5a5 5 0 0 0 4-2M17.5 7H21M18 4l3 3-3 3M18 12l3 3-3 3" /></Svg>;
export const ClipboardIcon = () => <Svg><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4h6v3H9zM9 12h6M9 16h4" /></Svg>;
