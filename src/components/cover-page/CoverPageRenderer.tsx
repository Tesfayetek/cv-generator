import React, { useMemo, useRef, useState } from 'react';
import {
  Award,
  Briefcase,
  BookOpen,
  Compass,
  Globe,
  ImagePlus,
  Layers,
  Lock,
  Shield,
  Sparkles,
} from 'lucide-react';
import type {
  CoverBackgroundConfig,
  CoverCanvasElement,
  CoverPageDocument,
  CoverPagePersonalInfo,
  CoverPatternType,
} from '../../types/coverPage';

export function resolveCoverElementText(
  el: CoverCanvasElement,
  info: CoverPagePersonalInfo
): string {
  if (!el.fieldBinding) return el.text || '';
  if (el.fieldBinding === 'contactLine') {
    const parts = [
      info.email,
      info.phone,
      info.location,
      info.linkedin,
      info.website,
    ].filter((v) => v && v.trim());
    // Narrow boxes stack vertically, wide bars join inline
    return el.width < 36 ? parts.join('\n') : parts.join('   ·   ');
  }
  const val = info[el.fieldBinding];
  return val || el.text || '';
}

export function getCoverCanvasDimensions(coverPage: CoverPageDocument): {
  widthPx: number;
  heightPx: number;
  widthMm: number;
  heightMm: number;
} {
  if (coverPage.pageSize === 'LETTER') {
    return { widthPx: 816, heightPx: 1056, widthMm: 215.9, heightMm: 279.4 };
  }
  if (coverPage.pageSize === 'CUSTOM') {
    const wMm = Math.max(120, Math.min(350, coverPage.designConfiguration.customWidthMm || 210));
    const hMm = Math.max(150, Math.min(450, coverPage.designConfiguration.customHeightMm || 297));
    return {
      widthPx: Math.round(wMm * 3.78),
      heightPx: Math.round(hMm * 3.78),
      widthMm: wMm,
      heightMm: hMm,
    };
  }
  return { widthPx: 794, heightPx: 1123, widthMm: 210, heightMm: 297 };
}

function renderPatternSvg(bg: CoverBackgroundConfig) {
  const pattern = bg.patternType as CoverPatternType | undefined;
  if (!pattern || pattern === 'none') return null;
  const color = bg.patternColor || '#2864A6';
  const opacity = bg.patternOpacity ?? 0.08;

  if (pattern === 'dots') {
    return (
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity }}>
        <defs>
          <pattern id="cp-dots" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="4" cy="4" r="1.6" fill={color} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#cp-dots)" />
      </svg>
    );
  }
  if (pattern === 'grid') {
    return (
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity }}>
        <defs>
          <pattern id="cp-grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke={color} strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#cp-grid)" />
      </svg>
    );
  }
  if (pattern === 'diagonal') {
    return (
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity }}>
        <defs>
          <pattern id="cp-diag" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="24" stroke={color} strokeWidth="1.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#cp-diag)" />
      </svg>
    );
  }
  if (pattern === 'hexagons') {
    return (
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity }}>
        <defs>
          <pattern id="cp-hex" width="56" height="48" patternUnits="userSpaceOnUse">
            <polygon
              points="28,2 52,14 52,36 28,48 4,36 4,14"
              fill="none"
              stroke={color}
              strokeWidth="1.2"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#cp-hex)" />
      </svg>
    );
  }
  if (pattern === 'rings') {
    return (
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 800 1120"
        preserveAspectRatio="none"
        style={{ opacity }}
      >
        <circle cx="680" cy="180" r="220" fill="none" stroke={color} strokeWidth="2" />
        <circle cx="680" cy="180" r="300" fill="none" stroke={color} strokeWidth="1.2" />
        <circle cx="120" cy="940" r="240" fill="none" stroke={color} strokeWidth="1.5" />
      </svg>
    );
  }
  if (pattern === 'waves') {
    return (
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 800 1120"
        preserveAspectRatio="none"
        style={{ opacity }}
      >
        <path
          d="M0 900 Q 220 820 440 900 T 800 870 L 800 1120 L 0 1120 Z"
          fill={color}
        />
        <path
          d="M0 960 Q 260 880 500 960 T 800 940 L 800 1120 L 0 1120 Z"
          fill={color}
          opacity="0.55"
        />
      </svg>
    );
  }
  return null;
}

function renderIconSymbol(iconName: CoverCanvasElement['iconName'], color: string) {
  const props = { className: 'w-full h-full', style: { color } };
  switch (iconName) {
    case 'briefcase':
      return <Briefcase {...props} />;
    case 'award':
      return <Award {...props} />;
    case 'globe':
      return <Globe {...props} />;
    case 'book':
      return <BookOpen {...props} />;
    case 'compass':
      return <Compass {...props} />;
    case 'layers':
      return <Layers {...props} />;
    case 'shield':
      return <Shield {...props} />;
    default:
      return <Sparkles {...props} />;
  }
}

interface CoverPageRendererProps {
  coverPage: CoverPageDocument;
  scale?: number;
  interactive?: boolean;
  selectedElementId?: string | null;
  onSelectElement?: (id: string | null) => void;
  onUpdateElement?: (id: string, patch: Partial<CoverCanvasElement>) => void;
  onCommitElementHistory?: (id: string, patch: Partial<CoverCanvasElement>) => void;
  onDoubleClickElement?: (el: CoverCanvasElement) => void;
  printClassName?: string;
}

interface SnapGuide {
  axis: 'x' | 'y';
  pos: number; // percentage
}

export const CoverPageRenderer: React.FC<CoverPageRendererProps> = ({
  coverPage,
  scale = 1,
  interactive = false,
  selectedElementId,
  onSelectElement,
  onUpdateElement,
  onCommitElementHistory,
  onDoubleClickElement,
  printClassName = '',
}) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  const dims = useMemo(() => getCoverCanvasDimensions(coverPage), [coverPage]);
  const bg = coverPage.backgroundConfiguration;
  const elements = useMemo(
    () => [...(coverPage.designConfiguration.elements || [])].sort((a, b) => a.zIndex - b.zIndex),
    [coverPage.designConfiguration.elements]
  );

  const backgroundCss = useMemo(() => {
    if (bg.type === 'gradient') {
      return `linear-gradient(${bg.gradientAngle || 135}deg, ${bg.primaryColor || '#142B4A'}, ${bg.secondaryColor || '#2864A6'})`;
    }
    return bg.primaryColor || '#FFFFFF';
  }, [bg]);

  const beginDragMove = (e: React.PointerEvent, el: CoverCanvasElement) => {
    if (!interactive || el.locked || editingTextId === el.id) return;
    e.stopPropagation();
    onSelectElement?.(el.id);

    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const origX = el.x;
    const origY = el.y;
    let finalX = origX;
    let finalY = origY;

    const otherXs = [50, 8, 92];
    const otherYs = [50, 8, 92];
    elements.forEach((other) => {
      if (other.id === el.id) return;
      otherXs.push(other.x, other.x + other.width / 2, other.x + other.width);
      otherYs.push(other.y, other.y + other.height / 2, other.y + other.height);
    });

    const handleMove = (ev: PointerEvent) => {
      const dxPct = ((ev.clientX - startClientX) / rect.width) * 100;
      const dyPct = ((ev.clientY - startClientY) / rect.height) * 100;
      let nextX = Math.max(-5, Math.min(100 - Math.min(el.width, 10), origX + dxPct));
      let nextY = Math.max(-5, Math.min(100 - Math.min(el.height, 4), origY + dyPct));

      const guides: SnapGuide[] = [];
      const threshold = 1.1;

      // Snap X (left, center, right)
      const cx = nextX + el.width / 2;
      for (const gx of otherXs) {
        if (Math.abs(nextX - gx) < threshold) {
          nextX = gx;
          guides.push({ axis: 'x', pos: gx });
          break;
        }
        if (Math.abs(cx - gx) < threshold) {
          nextX = gx - el.width / 2;
          guides.push({ axis: 'x', pos: gx });
          break;
        }
      }

      // Snap Y (top, center)
      const cy = nextY + el.height / 2;
      for (const gy of otherYs) {
        if (Math.abs(nextY - gy) < threshold) {
          nextY = gy;
          guides.push({ axis: 'y', pos: gy });
          break;
        }
        if (Math.abs(cy - gy) < threshold) {
          nextY = gy - el.height / 2;
          guides.push({ axis: 'y', pos: gy });
          break;
        }
      }

      finalX = Number(nextX.toFixed(2));
      finalY = Number(nextY.toFixed(2));
      setSnapGuides(guides);
      onUpdateElement?.(el.id, { x: finalX, y: finalY });
    };

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      setSnapGuides([]);
      if (finalX !== origX || finalY !== origY) {
        onCommitElementHistory?.(el.id, { x: finalX, y: finalY });
      }
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const beginDragResize = (e: React.PointerEvent, el: CoverCanvasElement) => {
    if (!interactive || el.locked) return;
    e.stopPropagation();
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const origW = el.width;
    const origH = el.height;
    let finalW = origW;
    let finalH = origH;

    const handleMove = (ev: PointerEvent) => {
      const dw = ((ev.clientX - startX) / rect.width) * 100;
      const dh = ((ev.clientY - startY) / rect.height) * 100;
      finalW = Number(Math.max(1.5, Math.min(100 - el.x, origW + dw)).toFixed(2));
      finalH = Number(Math.max(0.4, Math.min(100 - el.y, origH + dh)).toFixed(2));
      onUpdateElement?.(el.id, { width: finalW, height: finalH });
    };

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      if (finalW !== origW || finalH !== origH) {
        onCommitElementHistory?.(el.id, { width: finalW, height: finalH });
      }
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const resolveImageSource = (el: CoverCanvasElement): string => {
    if (el.src) return el.src;
    if (el.type === 'photo') return coverPage.uploadedImages.profilePhoto || '';
    if (el.type === 'personalLogo') return coverPage.uploadedImages.personalLogo || '';
    if (el.type === 'companyLogo') return coverPage.uploadedImages.companyLogo || '';
    return '';
  };

  const marginPctX = (bg.marginMm / dims.widthMm) * 100;
  const marginPctY = (bg.marginMm / dims.heightMm) * 100;

  return (
    <div
      style={{
        width: dims.widthPx * scale,
        height: dims.heightPx * scale,
      }}
      className={`relative shrink-0 ${printClassName}`}
    >
      <div
        ref={stageRef}
        onPointerDown={() => {
          if (interactive) {
            setEditingTextId(null);
            onSelectElement?.(null);
          }
        }}
        style={{
          width: dims.widthPx,
          height: dims.heightPx,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          background: backgroundCss,
          fontFamily: coverPage.designConfiguration.fontFamily,
        }}
        className="relative overflow-hidden shadow-lg border border-slate-200 select-none bg-white"
      >
        {/* Uploaded Background Image Layer */}
        {(bg.type === 'image' || bg.imageUrl) && (bg.imageUrl || coverPage.uploadedImages.backgroundImage) && (
          <img
            src={bg.imageUrl || coverPage.uploadedImages.backgroundImage}
            alt="Cover background"
            style={{ opacity: bg.imageOpacity ?? 0.35 }}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          />
        )}

        {/* Geometric / Abstract Pattern Layer */}
        {renderPatternSvg(bg)}

        {/* Margin & Bleed Guides (Interactive Studio Only) */}
        {interactive && bg.showBleedGuides && (
          <>
            <div
              style={{
                left: `${marginPctX}%`,
                right: `${marginPctX}%`,
                top: `${marginPctY}%`,
                bottom: `${marginPctY}%`,
              }}
              className="absolute border border-dashed border-[#2864A6]/45 pointer-events-none z-40"
            />
            <div
              style={{ left: '1.5%', right: '1.5%', top: '1.5%', bottom: '1.5%' }}
              className="absolute border border-dotted border-rose-400/50 pointer-events-none z-40"
            />
          </>
        )}

        {/* Snapping Alignment Hairlines */}
        {interactive &&
          snapGuides.map((g, i) =>
            g.axis === 'x' ? (
              <div
                key={`gx_${i}`}
                style={{ left: `${g.pos}%` }}
                className="absolute top-0 bottom-0 w-px bg-rose-500/80 z-50 pointer-events-none"
              />
            ) : (
              <div
                key={`gy_${i}`}
                style={{ top: `${g.pos}%` }}
                className="absolute left-0 right-0 h-px bg-rose-500/80 z-50 pointer-events-none"
              />
            )
          )}

        {/* Canvas Elements */}
        {elements.map((el) => {
          const isSelected = interactive && selectedElementId === el.id;
          const baseWrapperStyle: React.CSSProperties = {
            left: `${el.x}%`,
            top: `${el.y}%`,
            width: `${el.width}%`,
            height: `${el.height}%`,
            zIndex: el.zIndex,
            opacity: el.opacity ?? 1,
            transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
          };

          let inner: React.ReactNode = null;

          if (el.type === 'colorBlock' || el.type === 'line') {
            inner = (
              <div
                className="w-full h-full"
                style={{
                  backgroundColor: el.style.backgroundColor || coverPage.designConfiguration.primaryColor,
                  borderRadius: el.style.borderRadius ? `${el.style.borderRadius}px` : undefined,
                  border: el.style.borderWidth
                    ? `${el.style.borderWidth}px solid ${el.style.borderColor || '#CBD5E1'}`
                    : undefined,
                }}
              />
            );
          } else if (el.type === 'shape') {
            if (el.shapeKind === 'triangle') {
              inner = (
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
                  <polygon
                    points="0,0 100,0 0,100"
                    fill={el.style.backgroundColor || coverPage.designConfiguration.primaryColor}
                  />
                </svg>
              );
            } else if (el.shapeKind === 'diamond') {
              inner = (
                <div
                  className="w-full h-full"
                  style={{
                    backgroundColor: el.style.backgroundColor || coverPage.designConfiguration.primaryColor,
                    transform: 'rotate(45deg) scale(0.72)',
                  }}
                />
              );
            } else {
              const radius =
                el.shapeKind === 'circle'
                  ? '9999px'
                  : el.shapeKind === 'pill'
                  ? '9999px'
                  : el.shapeKind === 'rounded'
                  ? `${el.style.borderRadius ?? 10}px`
                  : `${el.style.borderRadius ?? 0}px`;
              inner = (
                <div
                  className="w-full h-full"
                  style={{
                    backgroundColor: el.style.backgroundColor || 'transparent',
                    border: el.style.borderWidth
                      ? `${el.style.borderWidth}px solid ${el.style.borderColor || coverPage.designConfiguration.primaryColor}`
                      : undefined,
                    borderRadius: radius,
                  }}
                />
              );
            }
          } else if (el.type === 'icon') {
            inner = (
              <div className="w-full h-full flex items-center justify-center">
                {renderIconSymbol(
                  el.iconName,
                  el.style.color || coverPage.designConfiguration.primaryColor
                )}
              </div>
            );
          } else if (
            el.type === 'photo' ||
            el.type === 'personalLogo' ||
            el.type === 'companyLogo'
          ) {
            const imgSrc = resolveImageSource(el);
            const cropShape = el.crop?.shape || 'rounded';
            const radius =
              cropShape === 'circle' ? '9999px' : cropShape === 'rounded' ? '12px' : '2px';
            const borderStyle = el.style.borderWidth
              ? `${el.style.borderWidth}px solid ${el.style.borderColor || '#FFFFFF'}`
              : undefined;

            inner = (
              <div
                className="w-full h-full overflow-hidden flex items-center justify-center"
                style={{
                  borderRadius: radius,
                  border: borderStyle,
                  backgroundColor: imgSrc
                    ? el.type === 'photo'
                      ? '#E2E8F0'
                      : 'transparent'
                    : 'rgba(226, 232, 240, 0.35)',
                }}
              >
                {imgSrc ? (
                  <img
                    src={imgSrc}
                    alt={el.label}
                    className={`w-full h-full ${el.type === 'photo' ? 'object-cover' : 'object-contain p-1'}`}
                    style={{
                      transform: `scale(${el.crop?.zoom || 1}) translate(${el.crop?.offsetX || 0}%, ${el.crop?.offsetY || 0}%)`,
                    }}
                  />
                ) : interactive ? (
                  <div className="flex flex-col items-center justify-center text-slate-400 text-center p-2 border border-dashed border-slate-300 w-full h-full">
                    <ImagePlus className="w-5 h-5 mb-1 opacity-75" />
                    <span className="text-[10px] font-semibold leading-tight">{el.label}</span>
                  </div>
                ) : (
                  <div className="w-full h-full border border-dashed border-slate-300/60" />
                )}
              </div>
            );
          } else {
            // Text element
            const textValue = resolveCoverElementText(el, coverPage.personalInformation);
            const isEditing = interactive && editingTextId === el.id;

            inner = isEditing ? (
              <textarea
                autoFocus
                value={textValue}
                onChange={(e) => {
                  const v = e.target.value;
                  onUpdateElement?.(el.id, {
                    text: v,
                    fieldBinding: el.fieldBinding === 'contactLine' ? undefined : el.fieldBinding,
                  });
                }}
                onBlur={() => setEditingTextId(null)}
                onPointerDown={(ev) => ev.stopPropagation()}
                style={{
                  fontFamily: el.style.fontFamily || coverPage.designConfiguration.fontFamily,
                  fontSize: `${el.style.fontSize || 14}px`,
                  fontWeight: el.style.fontWeight || '400',
                  fontStyle: el.style.fontStyle || 'normal',
                  color: el.style.color || coverPage.designConfiguration.textColor,
                  textAlign: el.style.textAlign || 'left',
                  letterSpacing: el.style.letterSpacing ? `${el.style.letterSpacing}em` : undefined,
                  lineHeight: el.style.lineHeight || 1.4,
                }}
                className="w-full h-full bg-white/90 text-slate-900 p-1 border border-[#2864A6] rounded resize-none focus:outline-none"
              />
            ) : (
              <div
                style={{
                  fontFamily: el.style.fontFamily || coverPage.designConfiguration.fontFamily,
                  fontSize: `${el.style.fontSize || 14}px`,
                  fontWeight: el.style.fontWeight || '400',
                  fontStyle: el.style.fontStyle || 'normal',
                  color: el.style.color || coverPage.designConfiguration.textColor,
                  backgroundColor: el.style.backgroundColor,
                  textAlign: el.style.textAlign || 'left',
                  letterSpacing: el.style.letterSpacing ? `${el.style.letterSpacing}em` : undefined,
                  lineHeight: el.style.lineHeight || 1.45,
                  textTransform: el.style.textTransform || 'none',
                  padding: el.style.padding ? `${el.style.padding}px` : undefined,
                }}
                className="w-full h-full whitespace-pre-wrap break-words overflow-hidden"
              >
                {textValue || (interactive ? `[${el.label}]` : '')}
              </div>
            );
          }

          return (
            <div
              key={el.id}
              style={baseWrapperStyle}
              onPointerDown={(e) => beginDragMove(e, el)}
              onDoubleClick={(e) => {
                if (!interactive || el.locked) return;
                e.stopPropagation();
                if (el.type === 'text' && !el.fieldBinding) {
                  setEditingTextId(el.id);
                } else {
                  onDoubleClickElement?.(el);
                }
              }}
              className={`absolute ${
                interactive
                  ? el.locked
                    ? 'cursor-not-allowed'
                    : 'cursor-move hover:outline hover:outline-1 hover:outline-[#2864A6]/50'
                  : ''
              } ${isSelected ? 'outline outline-2 outline-[#2864A6]' : ''}`}
            >
              {inner}

              {isSelected && (
                <>
                  {el.locked && (
                    <div className="absolute -top-5 left-0 bg-slate-800 text-white text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" />
                      <span>Locked</span>
                    </div>
                  )}
                  {!el.locked && (
                    <div
                      onPointerDown={(e) => beginDragResize(e, el)}
                      title="Drag to resize"
                      className="absolute -right-1.5 -bottom-1.5 w-3.5 h-3.5 bg-white border-2 border-[#2864A6] rounded-xs cursor-nwse-resize shadow-xs z-50"
                    />
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
