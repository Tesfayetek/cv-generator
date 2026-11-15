# Security Specification — AI CV Studio

## 1. Data Invariants
1. **User Isolation & Role Integrity**: A user may only read, create, or update their own `/users/{userId}` document. Users can never set `role: 'admin'` on creation or mutate `role` on update.
2. **CV Ownership**: Every `/cvs/{cvId}` document must have `userId == request.auth.uid`. Non-owners (except verified admins) cannot get, list, create, update, or delete another user's CV.
3. **Custom Design Ownership**: Every `/customDesigns/{designId}` document must belong to `request.auth.uid`.
4. **AI Design History Ownership**: Every `/aiDesignHistory/{historyId}` entry must belong to `request.auth.uid` and cannot be spoofed to another user.
5. **Admin-Only Template & Platform Control**: `/templates/{templateId}` and `/platformSettings/{settingId}` mutations are strictly restricted to verified administrators (`isAdmin()`). Published templates (`status == 'published'`) are readable; draft templates are readable only by admins.
6. **Verified Identity & Strict Timestamps**: Standard user writes require `request.auth.token.email_verified == true`. `createdAt` and `updatedAt` must equal `request.time` on creation, and `createdAt`/`userId` are immutable on update.
7. **ID & Size Hardening**: All path IDs match `^[a-zA-Z0-9_\-]+$` and are `<= 128` characters; all strings and arrays have bounded `.size()` constraints.

## 2. The "Dirty Dozen" Attack Payloads (Expected: PERMISSION_DENIED)
1. **Self-Assigned Admin Role on User Create**: `POST /users/{uid}` with `{ userId: uid, role: "admin", ... }` -> Denied (`role == 'user'` required).
2. **Privilege Escalation on User Update**: `PATCH /users/{uid}` changing `role` from `"user"` to `"admin"` -> Denied (`affectedKeys().hasOnly(...)` & `incoming().role == existing().role`).
3. **Cross-User PII Read**: Authenticated User A attempts `GET /users/{userB}` -> Denied.
4. **Cross-User CV Read / List**: Authenticated User A attempts `GET /cvs/{cvOfUserB}` or `LIST /cvs` without `where('userId', '==', uid)` -> Denied.
5. **CV Identity Spoofing**: User A creates `/cvs/{cvId}` with `userId: userB` -> Denied (`incoming().userId == request.auth.uid`).
6. **CV Ownership Hijack on Update**: User A updates `/cvs/{cvId}` changing `userId` to `userB` -> Denied (`incoming().userId == existing().userId`).
7. **Shadow Field Injection**: User A creates or updates `/cvs/{cvId}` adding `isAdminOverride: true` -> Denied (`keys().hasOnly(...)` and `affectedKeys().hasOnly(...)`).
8. **Non-Admin Template Creation/Mutation**: Standard user attempts `SET /templates/tpl_1` or `UPDATE /templates/tpl_1` -> Denied (`isAdmin()` required).
9. **Unverified Email Spoof Admin**: User signs in with unverified email matching admin email (`email_verified: false`) and attempts template write -> Denied (`email_verified == true` required).
10. **ID Poisoning / Oversized Path ID**: User writes `/cvs/{1500_char_string}` or `/cvs/bad$id` -> Denied (`isValidId()`).
11. **Timestamp Forgery**: User creates `/cvs/{cvId}` with `createdAt` in the past (`2020-01-01`) instead of server `request.time` -> Denied.
12. **Unbounded Array / String Resource Exhaustion**: User writes `/users/{uid}` with 200 `favoriteTemplateIds` or 100KB `fullName` -> Denied (`size() <= 50`, `size() <= 120`).
