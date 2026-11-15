import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { STARTER_TEMPLATES } from '../data/templates';
import { STARTER_COVER_PAGE_TEMPLATES } from '../data/coverPageTemplates';
import type {
  AIDesignHistoryEntry,
  CVDocument,
  CVTemplate,
  CustomDesign,
  PlatformSettings,
  UserActivity,
  UserProfile,
} from '../types/cv';
import type {
  CoverPageDocument,
  CoverPageTemplate,
} from '../types/coverPage';

export const BOOTSTRAPPED_ADMIN_EMAIL = 'arabsafashion@gmail.com';

function timestampToIso(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

function sanitizeId(id: string): string {
  const cleaned = id.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128);
  return cleaned || `id_${Date.now()}`;
}

export async function ensureUserProfile(
  uid: string,
  email: string,
  fullName: string,
  emailVerified: boolean
): Promise<UserProfile> {
  const path = `users/${uid}`;
  if (!emailVerified) {
    return {
      userId: uid,
      fullName: fullName || email.split('@')[0] || 'User',
      email,
      role: email === BOOTSTRAPPED_ADMIN_EMAIL ? 'admin' : 'user',
      favoriteTemplateIds: [],
      recentActivities: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  const ref = doc(db, 'users', uid);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      const isBootstrappedAdmin = email === BOOTSTRAPPED_ADMIN_EMAIL;
      return {
        userId: data.userId,
        fullName: data.fullName || fullName,
        email: data.email || email,
        role: isBootstrappedAdmin ? 'admin' : data.role || 'user',
        defaultTitle: data.defaultTitle || '',
        location: data.location || '',
        favoriteTemplateIds: Array.isArray(data.favoriteTemplateIds) ? data.favoriteTemplateIds : [],
        recentActivities: Array.isArray(data.recentActivities) ? data.recentActivities : [],
        createdAt: timestampToIso(data.createdAt),
        updatedAt: timestampToIso(data.updatedAt),
      };
    }

    const payload = {
      userId: sanitizeId(uid),
      fullName: (fullName || email.split('@')[0] || 'User').slice(0, 120),
      email: email.slice(0, 180),
      role: 'user',
      defaultTitle: '',
      location: '',
      favoriteTemplateIds: [],
      recentActivities: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(ref, payload);
    const nowIso = new Date().toISOString();
    return {
      userId: payload.userId,
      fullName: payload.fullName,
      email: payload.email,
      role: email === BOOTSTRAPPED_ADMIN_EMAIL ? 'admin' : 'user',
      defaultTitle: '',
      location: '',
      favoriteTemplateIds: [],
      recentActivities: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateUserProfileDoc(
  uid: string,
  updates: Partial<Pick<UserProfile, 'fullName' | 'defaultTitle' | 'location' | 'favoriteTemplateIds' | 'recentActivities'>>
): Promise<void> {
  const path = `users/${uid}`;
  try {
    const clean: Record<string, any> = { updatedAt: serverTimestamp() };
    if (updates.fullName !== undefined) clean.fullName = updates.fullName.slice(0, 120) || 'User';
    if (updates.defaultTitle !== undefined) clean.defaultTitle = updates.defaultTitle.slice(0, 140);
    if (updates.location !== undefined) clean.location = updates.location.slice(0, 140);
    if (updates.favoriteTemplateIds !== undefined) clean.favoriteTemplateIds = updates.favoriteTemplateIds.slice(0, 50);
    if (updates.recentActivities !== undefined) clean.recentActivities = updates.recentActivities.slice(0, 20);
    await updateDoc(doc(db, 'users', uid), clean);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function logUserActivity(
  uid: string,
  existingActivities: UserActivity[],
  action: string,
  targetName: string
): Promise<UserActivity[]> {
  const next: UserActivity[] = [
    {
      id: `act_${Date.now()}`,
      action: action.slice(0, 80),
      targetName: targetName.slice(0, 120),
      timestamp: new Date().toISOString(),
    },
    ...existingActivities,
  ].slice(0, 20);

  await updateUserProfileDoc(uid, { recentActivities: next });
  return next;
}

// ============================================================================
// CVs CRUD & Subscriptions
// ============================================================================

function serializeCVPayload(cv: CVDocument, isCreate: boolean) {
  const base: Record<string, any> = {
    cvId: sanitizeId(cv.cvId),
    userId: sanitizeId(cv.userId),
    cvTitle: (cv.cvTitle || 'Untitled CV').slice(0, 160),
    personalInformation: cv.personalInformation || {},
    professionalSummary: (cv.professionalSummary || '').slice(0, 6000),
    careerObjective: (cv.careerObjective || '').slice(0, 4000),
    workExperience: (cv.workExperience || []).slice(0, 40),
    education: (cv.education || []).slice(0, 25),
    skills: (cv.skills || []).slice(0, 80),
    certifications: (cv.certifications || []).slice(0, 40),
    languages: (cv.languages || []).slice(0, 25),
    projects: (cv.projects || []).slice(0, 35),
    awards: (cv.awards || []).slice(0, 30),
    publications: (cv.publications || []).slice(0, 50),
    volunteerExperience: (cv.volunteerExperience || []).slice(0, 25),
    references: (cv.references || []).slice(0, 15),
    sectionOrder: (cv.sectionOrder || []).slice(0, 25),
    hiddenSections: (cv.hiddenSections || []).slice(0, 25),
    sectionTitles: cv.sectionTitles || {},
    selectedTemplateId: sanitizeId(cv.selectedTemplateId || 'tpl_classic_executive'),
    attachedCoverPageId: cv.attachedCoverPageId ? sanitizeId(cv.attachedCoverPageId) : '',
    atsMode: Boolean(cv.atsMode),
    updatedAt: serverTimestamp(),
  };
  if (cv.designOverrides) {
    base.designOverrides = cv.designOverrides;
  }
  if (isCreate) {
    base.createdAt = serverTimestamp();
  }
  return base;
}

export function subscribeUserCVs(
  userId: string,
  onData: (cvs: CVDocument[]) => void,
  onError?: (err: Error) => void
) {
  const path = 'cvs';
  const q = query(collection(db, 'cvs'), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: CVDocument[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          ...(data as any),
          cvId: data.cvId || d.id,
          createdAt: timestampToIso(data.createdAt),
          updatedAt: timestampToIso(data.updatedAt),
        };
      });
      list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      onData(list);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function saveCVDocument(cv: CVDocument, isNew = false): Promise<void> {
  const cvId = sanitizeId(cv.cvId);
  const path = `cvs/${cvId}`;
  try {
    const ref = doc(db, 'cvs', cvId);
    if (isNew) {
      await setDoc(ref, serializeCVPayload({ ...cv, cvId }, true));
    } else {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, serializeCVPayload({ ...cv, cvId }, true));
      } else {
        const updateData = serializeCVPayload({ ...cv, cvId }, false);
        delete updateData.cvId;
        delete updateData.userId;
        await updateDoc(ref, updateData);
      }
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteCVDocument(cvId: string): Promise<void> {
  const id = sanitizeId(cvId);
  const path = `cvs/${id}`;
  try {
    await deleteDoc(doc(db, 'cvs', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ============================================================================
// Templates (Database-driven with Starter Seed)
// ============================================================================

export function subscribeTemplates(
  isAdmin: boolean,
  onData: (templates: CVTemplate[]) => void
) {
  const path = 'templates';
  const q = isAdmin
    ? query(collection(db, 'templates'))
    : query(collection(db, 'templates'), where('status', '==', 'published'));

  return onSnapshot(
    q,
    (snapshot) => {
      const dbTemplates: CVTemplate[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          ...(data as any),
          templateId: data.templateId || d.id,
          createdAt: timestampToIso(data.createdAt),
          updatedAt: timestampToIso(data.updatedAt),
        };
      });

      // Merge Firestore templates over starter templates so all 35 are always available
      // and any admin edits/additions/unpublishes in Firestore take precedence!
      const map = new Map<string, CVTemplate>();
      for (const t of STARTER_TEMPLATES) {
        map.set(t.templateId, t);
      }
      for (const t of dbTemplates) {
        map.set(t.templateId, t);
      }
      const merged = Array.from(map.values()).filter((t) => isAdmin || t.status === 'published');
      onData(merged);
    },
    (error) => {
      console.warn('Template listener fallback to starter catalog:', error.message);
      onData(STARTER_TEMPLATES);
    }
  );
}

export async function seedStarterTemplatesIfAdmin(): Promise<number> {
  let seeded = 0;
  try {
    const snap = await getDocs(collection(db, 'templates'));
    const existingIds = new Set(snap.docs.map((d) => d.id));
    for (const tpl of STARTER_TEMPLATES) {
      if (!existingIds.has(tpl.templateId)) {
        await setDoc(doc(db, 'templates', tpl.templateId), {
          ...tpl,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        seeded += 1;
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'templates');
  }
  return seeded;
}

export async function upsertTemplateAdmin(tpl: CVTemplate, isNew: boolean): Promise<void> {
  const id = sanitizeId(tpl.templateId);
  const path = `templates/${id}`;
  try {
    const ref = doc(db, 'templates', id);
    const payload: Record<string, any> = {
      templateId: id,
      name: tpl.name.slice(0, 120),
      category: tpl.category.slice(0, 100),
      profession: (tpl.profession || '').slice(0, 100),
      description: (tpl.description || '').slice(0, 600),
      layoutConfiguration: tpl.layoutConfiguration,
      colorConfiguration: tpl.colorConfiguration,
      typographyConfiguration: tpl.typographyConfiguration,
      atsFriendly: Boolean(tpl.atsFriendly),
      previewConfiguration: tpl.previewConfiguration,
      status: tpl.status === 'draft' ? 'draft' : 'published',
      tier: tpl.tier === 'premium' ? 'premium' : 'free',
      popularityScore: Number(tpl.popularityScore || 80),
      updatedAt: serverTimestamp(),
    };

    const existing = await getDoc(ref);
    if (isNew || !existing.exists()) {
      payload.createdAt = serverTimestamp();
      await setDoc(ref, payload);
    } else {
      delete payload.templateId;
      await updateDoc(ref, payload);
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteTemplateAdmin(templateId: string): Promise<void> {
  const id = sanitizeId(templateId);
  try {
    await deleteDoc(doc(db, 'templates', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `templates/${id}`);
  }
}

// ============================================================================
// Custom Designs
// ============================================================================

export function subscribeCustomDesigns(
  userId: string,
  onData: (designs: CustomDesign[]) => void
) {
  const q = query(collection(db, 'customDesigns'), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: CustomDesign[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          ...(data as any),
          designId: data.designId || d.id,
          createdAt: timestampToIso(data.createdAt),
          updatedAt: timestampToIso(data.updatedAt),
        };
      });
      items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'customDesigns')
  );
}

export async function saveCustomDesign(design: CustomDesign, isNew = false): Promise<void> {
  const id = sanitizeId(design.designId);
  const path = `customDesigns/${id}`;
  try {
    const ref = doc(db, 'customDesigns', id);
    if (isNew) {
      await setDoc(ref, {
        designId: id,
        userId: sanitizeId(design.userId),
        name: design.name.slice(0, 120),
        description: (design.description || '').slice(0, 500),
        designConfiguration: design.designConfiguration,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          designId: id,
          userId: sanitizeId(design.userId),
          name: design.name.slice(0, 120),
          description: (design.description || '').slice(0, 500),
          designConfiguration: design.designConfiguration,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(ref, {
          name: design.name.slice(0, 120),
          description: (design.description || '').slice(0, 500),
          designConfiguration: design.designConfiguration,
          updatedAt: serverTimestamp(),
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteCustomDesign(designId: string): Promise<void> {
  const id = sanitizeId(designId);
  try {
    await deleteDoc(doc(db, 'customDesigns', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `customDesigns/${id}`);
  }
}

// ============================================================================
// AI Design History
// ============================================================================

export function subscribeAIDesignHistory(
  userId: string,
  onData: (entries: AIDesignHistoryEntry[]) => void
) {
  const q = query(
    collection(db, 'aiDesignHistory'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const items: AIDesignHistoryEntry[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          ...(data as any),
          historyId: data.historyId || d.id,
          createdAt: timestampToIso(data.createdAt),
        };
      });
      onData(items);
    },
    () => {
      // Fallback without index if composite index isn't created yet
      const fallbackQ = query(collection(db, 'aiDesignHistory'), where('userId', '==', userId));
      onSnapshot(fallbackQ, (snap) => {
        const items: AIDesignHistoryEntry[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            ...(data as any),
            historyId: data.historyId || d.id,
            createdAt: timestampToIso(data.createdAt),
          };
        });
        items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        onData(items);
      });
    }
  );
}

export async function saveAIDesignHistoryEntry(entry: AIDesignHistoryEntry): Promise<void> {
  const id = sanitizeId(entry.historyId);
  const path = `aiDesignHistory/${id}`;
  try {
    const payload: Record<string, any> = {
      historyId: id,
      userId: sanitizeId(entry.userId),
      prompt: entry.prompt.slice(0, 1000),
      generatedConfiguration: entry.generatedConfiguration,
      createdAt: serverTimestamp(),
    };
    if (entry.cvId) payload.cvId = sanitizeId(entry.cvId);
    await setDoc(doc(db, 'aiDesignHistory', id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// ============================================================================
// Platform Settings & Admin Users
// ============================================================================

export function subscribePlatformSettings(onData: (settings: PlatformSettings) => void) {
  const defaultSettings: PlatformSettings = {
    settingId: 'global',
    appName: 'AI CV Studio',
    tagline: 'Create. Customize. Impress.',
    defaultPrimaryColor: '#142B4A',
    defaultSecondaryColor: '#2864A6',
    aiEnabled: true,
    categories: [
      'Classic Professional',
      'Modern Elegant',
      'Executive and Leadership',
      'NGO and International Development',
      'Academic and Research',
      'Creative and Digital',
      'Entry-Level',
    ],
    updatedAt: new Date().toISOString(),
  };

  return onSnapshot(
    doc(db, 'platformSettings', 'global'),
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        onData({
          ...defaultSettings,
          ...(data as any),
          updatedAt: timestampToIso(data.updatedAt),
        });
      } else {
        onData(defaultSettings);
      }
    },
    () => onData(defaultSettings)
  );
}

export async function savePlatformSettingsAdmin(settings: PlatformSettings): Promise<void> {
  const path = 'platformSettings/global';
  try {
    await setDoc(doc(db, 'platformSettings', 'global'), {
      settingId: 'global',
      appName: settings.appName.slice(0, 80),
      tagline: settings.tagline.slice(0, 160),
      defaultPrimaryColor: settings.defaultPrimaryColor.slice(0, 20),
      defaultSecondaryColor: settings.defaultSecondaryColor.slice(0, 20),
      aiEnabled: Boolean(settings.aiEnabled),
      categories: settings.categories.slice(0, 30),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function listUsersAdmin(): Promise<UserProfile[]> {
  try {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        userId: data.userId || d.id,
        fullName: data.fullName || '',
        email: data.email || '',
        role: data.role || 'user',
        defaultTitle: data.defaultTitle || '',
        location: data.location || '',
        favoriteTemplateIds: data.favoriteTemplateIds || [],
        recentActivities: data.recentActivities || [],
        createdAt: timestampToIso(data.createdAt),
        updatedAt: timestampToIso(data.updatedAt),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'users');
  }
}

export async function setUserRoleAdmin(targetUid: string, targetEmail: string, role: 'user' | 'admin'): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', targetUid), {
      role,
      updatedAt: serverTimestamp(),
    });
    if (role === 'admin') {
      await setDoc(doc(db, 'admins', targetUid), {
        userId: targetUid,
        email: targetEmail,
        createdAt: serverTimestamp(),
      });
    } else {
      await deleteDoc(doc(db, 'admins', targetUid));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${targetUid}`);
  }
}

// ============================================================================
// Cover Pages CRUD & Subscriptions
// ============================================================================

function serializeCoverPagePayload(cp: CoverPageDocument, isCreate: boolean) {
  const base: Record<string, any> = {
    coverPageId: sanitizeId(cp.coverPageId),
    userId: sanitizeId(cp.userId),
    cvId: cp.cvId ? sanitizeId(cp.cvId) : '',
    templateId: sanitizeId(cp.templateId || 'cp_executive_navy_blue'),
    title: (cp.title || 'Untitled Cover Page').slice(0, 160),
    personalInformation: cp.personalInformation || {},
    designConfiguration: cp.designConfiguration || {},
    backgroundConfiguration: cp.backgroundConfiguration || {},
    uploadedImages: cp.uploadedImages || {},
    pageSize: cp.pageSize === 'LETTER' || cp.pageSize === 'CUSTOM' ? cp.pageSize : 'A4',
    updatedAt: serverTimestamp(),
  };
  if (isCreate) {
    base.createdAt = serverTimestamp();
  }
  return base;
}

export function subscribeUserCoverPages(
  userId: string,
  onData: (coverPages: CoverPageDocument[]) => void,
  onError?: (err: Error) => void
) {
  const q = query(collection(db, 'coverPages'), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: CoverPageDocument[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          ...(data as any),
          coverPageId: data.coverPageId || d.id,
          createdAt: timestampToIso(data.createdAt),
          updatedAt: timestampToIso(data.updatedAt),
        };
      });
      list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      onData(list);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, 'coverPages');
    }
  );
}

export async function saveCoverPageDocument(
  coverPage: CoverPageDocument,
  isNew = false
): Promise<void> {
  const coverPageId = sanitizeId(coverPage.coverPageId);
  const path = `coverPages/${coverPageId}`;
  try {
    const ref = doc(db, 'coverPages', coverPageId);
    if (isNew) {
      await setDoc(ref, serializeCoverPagePayload({ ...coverPage, coverPageId }, true));
    } else {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, serializeCoverPagePayload({ ...coverPage, coverPageId }, true));
      } else {
        const updateData = serializeCoverPagePayload({ ...coverPage, coverPageId }, false);
        delete updateData.coverPageId;
        delete updateData.userId;
        await updateDoc(ref, updateData);
      }
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteCoverPageDocument(coverPageId: string): Promise<void> {
  const id = sanitizeId(coverPageId);
  try {
    await deleteDoc(doc(db, 'coverPages', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `coverPages/${id}`);
  }
}

export async function attachCoverPageToCV(
  cvId: string,
  coverPageId: string
): Promise<void> {
  const cleanCvId = sanitizeId(cvId);
  const cleanCpId = coverPageId ? sanitizeId(coverPageId) : '';
  try {
    await updateDoc(doc(db, 'cvs', cleanCvId), {
      attachedCoverPageId: cleanCpId,
      updatedAt: serverTimestamp(),
    });
    if (cleanCpId) {
      await updateDoc(doc(db, 'coverPages', cleanCpId), {
        cvId: cleanCvId,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `cvs/${cleanCvId}`);
  }
}

// ============================================================================
// Cover Page Templates (Database-driven with 25+ Starter Seeds)
// ============================================================================

export function subscribeCoverPageTemplates(
  isAdmin: boolean,
  onData: (templates: CoverPageTemplate[]) => void
) {
  const q = isAdmin
    ? query(collection(db, 'coverPageTemplates'))
    : query(collection(db, 'coverPageTemplates'), where('status', '==', 'published'));

  return onSnapshot(
    q,
    (snapshot) => {
      const dbTemplates: CoverPageTemplate[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          ...(data as any),
          templateId: data.templateId || d.id,
          createdAt: timestampToIso(data.createdAt),
          updatedAt: timestampToIso(data.updatedAt),
        };
      });

      const map = new Map<string, CoverPageTemplate>();
      for (const t of STARTER_COVER_PAGE_TEMPLATES) {
        map.set(t.templateId, t);
      }
      for (const t of dbTemplates) {
        map.set(t.templateId, t);
      }
      const merged = Array.from(map.values()).filter(
        (t) => isAdmin || t.status === 'published'
      );
      onData(merged);
    },
    (error) => {
      console.warn('Cover page template listener fallback to starter catalog:', error.message);
      onData(STARTER_COVER_PAGE_TEMPLATES);
    }
  );
}

export async function seedStarterCoverPageTemplatesIfAdmin(): Promise<number> {
  let seeded = 0;
  try {
    const snap = await getDocs(collection(db, 'coverPageTemplates'));
    const existingIds = new Set(snap.docs.map((d) => d.id));
    for (const tpl of STARTER_COVER_PAGE_TEMPLATES) {
      if (!existingIds.has(tpl.templateId)) {
        await setDoc(doc(db, 'coverPageTemplates', tpl.templateId), {
          ...tpl,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        seeded += 1;
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'coverPageTemplates');
  }
  return seeded;
}

export async function upsertCoverPageTemplateAdmin(
  tpl: CoverPageTemplate,
  isNew: boolean
): Promise<void> {
  const id = sanitizeId(tpl.templateId);
  const path = `coverPageTemplates/${id}`;
  try {
    const ref = doc(db, 'coverPageTemplates', id);
    const payload: Record<string, any> = {
      templateId: id,
      templateName: tpl.templateName.slice(0, 120),
      category: tpl.category.slice(0, 100),
      description: (tpl.description || '').slice(0, 600),
      designConfiguration: tpl.designConfiguration,
      previewConfiguration: tpl.previewConfiguration,
      status:
        tpl.status === 'draft' || tpl.status === 'archived'
          ? tpl.status
          : 'published',
      updatedAt: serverTimestamp(),
    };

    const existing = await getDoc(ref);
    if (isNew || !existing.exists()) {
      payload.createdAt = serverTimestamp();
      await setDoc(ref, payload);
    } else {
      delete payload.templateId;
      await updateDoc(ref, payload);
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteCoverPageTemplateAdmin(templateId: string): Promise<void> {
  const id = sanitizeId(templateId);
  try {
    await deleteDoc(doc(db, 'coverPageTemplates', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `coverPageTemplates/${id}`);
  }
}

