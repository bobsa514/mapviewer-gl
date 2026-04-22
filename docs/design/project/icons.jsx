// Inline SVG icons — 16x16, currentColor, thin stroke (editorial feel)

const Icon = ({ d, size = 16, stroke = 1.5, fill = "none", children, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={fill} stroke="currentColor"
       strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" {...p}>
    {children || <path d={d} />}
  </svg>
);

const EyeIcon     = (p) => <Icon {...p}><path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z"/><circle cx="8" cy="8" r="2"/></Icon>;
const EyeOffIcon  = (p) => <Icon {...p}><path d="M3 3l10 10M9.5 9.5A2 2 0 0 1 6.5 6.5M6 4.2A6 6 0 0 1 14.5 8a9 9 0 0 1-2 2.4M1.5 8A9 9 0 0 1 4 5.2"/></Icon>;
const DragIcon    = (p) => <Icon {...p}><circle cx="6" cy="4" r="0.7" fill="currentColor" stroke="none"/><circle cx="10" cy="4" r="0.7" fill="currentColor" stroke="none"/><circle cx="6" cy="8" r="0.7" fill="currentColor" stroke="none"/><circle cx="10" cy="8" r="0.7" fill="currentColor" stroke="none"/><circle cx="6" cy="12" r="0.7" fill="currentColor" stroke="none"/><circle cx="10" cy="12" r="0.7" fill="currentColor" stroke="none"/></Icon>;
const TrashIcon   = (p) => <Icon {...p}><path d="M3 4h10M6 4V2.5h4V4M4.5 4l.5 9.5h6l.5-9.5"/></Icon>;
const EditIcon    = (p) => <Icon {...p}><path d="M11 2.5l2.5 2.5M3 13l8.5-8.5 2 2L5 15H3v-2Z"/></Icon>;
const PaletteIcon = (p) => <Icon {...p}><path d="M8 1.5A6.5 6.5 0 1 0 13 12c-.8 0-1.2-.5-1.2-1.2 0-.8.5-1.3 1.2-1.3H14a.5.5 0 0 0 .5-.5A6.5 6.5 0 0 0 8 1.5Z"/><circle cx="5" cy="6" r="0.7" fill="currentColor" stroke="none"/><circle cx="9" cy="4" r="0.7" fill="currentColor" stroke="none"/><circle cx="11.5" cy="7" r="0.7" fill="currentColor" stroke="none"/></Icon>;
const FilterIcon  = (p) => <Icon {...p}><path d="M2 3h12l-4.5 5.5V13l-3 1.5V8.5L2 3Z"/></Icon>;
const SqlIcon     = (p) => <Icon {...p}><ellipse cx="8" cy="4" rx="5" ry="1.8"/><path d="M3 4v8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V4M3 8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8"/></Icon>;
const PlusIcon    = (p) => <Icon {...p}><path d="M8 3v10M3 8h10"/></Icon>;
const UploadIcon  = (p) => <Icon {...p}><path d="M8 10V2M5 5l3-3 3 3M3 12v1.5A0.5 0.5 0 0 0 3.5 14h9a.5.5 0 0 0 .5-.5V12"/></Icon>;
const DownloadIcon= (p) => <Icon {...p}><path d="M8 2v8M5 7l3 3 3-3M3 12v1.5A0.5 0.5 0 0 0 3.5 14h9a.5.5 0 0 0 .5-.5V12"/></Icon>;
const LinkIcon    = (p) => <Icon {...p}><path d="M6 10l4-4M6.5 4.5L8 3a2.5 2.5 0 0 1 3.5 3.5L10 8M6 8l-1.5 1.5A2.5 2.5 0 1 0 8 13l1.5-1.5"/></Icon>;
const LockIcon    = (p) => <Icon {...p}><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5 7V5a3 3 0 0 1 6 0v2"/></Icon>;
const CloseIcon   = (p) => <Icon {...p}><path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/></Icon>;
const PlayIcon    = (p) => <Icon {...p}><path d="M4 3l9 5-9 5V3Z" fill="currentColor" stroke="none"/></Icon>;
const ZoomInIcon  = (p) => <Icon {...p}><circle cx="7" cy="7" r="4.5"/><path d="M7 4.5v5M4.5 7h5M10.5 10.5l3 3"/></Icon>;
const ZoomOutIcon = (p) => <Icon {...p}><circle cx="7" cy="7" r="4.5"/><path d="M4.5 7h5M10.5 10.5l3 3"/></Icon>;
const TargetIcon  = (p) => <Icon {...p}><circle cx="8" cy="8" r="5"/><circle cx="8" cy="8" r="1" fill="currentColor" stroke="none"/><path d="M8 1.5V3M8 13v1.5M1.5 8H3M13 8h1.5"/></Icon>;
const ChevronIcon = (p) => <Icon {...p}><path d="M5 4l4 4-4 4"/></Icon>;
const GearIcon    = (p) => <Icon {...p}><circle cx="8" cy="8" r="2"/><path d="M8 1.5v2M8 12.5v2M14.5 8h-2M3.5 8h-2M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4M12.6 12.6l-1.4-1.4M4.8 4.8L3.4 3.4"/></Icon>;
const PointsIcon  = (p) => <Icon {...p}><circle cx="4" cy="4" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none"/><circle cx="7" cy="10" r="1.5" fill="currentColor" stroke="none"/><circle cx="11" cy="12" r="1.5" fill="currentColor" stroke="none"/></Icon>;
const PolyIcon    = (p) => <Icon {...p}><path d="M3 4l4-1.5 6 2.5v6l-4 2-5-2.5Z"/></Icon>;
const HexIcon     = (p) => <Icon {...p}><path d="M4 4.5l4-2.3 4 2.3v4.6l-4 2.3-4-2.3Z"/></Icon>;
const PinIcon     = (p) => <Icon {...p}><path d="M8 2a3.5 3.5 0 0 1 3.5 3.5c0 2.5-3.5 7-3.5 7S4.5 8 4.5 5.5A3.5 3.5 0 0 1 8 2Z"/><circle cx="8" cy="5.5" r="1"/></Icon>;
const PinSlashIcon= (p) => <Icon {...p}><path d="M8 2a3.5 3.5 0 0 1 3.5 3.5c0 2.5-3.5 7-3.5 7S4.5 8 4.5 5.5A3.5 3.5 0 0 1 8 2Z"/><circle cx="8" cy="5.5" r="1"/><path d="M2 2l12 12"/></Icon>;
const InfoIcon    = (p) => <Icon {...p}><circle cx="8" cy="8" r="6"/><path d="M8 7v4M8 5v.5"/></Icon>;
const SparkIcon   = (p) => <Icon {...p}><path d="M8 2v3M8 11v3M2 8h3M11 8h3M4.2 4.2l2 2M9.8 9.8l2 2M4.2 11.8l2-2M9.8 6.2l2-2"/></Icon>;
const LayersIcon  = (p) => <Icon {...p}><path d="M8 2L2 5l6 3 6-3-6-3ZM2 8l6 3 6-3M2 11l6 3 6-3"/></Icon>;

Object.assign(window, {
  EyeIcon, EyeOffIcon, DragIcon, TrashIcon, EditIcon, PaletteIcon, FilterIcon, SqlIcon,
  PlusIcon, UploadIcon, DownloadIcon, LinkIcon, LockIcon, CloseIcon, PlayIcon,
  ZoomInIcon, ZoomOutIcon, TargetIcon, ChevronIcon, GearIcon,
  PointsIcon, PolyIcon, HexIcon, PinIcon, PinSlashIcon, InfoIcon, SparkIcon, LayersIcon,
});
