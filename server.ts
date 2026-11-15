import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import mammoth from 'mammoth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MODEL_NAME = 'gemini-4-hydrogen';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in the server environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function generateContentWithRetry(
  ai: GoogleGenAI,
  params: Parameters<GoogleGenAI['models']['generateContent']>[0],
  maxAttempts = 3
) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (err: any) {
      lastError = err;
      const msg = String(err?.message || '');
      const status = Number(err?.status || err?.code || 0);
      const isTransient = status === 503 || status === 429 || msg.includes('503') || msg.includes('UNAVAILABLE');
      if (!isTransient || attempt === maxAttempts) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, attempt * 1000));
    }
  }
  throw lastError;
}

// Simple sliding-window rate limiter for abuse protection
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  entry.count += 1;
  return true;
}

const VALID_FONTS = [
  'Inter',
  'Arial',
  'Calibri',
  'Roboto',
  'Lato',
  'Open Sans',
  'Georgia',
  'Garamond',
  'Montserrat',
  'Source Sans 3',
];

const VALID_COVER_FONTS = [
  'Inter',
  'Montserrat',
  'Lato',
  'Roboto',
  'Open Sans',
  'Arial',
  'Georgia',
  'Garamond',
  'Playfair Display',
];

const VALID_COVER_BG_TYPES = [
  'solid',
  'gradient',
  'image',
  'pattern-geometric',
  'pattern-abstract',
  'minimal-white',
];

const VALID_COVER_PATTERNS = ['none', 'grid', 'dots', 'diagonal', 'rings', 'waves', 'hexagons'];
const VALID_ELEMENT_TYPES = ['text', 'photo', 'personalLogo', 'companyLogo', 'colorBlock', 'shape', 'line', 'icon'];
const VALID_FIELD_BINDINGS = [
  'fullName',
  'professionalTitle',
  'professionalSubtitle',
  'cvTitle',
  'tagline',
  'careerSpecialty',
  'introduction',
  'documentDate',
  'targetOrganization',
  'contactLine',
];

const VALID_STRUCTURES = ['one-column', 'two-column-balanced', 'sidebar-left', 'sidebar-right'];
const VALID_HEADER_STYLES = ['centered', 'left-aligned', 'banner-colored', 'minimal', 'split-contact', 'executive-rule'];
const VALID_HEADING_STYLES = ['underline', 'caps-rule', 'left-bar', 'shaded-band', 'clean-bold', 'numbered', 'double-rule'];
const VALID_SKILL_DISPLAY = ['tags', 'bars', 'grid', 'comma', 'grouped'];
const VALID_BULLET_STYLES = ['disc', 'square', 'dash', 'arrow', 'none'];
const VALID_TIMELINE_STYLES = ['none', 'dots', 'dates-left'];
const VALID_ACCENTS = ['none', 'top-stripe', 'corner-mark', 'sidebar-border', 'footer-rule'];

function isHexColor(val: unknown): val is string {
  return typeof val === 'string' && /^#[0-9a-fA-F]{6}$/.test(val.trim());
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

function sanitizeDesignConfig(raw: any, fallback: any): any {
  const layout = raw?.layout || {};
  const colors = raw?.colors || {};
  const typography = raw?.typography || {};
  const page = raw?.page || {};

  return {
    layout: {
      structure: VALID_STRUCTURES.includes(layout.structure) ? layout.structure : fallback.layout.structure,
      sidebarWidth: typeof layout.sidebarWidth === 'number' ? clamp(Math.round(layout.sidebarWidth), 26, 40) : fallback.layout.sidebarWidth,
      headerStyle: VALID_HEADER_STYLES.includes(layout.headerStyle) ? layout.headerStyle : fallback.layout.headerStyle,
      showPhoto: typeof layout.showPhoto === 'boolean' ? layout.showPhoto : fallback.layout.showPhoto,
      photoShape: ['circle', 'rounded', 'square'].includes(layout.photoShape) ? layout.photoShape : fallback.layout.photoShape,
      sectionHeadingStyle: VALID_HEADING_STYLES.includes(layout.sectionHeadingStyle) ? layout.sectionHeadingStyle : fallback.layout.sectionHeadingStyle,
      bulletStyle: VALID_BULLET_STYLES.includes(layout.bulletStyle) ? layout.bulletStyle : fallback.layout.bulletStyle,
      skillDisplay: VALID_SKILL_DISPLAY.includes(layout.skillDisplay) ? layout.skillDisplay : fallback.layout.skillDisplay,
      timelineStyle: VALID_TIMELINE_STYLES.includes(layout.timelineStyle) ? layout.timelineStyle : fallback.layout.timelineStyle,
      decorativeAccent: VALID_ACCENTS.includes(layout.decorativeAccent) ? layout.decorativeAccent : fallback.layout.decorativeAccent,
      showPageNumbers: typeof layout.showPageNumbers === 'boolean' ? layout.showPageNumbers : true,
      headerText: typeof layout.headerText === 'string' ? layout.headerText.slice(0, 100) : '',
      footerText: typeof layout.footerText === 'string' ? layout.footerText.slice(0, 100) : '',
      sidebarSections: Array.isArray(layout.sidebarSections) && layout.sidebarSections.length > 0
        ? layout.sidebarSections.slice(0, 8)
        : (fallback.layout.sidebarSections || ['skills', 'languages', 'certifications', 'education']),
    },
    colors: {
      presetName: typeof colors.presetName === 'string' ? colors.presetName.slice(0, 40) : 'AI Custom',
      primary: isHexColor(colors.primary) ? colors.primary : fallback.colors.primary,
      secondary: isHexColor(colors.secondary) ? colors.secondary : fallback.colors.secondary,
      accent: isHexColor(colors.accent) ? colors.accent : fallback.colors.accent,
      background: isHexColor(colors.background) ? colors.background : '#FFFFFF',
      sidebarBg: isHexColor(colors.sidebarBg) ? colors.sidebarBg : fallback.colors.sidebarBg,
      headerBg: isHexColor(colors.headerBg) ? colors.headerBg : fallback.colors.headerBg,
      headerText: isHexColor(colors.headerText) ? colors.headerText : '#FFFFFF',
      text: isHexColor(colors.text) ? colors.text : '#1E293B',
      mutedText: isHexColor(colors.mutedText) ? colors.mutedText : '#475569',
      border: isHexColor(colors.border) ? colors.border : '#CBD5E1',
    },
    typography: {
      fontFamily: VALID_FONTS.includes(typography.fontFamily) ? typography.fontFamily : fallback.typography.fontFamily,
      headingFontFamily: VALID_FONTS.includes(typography.headingFontFamily) ? typography.headingFontFamily : fallback.typography.headingFontFamily,
      nameSize: typeof typography.nameSize === 'number' ? clamp(typography.nameSize, 20, 34) : fallback.typography.nameSize,
      headingSize: typeof typography.headingSize === 'number' ? clamp(typography.headingSize, 10.5, 16) : fallback.typography.headingSize,
      bodySize: typeof typography.bodySize === 'number' ? clamp(typography.bodySize, 9, 12) : fallback.typography.bodySize,
      fontWeight: ['400', '500', '600', '700'].includes(String(typography.fontWeight)) ? String(typography.fontWeight) : '400',
      lineHeight: typeof typography.lineHeight === 'number' ? clamp(typography.lineHeight, 1.25, 1.75) : fallback.typography.lineHeight,
      letterSpacing: typeof typography.letterSpacing === 'number' ? clamp(typography.letterSpacing, -0.02, 0.08) : 0,
    },
    page: {
      size: page.size === 'LETTER' ? 'LETTER' : 'A4',
      marginTop: typeof page.marginTop === 'number' ? clamp(page.marginTop, 10, 25) : fallback.page.marginTop,
      marginRight: typeof page.marginRight === 'number' ? clamp(page.marginRight, 10, 25) : fallback.page.marginRight,
      marginBottom: typeof page.marginBottom === 'number' ? clamp(page.marginBottom, 10, 25) : fallback.page.marginBottom,
      marginLeft: typeof page.marginLeft === 'number' ? clamp(page.marginLeft, 10, 25) : fallback.page.marginLeft,
      sectionSpacing: typeof page.sectionSpacing === 'number' ? clamp(page.sectionSpacing, 8, 24) : fallback.page.sectionSpacing,
      explicitPageBreaks: Array.isArray(fallback.page.explicitPageBreaks) ? fallback.page.explicitPageBreaks : [],
    },
  };
}

function sanitizeCoverPageAIResponse(raw: any, currentDesign?: any, currentBackground?: any) {
  const dc = raw?.designConfiguration || {};
  const bg = raw?.backgroundConfiguration || {};
  const fallbackFont = VALID_COVER_FONTS.includes(dc.fontFamily) ? dc.fontFamily : (currentDesign?.fontFamily || 'Inter');
  const fallbackHeadingFont = VALID_COVER_FONTS.includes(dc.headingFontFamily)
    ? dc.headingFontFamily
    : (currentDesign?.headingFontFamily || 'Montserrat');

  const rawElements = Array.isArray(dc.elements) ? dc.elements : [];
  const sanitizedElements = rawElements
    .slice(0, 28)
    .filter((item: any) => item && VALID_ELEMENT_TYPES.includes(item.type))
    .map((item: any, idx: number) => {
      const style = item.style || {};
      const shape = ['circle', 'square', 'rounded'].includes(item.crop?.shape) ? item.crop.shape : 'circle';
      return {
        id: typeof item.id === 'string' && item.id.trim() ? item.id.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 48) : `ai_el_${idx}`,
        type: item.type,
        label: typeof item.label === 'string' ? item.label.slice(0, 60) : `Element ${idx + 1}`,
        fieldBinding: VALID_FIELD_BINDINGS.includes(item.fieldBinding) ? item.fieldBinding : undefined,
        text: typeof item.text === 'string' ? item.text.slice(0, 400) : undefined,
        shapeKind: ['rectangle', 'circle', 'rounded', 'triangle', 'diamond', 'pill'].includes(item.shapeKind)
          ? item.shapeKind
          : 'rectangle',
        iconName: ['briefcase', 'award', 'globe', 'book', 'sparkles', 'compass', 'layers', 'shield'].includes(item.iconName)
          ? item.iconName
          : 'sparkles',
        x: clamp(Number(item.x) || 0, 0, 96),
        y: clamp(Number(item.y) || 0, 0, 96),
        width: clamp(Number(item.width) || 20, 0.25, 100),
        height: clamp(Number(item.height) || 6, 0.25, 100),
        zIndex: clamp(Math.round(Number(item.zIndex) || idx + 1), 1, 50),
        locked: false,
        rotation: clamp(Number(item.rotation) || 0, -180, 180),
        opacity: clamp(Number(item.opacity ?? 1), 0.05, 1),
        style: {
          fontFamily: VALID_COVER_FONTS.includes(style.fontFamily) ? style.fontFamily : fallbackFont,
          fontSize: typeof style.fontSize === 'number' ? clamp(style.fontSize, 8, 56) : 13,
          fontWeight: ['400', '500', '600', '700', '800'].includes(String(style.fontWeight)) ? String(style.fontWeight) : '400',
          fontStyle: style.fontStyle === 'italic' ? 'italic' : 'normal',
          color: isHexColor(style.color) ? style.color : '#1E293B',
          backgroundColor:
            style.backgroundColor === 'transparent' || isHexColor(style.backgroundColor)
              ? style.backgroundColor
              : undefined,
          borderColor: isHexColor(style.borderColor) ? style.borderColor : undefined,
          borderWidth: typeof style.borderWidth === 'number' ? clamp(style.borderWidth, 0, 10) : 0,
          borderRadius: typeof style.borderRadius === 'number' ? clamp(style.borderRadius, 0, 40) : 0,
          textAlign: ['left', 'center', 'right'].includes(style.textAlign) ? style.textAlign : 'left',
          letterSpacing: typeof style.letterSpacing === 'number' ? clamp(style.letterSpacing, -0.04, 0.3) : 0,
          lineHeight: typeof style.lineHeight === 'number' ? clamp(style.lineHeight, 1.0, 2.2) : 1.5,
          textTransform: ['none', 'uppercase', 'capitalize'].includes(style.textTransform) ? style.textTransform : 'none',
        },
        crop: item.type === 'photo' || item.type === 'personalLogo' || item.type === 'companyLogo'
          ? { zoom: 1, offsetX: 0, offsetY: 0, shape }
          : undefined,
      };
    });

  return {
    rationale: typeof raw?.rationale === 'string' ? raw.rationale.slice(0, 500) : 'Generated editable cover page composition.',
    designConfiguration: {
      colorSchemeName: typeof dc.colorSchemeName === 'string' ? dc.colorSchemeName.slice(0, 40) : 'AI Bespoke',
      primaryColor: isHexColor(dc.primaryColor) ? dc.primaryColor : (currentDesign?.primaryColor || '#142B4A'),
      secondaryColor: isHexColor(dc.secondaryColor) ? dc.secondaryColor : (currentDesign?.secondaryColor || '#2864A6'),
      accentColor: isHexColor(dc.accentColor) ? dc.accentColor : (currentDesign?.accentColor || '#EAF2FB'),
      textColor: isHexColor(dc.textColor) ? dc.textColor : (currentDesign?.textColor || '#1E293B'),
      mutedTextColor: isHexColor(dc.mutedTextColor) ? dc.mutedTextColor : (currentDesign?.mutedTextColor || '#475569'),
      fontFamily: fallbackFont,
      headingFontFamily: fallbackHeadingFont,
      alignment: ['left', 'center', 'right'].includes(dc.alignment) ? dc.alignment : 'left',
      elements: sanitizedElements.length > 0 ? sanitizedElements : (currentDesign?.elements || []),
    },
    backgroundConfiguration: {
      type: VALID_COVER_BG_TYPES.includes(bg.type) ? bg.type : (currentBackground?.type || 'solid'),
      primaryColor: isHexColor(bg.primaryColor) ? bg.primaryColor : (currentBackground?.primaryColor || '#FFFFFF'),
      secondaryColor: isHexColor(bg.secondaryColor) ? bg.secondaryColor : (currentBackground?.secondaryColor || '#F8FAFC'),
      gradientAngle: typeof bg.gradientAngle === 'number' ? clamp(bg.gradientAngle, 0, 360) : 135,
      patternType: VALID_COVER_PATTERNS.includes(bg.patternType) ? bg.patternType : 'none',
      patternColor: isHexColor(bg.patternColor) ? bg.patternColor : '#2864A6',
      patternOpacity: typeof bg.patternOpacity === 'number' ? clamp(bg.patternOpacity, 0.02, 0.35) : 0.08,
      marginMm: typeof bg.marginMm === 'number' ? clamp(bg.marginMm, 8, 25) : 14,
      showBleedGuides: Boolean(currentBackground?.showBleedGuides),
    },
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.use('/api', (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit(ip)) {
      res.status(429).json({ error: 'Rate limit exceeded. Please wait a minute before trying again.' });
      return;
    }
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', aiConfigured: Boolean(process.env.GEMINI_API_KEY) });
  });

  // 1. AI CV Content Assistant
  app.post('/api/ai/content', async (req, res) => {
    try {
      const { action, targetSection, inputText, jobDescription, cvContext, lengthPreference } = req.body || {};
      if (!action || typeof action !== 'string') {
        res.status(400).json({ error: 'Action is required.' });
        return;
      }

      const ai = getAiClient();
      const systemInstruction = `You are an ethical, executive-grade CV writing specialist.
CRITICAL INTEGRITY RULES:
1. NEVER invent, fabricate, or guess employment history, job titles, employers, dates, degrees, certifications, or fake numerical metrics that were not provided by the user.
2. Only elevate grammar, clarity, impact phrasing, structure, and truthful ATS keyword alignment based strictly on the supplied facts.
3. If measurable results are missing, suggest a placeholder like "[X% / $Y]" only inside optional coaching notes, or write strong action-led achievement statements from the facts given.
4. Keep output crisp, authentic, and directly usable in a professional CV.`;

      const prompt = JSON.stringify({
        action,
        targetSection: targetSection || 'general',
        lengthPreference: lengthPreference || 'balanced',
        inputText: typeof inputText === 'string' ? inputText.slice(0, 8000) : '',
        jobDescription: typeof jobDescription === 'string' ? jobDescription.slice(0, 8000) : '',
        cvContext: cvContext || {},
      });

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Perform the requested CV content assistance task:\n${prompt}`,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              updatedText: { type: Type.STRING, description: 'Rewritten or generated prose for the requested section.' },
              suggestedBullets: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Achievement-oriented bullet points strictly grounded in user-supplied facts.',
              },
              suggestedSkills: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Relevant skills/keywords identified from supplied experience or job description.',
              },
              atsKeywords: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Key ATS terms from the job description or target domain.',
              },
              explanation: { type: Type.STRING, description: 'Brief explanation of improvements and truthful ATS recommendations.' },
              warnings: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Any missing details the user may want to verify or quantify themselves.',
              },
            },
            required: ['updatedText', 'suggestedBullets', 'suggestedSkills', 'atsKeywords', 'explanation', 'warnings'],
          },
        },
      });

      const parsed = JSON.parse((response.text || '{}').trim());
      res.json(parsed);
    } catch (error: any) {
      console.error('AI content error:', error);
      res.status(500).json({ error: error?.message || 'Failed to generate AI CV content.' });
    }
  });

  // 2. Method 3: AI-Assisted Full CV Generation from User Background
  app.post('/api/ai/generate-cv', async (req, res) => {
    try {
      const { fullName, targetTitle, industry, yearsExperience, backgroundNotes, experienceNotes, educationNotes, skillsNotes, careerGoals } = req.body || {};
      if (!targetTitle && !backgroundNotes && !experienceNotes) {
        res.status(400).json({ error: 'Please provide your target job title, background, or experience details.' });
        return;
      }

      const ai = getAiClient();
      const systemInstruction = `You are a professional CV architect creating a structured CV draft from user-supplied notes.
STRICT TRUTHFULNESS MANDATE:
- Use ONLY employers, roles, dates, degrees, institutions, skills, and achievements supplied by the user.
- NEVER invent fake company names, fake university names, fake dates, or fabricated numbers.
- If a date or company is omitted by the user, leave that field empty string "" rather than making it up.
- Polish the user's supplied background into clean, professional CV prose and bullet points ready for user review.`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Generate a structured CV draft from the following user-provided information:\n${JSON.stringify({
          fullName: fullName || '',
          targetTitle: targetTitle || '',
          industry: industry || '',
          yearsExperience: yearsExperience || '',
          backgroundNotes: String(backgroundNotes || '').slice(0, 6000),
          experienceNotes: String(experienceNotes || '').slice(0, 8000),
          educationNotes: String(educationNotes || '').slice(0, 3000),
          skillsNotes: String(skillsNotes || '').slice(0, 3000),
          careerGoals: String(careerGoals || '').slice(0, 2000),
        })}`,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              professionalTitle: { type: Type.STRING },
              professionalSummary: { type: Type.STRING },
              careerObjective: { type: Type.STRING },
              workExperience: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    jobTitle: { type: Type.STRING },
                    company: { type: Type.STRING },
                    location: { type: Type.STRING },
                    startDate: { type: Type.STRING },
                    endDate: { type: Type.STRING },
                    description: { type: Type.STRING },
                    achievements: { type: Type.ARRAY, items: { type: Type.STRING } },
                  },
                },
              },
              education: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    degree: { type: Type.STRING },
                    institution: { type: Type.STRING },
                    location: { type: Type.STRING },
                    startDate: { type: Type.STRING },
                    endDate: { type: Type.STRING },
                    honors: { type: Type.STRING },
                  },
                },
              },
              skills: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    category: { type: Type.STRING },
                  },
                },
              },
              certifications: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    issuer: { type: Type.STRING },
                    date: { type: Type.STRING },
                  },
                },
              },
              languages: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    proficiency: { type: Type.STRING },
                  },
                },
              },
            },
            required: ['professionalTitle', 'professionalSummary', 'workExperience', 'education', 'skills'],
          },
        },
      });

      const parsed = JSON.parse((response.text || '{}').trim());
      res.json(parsed);
    } catch (error: any) {
      console.error('AI CV generation error:', error);
      res.status(500).json({ error: error?.message || 'Failed to generate structured CV draft.' });
    }
  });

  // 3. AI Design Generation Engine
  app.post('/api/ai/design', async (req, res) => {
    try {
      const { prompt, currentConfiguration, atsRequired } = req.body || {};
      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        res.status(400).json({ error: 'Design prompt is required.' });
        return;
      }

      const ai = getAiClient();
      const systemInstruction = `You are a senior typographic and layout designer for AI CV Studio.
Convert the user's natural-language CV design request into a precise JSON DesignConfiguration.
Allowed values:
- layout.structure: 'one-column' | 'two-column-balanced' | 'sidebar-left' | 'sidebar-right'
- layout.sidebarWidth: integer 26..40
- layout.headerStyle: 'centered' | 'left-aligned' | 'banner-colored' | 'minimal' | 'split-contact' | 'executive-rule'
- layout.showPhoto: boolean
- layout.photoShape: 'circle' | 'rounded' | 'square'
- layout.sectionHeadingStyle: 'underline' | 'caps-rule' | 'left-bar' | 'shaded-band' | 'clean-bold' | 'numbered' | 'double-rule'
- layout.bulletStyle: 'disc' | 'square' | 'dash' | 'arrow' | 'none'
- layout.skillDisplay: 'tags' | 'bars' | 'grid' | 'comma' | 'grouped'
- layout.timelineStyle: 'none' | 'dots' | 'dates-left'
- layout.decorativeAccent: 'none' | 'top-stripe' | 'corner-mark' | 'sidebar-border' | 'footer-rule'
- typography.fontFamily and headingFontFamily: 'Inter' | 'Arial' | 'Calibri' | 'Roboto' | 'Lato' | 'Open Sans' | 'Georgia' | 'Garamond' | 'Montserrat' | 'Source Sans 3'
- colors: valid 6-digit hex strings (#RRGGBB) with strong WCAG AA text contrast on light backgrounds (background should stay #FFFFFF or very soft #FCFCFD; text dark #1E293B; if sidebarBg is dark navy/charcoal, ensure sidebar text contrast works or keep sidebarBg light like #F4F7FB unless user asks for dark sidebar; headerText must contrast cleanly with headerBg if banner-colored).
If the user requests ATS-friendly or minimalist without graphics, use 'one-column', showPhoto: false, decorativeAccent: 'none', and clean standard fonts.`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `User design request: "${prompt.slice(0, 1000)}"\nATS priority: ${Boolean(atsRequired)}\nCurrent design (for refinement context if applicable): ${JSON.stringify(currentConfiguration || {})}`,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              rationale: { type: Type.STRING, description: 'Short explanation of the typographic, color, and layout choices made.' },
              designConfiguration: {
                type: Type.OBJECT,
                properties: {
                  layout: {
                    type: Type.OBJECT,
                    properties: {
                      structure: { type: Type.STRING },
                      sidebarWidth: { type: Type.NUMBER },
                      headerStyle: { type: Type.STRING },
                      showPhoto: { type: Type.BOOLEAN },
                      photoShape: { type: Type.STRING },
                      sectionHeadingStyle: { type: Type.STRING },
                      bulletStyle: { type: Type.STRING },
                      skillDisplay: { type: Type.STRING },
                      timelineStyle: { type: Type.STRING },
                      decorativeAccent: { type: Type.STRING },
                      showPageNumbers: { type: Type.BOOLEAN },
                      sidebarSections: { type: Type.ARRAY, items: { type: Type.STRING } },
                    },
                  },
                  colors: {
                    type: Type.OBJECT,
                    properties: {
                      presetName: { type: Type.STRING },
                      primary: { type: Type.STRING },
                      secondary: { type: Type.STRING },
                      accent: { type: Type.STRING },
                      background: { type: Type.STRING },
                      sidebarBg: { type: Type.STRING },
                      headerBg: { type: Type.STRING },
                      headerText: { type: Type.STRING },
                      text: { type: Type.STRING },
                      mutedText: { type: Type.STRING },
                      border: { type: Type.STRING },
                    },
                  },
                  typography: {
                    type: Type.OBJECT,
                    properties: {
                      fontFamily: { type: Type.STRING },
                      headingFontFamily: { type: Type.STRING },
                      nameSize: { type: Type.NUMBER },
                      headingSize: { type: Type.NUMBER },
                      bodySize: { type: Type.NUMBER },
                      fontWeight: { type: Type.STRING },
                      lineHeight: { type: Type.NUMBER },
                      letterSpacing: { type: Type.NUMBER },
                    },
                  },
                  page: {
                    type: Type.OBJECT,
                    properties: {
                      size: { type: Type.STRING },
                      marginTop: { type: Type.NUMBER },
                      marginRight: { type: Type.NUMBER },
                      marginBottom: { type: Type.NUMBER },
                      marginLeft: { type: Type.NUMBER },
                      sectionSpacing: { type: Type.NUMBER },
                    },
                  },
                },
                required: ['layout', 'colors', 'typography', 'page'],
              },
            },
            required: ['rationale', 'designConfiguration'],
          },
        },
      });

      const parsed = JSON.parse((response.text || '{}').trim());
      const fallback = currentConfiguration || {
        layout: {
          structure: 'one-column',
          sidebarWidth: 32,
          headerStyle: 'left-aligned',
          showPhoto: false,
          photoShape: 'rounded',
          sectionHeadingStyle: 'underline',
          bulletStyle: 'disc',
          skillDisplay: 'tags',
          timelineStyle: 'none',
          decorativeAccent: 'none',
          showPageNumbers: true,
          sidebarSections: ['skills', 'languages', 'certifications', 'education'],
        },
        colors: {
          presetName: 'Navy Blue',
          primary: '#142B4A',
          secondary: '#2864A6',
          accent: '#EAF2FB',
          background: '#FFFFFF',
          sidebarBg: '#F4F7FB',
          headerBg: '#142B4A',
          headerText: '#FFFFFF',
          text: '#1E293B',
          mutedText: '#475569',
          border: '#CBD5E1',
        },
        typography: {
          fontFamily: 'Lato',
          headingFontFamily: 'Montserrat',
          nameSize: 26,
          headingSize: 12,
          bodySize: 10,
          fontWeight: '400',
          lineHeight: 1.45,
          letterSpacing: 0,
        },
        page: {
          size: 'A4',
          marginTop: 15,
          marginRight: 16,
          marginBottom: 15,
          marginLeft: 16,
          sectionSpacing: 14,
          explicitPageBreaks: [],
        },
      };

      const sanitized = sanitizeDesignConfig(parsed.designConfiguration, fallback);
      res.json({
        rationale: parsed.rationale || 'Generated custom layout configuration.',
        designConfiguration: sanitized,
      });
    } catch (error: any) {
      console.error('AI design error:', error);
      res.status(500).json({ error: error?.message || 'Failed to generate AI design configuration.' });
    }
  });

  // 4. Method 2: Upload & Extract Existing CV (DOCX, PDF, TXT)
  app.post('/api/cv/extract', async (req, res) => {
    try {
      const { fileName, mimeType, base64Data, plainText } = req.body || {};
      if (!base64Data && !plainText) {
        res.status(400).json({ error: 'No CV file content provided.' });
        return;
      }

      const lowerName = String(fileName || '').toLowerCase();
      const ai = getAiClient();

      const extractionSchema = {
        type: Type.OBJECT,
        properties: {
          personalInformation: {
            type: Type.OBJECT,
            properties: {
              fullName: { type: Type.STRING },
              professionalTitle: { type: Type.STRING },
              email: { type: Type.STRING },
              phone: { type: Type.STRING },
              location: { type: Type.STRING },
              linkedin: { type: Type.STRING },
              website: { type: Type.STRING },
            },
          },
          professionalSummary: { type: Type.STRING },
          careerObjective: { type: Type.STRING },
          workExperience: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                jobTitle: { type: Type.STRING },
                company: { type: Type.STRING },
                location: { type: Type.STRING },
                startDate: { type: Type.STRING },
                endDate: { type: Type.STRING },
                current: { type: Type.BOOLEAN },
                description: { type: Type.STRING },
                achievements: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
            },
          },
          education: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                degree: { type: Type.STRING },
                institution: { type: Type.STRING },
                location: { type: Type.STRING },
                startDate: { type: Type.STRING },
                endDate: { type: Type.STRING },
                gpa: { type: Type.STRING },
                honors: { type: Type.STRING },
              },
            },
          },
          skills: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                category: { type: Type.STRING },
              },
            },
          },
          certifications: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                issuer: { type: Type.STRING },
                date: { type: Type.STRING },
              },
            },
          },
          languages: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                proficiency: { type: Type.STRING },
              },
            },
          },
          projects: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                role: { type: Type.STRING },
                date: { type: Type.STRING },
                description: { type: Type.STRING },
                highlights: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
            },
          },
          awards: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                issuer: { type: Type.STRING },
                date: { type: Type.STRING },
                description: { type: Type.STRING },
              },
            },
          },
          publications: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                venue: { type: Type.STRING },
                year: { type: Type.STRING },
                authors: { type: Type.STRING },
              },
            },
          },
          volunteerExperience: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                role: { type: Type.STRING },
                organization: { type: Type.STRING },
                startDate: { type: Type.STRING },
                endDate: { type: Type.STRING },
                description: { type: Type.STRING },
              },
            },
          },
          references: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                title: { type: Type.STRING },
                organization: { type: Type.STRING },
                email: { type: Type.STRING },
                phone: { type: Type.STRING },
                relationship: { type: Type.STRING },
              },
            },
          },
        },
        required: ['personalInformation', 'workExperience', 'education', 'skills'],
      };

      const systemInstruction = `You are a high-precision CV document parser.
Extract every section accurately from the uploaded CV document.
STRICT ACCURACY RULES:
- Preserve exact names, dates, employers, job titles, institutions, degrees, and achievements verbatim where clear.
- NEVER invent, guess, or hallucinate missing personal details, dates, employers, or skills.
- If a field is not present in the document, leave it as "" or [].`;

      let contents: any;
      let extractedRawText = '';

      if (lowerName.endsWith('.pdf') || mimeType === 'application/pdf') {
        contents = {
          parts: [
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: base64Data,
              },
            },
            {
              text: 'Extract all structured CV sections from this PDF document accurately without inventing missing information.',
            },
          ],
        };
      } else if (
        lowerName.endsWith('.docx') ||
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ) {
        const buffer = Buffer.from(base64Data, 'base64');
        const result = await mammoth.extractRawText({ buffer });
        extractedRawText = result.value || '';
        if (!extractedRawText.trim()) {
          res.status(400).json({ error: 'Could not read text from the uploaded DOCX file.' });
          return;
        }
        contents = `Extract all structured CV sections from this DOCX CV text accurately without inventing missing information:\n\n${extractedRawText.slice(0, 30000)}`;
      } else {
        extractedRawText = plainText || Buffer.from(base64Data, 'base64').toString('utf-8');
        contents = `Extract all structured CV sections from this CV text accurately without inventing missing information:\n\n${extractedRawText.slice(0, 30000)}`;
      }

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: extractionSchema,
        },
      });

      const parsed = JSON.parse((response.text || '{}').trim());
      res.json({ extracted: parsed, rawTextPreview: extractedRawText.slice(0, 1000) });
    } catch (error: any) {
      console.error('CV extraction error:', error);
      res.status(500).json({ error: error?.message || 'Failed to extract structured CV data.' });
    }
  });

  // 5. AI Cover Page Generator & Iterative Refinement Engine
  app.post('/api/ai/cover-page', async (req, res) => {
    try {
      const { prompt, currentDesign, currentBackground, personalInformation } = req.body || {};
      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        res.status(400).json({ error: 'Cover page design prompt is required.' });
        return;
      }

      const ai = getAiClient();
      const systemInstruction = `You are a senior editorial graphic designer for AI CV Studio's Cover Page Designer.
Convert the user's natural-language prompt (or refinement instruction on an existing layout) into a fully editable JSON Cover Page DesignConfiguration and BackgroundConfiguration.
All elements live on a percentage canvas (x: 0..100, y: 0..100, width: 0.3..100, height: 0.3..100).
CRITICAL LAYOUT & CONTRAST RULES:
1. Ensure zero overlapping text boxes! Leave clean vertical spacing between fullName, professionalTitle, tagline, introduction, and contactLine.
2. Guarantee high WCAG AA contrast between background/colorBlock colors and text colors (e.g., white #FFFFFF or #E2E8F0 text on dark navy #142B4A / charcoal #0F172A; dark slate #1E293B / #142B4A text on light #FFFFFF / #EAF2FB backgrounds).
3. Include structural visual hierarchy: at least one decorative colorBlock/shape/line element plus text elements bound to fieldBinding values ('cvTitle', 'fullName', 'professionalTitle', 'tagline', 'careerSpecialty', 'introduction', 'contactLine', 'documentDate', 'targetOrganization') and optionally 'photo' / 'companyLogo' / 'icon' when appropriate.
4. Valid fonts: 'Inter', 'Montserrat', 'Lato', 'Roboto', 'Open Sans', 'Arial', 'Georgia', 'Garamond', 'Playfair Display'.
5. Valid background types: 'solid', 'gradient', 'pattern-geometric', 'pattern-abstract', 'minimal-white'.
6. Valid pattern types: 'none', 'grid', 'dots', 'diagonal', 'rings', 'waves', 'hexagons'.
7. Valid element types: 'text', 'photo', 'personalLogo', 'companyLogo', 'colorBlock', 'shape', 'line', 'icon'.
8. If refining an existing design, preserve the user's unmentioned elements and modify only what the prompt asks (e.g. changing colors, moving elements to upper left, adding portrait space, changing font).`;

      const response = await generateContentWithRetry(ai, {
        model: MODEL_NAME,
        contents: `User cover page request: "${prompt.slice(0, 1200)}"\nPersonal context: ${JSON.stringify({
          fullName: personalInformation?.fullName || '',
          professionalTitle: personalInformation?.professionalTitle || '',
          targetOrganization: personalInformation?.targetOrganization || '',
        })}\nExisting layout (for refinement if provided): ${JSON.stringify(
          currentDesign && currentBackground
            ? { designConfiguration: currentDesign, backgroundConfiguration: currentBackground }
            : null
        )}`,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              rationale: { type: Type.STRING },
              backgroundConfiguration: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  primaryColor: { type: Type.STRING },
                  secondaryColor: { type: Type.STRING },
                  gradientAngle: { type: Type.NUMBER },
                  patternType: { type: Type.STRING },
                  patternColor: { type: Type.STRING },
                  patternOpacity: { type: Type.NUMBER },
                  marginMm: { type: Type.NUMBER },
                },
                required: ['type', 'primaryColor', 'secondaryColor'],
              },
              designConfiguration: {
                type: Type.OBJECT,
                properties: {
                  colorSchemeName: { type: Type.STRING },
                  primaryColor: { type: Type.STRING },
                  secondaryColor: { type: Type.STRING },
                  accentColor: { type: Type.STRING },
                  textColor: { type: Type.STRING },
                  mutedTextColor: { type: Type.STRING },
                  fontFamily: { type: Type.STRING },
                  headingFontFamily: { type: Type.STRING },
                  alignment: { type: Type.STRING },
                  elements: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        type: { type: Type.STRING },
                        label: { type: Type.STRING },
                        fieldBinding: { type: Type.STRING },
                        text: { type: Type.STRING },
                        shapeKind: { type: Type.STRING },
                        iconName: { type: Type.STRING },
                        x: { type: Type.NUMBER },
                        y: { type: Type.NUMBER },
                        width: { type: Type.NUMBER },
                        height: { type: Type.NUMBER },
                        zIndex: { type: Type.NUMBER },
                        opacity: { type: Type.NUMBER },
                        style: {
                          type: Type.OBJECT,
                          properties: {
                            fontFamily: { type: Type.STRING },
                            fontSize: { type: Type.NUMBER },
                            fontWeight: { type: Type.STRING },
                            fontStyle: { type: Type.STRING },
                            color: { type: Type.STRING },
                            backgroundColor: { type: Type.STRING },
                            borderColor: { type: Type.STRING },
                            borderWidth: { type: Type.NUMBER },
                            borderRadius: { type: Type.NUMBER },
                            textAlign: { type: Type.STRING },
                            letterSpacing: { type: Type.NUMBER },
                            lineHeight: { type: Type.NUMBER },
                            textTransform: { type: Type.STRING },
                          },
                        },
                        crop: {
                          type: Type.OBJECT,
                          properties: {
                            shape: { type: Type.STRING },
                          },
                        },
                      },
                      required: ['id', 'type', 'label', 'x', 'y', 'width', 'height'],
                    },
                  },
                },
                required: ['primaryColor', 'secondaryColor', 'fontFamily', 'headingFontFamily', 'elements'],
              },
            },
            required: ['rationale', 'backgroundConfiguration', 'designConfiguration'],
          },
        },
      });

      const parsed = JSON.parse((response.text || '{}').trim());
      const sanitized = sanitizeCoverPageAIResponse(parsed, currentDesign, currentBackground);
      res.json(sanitized);
    } catch (error: any) {
      console.error('AI cover page error:', error);
      res.status(500).json({ error: error?.message || 'Failed to generate AI cover page design.' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AI CV Studio server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
