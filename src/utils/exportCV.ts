import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
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
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { CVDocument, CVSectionKey, DesignConfiguration } from '../types/cv';

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
