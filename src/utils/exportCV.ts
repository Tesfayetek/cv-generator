import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  PageBreak,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import type { CVDocument, CVSectionKey, DesignConfiguration } from '../types/cv';
import type { CoverCanvasElement, CoverPageDocument } from '../types/coverPage';
import { getCoverCanvasDimensions, resolveCoverElementText } from '../components/cover-page/CoverPageRenderer';

function hexToRgbTuple(hex: string): [number, number, number] {
  const clean = (hex || '#142B4A').replace('#', '');
  if (clean.length !== 6) return [20, 43, 74];
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return [isNaN(r) ? 0.08 : r, isNaN(g) ? 0.17 : g, isNaN(b) ? 0.29 : b];
}

function cleanHex(hex: string): string {
  return (hex || '#142B4A').replace('#', '').toUpperCase();
}

function mmToTwips(mm: number): number {
  return Math.round(mm * 56.6929);
}

function mmToPt(mm: number): number {
  return mm * 2.83465;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildSectionParagraphsForDocx(
  sectionKey: CVSectionKey,
  cv: CVDocument,
  design: DesignConfiguration
): Paragraph[] {
  const title = cv.sectionTitles[sectionKey] || sectionKey.toUpperCase();
  const primaryHex = cleanHex(design.colors.primary);
  const textHex = cleanHex(design.colors.text);
  const mutedHex = cleanHex(design.colors.mutedText);
  const accentHex = cleanHex(design.colors.accent);
  const fontName = design.typography.fontFamily === 'Source Sans 3' ? 'Source Sans Pro' : design.typography.fontFamily;
  const bodyHalfPt = Math.round(design.typography.bodySize * 2);
  const headingHalfPt = Math.round(design.typography.headingSize * 2);

  const items: Paragraph[] = [];

  const hasContent = (() => {
    switch (sectionKey) {
      case 'summary': return Boolean(cv.professionalSummary?.trim());
      case 'objective': return Boolean(cv.careerObjective?.trim());
      case 'experience': return cv.workExperience.length > 0;
      case 'education': return cv.education.length > 0;
      case 'skills': return cv.skills.length > 0;
      case 'certifications': return cv.certifications.length > 0;
      case 'languages': return cv.languages.length > 0;
      case 'projects': return cv.projects.length > 0;
      case 'awards': return cv.awards.length > 0;
      case 'publications': return cv.publications.length > 0;
      case 'volunteer': return cv.volunteerExperience.length > 0;
      case 'references': return cv.references.length > 0;
    }
  })();

  if (!hasContent) return [];

  if (design.page.explicitPageBreaks?.includes(sectionKey)) {
    items.push(new Paragraph({ children: [new PageBreak()] }));
  }

  const isShaded = design.layout.sectionHeadingStyle === 'shaded-band';
  items.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 90 },
      shading: isShaded ? { type: ShadingType.CLEAR, fill: accentHex } : undefined,
      border: {
        bottom: {
          color: primaryHex,
          space: 4,
          style: BorderStyle.SINGLE,
          size: design.layout.sectionHeadingStyle === 'double-rule' ? 12 : 6,
        },
      },
      children: [
        new TextRun({
          text: title.toUpperCase(),
          bold: true,
          color: primaryHex,
          font: fontName,
          size: headingHalfPt,
        }),
      ],
    })
  );

  if (sectionKey === 'summary' && cv.professionalSummary) {
    items.push(
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun({ text: cv.professionalSummary, color: textHex, font: fontName, size: bodyHalfPt })],
      })
    );
  }

  if (sectionKey === 'objective' && cv.careerObjective) {
    items.push(
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun({ text: cv.careerObjective, color: textHex, font: fontName, size: bodyHalfPt })],
      })
    );
  }

  if (sectionKey === 'experience') {
    for (const exp of cv.workExperience) {
      items.push(
        new Paragraph({
          spacing: { before: 90, after: 20 },
          children: [
            new TextRun({ text: exp.jobTitle, bold: true, color: textHex, font: fontName, size: bodyHalfPt + 1 }),
            new TextRun({ text: `  |  ${exp.company}`, bold: true, color: primaryHex, font: fontName, size: bodyHalfPt }),
          ],
        })
      );
      items.push(
        new Paragraph({
          spacing: { after: 40 },
          children: [
            new TextRun({
              text: `${exp.startDate} – ${exp.current ? 'Present' : exp.endDate}${exp.location ? `  ·  ${exp.location}` : ''}`,
              italics: true,
              color: mutedHex,
              font: fontName,
              size: Math.max(16, bodyHalfPt - 2),
            }),
          ],
        })
      );
      if (exp.description) {
        items.push(
          new Paragraph({
            spacing: { after: 40 },
            children: [new TextRun({ text: exp.description, color: textHex, font: fontName, size: bodyHalfPt })],
          })
        );
      }
      for (const ach of exp.achievements || []) {
        if (!ach.trim()) continue;
        items.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 30 },
            children: [new TextRun({ text: ach, color: textHex, font: fontName, size: bodyHalfPt })],
          })
        );
      }
    }
  }

  if (sectionKey === 'education') {
    for (const edu of cv.education) {
      items.push(
        new Paragraph({
          spacing: { before: 70, after: 20 },
          children: [
            new TextRun({ text: edu.degree, bold: true, color: textHex, font: fontName, size: bodyHalfPt + 1 }),
            new TextRun({ text: `  —  ${edu.institution}`, color: primaryHex, font: fontName, size: bodyHalfPt }),
          ],
        })
      );
      items.push(
        new Paragraph({
          spacing: { after: 50 },
          children: [
            new TextRun({
              text: `${edu.startDate} – ${edu.endDate}${edu.location ? ` · ${edu.location}` : ''}${edu.honors ? ` · ${edu.honors}` : ''}${edu.gpa ? ` · GPA: ${edu.gpa}` : ''}`,
              color: mutedHex,
              font: fontName,
              size: Math.max(16, bodyHalfPt - 2),
            }),
          ],
        })
      );
    }
  }

  if (sectionKey === 'skills') {
    const grouped = new Map<string, string[]>();
    for (const s of cv.skills) {
      const cat = s.category || 'Core';
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat)!.push(s.name);
    }
    for (const [cat, list] of grouped.entries()) {
      items.push(
        new Paragraph({
          spacing: { after: 45 },
          children: [
            new TextRun({ text: `${cat}: `, bold: true, color: primaryHex, font: fontName, size: bodyHalfPt }),
            new TextRun({ text: list.join(' · '), color: textHex, font: fontName, size: bodyHalfPt }),
          ],
        })
      );
    }
  }

  if (sectionKey === 'certifications') {
    for (const c of cv.certifications) {
      items.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 35 },
          children: [
            new TextRun({ text: c.name, bold: true, color: textHex, font: fontName, size: bodyHalfPt }),
            new TextRun({ text: ` — ${c.issuer}${c.date ? ` (${c.date})` : ''}`, color: mutedHex, font: fontName, size: bodyHalfPt }),
          ],
        })
      );
    }
  }

  if (sectionKey === 'languages') {
    items.push(
      new Paragraph({
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: cv.languages.map((l) => `${l.name} (${l.proficiency})`).join('   ·   '),
            color: textHex,
            font: fontName,
            size: bodyHalfPt,
          }),
        ],
      })
    );
  }

  if (sectionKey === 'projects') {
    for (const proj of cv.projects) {
      items.push(
        new Paragraph({
          spacing: { before: 70, after: 20 },
          children: [
            new TextRun({ text: proj.name, bold: true, color: textHex, font: fontName, size: bodyHalfPt + 1 }),
            new TextRun({ text: `${proj.role ? ` · ${proj.role}` : ''}${proj.date ? ` (${proj.date})` : ''}`, color: mutedHex, font: fontName, size: bodyHalfPt }),
          ],
        })
      );
      if (proj.description) {
        items.push(
          new Paragraph({
            spacing: { after: 30 },
            children: [new TextRun({ text: proj.description, color: textHex, font: fontName, size: bodyHalfPt })],
          })
        );
      }
      for (const h of proj.highlights || []) {
        items.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 25 },
            children: [new TextRun({ text: h, color: textHex, font: fontName, size: bodyHalfPt })],
          })
        );
      }
    }
  }

  if (sectionKey === 'awards') {
    for (const aw of cv.awards) {
      items.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 35 },
          children: [
            new TextRun({ text: aw.title, bold: true, color: textHex, font: fontName, size: bodyHalfPt }),
            new TextRun({ text: ` — ${aw.issuer}${aw.date ? ` (${aw.date})` : ''}${aw.description ? `: ${aw.description}` : ''}`, color: textHex, font: fontName, size: bodyHalfPt }),
          ],
        })
      );
    }
  }

  if (sectionKey === 'publications') {
    for (const pub of cv.publications) {
      items.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 45 },
          children: [
            new TextRun({ text: `${pub.authors ? `${pub.authors} ` : ''}(${pub.year}). `, color: mutedHex, font: fontName, size: bodyHalfPt }),
            new TextRun({ text: `${pub.title}. `, bold: true, color: textHex, font: fontName, size: bodyHalfPt }),
            new TextRun({ text: pub.venue, italics: true, color: textHex, font: fontName, size: bodyHalfPt }),
          ],
        })
      );
    }
  }

  if (sectionKey === 'volunteer') {
    for (const vol of cv.volunteerExperience) {
      items.push(
        new Paragraph({
          spacing: { before: 60, after: 20 },
          children: [
            new TextRun({ text: vol.role, bold: true, color: textHex, font: fontName, size: bodyHalfPt }),
            new TextRun({ text: ` — ${vol.organization} (${vol.startDate} – ${vol.endDate})`, color: mutedHex, font: fontName, size: bodyHalfPt }),
          ],
        })
      );
      if (vol.description) {
        items.push(
          new Paragraph({
            spacing: { after: 40 },
            children: [new TextRun({ text: vol.description, color: textHex, font: fontName, size: bodyHalfPt })],
          })
        );
      }
    }
  }

  if (sectionKey === 'references') {
    for (const ref of cv.references) {
      items.push(
        new Paragraph({
          spacing: { after: 45 },
          children: [
            new TextRun({ text: `${ref.name} — `, bold: true, color: textHex, font: fontName, size: bodyHalfPt }),
            new TextRun({
              text: `${ref.title}, ${ref.organization}${ref.email ? ` · ${ref.email}` : ''}${ref.phone ? ` · ${ref.phone}` : ''}`,
              color: mutedHex,
              font: fontName,
              size: bodyHalfPt,
            }),
          ],
        })
      );
    }
  }

  return items;
}

export async function exportToDOCX(
  cv: CVDocument,
  design: DesignConfiguration,
  pageSizeOverride?: 'A4' | 'LETTER'
): Promise<void> {
  const pageSize = pageSizeOverride || design.page.size || 'A4';
  const widthTwips = pageSize === 'A4' ? 11906 : 12240;
  const heightTwips = pageSize === 'A4' ? 16838 : 15840;

  const primaryHex = cleanHex(design.colors.primary);
  const secondaryHex = cleanHex(design.colors.secondary);
  const fontName = design.typography.fontFamily === 'Source Sans 3' ? 'Source Sans Pro' : design.typography.fontFamily;
  const p = cv.personalInformation;

  const contactParts = [p.email, p.phone, p.location, p.linkedin, p.website].filter(Boolean);
  const isBanner = design.layout.headerStyle === 'banner-colored';
  const isCentered = design.layout.headerStyle === 'centered';

  const headerParagraphs: Paragraph[] = [
    new Paragraph({
      alignment: isCentered ? AlignmentType.CENTER : AlignmentType.LEFT,
      shading: isBanner ? { type: ShadingType.CLEAR, fill: cleanHex(design.colors.headerBg) } : undefined,
      spacing: { before: isBanner ? 120 : 0, after: 40 },
      children: [
        new TextRun({
          text: p.fullName || cv.cvTitle || 'Curriculum Vitae',
          bold: true,
          color: isBanner ? 'FFFFFF' : primaryHex,
          font: fontName,
          size: Math.round(design.typography.nameSize * 2),
        }),
      ],
    }),
  ];

  if (p.professionalTitle) {
    headerParagraphs.push(
      new Paragraph({
        alignment: isCentered ? AlignmentType.CENTER : AlignmentType.LEFT,
        shading: isBanner ? { type: ShadingType.CLEAR, fill: cleanHex(design.colors.headerBg) } : undefined,
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: p.professionalTitle,
            bold: true,
            color: isBanner ? 'E2E8F0' : secondaryHex,
            font: fontName,
            size: 24,
          }),
        ],
      })
    );
  }

  if (contactParts.length > 0) {
    headerParagraphs.push(
      new Paragraph({
        alignment: isCentered ? AlignmentType.CENTER : AlignmentType.LEFT,
        shading: isBanner ? { type: ShadingType.CLEAR, fill: cleanHex(design.colors.headerBg) } : undefined,
        spacing: { after: 140 },
        border: !isBanner
          ? { bottom: { color: cleanHex(design.colors.border), space: 6, style: BorderStyle.SINGLE, size: 6 } }
          : undefined,
        children: [
          new TextRun({
            text: contactParts.join('   |   '),
            color: isBanner ? 'F1F5F9' : cleanHex(design.colors.mutedText),
            font: fontName,
            size: 18,
          }),
        ],
      })
    );
  }

  const visibleSections = cv.sectionOrder.filter((s) => !cv.hiddenSections.includes(s));
  const useTwoColTable =
    !cv.atsMode &&
    (design.layout.structure === 'sidebar-left' ||
      design.layout.structure === 'sidebar-right' ||
      design.layout.structure === 'two-column-balanced');

  let bodyChildren: (Paragraph | Table)[] = [...headerParagraphs];

  if (useTwoColTable) {
    const sidebarSet = new Set<CVSectionKey>(
      design.layout.sidebarSections || ['skills', 'languages', 'certifications', 'awards']
    );
    const sideSections = visibleSections.filter((s) => sidebarSet.has(s));
    const mainSections = visibleSections.filter((s) => !sidebarSet.has(s));

    const sideParagraphs = sideSections.flatMap((s) => buildSectionParagraphsForDocx(s, cv, design));
    const mainParagraphs = mainSections.flatMap((s) => buildSectionParagraphsForDocx(s, cv, design));

    const isRight = design.layout.structure === 'sidebar-right';
    const sidePct = design.layout.structure === 'two-column-balanced' ? 48 : design.layout.sidebarWidth || 32;
    const mainPct = 100 - sidePct;

    const sideCell = new TableCell({
      width: { size: sidePct, type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.CLEAR, fill: cleanHex(design.colors.sidebarBg) },
      margins: { top: 140, bottom: 140, left: 160, right: 160 },
      borders: {
        top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      },
      children: sideParagraphs.length > 0 ? sideParagraphs : [new Paragraph('')],
    });

    const mainCell = new TableCell({
      width: { size: mainPct, type: WidthType.PERCENTAGE },
      margins: { top: 140, bottom: 140, left: isRight ? 0 : 200, right: isRight ? 200 : 0 },
      borders: {
        top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      },
      children: mainParagraphs.length > 0 ? mainParagraphs : [new Paragraph('')],
    });

    const layoutTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      },
      rows: [
        new TableRow({
          children: isRight ? [mainCell, sideCell] : [sideCell, mainCell],
        }),
      ],
    });

    bodyChildren.push(layoutTable);
  } else {
    for (const s of visibleSections) {
      bodyChildren.push(...buildSectionParagraphsForDocx(s, cv, design));
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: widthTwips, height: heightTwips },
            margin: {
              top: mmToTwips(design.page.marginTop),
              right: mmToTwips(design.page.marginRight),
              bottom: mmToTwips(design.page.marginBottom),
              left: mmToTwips(design.page.marginLeft),
            },
          },
        },
        children: bodyChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const safeName = (cv.personalInformation.fullName || cv.cvTitle || 'cv-document')
    .replace(/[^a-zA-Z0-9_\- ]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  triggerDownload(blob, `${safeName || 'CV'}_${pageSize}.docx`);
}

// ============================================================================
// True Selectable-Text Vector PDF Exporter (pdf-lib) with Page Selection
// ============================================================================

function wrapTextToLines(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const paragraphs = text.split('\n');
  const lines: string[] = [];
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let current = words[0];
    for (let i = 1; i < words.length; i++) {
      const candidate = `${current} ${words[i]}`;
      if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
        current = candidate;
      } else {
        lines.push(current);
        current = words[i];
      }
    }
    lines.push(current);
  }
  return lines;
}

export async function exportToVectorPDF(
  cv: CVDocument,
  design: DesignConfiguration,
  options?: { pageSize?: 'A4' | 'LETTER'; selectedPages?: number[] }
): Promise<number> {
  const pageSize = options?.pageSize || design.page.size || 'A4';
  const pageW = pageSize === 'A4' ? 595.28 : 612;
  const pageH = pageSize === 'A4' ? 841.89 : 792;

  const pdfDoc = await PDFDocument.create();
  const isSerif = design.typography.fontFamily === 'Georgia' || design.typography.fontFamily === 'Garamond';
  const bodyFont = await pdfDoc.embedFont(isSerif ? StandardFonts.TimesRoman : StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(isSerif ? StandardFonts.TimesRomanBold : StandardFonts.HelveticaBold);
  const italicFont = await pdfDoc.embedFont(isSerif ? StandardFonts.TimesRomanItalic : StandardFonts.HelveticaOblique);

  const [pr, pg, pb] = hexToRgbTuple(design.colors.primary);
  const [sr, sg, sb] = hexToRgbTuple(design.colors.secondary);
  const [tr, tg, tb] = hexToRgbTuple(design.colors.text);
  const [mr, mg, mb] = hexToRgbTuple(design.colors.mutedText);
  const [hr, hg, hb] = hexToRgbTuple(design.colors.headerBg);
  const primaryColor = rgb(pr, pg, pb);
  const secondaryColor = rgb(sr, sg, sb);
  const textColor = rgb(tr, tg, tb);
  const mutedColor = rgb(mr, mg, mb);
  const headerBgColor = rgb(hr, hg, hb);

  const mTop = mmToPt(design.page.marginTop);
  const mRight = mmToPt(design.page.marginRight);
  const mBottom = mmToPt(design.page.marginBottom);
  const mLeft = mmToPt(design.page.marginLeft);
  const contentWidth = pageW - mLeft - mRight;

  const bodySize = Math.max(8.5, Math.min(11.5, design.typography.bodySize * 0.95));
  const headingSize = Math.max(10.5, Math.min(14, design.typography.headingSize * 0.95));
  const lineH = bodySize * (design.typography.lineHeight || 1.42);

  let page: PDFPage = pdfDoc.addPage([pageW, pageH]);
  let y = pageH - mTop;

  const ensureSpace = (needed: number) => {
    if (y - needed < mBottom + 18) {
      page = pdfDoc.addPage([pageW, pageH]);
      y = pageH - mTop;
    }
  };

  // Header
  const p = cv.personalInformation;
  const isBanner = design.layout.headerStyle === 'banner-colored' && !cv.atsMode;
  const isCentered = design.layout.headerStyle === 'centered';
  const nameText = p.fullName || cv.cvTitle || 'Curriculum Vitae';
  const nameSize = Math.min(24, design.typography.nameSize * 0.85);
  const contactLine = [p.email, p.phone, p.location, p.linkedin, p.website].filter(Boolean).join('  |  ');

  if (isBanner) {
    const bannerH = p.professionalTitle ? 88 : 68;
    page.drawRectangle({
      x: 0,
      y: pageH - bannerH - 12,
      width: pageW,
      height: bannerH + 12,
      color: headerBgColor,
    });
    y = pageH - 36;
    page.drawText(nameText, { x: mLeft, y, size: nameSize, font: boldFont, color: rgb(1, 1, 1) });
    y -= 18;
    if (p.professionalTitle) {
      page.drawText(p.professionalTitle, { x: mLeft, y, size: 11.5, font: bodyFont, color: rgb(0.9, 0.94, 0.98) });
      y -= 16;
    }
    if (contactLine) {
      for (const l of wrapTextToLines(contactLine, bodyFont, 8.8, contentWidth)) {
        page.drawText(l, { x: mLeft, y, size: 8.8, font: bodyFont, color: rgb(0.92, 0.95, 0.99) });
        y -= 12;
      }
    }
    y = pageH - bannerH - 28;
  } else {
    const nameW = boldFont.widthOfTextAtSize(nameText, nameSize);
    const nameX = isCentered ? (pageW - nameW) / 2 : mLeft;
    page.drawText(nameText, { x: Math.max(mLeft, nameX), y, size: nameSize, font: boldFont, color: primaryColor });
    y -= nameSize * 0.9;

    if (p.professionalTitle) {
      const tW = boldFont.widthOfTextAtSize(p.professionalTitle, 11);
      const tX = isCentered ? (pageW - tW) / 2 : mLeft;
      page.drawText(p.professionalTitle, { x: Math.max(mLeft, tX), y, size: 11, font: boldFont, color: secondaryColor });
      y -= 15;
    }

    if (contactLine) {
      for (const l of wrapTextToLines(contactLine, bodyFont, 8.8, contentWidth)) {
        const lW = bodyFont.widthOfTextAtSize(l, 8.8);
        const lX = isCentered ? (pageW - lW) / 2 : mLeft;
        page.drawText(l, { x: Math.max(mLeft, lX), y, size: 8.8, font: bodyFont, color: mutedColor });
        y -= 12;
      }
    }
    page.drawLine({
      start: { x: mLeft, y: y - 2 },
      end: { x: pageW - mRight, y: y - 2 },
      thickness: 0.8,
      color: primaryColor,
    });
    y -= 16;
  }

  const drawHeading = (title: string) => {
    ensureSpace(32);
    y -= 6;
    page.drawText(title.toUpperCase(), { x: mLeft, y, size: headingSize, font: boldFont, color: primaryColor });
    y -= 4;
    page.drawLine({
      start: { x: mLeft, y },
      end: { x: pageW - mRight, y },
      thickness: 0.75,
      color: primaryColor,
    });
    y -= 12;
  };

  const drawWrapped = (text: string, font: PDFFont, size: number, color: any, indent = 0) => {
    const lines = wrapTextToLines(text, font, size, contentWidth - indent);
    for (const line of lines) {
      ensureSpace(lineH);
      page.drawText(line, { x: mLeft + indent, y, size, font, color });
      y -= lineH;
    }
  };

  const visibleSections = cv.sectionOrder.filter((s) => !cv.hiddenSections.includes(s));
  for (const key of visibleSections) {
    if (design.page.explicitPageBreaks?.includes(key)) {
      page = pdfDoc.addPage([pageW, pageH]);
      y = pageH - mTop;
    }

    const title = cv.sectionTitles[key] || key.toUpperCase();
    if (key === 'summary' && cv.professionalSummary?.trim()) {
      drawHeading(title);
      drawWrapped(cv.professionalSummary, bodyFont, bodySize, textColor);
      y -= 4;
    } else if (key === 'objective' && cv.careerObjective?.trim()) {
      drawHeading(title);
      drawWrapped(cv.careerObjective, bodyFont, bodySize, textColor);
      y -= 4;
    } else if (key === 'experience' && cv.workExperience.length > 0) {
      drawHeading(title);
      for (const exp of cv.workExperience) {
        ensureSpace(36);
        page.drawText(`${exp.jobTitle} — ${exp.company}`, { x: mLeft, y, size: bodySize + 0.6, font: boldFont, color: textColor });
        y -= lineH;
        const meta = `${exp.startDate} – ${exp.current ? 'Present' : exp.endDate}${exp.location ? ` · ${exp.location}` : ''}`;
        page.drawText(meta, { x: mLeft, y, size: bodySize - 0.8, font: italicFont, color: mutedColor });
        y -= lineH;
        if (exp.description) {
          drawWrapped(exp.description, bodyFont, bodySize, textColor);
        }
        for (const ach of exp.achievements || []) {
          if (!ach.trim()) continue;
          drawWrapped(`• ${ach}`, bodyFont, bodySize, textColor, 8);
        }
        y -= 5;
      }
    } else if (key === 'education' && cv.education.length > 0) {
      drawHeading(title);
      for (const edu of cv.education) {
        ensureSpace(26);
        page.drawText(`${edu.degree} — ${edu.institution}`, { x: mLeft, y, size: bodySize + 0.4, font: boldFont, color: textColor });
        y -= lineH;
        const meta = `${edu.startDate} – ${edu.endDate}${edu.location ? ` · ${edu.location}` : ''}${edu.honors ? ` · ${edu.honors}` : ''}${edu.gpa ? ` · GPA ${edu.gpa}` : ''}`;
        drawWrapped(meta, italicFont, bodySize - 0.6, mutedColor);
        y -= 3;
      }
    } else if (key === 'skills' && cv.skills.length > 0) {
      drawHeading(title);
      drawWrapped(cv.skills.map((s) => s.name).join('  ·  '), bodyFont, bodySize, textColor);
      y -= 4;
    } else if (key === 'certifications' && cv.certifications.length > 0) {
      drawHeading(title);
      for (const c of cv.certifications) {
        drawWrapped(`• ${c.name} — ${c.issuer}${c.date ? ` (${c.date})` : ''}`, bodyFont, bodySize, textColor, 6);
      }
      y -= 4;
    } else if (key === 'languages' && cv.languages.length > 0) {
      drawHeading(title);
      drawWrapped(cv.languages.map((l) => `${l.name} (${l.proficiency})`).join('  ·  '), bodyFont, bodySize, textColor);
      y -= 4;
    } else if (key === 'projects' && cv.projects.length > 0) {
      drawHeading(title);
      for (const proj of cv.projects) {
        ensureSpace(24);
        page.drawText(`${proj.name}${proj.role ? ` · ${proj.role}` : ''}${proj.date ? ` (${proj.date})` : ''}`, {
          x: mLeft,
          y,
          size: bodySize + 0.4,
          font: boldFont,
          color: textColor,
        });
        y -= lineH;
        if (proj.description) drawWrapped(proj.description, bodyFont, bodySize, textColor);
        for (const h of proj.highlights || []) {
          drawWrapped(`• ${h}`, bodyFont, bodySize, textColor, 8);
        }
        y -= 3;
      }
    } else if (key === 'awards' && cv.awards.length > 0) {
      drawHeading(title);
      for (const aw of cv.awards) {
        drawWrapped(`• ${aw.title} — ${aw.issuer}${aw.date ? ` (${aw.date})` : ''}`, bodyFont, bodySize, textColor, 6);
      }
      y -= 4;
    } else if (key === 'publications' && cv.publications.length > 0) {
      drawHeading(title);
      for (const pub of cv.publications) {
        drawWrapped(`• ${pub.authors} (${pub.year}). ${pub.title}. ${pub.venue}`, bodyFont, bodySize, textColor, 6);
      }
      y -= 4;
    } else if (key === 'volunteer' && cv.volunteerExperience.length > 0) {
      drawHeading(title);
      for (const vol of cv.volunteerExperience) {
        drawWrapped(`${vol.role} — ${vol.organization} (${vol.startDate} – ${vol.endDate})`, boldFont, bodySize, textColor);
        if (vol.description) drawWrapped(vol.description, bodyFont, bodySize, textColor, 6);
      }
      y -= 4;
    } else if (key === 'references' && cv.references.length > 0) {
      drawHeading(title);
      for (const ref of cv.references) {
        drawWrapped(`${ref.name} — ${ref.title}, ${ref.organization} (${ref.email || ref.phone})`, bodyFont, bodySize, textColor);
      }
    }
  }

  const totalGenerated = pdfDoc.getPageCount();
  let finalDoc = pdfDoc;

  if (options?.selectedPages && options.selectedPages.length > 0) {
    const validIndices = options.selectedPages
      .map((pNum) => pNum - 1)
      .filter((idx) => idx >= 0 && idx < totalGenerated);
    if (validIndices.length > 0 && validIndices.length < totalGenerated) {
      finalDoc = await PDFDocument.create();
      const copied = await finalDoc.copyPages(pdfDoc, validIndices);
      copied.forEach((cp) => finalDoc.addPage(cp));
    }
  }

  // Add subtle page numbers if enabled
  if (design.layout.showPageNumbers) {
    const pages = finalDoc.getPages();
    const numFont = await finalDoc.embedFont(StandardFonts.Helvetica);
    pages.forEach((pgItem, idx) => {
      pgItem.drawText(`Page ${idx + 1} of ${pages.length}`, {
        x: pageW - mRight - 55,
        y: 18,
        size: 8,
        font: numFont,
        color: mutedColor,
      });
    });
  }

  const pdfBytes = await finalDoc.save();
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
  const safeName = (cv.personalInformation.fullName || cv.cvTitle || 'cv-document')
    .replace(/[^a-zA-Z0-9_\- ]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  triggerDownload(blob, `${safeName || 'CV'}_${pageSize}.pdf`);
  return totalGenerated;
}

export function triggerPrintCV(pageSize: 'A4' | 'LETTER') {
  const styleId = 'dynamic-cv-page-size';
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = `@media print { @page { size: ${pageSize === 'A4' ? 'A4' : 'letter'}; margin: 0; } }`;
  window.print();
}

// ============================================================================
// Cover Page & Combined (Cover Page + CV) Vector PDF & Editable DOCX Exporters
// ============================================================================

async function fetchImageBytes(src: string): Promise<{ bytes: Uint8Array; type: 'png' | 'jpg' } | null> {
  if (!src) return null;
  try {
    if (src.startsWith('data:image/')) {
      const isPng = src.startsWith('data:image/png');
      const base64 = src.split(',')[1];
      if (!base64) return null;
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return { bytes, type: isPng ? 'png' : 'jpg' };
    }
    const resp = await fetch(src);
    if (!resp.ok) return null;
    const buf = new Uint8Array(await resp.arrayBuffer());
    const contentType = resp.headers.get('content-type') || '';
    const isPng = contentType.includes('png') || src.toLowerCase().includes('.png');
    return { bytes: buf, type: isPng ? 'png' : 'jpg' };
  } catch {
    return null;
  }
}

async function embedImageInPdf(pdfDoc: PDFDocument, src: string): Promise<PDFImage | null> {
  const loaded = await fetchImageBytes(src);
  if (!loaded) return null;
  try {
    return loaded.type === 'png'
      ? await pdfDoc.embedPng(loaded.bytes)
      : await pdfDoc.embedJpg(loaded.bytes);
  } catch {
    // Fallback attempt opposite codec in case extension differed
    try {
      return loaded.type === 'png'
        ? await pdfDoc.embedJpg(loaded.bytes)
        : await pdfDoc.embedPng(loaded.bytes);
    } catch {
      return null;
    }
  }
}

function getCoverPdfDimensions(coverPage: CoverPageDocument, pageSizeOverride?: 'A4' | 'LETTER') {
  const effective = pageSizeOverride || coverPage.pageSize;
  if (effective === 'LETTER') return { pageW: 612, pageH: 792 };
  if (effective === 'CUSTOM') {
    const wMm = Math.max(120, Math.min(350, coverPage.designConfiguration.customWidthMm || 210));
    const hMm = Math.max(150, Math.min(450, coverPage.designConfiguration.customHeightMm || 297));
    return { pageW: mmToPt(wMm), pageH: mmToPt(hMm) };
  }
  return { pageW: 595.28, pageH: 841.89 };
}

async function drawCoverPageIntoPdf(
  pdfDoc: PDFDocument,
  coverPage: CoverPageDocument,
  pageSizeOverride?: 'A4' | 'LETTER'
): Promise<{ pageW: number; pageH: number }> {
  const { pageW, pageH } = getCoverPdfDimensions(coverPage, pageSizeOverride);
  const page = pdfDoc.addPage([pageW, pageH]);
  const bg = coverPage.backgroundConfiguration;

  const sansFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const sansItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const serifFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const serifBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const serifItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

  const pickFonts = (family?: string) => {
    const isSerif = family === 'Georgia' || family === 'Garamond' || family === 'Playfair Display';
    return isSerif
      ? { regular: serifFont, bold: serifBold, italic: serifItalic }
      : { regular: sansFont, bold: sansBold, italic: sansItalic };
  };

  // Base background fill (simulate gradient cleanly via stepped vector bands when gradient)
  const [br1, bg1, bb1] = hexToRgbTuple(bg.primaryColor || '#FFFFFF');
  page.drawRectangle({ x: 0, y: 0, width: pageW, height: pageH, color: rgb(br1, bg1, bb1) });

  if (bg.type === 'gradient') {
    const [br2, bg2, bb2] = hexToRgbTuple(bg.secondaryColor || bg.primaryColor);
    const steps = 28;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const r = br1 + (br2 - br1) * t;
      const g = bg1 + (bg2 - bg1) * t;
      const b = bb1 + (bb2 - bb1) * t;
      const sliceH = pageH / steps;
      page.drawRectangle({
        x: 0,
        y: pageH - (i + 1) * sliceH,
        width: pageW,
        height: sliceH + 0.5,
        color: rgb(r, g, b),
      });
    }
  }

  // Optional uploaded background image
  const bgImgSrc = bg.imageUrl || coverPage.uploadedImages.backgroundImage;
  if ((bg.type === 'image' || bgImgSrc) && bgImgSrc) {
    const embeddedBg = await embedImageInPdf(pdfDoc, bgImgSrc);
    if (embeddedBg) {
      page.drawImage(embeddedBg, {
        x: 0,
        y: 0,
        width: pageW,
        height: pageH,
        opacity: bg.imageOpacity ?? 0.35,
      });
    }
  }

  // Subtle vector geometric patterns
  if (bg.patternType === 'dots' || bg.patternType === 'grid') {
    const [pr, pg, pb] = hexToRgbTuple(bg.patternColor || '#2864A6');
    const patColor = rgb(pr, pg, pb);
    const patOp = bg.patternOpacity ?? 0.08;
    if (bg.patternType === 'dots') {
      for (let gx = 20; gx < pageW; gx += 22) {
        for (let gy = 20; gy < pageH; gy += 22) {
          page.drawCircle({ x: gx, y: gy, size: 1.1, color: patColor, opacity: patOp });
        }
      }
    } else {
      for (let gx = 0; gx < pageW; gx += 28) {
        page.drawLine({ start: { x: gx, y: 0 }, end: { x: gx, y: pageH }, thickness: 0.5, color: patColor, opacity: patOp });
      }
      for (let gy = 0; gy < pageH; gy += 28) {
        page.drawLine({ start: { x: 0, y: gy }, end: { x: pageW, y: gy }, thickness: 0.5, color: patColor, opacity: patOp });
      }
    }
  }

  const elements = [...(coverPage.designConfiguration.elements || [])].sort(
    (a, b) => a.zIndex - b.zIndex
  );
  const scaleFactor = pageW / getCoverCanvasDimensions(coverPage).widthPx;

  for (const el of elements) {
    const elX = (el.x / 100) * pageW;
    const elW = (el.width / 100) * pageW;
    const elH = (el.height / 100) * pageH;
    const elYBottom = pageH - ((el.y + el.height) / 100) * pageH;
    const elYTop = pageH - (el.y / 100) * pageH;
    const op = el.opacity ?? 1;

    if (el.type === 'colorBlock' || el.type === 'line') {
      const bgHex = el.style.backgroundColor || coverPage.designConfiguration.primaryColor;
      const [cr, cg, cb] = hexToRgbTuple(bgHex);
      page.drawRectangle({
        x: elX,
        y: elYBottom,
        width: elW,
        height: Math.max(0.8, elH),
        color: rgb(cr, cg, cb),
        opacity: op,
      });
    } else if (el.type === 'shape') {
      const fillHex = el.style.backgroundColor;
      const borderHex = el.style.borderColor;
      const hasFill = Boolean(fillHex && fillHex !== 'transparent');
      const [fr, fg, fb] = hexToRgbTuple(fillHex || '#FFFFFF');
      const [er, eg, eb] = hexToRgbTuple(borderHex || coverPage.designConfiguration.primaryColor);

      if (el.shapeKind === 'circle') {
        page.drawEllipse({
          x: elX + elW / 2,
          y: elYBottom + elH / 2,
          xScale: elW / 2,
          yScale: elH / 2,
          color: hasFill ? rgb(fr, fg, fb) : undefined,
          borderColor: el.style.borderWidth ? rgb(er, eg, eb) : undefined,
          borderWidth: el.style.borderWidth || 0,
          opacity: op,
        });
      } else {
        page.drawRectangle({
          x: elX,
          y: elYBottom,
          width: elW,
          height: elH,
          color: hasFill ? rgb(fr, fg, fb) : undefined,
          borderColor: el.style.borderWidth ? rgb(er, eg, eb) : undefined,
          borderWidth: el.style.borderWidth || 0,
          opacity: op,
        });
      }
    } else if (el.type === 'photo' || el.type === 'personalLogo' || el.type === 'companyLogo') {
      const src =
        el.src ||
        (el.type === 'photo'
          ? coverPage.uploadedImages.profilePhoto
          : el.type === 'personalLogo'
          ? coverPage.uploadedImages.personalLogo
          : coverPage.uploadedImages.companyLogo);
      if (src) {
        const embedded = await embedImageInPdf(pdfDoc, src);
        if (embedded) {
          page.drawImage(embedded, {
            x: elX,
            y: elYBottom,
            width: elW,
            height: elH,
            opacity: op,
          });
        }
      }
      if (el.style.borderWidth && el.style.borderColor) {
        const [br, bgc, bb] = hexToRgbTuple(el.style.borderColor);
        page.drawRectangle({
          x: elX,
          y: elYBottom,
          width: elW,
          height: elH,
          borderColor: rgb(br, bgc, bb),
          borderWidth: Math.max(0.75, el.style.borderWidth * 0.7),
        });
      }
    } else if (el.type === 'text') {
      let content = resolveCoverElementText(el, coverPage.personalInformation);
      if (!content) continue;
      if (el.style.textTransform === 'uppercase') content = content.toUpperCase();

      const fonts = pickFonts(el.style.fontFamily || coverPage.designConfiguration.fontFamily);
      const isBold = Number(el.style.fontWeight || 400) >= 600;
      const fontToUse = el.style.fontStyle === 'italic' ? fonts.italic : isBold ? fonts.bold : fonts.regular;
      const fontSizePt = Math.max(7.5, (el.style.fontSize || 13) * scaleFactor * 0.92);
      const lineHPt = fontSizePt * (el.style.lineHeight || 1.4);
      const [tr, tg, tb] = hexToRgbTuple(el.style.color || coverPage.designConfiguration.textColor);
      const txtColor = rgb(tr, tg, tb);

      const lines = wrapTextToLines(content, fontToUse, fontSizePt, Math.max(20, elW - 2));
      let curY = elYTop - fontSizePt;
      for (const line of lines) {
        if (curY < elYBottom - 4) break;
        const lineW = fontToUse.widthOfTextAtSize(line, fontSizePt);
        let drawX = elX;
        if (el.style.textAlign === 'center') drawX = elX + Math.max(0, (elW - lineW) / 2);
        if (el.style.textAlign === 'right') drawX = elX + Math.max(0, elW - lineW);
        page.drawText(line, { x: drawX, y: curY, size: fontSizePt, font: fontToUse, color: txtColor, opacity: op });
        curY -= lineHPt;
      }
    }
  }

  return { pageW, pageH };
}

export async function exportCoverPageToVectorPDF(
  coverPage: CoverPageDocument,
  pageSizeOverride?: 'A4' | 'LETTER'
): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  await drawCoverPageIntoPdf(pdfDoc, coverPage, pageSizeOverride);
  const bytes = await pdfDoc.save();
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
  const safeName = (coverPage.personalInformation.fullName || coverPage.title || 'cover-page')
    .replace(/[^a-zA-Z0-9_\- ]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  triggerDownload(blob, `${safeName || 'CoverPage'}_${pageSizeOverride || coverPage.pageSize}.pdf`);
}

export async function exportCombinedCVWithCoverPDF(
  coverPage: CoverPageDocument,
  cv: CVDocument,
  design: DesignConfiguration,
  options?: { pageSize?: 'A4' | 'LETTER' }
): Promise<void> {
  const pageSize = options?.pageSize || design.page.size || 'A4';
  const combinedDoc = await PDFDocument.create();

  // Page 1: Cover Page
  await drawCoverPageIntoPdf(combinedDoc, coverPage, pageSize);

  // Page 2+: Render CV into a temporary PDF document cleanly, then merge pages
  const pageW = pageSize === 'A4' ? 595.28 : 612;
  const pageH = pageSize === 'A4' ? 841.89 : 792;
  const cvPdf = await PDFDocument.create();
  const isSerif = design.typography.fontFamily === 'Georgia' || design.typography.fontFamily === 'Garamond';
  const bodyFont = await cvPdf.embedFont(isSerif ? StandardFonts.TimesRoman : StandardFonts.Helvetica);
  const boldFont = await cvPdf.embedFont(isSerif ? StandardFonts.TimesRomanBold : StandardFonts.HelveticaBold);
  const italicFont = await cvPdf.embedFont(isSerif ? StandardFonts.TimesRomanItalic : StandardFonts.HelveticaOblique);

  const [pr, pg, pb] = hexToRgbTuple(design.colors.primary);
  const [sr, sg, sb] = hexToRgbTuple(design.colors.secondary);
  const [tr, tg, tb] = hexToRgbTuple(design.colors.text);
  const [mr, mg, mb] = hexToRgbTuple(design.colors.mutedText);
  const [hr, hg, hb] = hexToRgbTuple(design.colors.headerBg);
  const primaryColor = rgb(pr, pg, pb);
  const secondaryColor = rgb(sr, sg, sb);
  const textColor = rgb(tr, tg, tb);
  const mutedColor = rgb(mr, mg, mb);
  const headerBgColor = rgb(hr, hg, hb);

  const mTop = mmToPt(design.page.marginTop);
  const mRight = mmToPt(design.page.marginRight);
  const mBottom = mmToPt(design.page.marginBottom);
  const mLeft = mmToPt(design.page.marginLeft);
  const contentWidth = pageW - mLeft - mRight;
  const bodySize = Math.max(8.5, Math.min(11.5, design.typography.bodySize * 0.95));
  const headingSize = Math.max(10.5, Math.min(14, design.typography.headingSize * 0.95));
  const lineH = bodySize * (design.typography.lineHeight || 1.42);

  let page: PDFPage = cvPdf.addPage([pageW, pageH]);
  let y = pageH - mTop;
  const ensureSpace = (needed: number) => {
    if (y - needed < mBottom + 18) {
      page = cvPdf.addPage([pageW, pageH]);
      y = pageH - mTop;
    }
  };

  const p = cv.personalInformation;
  const isBanner = design.layout.headerStyle === 'banner-colored' && !cv.atsMode;
  const isCentered = design.layout.headerStyle === 'centered';
  const nameText = p.fullName || cv.cvTitle || 'Curriculum Vitae';
  const nameSize = Math.min(24, design.typography.nameSize * 0.85);
  const contactLine = [p.email, p.phone, p.location, p.linkedin, p.website].filter(Boolean).join('  |  ');

  if (isBanner) {
    const bannerH = p.professionalTitle ? 88 : 68;
    page.drawRectangle({ x: 0, y: pageH - bannerH - 12, width: pageW, height: bannerH + 12, color: headerBgColor });
    y = pageH - 36;
    page.drawText(nameText, { x: mLeft, y, size: nameSize, font: boldFont, color: rgb(1, 1, 1) });
    y -= 18;
    if (p.professionalTitle) {
      page.drawText(p.professionalTitle, { x: mLeft, y, size: 11.5, font: bodyFont, color: rgb(0.9, 0.94, 0.98) });
      y -= 16;
    }
    if (contactLine) {
      for (const l of wrapTextToLines(contactLine, bodyFont, 8.8, contentWidth)) {
        page.drawText(l, { x: mLeft, y, size: 8.8, font: bodyFont, color: rgb(0.92, 0.95, 0.99) });
        y -= 12;
      }
    }
    y = pageH - bannerH - 28;
  } else {
    const nameW = boldFont.widthOfTextAtSize(nameText, nameSize);
    const nameX = isCentered ? (pageW - nameW) / 2 : mLeft;
    page.drawText(nameText, { x: Math.max(mLeft, nameX), y, size: nameSize, font: boldFont, color: primaryColor });
    y -= nameSize * 0.9;
    if (p.professionalTitle) {
      const tW = boldFont.widthOfTextAtSize(p.professionalTitle, 11);
      const tX = isCentered ? (pageW - tW) / 2 : mLeft;
      page.drawText(p.professionalTitle, { x: Math.max(mLeft, tX), y, size: 11, font: boldFont, color: secondaryColor });
      y -= 15;
    }
    if (contactLine) {
      for (const l of wrapTextToLines(contactLine, bodyFont, 8.8, contentWidth)) {
        const lW = bodyFont.widthOfTextAtSize(l, 8.8);
        const lX = isCentered ? (pageW - lW) / 2 : mLeft;
        page.drawText(l, { x: Math.max(mLeft, lX), y, size: 8.8, font: bodyFont, color: mutedColor });
        y -= 12;
      }
    }
    page.drawLine({ start: { x: mLeft, y: y - 2 }, end: { x: pageW - mRight, y: y - 2 }, thickness: 0.8, color: primaryColor });
    y -= 16;
  }

  const drawHeading = (title: string) => {
    ensureSpace(32);
    y -= 6;
    page.drawText(title.toUpperCase(), { x: mLeft, y, size: headingSize, font: boldFont, color: primaryColor });
    y -= 4;
    page.drawLine({ start: { x: mLeft, y }, end: { x: pageW - mRight, y }, thickness: 0.75, color: primaryColor });
    y -= 12;
  };
  const drawWrapped = (text: string, font: PDFFont, size: number, color: any, indent = 0) => {
    for (const line of wrapTextToLines(text, font, size, contentWidth - indent)) {
      ensureSpace(lineH);
      page.drawText(line, { x: mLeft + indent, y, size, font, color });
      y -= lineH;
    }
  };

  for (const key of cv.sectionOrder.filter((s) => !cv.hiddenSections.includes(s))) {
    if (design.page.explicitPageBreaks?.includes(key)) {
      page = cvPdf.addPage([pageW, pageH]);
      y = pageH - mTop;
    }
    const title = cv.sectionTitles[key] || key.toUpperCase();
    if (key === 'summary' && cv.professionalSummary?.trim()) {
      drawHeading(title);
      drawWrapped(cv.professionalSummary, bodyFont, bodySize, textColor);
      y -= 4;
    } else if (key === 'objective' && cv.careerObjective?.trim()) {
      drawHeading(title);
      drawWrapped(cv.careerObjective, bodyFont, bodySize, textColor);
      y -= 4;
    } else if (key === 'experience' && cv.workExperience.length > 0) {
      drawHeading(title);
      for (const exp of cv.workExperience) {
        ensureSpace(36);
        page.drawText(`${exp.jobTitle} — ${exp.company}`, { x: mLeft, y, size: bodySize + 0.6, font: boldFont, color: textColor });
        y -= lineH;
        const meta = `${exp.startDate} – ${exp.current ? 'Present' : exp.endDate}${exp.location ? ` · ${exp.location}` : ''}`;
        page.drawText(meta, { x: mLeft, y, size: bodySize - 0.8, font: italicFont, color: mutedColor });
        y -= lineH;
        if (exp.description) drawWrapped(exp.description, bodyFont, bodySize, textColor);
        for (const ach of exp.achievements || []) if (ach.trim()) drawWrapped(`• ${ach}`, bodyFont, bodySize, textColor, 8);
        y -= 5;
      }
    } else if (key === 'education' && cv.education.length > 0) {
      drawHeading(title);
      for (const edu of cv.education) {
        ensureSpace(26);
        page.drawText(`${edu.degree} — ${edu.institution}`, { x: mLeft, y, size: bodySize + 0.4, font: boldFont, color: textColor });
        y -= lineH;
        const meta = `${edu.startDate} – ${edu.endDate}${edu.location ? ` · ${edu.location}` : ''}${edu.honors ? ` · ${edu.honors}` : ''}${edu.gpa ? ` · GPA ${edu.gpa}` : ''}`;
        drawWrapped(meta, italicFont, bodySize - 0.6, mutedColor);
        y -= 3;
      }
    } else if (key === 'skills' && cv.skills.length > 0) {
      drawHeading(title);
      drawWrapped(cv.skills.map((s) => s.name).join('  ·  '), bodyFont, bodySize, textColor);
      y -= 4;
    } else if (key === 'certifications' && cv.certifications.length > 0) {
      drawHeading(title);
      for (const c of cv.certifications) drawWrapped(`• ${c.name} — ${c.issuer}${c.date ? ` (${c.date})` : ''}`, bodyFont, bodySize, textColor, 6);
      y -= 4;
    } else if (key === 'languages' && cv.languages.length > 0) {
      drawHeading(title);
      drawWrapped(cv.languages.map((l) => `${l.name} (${l.proficiency})`).join('  ·  '), bodyFont, bodySize, textColor);
      y -= 4;
    } else if (key === 'projects' && cv.projects.length > 0) {
      drawHeading(title);
      for (const proj of cv.projects) {
        ensureSpace(24);
        page.drawText(`${proj.name}${proj.role ? ` · ${proj.role}` : ''}${proj.date ? ` (${proj.date})` : ''}`, { x: mLeft, y, size: bodySize + 0.4, font: boldFont, color: textColor });
        y -= lineH;
        if (proj.description) drawWrapped(proj.description, bodyFont, bodySize, textColor);
        for (const h of proj.highlights || []) drawWrapped(`• ${h}`, bodyFont, bodySize, textColor, 8);
        y -= 3;
      }
    } else if (key === 'awards' && cv.awards.length > 0) {
      drawHeading(title);
      for (const aw of cv.awards) drawWrapped(`• ${aw.title} — ${aw.issuer}${aw.date ? ` (${aw.date})` : ''}`, bodyFont, bodySize, textColor, 6);
      y -= 4;
    } else if (key === 'publications' && cv.publications.length > 0) {
      drawHeading(title);
      for (const pub of cv.publications) drawWrapped(`• ${pub.authors} (${pub.year}). ${pub.title}. ${pub.venue}`, bodyFont, bodySize, textColor, 6);
      y -= 4;
    } else if (key === 'volunteer' && cv.volunteerExperience.length > 0) {
      drawHeading(title);
      for (const vol of cv.volunteerExperience) {
        drawWrapped(`${vol.role} — ${vol.organization} (${vol.startDate} – ${vol.endDate})`, boldFont, bodySize, textColor);
        if (vol.description) drawWrapped(vol.description, bodyFont, bodySize, textColor, 6);
      }
      y -= 4;
    } else if (key === 'references' && cv.references.length > 0) {
      drawHeading(title);
      for (const ref of cv.references) drawWrapped(`${ref.name} — ${ref.title}, ${ref.organization} (${ref.email || ref.phone})`, bodyFont, bodySize, textColor);
    }
  }

  // Number CV pages cleanly starting Page 1 on the first CV page (Page 2 of combined PDF)
  if (design.layout.showPageNumbers) {
    const cvPages = cvPdf.getPages();
    const numFont = await cvPdf.embedFont(StandardFonts.Helvetica);
    cvPages.forEach((pgItem, idx) => {
      pgItem.drawText(`Page ${idx + 1} of ${cvPages.length}`, {
        x: pageW - mRight - 55,
        y: 18,
        size: 8,
        font: numFont,
        color: mutedColor,
      });
    });
  }

  const copiedCvPages = await combinedDoc.copyPages(cvPdf, cvPdf.getPageIndices());
  copiedCvPages.forEach((cp) => combinedDoc.addPage(cp));

  const bytes = await combinedDoc.save();
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
  const safeName = (cv.personalInformation.fullName || cv.cvTitle || 'complete-cv')
    .replace(/[^a-zA-Z0-9_\- ]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  triggerDownload(blob, `${safeName || 'CV'}_With_CoverPage_${pageSize}.pdf`);
}

async function buildCoverPageDocxChildren(coverPage: CoverPageDocument): Promise<Paragraph[]> {
  const dc = coverPage.designConfiguration;
  const bg = coverPage.backgroundConfiguration;
  const info = coverPage.personalInformation;
  const fontName = dc.fontFamily || 'Inter';
  const headingFont = dc.headingFontFamily || fontName;
  const isDarkBg =
    bg.primaryColor.toLowerCase() === '#0f172a' ||
    bg.primaryColor.toLowerCase() === '#142b4a' ||
    bg.primaryColor.toLowerCase() === '#1e40af' ||
    bg.primaryColor.toLowerCase() === '#1f2937';

  const primaryHex = cleanHex(isDarkBg ? '#FFFFFF' : dc.primaryColor);
  const secondaryHex = cleanHex(isDarkBg ? '#93C5FD' : dc.secondaryColor);
  const textHex = cleanHex(isDarkBg ? '#E2E8F0' : dc.textColor);
  const mutedHex = cleanHex(isDarkBg ? '#CBD5E1' : dc.mutedTextColor);
  const align =
    dc.alignment === 'center'
      ? AlignmentType.CENTER
      : dc.alignment === 'right'
      ? AlignmentType.RIGHT
      : AlignmentType.LEFT;

  const children: Paragraph[] = [];

  // Optional embedded image (company logo or profile portrait)
  const imageSource =
    coverPage.uploadedImages.profilePhoto ||
    coverPage.uploadedImages.companyLogo ||
    coverPage.uploadedImages.personalLogo;
  if (imageSource) {
    const imgData = await fetchImageBytes(imageSource);
    if (imgData) {
      children.push(
        new Paragraph({
          alignment: align,
          spacing: { before: 120, after: 220 },
          children: [
            new ImageRun({
              data: imgData.bytes,
              transformation: { width: 110, height: 110 },
              type: imgData.type === 'png' ? 'png' : 'jpg',
            }),
          ],
        })
      );
    }
  }

  if (info.cvTitle) {
    children.push(
      new Paragraph({
        alignment: align,
        spacing: { before: 280, after: 140 },
        shading: isDarkBg ? { type: ShadingType.CLEAR, fill: cleanHex(bg.primaryColor) } : undefined,
        children: [
          new TextRun({
            text: info.cvTitle.toUpperCase(),
            bold: true,
            color: secondaryHex,
            font: headingFont,
            size: 22,
          }),
        ],
      })
    );
  }

  children.push(
    new Paragraph({
      alignment: align,
      spacing: { before: 120, after: 120 },
      shading: isDarkBg ? { type: ShadingType.CLEAR, fill: cleanHex(bg.primaryColor) } : undefined,
      children: [
        new TextRun({
          text: info.fullName || 'Full Name',
          bold: true,
          color: primaryHex,
          font: headingFont,
          size: 64,
        }),
      ],
    })
  );

  if (info.professionalTitle) {
    children.push(
      new Paragraph({
        alignment: align,
        spacing: { after: 100 },
        children: [
          new TextRun({
            text: info.professionalTitle,
            bold: true,
            color: secondaryHex,
            font: fontName,
            size: 32,
          }),
        ],
      })
    );
  }

  if (info.professionalSubtitle) {
    children.push(
      new Paragraph({
        alignment: align,
        spacing: { after: 180 },
        children: [
          new TextRun({
            text: info.professionalSubtitle,
            color: mutedHex,
            font: fontName,
            size: 24,
          }),
        ],
      })
    );
  }

  children.push(
    new Paragraph({
      alignment: align,
      spacing: { before: 80, after: 200 },
      border: {
        bottom: {
          color: cleanHex(dc.primaryColor),
          space: 6,
          style: BorderStyle.SINGLE,
          size: 12,
        },
      },
      children: [],
    })
  );

  if (info.tagline) {
    children.push(
      new Paragraph({
        alignment: align,
        spacing: { before: 120, after: 160 },
        children: [
          new TextRun({
            text: info.tagline,
            italics: true,
            color: textHex,
            font: fontName,
            size: 26,
          }),
        ],
      })
    );
  }

  if (info.careerSpecialty) {
    children.push(
      new Paragraph({
        alignment: align,
        spacing: { after: 160 },
        shading: !isDarkBg ? { type: ShadingType.CLEAR, fill: cleanHex(dc.accentColor) } : undefined,
        children: [
          new TextRun({
            text: info.careerSpecialty,
            bold: true,
            color: primaryHex,
            font: fontName,
            size: 22,
          }),
        ],
      })
    );
  }

  if (info.introduction) {
    children.push(
      new Paragraph({
        alignment: align,
        spacing: { before: 120, after: 280 },
        children: [
          new TextRun({
            text: info.introduction,
            color: textHex,
            font: fontName,
            size: 23,
          }),
        ],
      })
    );
  }

  if (info.targetOrganization || info.documentDate) {
    children.push(
      new Paragraph({
        alignment: align,
        spacing: { before: 320, after: 100 },
        children: [
          new TextRun({
            text: [info.targetOrganization, info.documentDate].filter(Boolean).join('   ·   '),
            bold: true,
            color: mutedHex,
            font: fontName,
            size: 21,
          }),
        ],
      })
    );
  }

  const contact = [info.email, info.phone, info.location, info.linkedin, info.website]
    .filter(Boolean)
    .join('   |   ');
  if (contact) {
    children.push(
      new Paragraph({
        alignment: align,
        spacing: { before: 220, after: 80 },
        children: [
          new TextRun({
            text: contact,
            color: mutedHex,
            font: fontName,
            size: 20,
          }),
        ],
      })
    );
  }

  return children;
}

export async function exportCoverPageToDOCX(
  coverPage: CoverPageDocument,
  pageSizeOverride?: 'A4' | 'LETTER'
): Promise<void> {
  const pageSize = pageSizeOverride || (coverPage.pageSize === 'LETTER' ? 'LETTER' : 'A4');
  const widthTwips = pageSize === 'A4' ? 11906 : 12240;
  const heightTwips = pageSize === 'A4' ? 16838 : 15840;
  const marginTwips = mmToTwips(coverPage.backgroundConfiguration.marginMm || 16);

  const coverChildren = await buildCoverPageDocxChildren(coverPage);
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: widthTwips, height: heightTwips },
            margin: { top: marginTwips, right: marginTwips, bottom: marginTwips, left: marginTwips },
          },
        },
        children: coverChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const safeName = (coverPage.personalInformation.fullName || coverPage.title || 'cover-page')
    .replace(/[^a-zA-Z0-9_\- ]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  triggerDownload(blob, `${safeName || 'CoverPage'}_${pageSize}.docx`);
}

export async function exportCombinedCVWithCoverDOCX(
  coverPage: CoverPageDocument,
  cv: CVDocument,
  design: DesignConfiguration,
  pageSizeOverride?: 'A4' | 'LETTER'
): Promise<void> {
  const pageSize = pageSizeOverride || design.page.size || 'A4';
  const widthTwips = pageSize === 'A4' ? 11906 : 12240;
  const heightTwips = pageSize === 'A4' ? 16838 : 15840;
  const coverMarginTwips = mmToTwips(coverPage.backgroundConfiguration.marginMm || 16);

  const coverChildren = await buildCoverPageDocxChildren(coverPage);

  // Build CV section children
  const primaryHex = cleanHex(design.colors.primary);
  const secondaryHex = cleanHex(design.colors.secondary);
  const fontName = design.typography.fontFamily === 'Source Sans 3' ? 'Source Sans Pro' : design.typography.fontFamily;
  const p = cv.personalInformation;
  const contactParts = [p.email, p.phone, p.location, p.linkedin, p.website].filter(Boolean);
  const isBanner = design.layout.headerStyle === 'banner-colored';
  const isCentered = design.layout.headerStyle === 'centered';

  const headerParagraphs: Paragraph[] = [
    new Paragraph({
      alignment: isCentered ? AlignmentType.CENTER : AlignmentType.LEFT,
      shading: isBanner ? { type: ShadingType.CLEAR, fill: cleanHex(design.colors.headerBg) } : undefined,
      spacing: { before: isBanner ? 120 : 0, after: 40 },
      children: [
        new TextRun({
          text: p.fullName || cv.cvTitle || 'Curriculum Vitae',
          bold: true,
          color: isBanner ? 'FFFFFF' : primaryHex,
          font: fontName,
          size: Math.round(design.typography.nameSize * 2),
        }),
      ],
    }),
  ];
  if (p.professionalTitle) {
    headerParagraphs.push(
      new Paragraph({
        alignment: isCentered ? AlignmentType.CENTER : AlignmentType.LEFT,
        shading: isBanner ? { type: ShadingType.CLEAR, fill: cleanHex(design.colors.headerBg) } : undefined,
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: p.professionalTitle,
            bold: true,
            color: isBanner ? 'E2E8F0' : secondaryHex,
            font: fontName,
            size: 24,
          }),
        ],
      })
    );
  }
  if (contactParts.length > 0) {
    headerParagraphs.push(
      new Paragraph({
        alignment: isCentered ? AlignmentType.CENTER : AlignmentType.LEFT,
        shading: isBanner ? { type: ShadingType.CLEAR, fill: cleanHex(design.colors.headerBg) } : undefined,
        spacing: { after: 140 },
        border: !isBanner ? { bottom: { color: cleanHex(design.colors.border), space: 6, style: BorderStyle.SINGLE, size: 6 } } : undefined,
        children: [
          new TextRun({
            text: contactParts.join('   |   '),
            color: isBanner ? 'F1F5F9' : cleanHex(design.colors.mutedText),
            font: fontName,
            size: 18,
          }),
        ],
      })
    );
  }

  const visibleSections = cv.sectionOrder.filter((s) => !cv.hiddenSections.includes(s));
  const useTwoColTable =
    !cv.atsMode &&
    (design.layout.structure === 'sidebar-left' ||
      design.layout.structure === 'sidebar-right' ||
      design.layout.structure === 'two-column-balanced');
  const cvBodyChildren: (Paragraph | Table)[] = [...headerParagraphs];

  if (useTwoColTable) {
    const sidebarSet = new Set<CVSectionKey>(
      design.layout.sidebarSections || ['skills', 'languages', 'certifications', 'awards']
    );
    const sideParagraphs = visibleSections.filter((s) => sidebarSet.has(s)).flatMap((s) => buildSectionParagraphsForDocx(s, cv, design));
    const mainParagraphs = visibleSections.filter((s) => !sidebarSet.has(s)).flatMap((s) => buildSectionParagraphsForDocx(s, cv, design));
    const isRight = design.layout.structure === 'sidebar-right';
    const sidePct = design.layout.structure === 'two-column-balanced' ? 48 : design.layout.sidebarWidth || 32;
    const mainPct = 100 - sidePct;
    const noBorders = {
      top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    };
    const sideCell = new TableCell({
      width: { size: sidePct, type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.CLEAR, fill: cleanHex(design.colors.sidebarBg) },
      margins: { top: 140, bottom: 140, left: 160, right: 160 },
      borders: noBorders,
      children: sideParagraphs.length > 0 ? sideParagraphs : [new Paragraph('')],
    });
    const mainCell = new TableCell({
      width: { size: mainPct, type: WidthType.PERCENTAGE },
      margins: { top: 140, bottom: 140, left: isRight ? 0 : 200, right: isRight ? 200 : 0 },
      borders: noBorders,
      children: mainParagraphs.length > 0 ? mainParagraphs : [new Paragraph('')],
    });
    cvBodyChildren.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { ...noBorders, insideHorizontal: noBorders.top, insideVertical: noBorders.top },
        rows: [new TableRow({ children: isRight ? [mainCell, sideCell] : [sideCell, mainCell] })],
      })
    );
  } else {
    for (const s of visibleSections) cvBodyChildren.push(...buildSectionParagraphsForDocx(s, cv, design));
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: widthTwips, height: heightTwips },
            margin: { top: coverMarginTwips, right: coverMarginTwips, bottom: coverMarginTwips, left: coverMarginTwips },
          },
        },
        children: coverChildren,
      },
      {
        properties: {
          page: {
            size: { width: widthTwips, height: heightTwips },
            margin: {
              top: mmToTwips(design.page.marginTop),
              right: mmToTwips(design.page.marginRight),
              bottom: mmToTwips(design.page.marginBottom),
              left: mmToTwips(design.page.marginLeft),
            },
          },
        },
        children: cvBodyChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const safeName = (cv.personalInformation.fullName || cv.cvTitle || 'complete-cv')
    .replace(/[^a-zA-Z0-9_\- ]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  triggerDownload(blob, `${safeName || 'CV'}_With_CoverPage_${pageSize}.docx`);
}

