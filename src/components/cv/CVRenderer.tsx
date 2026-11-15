import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Globe, Linkedin, Mail, MapPin, Phone } from 'lucide-react';
import { FONT_CSS_MAP, SAMPLE_PORTRAIT_URL } from '../../data/presets';
import type {
  CVDocument,
  CVSectionKey,
  DesignConfiguration,
  WorkExperienceItem,
} from '../../types/cv';

interface CVRendererProps {
  cv: CVDocument;
  design: DesignConfiguration;
  scale?: number;
  singlePagePreview?: boolean;
  activePage?: number; // 1-indexed when paginated view shows one page at a time; undefined = show all pages
  selectedPrintPages?: number[]; // 1-indexed pages to include in print
  onPageCountChange?: (count: number) => void;
  className?: string;
}

interface RenderBlock {
  id: string;
  column: 'main' | 'side';
  sectionKey: CVSectionKey;
  isFirstInSection: boolean;
  experienceSlice?: WorkExperienceItem[];
  breakBefore?: boolean;
}

const MM_TO_PX = 3.7795275591;

function isDarkHex(hex: string): boolean {
  const clean = (hex || '#FFFFFF').replace('#', '');
  if (clean.length !== 6) return false;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.52;
}

function hasSectionContent(cv: CVDocument, key: CVSectionKey): boolean {
  switch (key) {
    case 'summary':
      return Boolean(cv.professionalSummary?.trim());
    case 'objective':
      return Boolean(cv.careerObjective?.trim());
    case 'experience':
      return cv.workExperience.length > 0;
    case 'education':
      return cv.education.length > 0;
    case 'skills':
      return cv.skills.length > 0;
    case 'certifications':
      return cv.certifications.length > 0;
    case 'languages':
      return cv.languages.length > 0;
    case 'projects':
      return cv.projects.length > 0;
    case 'awards':
      return cv.awards.length > 0;
    case 'publications':
      return cv.publications.length > 0;
    case 'volunteer':
      return cv.volunteerExperience.length > 0;
    case 'references':
      return cv.references.length > 0;
  }
}

export const CVRenderer: React.FC<CVRendererProps> = ({
  cv,
  design,
  scale = 1,
  singlePagePreview = false,
  activePage,
  selectedPrintPages,
  onPageCountChange,
  className = '',
}) => {
  const pageSize = design.page.size || 'A4';
  const pageWidthMm = pageSize === 'A4' ? 210 : 215.9;
  const pageHeightMm = pageSize === 'A4' ? 297 : 279.4;

  const pageWidthPx = Math.round(pageWidthMm * MM_TO_PX);
  const pageHeightPx = Math.round(pageHeightMm * MM_TO_PX);

  const marginTopPx = Math.round((design.page.marginTop || 15) * MM_TO_PX);
  const marginRightPx = Math.round((design.page.marginRight || 16) * MM_TO_PX);
  const marginBottomPx = Math.round((design.page.marginBottom || 15) * MM_TO_PX);
  const marginLeftPx = Math.round((design.page.marginLeft || 16) * MM_TO_PX);

  const bodyFontCss = FONT_CSS_MAP[design.typography.fontFamily] || FONT_CSS_MAP.Lato;
  const headingFontCss = FONT_CSS_MAP[design.typography.headingFontFamily] || bodyFontCss;

  const structure = design.layout.structure;
  const isTwoCol = structure !== 'one-column';
  const sidebarPct = structure === 'two-column-balanced' ? 48 : design.layout.sidebarWidth || 32;
  const mainPct = 100 - sidebarPct;

  const visibleSections = useMemo(
    () =>
      cv.sectionOrder.filter(
        (key) => !cv.hiddenSections.includes(key) && hasSectionContent(cv, key)
      ),
    [cv]
  );

  const sidebarSet = useMemo(
    () =>
      new Set<CVSectionKey>(
        design.layout.sidebarSections || ['skills', 'languages', 'certifications', 'awards']
      ),
    [design.layout.sidebarSections]
  );

  // Build atomic renderable blocks (splitting workExperience per role so multi-page CVs flow naturally)
  const allBlocks = useMemo<RenderBlock[]>(() => {
    const blocks: RenderBlock[] = [];
    for (const key of visibleSections) {
      const col: 'main' | 'side' = isTwoCol && sidebarSet.has(key) ? 'side' : 'main';
      const breakBefore = design.page.explicitPageBreaks?.includes(key);

      if (key === 'experience' && cv.workExperience.length > 1) {
        cv.workExperience.forEach((exp, idx) => {
          blocks.push({
            id: `block-${key}-${exp.id}-${idx}`,
            column: col,
            sectionKey: key,
            isFirstInSection: idx === 0,
            experienceSlice: [exp],
            breakBefore: idx === 0 ? breakBefore : false,
          });
        });
      } else {
        blocks.push({
          id: `block-${key}`,
          column: col,
          sectionKey: key,
          isFirstInSection: true,
          experienceSlice: key === 'experience' ? cv.workExperience : undefined,
          breakBefore,
        });
      }
    }
    return blocks;
  }, [visibleSections, isTwoCol, sidebarSet, cv.workExperience, design.page.explicitPageBreaks]);

  const measureRootRef = useRef<HTMLDivElement | null>(null);
  const [pages, setPages] = useState<Array<{ main: RenderBlock[]; side: RenderBlock[] }>>([
    {
      main: allBlocks.filter((b) => b.column === 'main'),
      side: allBlocks.filter((b) => b.column === 'side'),
    },
  ]);

  useLayoutEffect(() => {
    if (singlePagePreview) {
      setPages([
        {
          main: allBlocks.filter((b) => b.column === 'main'),
          side: allBlocks.filter((b) => b.column === 'side'),
        },
      ]);
      onPageCountChange?.(1);
      return;
    }

    const root = measureRootRef.current;
    if (!root) return;

    const headerEl = root.querySelector('[data-measure-header="true"]') as HTMLElement | null;
    const headerH = headerEl ? headerEl.offsetHeight + 12 : 110;
    const footerReserve = design.layout.showPageNumbers || design.layout.footerText ? 28 : 8;
    const topBannerExtra = design.layout.headerText ? 22 : 0;

    const firstPageMaxH = Math.max(
      200,
      pageHeightPx - marginTopPx - marginBottomPx - headerH - footerReserve - topBannerExtra
    );
    const nextPageMaxH = Math.max(
      260,
      pageHeightPx - marginTopPx - marginBottomPx - footerReserve - topBannerExtra
    );

    const heights = new Map<string, number>();
    root.querySelectorAll('[data-block-id]').forEach((el) => {
      const id = el.getAttribute('data-block-id');
      if (id) {
        heights.set(id, (el as HTMLElement).offsetHeight + 6);
      }
    });

    const paginateColumn = (colBlocks: RenderBlock[]) => {
      const colsByPage: RenderBlock[][] = [[]];
      let currentPageIdx = 0;
      let usedH = 0;

      for (const blk of colBlocks) {
        const h = heights.get(blk.id) || 60;
        const limit = currentPageIdx === 0 ? firstPageMaxH : nextPageMaxH;

        if (blk.breakBefore && colsByPage[currentPageIdx].length > 0) {
          currentPageIdx += 1;
          colsByPage[currentPageIdx] = [];
          usedH = 0;
        } else if (usedH + h > limit && colsByPage[currentPageIdx].length > 0) {
          currentPageIdx += 1;
          colsByPage[currentPageIdx] = [];
          usedH = 0;
        }

        colsByPage[currentPageIdx].push(blk);
        usedH += h;
      }
      return colsByPage;
    };

    const mainPages = paginateColumn(allBlocks.filter((b) => b.column === 'main'));
    const sidePages = isTwoCol ? paginateColumn(allBlocks.filter((b) => b.column === 'side')) : [[]];
    const total = Math.max(1, mainPages.length, sidePages.length);

    const combined: Array<{ main: RenderBlock[]; side: RenderBlock[] }> = [];
    for (let i = 0; i < total; i++) {
      combined.push({
        main: mainPages[i] || [],
        side: sidePages[i] || [],
      });
    }

    setPages(combined);
    onPageCountChange?.(combined.length);
  }, [
    allBlocks,
    singlePagePreview,
    pageHeightPx,
    marginTopPx,
    marginBottomPx,
    isTwoCol,
    design.layout.showPageNumbers,
    design.layout.footerText,
    design.layout.headerText,
    design.layout.headerStyle,
    design.typography.bodySize,
    design.typography.lineHeight,
    design.page.sectionSpacing,
    onPageCountChange,
  ]);

  const bulletChar = (() => {
    switch (design.layout.bulletStyle) {
      case 'square': return '▪';
      case 'dash': return '–';
      case 'arrow': return '▸';
      case 'none': return '';
      default: return '•';
    }
  })();

  const sectionIndexMap = useMemo(() => {
    const map = new Map<CVSectionKey, number>();
    visibleSections.forEach((s, idx) => map.set(s, idx + 1));
    return map;
  }, [visibleSections]);

  const renderSectionHeading = (key: CVSectionKey, onDarkBg: boolean) => {
    const rawTitle = cv.sectionTitles[key] || key;
    const num = sectionIndexMap.get(key) || 1;
    const style = design.layout.sectionHeadingStyle;
    const primary = onDarkBg ? '#FFFFFF' : design.colors.primary;
    const secondary = onDarkBg ? '#E2E8F0' : design.colors.secondary;
    const borderCol = onDarkBg ? 'rgba(255,255,255,0.28)' : design.colors.border;

    const baseStyle: React.CSSProperties = {
      fontFamily: headingFontCss,
      fontSize: `${design.typography.headingSize}px`,
      color: primary,
      letterSpacing: '0.06em',
      fontWeight: 700,
      textTransform: 'uppercase',
      marginBottom: '7px',
    };

    if (style === 'shaded-band') {
      return (
        <div
          style={{
            ...baseStyle,
            backgroundColor: onDarkBg ? 'rgba(255,255,255,0.12)' : design.colors.accent,
            padding: '4px 8px',
            borderLeft: `3px solid ${primary}`,
          }}
        >
          {rawTitle}
        </div>
      );
    }

    if (style === 'left-bar') {
      return (
        <div
          style={{
            ...baseStyle,
            borderLeft: `3.5px solid ${secondary}`,
            paddingLeft: '8px',
          }}
        >
          {rawTitle}
        </div>
      );
    }

    if (style === 'double-rule') {
      return (
        <div
          style={{
            ...baseStyle,
            borderBottom: `3px double ${primary}`,
            paddingBottom: '3px',
          }}
        >
          {rawTitle}
        </div>
      );
    }

    if (style === 'caps-rule') {
      return (
        <div className="flex items-center gap-2" style={{ marginBottom: '7px' }}>
          <span style={{ ...baseStyle, marginBottom: 0, whiteSpace: 'nowrap' }}>{rawTitle}</span>
          <span style={{ flex: 1, height: '1px', backgroundColor: borderCol }} />
        </div>
      );
    }

    if (style === 'numbered') {
      return (
        <div
          style={{
            ...baseStyle,
            borderBottom: `1px solid ${borderCol}`,
            paddingBottom: '3px',
          }}
        >
          <span style={{ color: secondary, marginRight: '6px' }}>
            {String(num).padStart(2, '0')}.
          </span>
          {rawTitle}
        </div>
      );
    }

    if (style === 'clean-bold') {
      return (
        <div style={{ ...baseStyle, textTransform: 'none', letterSpacing: '0.01em', fontSize: `${design.typography.headingSize + 1}px` }}>
          {rawTitle}
        </div>
      );
    }

    // default: underline
    return (
      <div
        style={{
          ...baseStyle,
          borderBottom: `1.5px solid ${primary}`,
          paddingBottom: '3px',
        }}
      >
        {rawTitle}
      </div>
    );
  };

  const renderBlock = (blk: RenderBlock, onDarkBg: boolean) => {
    const textCol = onDarkBg ? '#F8FAFC' : design.colors.text;
    const mutedCol = onDarkBg ? '#CBD5E1' : design.colors.mutedText;
    const primaryCol = onDarkBg ? '#FFFFFF' : design.colors.primary;
    const secondaryCol = onDarkBg ? '#93C5FD' : design.colors.secondary;
    const borderCol = onDarkBg ? 'rgba(255,255,255,0.22)' : design.colors.border;
    const accentBg = onDarkBg ? 'rgba(255,255,255,0.12)' : design.colors.accent;

    const key = blk.sectionKey;

    return (
      <div
        key={blk.id}
        data-block-id={blk.id}
        style={{
          marginBottom: `${design.page.sectionSpacing || 14}px`,
          color: textCol,
        }}
      >
        {blk.isFirstInSection && renderSectionHeading(key, onDarkBg)}

        {key === 'summary' && (
          <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{cv.professionalSummary}</p>
        )}

        {key === 'objective' && (
          <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{cv.careerObjective}</p>
        )}

        {key === 'experience' &&
          (blk.experienceSlice || cv.workExperience).map((exp) => {
            const dates = `${exp.startDate || ''}${exp.startDate && (exp.endDate || exp.current) ? ' – ' : ''}${
              exp.current ? 'Present' : exp.endDate || ''
            }`;
            const isDatesLeft = design.layout.timelineStyle === 'dates-left' && blk.column === 'main';
            const isDots = design.layout.timelineStyle === 'dots' && blk.column === 'main';

            return (
              <div
                key={exp.id}
                style={{
                  marginBottom: '9px',
                  display: isDatesLeft ? 'grid' : 'block',
                  gridTemplateColumns: isDatesLeft ? '105px 1fr' : undefined,
                  gap: isDatesLeft ? '12px' : undefined,
                  paddingLeft: isDots ? '12px' : undefined,
                  borderLeft: isDots ? `1.5px solid ${borderCol}` : undefined,
                  position: 'relative',
                }}
              >
                {isDots && (
                  <span
                    style={{
                      position: 'absolute',
                      left: '-4.5px',
                      top: '5px',
                      width: '7px',
                      height: '7px',
                      borderRadius: '9999px',
                      backgroundColor: secondaryCol,
                    }}
                  />
                )}

                {isDatesLeft && (
                  <div style={{ color: mutedCol, fontSize: '0.9em', paddingTop: '1px' }} className="tabular-nums">
                    <div>{dates}</div>
                    {exp.location && <div style={{ marginTop: '2px' }}>{exp.location}</div>}
                  </div>
                )}

                <div>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                    <div style={{ fontWeight: 700, color: primaryCol, fontSize: '1.05em' }}>
                      {exp.jobTitle}
                      {exp.company && (
                        <span style={{ fontWeight: 600, color: secondaryCol }}> · {exp.company}</span>
                      )}
                    </div>
                    {!isDatesLeft && (dates || exp.location) && (
                      <div style={{ color: mutedCol, fontSize: '0.88em' }} className="tabular-nums">
                        {dates}
                        {exp.location ? ` · ${exp.location}` : ''}
                      </div>
                    )}
                  </div>

                  {exp.description && (
                    <p style={{ margin: '3px 0 3px 0', color: textCol }}>{exp.description}</p>
                  )}

                  {exp.achievements?.filter((a) => a.trim()).length > 0 && (
                    <ul style={{ margin: '3px 0 0 0', padding: 0, listStyle: 'none' }}>
                      {exp.achievements
                        .filter((a) => a.trim())
                        .map((ach, idx) => (
                          <li
                            key={idx}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '6px',
                              marginBottom: '2px',
                            }}
                          >
                            {bulletChar && (
                              <span style={{ color: secondaryCol, fontWeight: 700, flexShrink: 0 }}>
                                {bulletChar}
                              </span>
                            )}
                            <span>{ach}</span>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}

        {key === 'education' &&
          cv.education.map((edu) => (
            <div key={edu.id} style={{ marginBottom: '7px' }}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <div style={{ fontWeight: 700, color: primaryCol }}>{edu.degree}</div>
                <div style={{ color: mutedCol, fontSize: '0.88em' }} className="tabular-nums">
                  {edu.startDate}
                  {edu.startDate && edu.endDate ? ' – ' : ''}
                  {edu.endDate}
                </div>
              </div>
              <div style={{ color: secondaryCol, fontWeight: 600 }}>
                {edu.institution}
                {edu.location ? ` · ${edu.location}` : ''}
              </div>
              {(edu.honors || edu.gpa || edu.coursework) && (
                <div style={{ color: mutedCol, fontSize: '0.9em', marginTop: '1px' }}>
                  {[edu.honors, edu.gpa ? `GPA: ${edu.gpa}` : '', edu.coursework ? `Coursework: ${edu.coursework}` : '']
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              )}
            </div>
          ))}

        {key === 'skills' && (() => {
          const mode = design.layout.skillDisplay;
          if (mode === 'comma') {
            return <p style={{ margin: 0 }}>{cv.skills.map((s) => s.name).join(' · ')}</p>;
          }
          if (mode === 'grouped') {
            const groups = new Map<string, string[]>();
            cv.skills.forEach((s) => {
              const cat = s.category || 'Core';
              if (!groups.has(cat)) groups.set(cat, []);
              groups.get(cat)!.push(s.name);
            });
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {Array.from(groups.entries()).map(([cat, list]) => (
                  <div key={cat}>
                    <span style={{ fontWeight: 700, color: primaryCol }}>{cat}: </span>
                    <span>{list.join(', ')}</span>
                  </div>
                ))}
              </div>
            );
          }
          if (mode === 'bars') {
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {cv.skills.map((s) => (
                  <div key={s.id}>
                    <div className="flex justify-between" style={{ fontSize: '0.94em', marginBottom: '2px' }}>
                      <span style={{ fontWeight: 600 }}>{s.name}</span>
                    </div>
                    <div
                      style={{
                        height: '4px',
                        width: '100%',
                        backgroundColor: borderCol,
                        borderRadius: '2px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(100, Math.max(25, (s.level || 4) * 20))}%`,
                          backgroundColor: secondaryCol,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            );
          }
          if (mode === 'grid') {
            return (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: blk.column === 'side' ? '1fr' : 'repeat(2, minmax(0, 1fr))',
                  gap: '3px 14px',
                }}
              >
                {cv.skills.map((s) => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ color: secondaryCol }}>▸</span>
                    <span>{s.name}</span>
                  </div>
                ))}
              </div>
            );
          }
          // default: tags (clean bordered chips)
          return (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {cv.skills.map((s) => (
                <span
                  key={s.id}
                  style={{
                    backgroundColor: accentBg,
                    color: primaryCol,
                    border: `1px solid ${borderCol}`,
                    padding: '2px 7px',
                    borderRadius: '3px',
                    fontSize: '0.9em',
                    fontWeight: 600,
                  }}
                >
                  {s.name}
                </span>
              ))}
            </div>
          );
        })()}

        {key === 'certifications' &&
          cv.certifications.map((c) => (
            <div key={c.id} style={{ marginBottom: '4px' }}>
              <span style={{ fontWeight: 600, color: primaryCol }}>{c.name}</span>
              <span style={{ color: mutedCol }}>
                {c.issuer ? ` — ${c.issuer}` : ''}
                {c.date ? ` (${c.date})` : ''}
              </span>
            </div>
          ))}

        {key === 'languages' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
            {cv.languages.map((l) => (
              <div key={l.id}>
                <span style={{ fontWeight: 600, color: primaryCol }}>{l.name}</span>
                <span style={{ color: mutedCol }}> · {l.proficiency}</span>
              </div>
            ))}
          </div>
        )}

        {key === 'projects' &&
          cv.projects.map((proj) => (
            <div key={proj.id} style={{ marginBottom: '7px' }}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <div style={{ fontWeight: 700, color: primaryCol }}>
                  {proj.name}
                  {proj.role && <span style={{ fontWeight: 500, color: secondaryCol }}> · {proj.role}</span>}
                </div>
                {proj.date && <span style={{ color: mutedCol, fontSize: '0.88em' }}>{proj.date}</span>}
              </div>
              {proj.description && <p style={{ margin: '2px 0' }}>{proj.description}</p>}
              {proj.highlights?.map((h, i) => (
                <div key={i} style={{ display: 'flex', gap: '5px' }}>
                  <span style={{ color: secondaryCol }}>{bulletChar || '•'}</span>
                  <span>{h}</span>
                </div>
              ))}
            </div>
          ))}

        {key === 'awards' &&
          cv.awards.map((aw) => (
            <div key={aw.id} style={{ marginBottom: '5px' }}>
              <div style={{ fontWeight: 600, color: primaryCol }}>
                {aw.title}
                <span style={{ fontWeight: 400, color: mutedCol }}>
                  {aw.issuer ? ` — ${aw.issuer}` : ''}
                  {aw.date ? ` (${aw.date})` : ''}
                </span>
              </div>
              {aw.description && <div style={{ color: textCol, fontSize: '0.94em' }}>{aw.description}</div>}
            </div>
          ))}

        {key === 'publications' &&
          cv.publications.map((pub) => (
            <div key={pub.id} style={{ marginBottom: '5px' }}>
              <span style={{ color: mutedCol }}>{pub.authors} ({pub.year}). </span>
              <span style={{ fontWeight: 600, color: primaryCol }}>{pub.title}. </span>
              <span style={{ fontStyle: 'italic' }}>{pub.venue}</span>
            </div>
          ))}

        {key === 'volunteer' &&
          cv.volunteerExperience.map((vol) => (
            <div key={vol.id} style={{ marginBottom: '6px' }}>
              <div className="flex justify-between gap-2">
                <span style={{ fontWeight: 600, color: primaryCol }}>
                  {vol.role} — {vol.organization}
                </span>
                <span style={{ color: mutedCol, fontSize: '0.88em' }}>
                  {vol.startDate} – {vol.endDate}
                </span>
              </div>
              {vol.description && <div style={{ marginTop: '2px' }}>{vol.description}</div>}
            </div>
          ))}

        {key === 'references' &&
          cv.references.map((ref) => (
            <div key={ref.id} style={{ marginBottom: '5px' }}>
              <div style={{ fontWeight: 600, color: primaryCol }}>{ref.name}</div>
              <div style={{ color: mutedCol, fontSize: '0.93em' }}>
                {ref.title}
                {ref.organization ? `, ${ref.organization}` : ''}
                {ref.relationship ? ` (${ref.relationship})` : ''}
              </div>
              <div style={{ color: textCol, fontSize: '0.9em' }}>
                {[ref.email, ref.phone].filter(Boolean).join(' · ')}
              </div>
            </div>
          ))}
      </div>
    );
  };

  const renderHeader = () => {
    const p = cv.personalInformation;
    const hStyle = design.layout.headerStyle;
    const isBanner = hStyle === 'banner-colored';
    const isCentered = hStyle === 'centered';
    const isSplit = hStyle === 'split-contact';
    const isExecutiveRule = hStyle === 'executive-rule';

    const headerBg = isBanner ? design.colors.headerBg : 'transparent';
    const bannerDark = isBanner && isDarkHex(design.colors.headerBg);
    const nameColor = isBanner ? (bannerDark ? '#FFFFFF' : design.colors.headerText) : design.colors.primary;
    const titleColor = isBanner
      ? bannerDark
        ? '#CBD5E1'
        : design.colors.headerText
      : design.colors.secondary;
    const metaColor = isBanner
      ? bannerDark
        ? '#E2E8F0'
        : design.colors.headerText
      : design.colors.mutedText;

    const showPhoto = design.layout.showPhoto;
    const photoSrc = p.photoUrl || SAMPLE_PORTRAIT_URL;
    const photoRadius =
      design.layout.photoShape === 'circle'
        ? '9999px'
        : design.layout.photoShape === 'rounded'
        ? '8px'
        : '2px';

    const contactItems = [
      p.email && { icon: Mail, text: p.email },
      p.phone && { icon: Phone, text: p.phone },
      p.location && { icon: MapPin, text: p.location },
      p.linkedin && { icon: Linkedin, text: p.linkedin },
      p.website && { icon: Globe, text: p.website },
    ].filter(Boolean) as Array<{ icon: any; text: string }>;

    return (
      <div
        data-measure-header="true"
        style={{
          backgroundColor: headerBg,
          padding: isBanner ? `${Math.max(16, marginTopPx * 0.7)}px ${marginRightPx}px 16px ${marginLeftPx}px` : '0 0 12px 0',
          marginBottom: isBanner ? '14px' : '12px',
          marginLeft: isBanner ? `-${marginLeftPx}px` : undefined,
          marginRight: isBanner ? `-${marginRightPx}px` : undefined,
          marginTop: isBanner ? `-${marginTopPx}px` : undefined,
          borderBottom: isBanner
            ? undefined
            : isExecutiveRule
            ? `2px solid ${design.colors.primary}`
            : hStyle === 'minimal'
            ? 'none'
            : `1px solid ${design.colors.border}`,
          textAlign: isCentered ? 'center' : 'left',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: isCentered ? 'column' : 'row',
            alignItems: isCentered ? 'center' : isSplit ? 'flex-start' : 'center',
            justifyContent: isSplit ? 'space-between' : isCentered ? 'center' : 'flex-start',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexDirection: isCentered ? 'column' : 'row' }}>
            {showPhoto && (
              <img
                src={photoSrc}
                alt={p.fullName || 'Profile portrait'}
                referrerPolicy="no-referrer"
                style={{
                  width: '66px',
                  height: '66px',
                  objectFit: 'cover',
                  borderRadius: photoRadius,
                  border: `2px solid ${isBanner ? 'rgba(255,255,255,0.4)' : design.colors.border}`,
                  flexShrink: 0,
                }}
              />
            )}
            <div>
              <div
                style={{
                  fontFamily: headingFontCss,
                  fontSize: `${design.typography.nameSize}px`,
                  fontWeight: 700,
                  color: nameColor,
                  lineHeight: 1.12,
                  letterSpacing: '-0.01em',
                }}
              >
                {p.fullName || 'Your Full Name'}
              </div>
              {p.professionalTitle && (
                <div
                  style={{
                    fontFamily: headingFontCss,
                    fontSize: `${Math.max(11, design.typography.headingSize)}px`,
                    fontWeight: 600,
                    color: titleColor,
                    marginTop: '3px',
                  }}
                >
                  {p.professionalTitle}
                </div>
              )}
              {!isSplit && contactItems.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: isCentered ? 'center' : 'flex-start',
                    gap: '4px 12px',
                    marginTop: '7px',
                    fontSize: `${Math.max(8.5, design.typography.bodySize - 0.8)}px`,
                    color: metaColor,
                  }}
                >
                  {contactItems.map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Icon style={{ width: '10px', height: '10px', flexShrink: 0 }} />
                        <span>{item.text}</span>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {isSplit && contactItems.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: '2px',
                fontSize: `${Math.max(8.5, design.typography.bodySize - 0.8)}px`,
                color: metaColor,
                flexShrink: 0,
              }}
            >
              {contactItems.map((item, idx) => (
                <span key={idx}>{item.text}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const sidebarIsDark = isDarkHex(design.colors.sidebarBg);

  const renderPageFrame = (
    pageContent: { main: RenderBlock[]; side: RenderBlock[] },
    pageNumber: number,
    totalPages: number,
    isMeasurement = false
  ) => {
    const isExcludedFromPrint =
      selectedPrintPages && selectedPrintPages.length > 0 && !selectedPrintPages.includes(pageNumber);

    const frameStyle: React.CSSProperties = {
      width: `${pageWidthPx}px`,
      height: isMeasurement ? 'auto' : `${pageHeightPx}px`,
      minHeight: isMeasurement ? undefined : `${pageHeightPx}px`,
      backgroundColor: design.colors.background || '#FFFFFF',
      color: design.colors.text,
      fontFamily: bodyFontCss,
      fontSize: `${design.typography.bodySize}px`,
      fontWeight: Number(design.typography.fontWeight || 400),
      lineHeight: design.typography.lineHeight || 1.45,
      letterSpacing: `${design.typography.letterSpacing || 0}em`,
      padding: `${marginTopPx}px ${marginRightPx}px ${marginBottomPx}px ${marginLeftPx}px`,
      position: 'relative',
      boxSizing: 'border-box',
      overflow: isMeasurement ? 'visible' : 'hidden',
      display: 'flex',
      flexDirection: 'column',
    };

    const mainColNode = (
      <div style={{ flex: 1, minWidth: 0 }}>
        {pageContent.main.map((blk) => renderBlock(blk, false))}
      </div>
    );

    const sideColNode = isTwoCol ? (
      <div
        style={{
          width: `${sidebarPct}%`,
          flexShrink: 0,
          backgroundColor:
            structure === 'two-column-balanced' ? 'transparent' : design.colors.sidebarBg,
          padding: structure === 'two-column-balanced' ? '0' : '12px',
          borderRadius: structure === 'two-column-balanced' ? undefined : '4px',
          borderLeft:
            design.layout.decorativeAccent === 'sidebar-border' && structure === 'sidebar-right'
              ? `2px solid ${design.colors.primary}`
              : undefined,
          borderRight:
            design.layout.decorativeAccent === 'sidebar-border' && structure === 'sidebar-left'
              ? `2px solid ${design.colors.primary}`
              : undefined,
        }}
      >
        {pageContent.side.map((blk) =>
          renderBlock(blk, structure !== 'two-column-balanced' && sidebarIsDark)
        )}
      </div>
    ) : null;

    return (
      <div
        key={isMeasurement ? 'measure' : `page-${pageNumber}`}
        style={frameStyle}
        className={
          isMeasurement
            ? ''
            : `cv-print-page bg-white shadow-[0_8px_30px_rgba(15,23,42,0.10)] border border-slate-200/80 ${
                isExcludedFromPrint ? 'cv-print-excluded' : ''
              }`
        }
      >
        {/* Decorative top stripe */}
        {design.layout.decorativeAccent === 'top-stripe' && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '5px',
              backgroundColor: design.colors.primary,
            }}
          />
        )}

        {/* Decorative corner mark */}
        {design.layout.decorativeAccent === 'corner-mark' && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '32px',
              height: '32px',
              borderTop: `4px solid ${design.colors.secondary}`,
              borderRight: `4px solid ${design.colors.secondary}`,
            }}
          />
        )}

        {/* Optional running header text on pages 2+ or all pages */}
        {design.layout.headerText && pageNumber > 1 && (
          <div
            style={{
              fontSize: '8.5px',
              color: design.colors.mutedText,
              borderBottom: `1px solid ${design.colors.border}`,
              paddingBottom: '4px',
              marginBottom: '10px',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>{design.layout.headerText}</span>
            <span>{cv.personalInformation.fullName}</span>
          </div>
        )}

        {/* Main Header rendered on Page 1 */}
        {pageNumber === 1 && renderHeader()}

        {/* Body Columns */}
        <div
          style={{
            flex: 1,
            display: isTwoCol ? 'flex' : 'block',
            gap: isTwoCol ? '18px' : undefined,
            alignItems: 'stretch',
            minHeight: 0,
          }}
        >
          {structure === 'sidebar-left' || structure === 'two-column-balanced' ? (
            <>
              {sideColNode}
              {mainColNode}
            </>
          ) : structure === 'sidebar-right' ? (
            <>
              {mainColNode}
              {sideColNode}
            </>
          ) : (
            mainColNode
          )}
        </div>

        {/* Footer & Page Numbers */}
        {(design.layout.showPageNumbers || design.layout.footerText || design.layout.decorativeAccent === 'footer-rule') && (
          <div
            style={{
              marginTop: 'auto',
              paddingTop: '8px',
              borderTop:
                design.layout.decorativeAccent === 'footer-rule'
                  ? `1.5px solid ${design.colors.primary}`
                  : `1px solid ${design.colors.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '8.5px',
              color: design.colors.mutedText,
            }}
          >
            <span>{design.layout.footerText || cv.personalInformation.fullName || ''}</span>
            {design.layout.showPageNumbers && (
              <span className="tabular-nums">
                Page {pageNumber} of {totalPages}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  const pagesToDisplay = activePage
    ? pages.filter((_, idx) => idx + 1 === activePage)
    : pages;

  return (
    <div className={`relative ${className}`}>
      {/* Hidden offscreen DOM measurement pass for exact non-clipping multi-page breaks */}
      {!singlePagePreview && (
        <div
          ref={measureRootRef}
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: '-99999px',
            top: 0,
            visibility: 'hidden',
            pointerEvents: 'none',
            zIndex: -1,
          }}
        >
          {renderPageFrame(
            {
              main: allBlocks.filter((b) => b.column === 'main'),
              side: allBlocks.filter((b) => b.column === 'side'),
            },
            1,
            1,
            true
          )}
        </div>
      )}

      {/* Visible scaled pages */}
      <div className="cv-print-root flex flex-col items-center gap-6">
        {pagesToDisplay.map((pg, idx) => {
          const actualPageNum = activePage || idx + 1;
          return (
            <div
              key={actualPageNum}
              style={{
                width: `${pageWidthPx * scale}px`,
                height: `${pageHeightPx * scale}px`,
                flexShrink: 0,
              }}
              className="relative"
            >
              <div
                style={{
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                  width: `${pageWidthPx}px`,
                  height: `${pageHeightPx}px`,
                }}
              >
                {renderPageFrame(pg, actualPageNum, pages.length, false)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
