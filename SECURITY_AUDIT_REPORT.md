# ETG Security Audit Report
## Date: February 27, 2026

### Summary

This audit reviewed the EvalsToGo (ETG) admin panel codebase for security vulnerabilities, covering API key exposure, authentication flows, data protection, dependency security, and OWASP Top 10 compliance. **3 critical, 4 high, 4 medium, and 2 low-severity findings** were identified. The most urgent issues are the Gemini API key and Supabase service-role key being bundled into client-side JavaScript, and a permissive RLS policy on the `admin_users` table that exposes password hashes to anonymous users.

---

### Finding 1: [CRITICAL] -- Gemini API Key Bundled into Client-Side JavaScript

**Status:** Vulnerable
**Location:** `vite.config.ts:14-15`, `services/geminiService.ts:9`, `services/translationService.ts:16`
**Category:** OWASP A02:2021 -- Cryptographic Failures / Sensitive Data Exposure
**CWE:** CWE-798 (Use of Hard-coded Credentials)

**Description:**
The Vite build configuration injects `GEMINI_API_KEY` from the environment into the client bundle via the `define` block:

```ts
// vite.config.ts lines 14-15
'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
```

At build time, every occurrence of `process.env.API_KEY` in the source is string-replaced with the literal key value. This was confirmed present in the production build artifact `dist/assets/index-B-9-5O07.js` (3 matches found for the key pattern).

The key (`AIzaSy...`) is visible to any user who opens browser DevTools or inspects the JS bundle.

**Impact:**
- Anyone can extract the Gemini API key and use it for arbitrary Google AI API calls at the project owner's expense.
- Potential for significant billing abuse (Gemini API charges per token).
- Key cannot be rotated without rebuilding and redeploying the application.

**Recommendation:**
Move all Gemini API calls to a backend proxy (e.g., a Supabase Edge Function or serverless function). The frontend should call your own endpoint, which then calls Gemini server-side with the key stored in a non-public environment variable (without the `VITE_` prefix).

---

### Finding 2: [CRITICAL] -- Supabase Service Role Key Exposed in Frontend Bundle

**Status:** Vulnerable
**Location:** `vite.config.ts:16`, `services/adminSupabaseClient.ts:21`
**Category:** OWASP A02:2021 -- Cryptographic Failures / A01:2021 -- Broken Access Control
**CWE:** CWE-798 (Use of Hard-coded Credentials), CWE-269 (Improper Privilege Management)

**Description:**
The Supabase service-role key is exposed to the browser in two ways:

1. `adminSupabaseClient.ts:21` reads it via `import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY`. The `VITE_` prefix is Vite's mechanism for exposing env vars to client-side code.

2. `vite.config.ts:16` also injects it via the `define` block:
```ts
'process.env.SUPABASE_SERVICE_ROLE_KEY': JSON.stringify(env.VITE_SUPABASE_SERVICE_ROLE_KEY || ''),
```

The service-role key was confirmed present in the production build `dist/assets/index-B-9-5O07.js`.

**Impact:**
- The Supabase service-role key **bypasses ALL Row Level Security (RLS) policies**.
- An attacker who extracts this key gains full read/write/delete access to every table in the database.
- This includes all assessment data, contact information (PII), admin credentials, client configurations, and analytics data.
- This is equivalent to full database administrator access.

**Recommendation:**
1. **Immediately rotate** the Supabase service-role key in the Supabase dashboard.
2. Remove the `VITE_` prefix from the env var name (rename to `SUPABASE_SERVICE_ROLE_KEY`) so Vite does not expose it.
3. Remove the `define` entry from `vite.config.ts`.
4. Move all service-role operations to Supabase Edge Functions or a backend API. The frontend should never possess the service-role key.

---

### Finding 3: [CRITICAL] -- admin_users Table RLS Allows Full Anonymous Access

**Status:** Vulnerable
**Location:** `supabase/migrations/20260212_admin_users.sql:12-13`
**Category:** OWASP A01:2021 -- Broken Access Control
**CWE:** CWE-284 (Improper Access Control), CWE-862 (Missing Authorization)

**Description:**
The RLS policy on `admin_users` is:
```sql
CREATE POLICY "Allow admin_users access" ON admin_users FOR ALL USING (true);
```

The `FOR ALL USING (true)` clause grants **every role** (including `anon`) full SELECT, INSERT, UPDATE, and DELETE access to the `admin_users` table. This means any anonymous user with the publicly-known anon key can:

- **Read all admin usernames and password hashes** via a simple `supabase.from('admin_users').select('*')` call.
- **Create new super_admin accounts**.
- **Modify existing accounts** (change roles, reset passwords).
- **Delete admin accounts**.

Combined with Finding 4 (SHA-256 unsalted hashing), the exposed hashes can be reversed via rainbow tables in seconds.

**Impact:**
- Complete admin panel takeover.
- Any internet user can read all admin password hashes, create admin accounts, or delete existing ones.
- Combined with the service-role key exposure (Finding 2), this represents full system compromise.

**Recommendation:**
Restrict the RLS policy to only allow authenticated access through the service-role key:
```sql
DROP POLICY "Allow admin_users access" ON admin_users;

-- Only service_role can manage admin_users
CREATE POLICY "service_role_admin_users" ON admin_users
  FOR ALL USING (auth.role() = 'service_role');
```

Alternatively, if the anon key needs login access:
```sql
-- Anon can only SELECT (for login verification)
CREATE POLICY "anon_select_admin_users" ON admin_users
  FOR SELECT USING (true);

-- Only service_role can INSERT/UPDATE/DELETE
CREATE POLICY "service_role_write_admin_users" ON admin_users
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

---

### Finding 4: [HIGH] -- SHA-256 Unsalted Password Hashing

**Status:** Vulnerable
**Location:** `services/adminService.ts:79-85`
**Category:** OWASP A02:2021 -- Cryptographic Failures
**CWE:** CWE-916 (Use of Password Hash With Insufficient Computational Effort), CWE-759 (Use of a One-Way Hash without a Salt)

**Description:**
Admin passwords are hashed using raw SHA-256 with no salt:
```ts
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
```

SHA-256 is a general-purpose hash function, not a password-hashing algorithm. It has no salt (identical passwords produce identical hashes) and no work factor (modern GPUs can compute billions of SHA-256 hashes per second).

**Impact:**
- Password hashes can be reversed via rainbow tables or brute force in seconds.
- All users with the same password share the same hash (no per-user salt).
- Given Finding 3 (public access to admin_users), this effectively exposes all admin passwords in plaintext-equivalent form.

**Recommendation:**
Migrate to `bcrypt` or `argon2` with a cost factor of at least 12. This must be done server-side (Supabase Edge Function) since bcrypt is not available in browser environments. During migration, re-hash all existing passwords on next login.

---

### Finding 5: [HIGH] -- Default Admin Credentials in Migration File (Committed to Repo)

**Status:** Vulnerable
**Location:** `supabase/migrations/20260212_admin_users.sql:15-18`
**Category:** OWASP A07:2021 -- Identification and Authentication Failures
**CWE:** CWE-798 (Use of Hard-coded Credentials)

**Description:**
The migration file contains the default admin password in a SQL comment and seeds the account:
```sql
-- Seed default admin user (password: K!3uhwP&uq9DV4gE, SHA-256 hashed)
INSERT INTO admin_users (username, password_hash)
VALUES ('admin', '848d338953702a6742b2dc6293954dc4da23fcee4539bbfd829a3a58822f4a04')
ON CONFLICT (username) DO NOTHING;
```

The plaintext password is permanently in the git history. Anyone with repository access knows the default admin credentials.

**Impact:**
- If the default password was never changed, anyone with repo access has full admin access.
- Even if changed, the SHA-256 hash of the original password is available for analysis.

**Recommendation:**
1. Immediately change the default admin password if it is still in use.
2. Remove the plaintext password from the migration comment.
3. Consider using a separate seed script not committed to version control, or require password setup on first login.

---

### Finding 6: [HIGH] -- Client-Side Only Admin Authentication (Forgeable Sessions)

**Status:** Vulnerable
**Location:** `services/adminService.ts:49-67, 119-121`
**Category:** OWASP A07:2021 -- Identification and Authentication Failures
**CWE:** CWE-602 (Client-Side Enforcement of Server-Side Security)

**Description:**
Admin authentication state is stored entirely in `sessionStorage`:
```ts
const ADMIN_SESSION_KEY = 'evalstogo_admin_session';

export function isAdminAuthenticated(): boolean {
  return getAdminSession() !== null;
}
```

The `requireAdmin()` guard used throughout admin services simply checks if a session object exists in `sessionStorage`. An attacker can forge an admin session by executing this in the browser console:

```js
sessionStorage.setItem('evalstogo_admin_session', JSON.stringify({
  username: 'hacker',
  role: 'super_admin',
  userId: 'any-uuid',
  ts: Date.now()
}));
```

After setting this, all `requireAdmin()` checks pass and the `hasPermission()` function grants `super_admin` privileges.

**Impact:**
- Any user can bypass admin authentication entirely.
- Combined with the service-role key (Finding 2), this grants full database write access through the admin UI.

**Recommendation:**
Move to server-side session validation. Options include:
1. Use Supabase Auth for admin users with proper JWT validation.
2. Implement a backend API that validates sessions server-side on each request.
3. At minimum, validate the session against the database on each protected operation (not just client-side).

---

### Finding 7: [HIGH] -- Password Hash Transmitted in Database Query

**Status:** Vulnerable
**Location:** `services/adminService.ts:88-95`
**Category:** OWASP A07:2021 -- Identification and Authentication Failures
**CWE:** CWE-522 (Insufficiently Protected Credentials)

**Description:**
The login function sends the password hash as a query parameter to Supabase:
```ts
const { data } = await supabase
  .from('admin_users')
  .select('id, username, role, is_active')
  .eq('username', username)
  .eq('password_hash', passwordHash)
  .single();
```

This approach:
1. Sends the password hash over the network as a query filter (visible in browser DevTools Network tab).
2. Delegates password comparison to the database engine rather than using a constant-time comparison.
3. Makes the hash a query parameter in the Supabase REST API URL, potentially logged by proxies/CDNs.

**Impact:**
- Password hashes are visible in network traffic inspection.
- Timing attacks may be possible depending on database query optimization.
- Hash values may appear in server logs, CDN logs, or monitoring tools.

**Recommendation:**
Implement password verification in a Supabase Edge Function that:
1. Fetches the stored hash by username only.
2. Compares hashes server-side using a constant-time comparison function.
3. Returns only a success/failure response to the client.

---

### Finding 8: [MEDIUM] -- Webhook URL Hardcoded in Source Code

**Status:** FIXED by Feature B
**Location:** `App.tsx:28`
**Category:** OWASP A05:2021 -- Security Misconfiguration
**CWE:** CWE-798 (Use of Hard-coded Credentials)

**Description:**
The Make.com webhook URL is hardcoded:
```ts
const WEBHOOK_URL = 'https://hook.us2.make.com/2yumbqtypir7635cpknaan9m6le5ol6m';
```

Feature B is migrating this to a database-driven platform setting (confirmed by `supabase/migrations/20260227_platform_settings.sql` which creates the `platform_settings` table and seeds the webhook URL). Once Feature B is deployed, this hardcoded value will be replaced with a dynamic lookup.

**Impact (current):**
- Webhook URL exposed in source code and build artifact.
- Cannot change webhook destination without code change and redeploy.

**Recommendation:** No further action needed -- Feature B addresses this.

---

### Finding 9: [MEDIUM] -- No Rate Limiting or Brute Force Protection on Admin Login

**Status:** Vulnerable
**Location:** `services/adminService.ts:87-113`
**Category:** OWASP A07:2021 -- Identification and Authentication Failures
**CWE:** CWE-307 (Improper Restriction of Excessive Authentication Attempts)

**Description:**
The `adminLogin()` function has no rate limiting, account lockout, CAPTCHA, or progressive delay mechanism. An attacker can make unlimited login attempts at maximum speed.

**Impact:**
- Brute force attacks against admin accounts are trivially possible.
- Combined with weak password hashing (Finding 4), this significantly reduces the time to crack credentials.

**Recommendation:**
1. Implement failed-login counting in the database (e.g., `failed_attempts` and `locked_until` columns on `admin_users`).
2. Lock accounts after 5 consecutive failed attempts for a progressive duration.
3. Add rate limiting at the network level (e.g., Supabase Edge Function or CDN rate limiting).
4. Consider adding CAPTCHA after 3 failed attempts.

---

### Finding 10: [MEDIUM] -- Session ID Generation Uses Math.random()

**Status:** Vulnerable
**Location:** `services/supabaseService.ts:11-12`
**Category:** OWASP A02:2021 -- Cryptographic Failures
**CWE:** CWE-330 (Use of Insufficiently Random Values)

**Description:**
Session IDs are generated using `Math.random()`:
```ts
export const generateSessionId = (): string => {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
};
```

`Math.random()` is not cryptographically secure. Its output can be predicted if the internal state is known, and it has limited entropy.

**Impact:**
- Assessment session IDs are partially predictable.
- An attacker who knows the approximate timestamp could guess session IDs.
- This could allow unauthorized access to or modification of assessment sessions.

**Recommendation:**
Use `crypto.getRandomValues()` for session ID generation:
```ts
export const generateSessionId = (): string => {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  const hex = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  return `sess_${hex}`;
};
```

---

### Finding 11: [MEDIUM] -- fetchTableData Accepts Arbitrary Table Names Without Validation

**Status:** Vulnerable
**Location:** `services/adminService.ts:196-232`
**Category:** OWASP A01:2021 -- Broken Access Control
**CWE:** CWE-20 (Improper Input Validation)

**Description:**
The `fetchTableData()` function accepts any string as `tableName` and passes it directly to the Supabase client:
```ts
export async function fetchTableData(
  tableName: string, ...
): Promise<PaginatedResult> {
  let query = supabase.from(tableName).select('*', { count: 'exact' });
  ...
}
```

While the UI component (`AdminDashboard.tsx:112`) validates against `TABLE_CONFIGS` before calling this function, the service function itself has no allowlist check. If another caller or a future code path passes an arbitrary table name, it would query that table.

**Impact:**
- Potential to query arbitrary Supabase tables (e.g., `admin_users`, `auth.users`) if the function is called with untrusted input.
- Currently mitigated by the UI layer validation, but defense-in-depth is lacking.

**Recommendation:**
Add an allowlist check inside `fetchTableData`:
```ts
const ALLOWED_TABLES = ['clients', 'assessments', 'contacts', 'question_responses', 'completed_reports'];

export async function fetchTableData(tableName: string, ...): Promise<PaginatedResult> {
  if (!ALLOWED_TABLES.includes(tableName)) {
    console.error(`Rejected query to unauthorized table: ${tableName}`);
    return { data: [], count: 0, page, pageSize, totalPages: 0 };
  }
  // ...existing code
}
```

---

### Finding 12: [LOW] -- Cloudinary Unsigned Upload Preset Exposed

**Status:** Acceptable (with caveats)
**Location:** `App.tsx:32-33`, `admin/AdminConfigForm.tsx:6-7`
**Category:** OWASP A05:2021 -- Security Misconfiguration
**CWE:** CWE-284 (Improper Access Control)

**Description:**
Cloudinary cloud name and unsigned upload preset are hardcoded:
```ts
const CLOUDINARY_CLOUD_NAME = 'dussrulvg';
const CLOUDINARY_UPLOAD_PRESET = 'Evalstogo';
```

Unsigned upload presets are designed for client-side use, so this is expected. However, anyone who knows these values can upload arbitrary files to the Cloudinary account.

**Impact:**
- Storage abuse: an attacker could upload large volumes of content, consuming the Cloudinary quota.
- The uploaded content could be inappropriate or malicious.

**Recommendation:**
1. Set upload size limits and file type restrictions on the Cloudinary upload preset.
2. Enable moderation or notification on the preset.
3. Monitor Cloudinary usage for anomalies.

---

### Finding 13: [LOW] -- Console Logging of URL Parameters in Production

**Status:** Vulnerable
**Location:** `App.tsx:43-44`
**Category:** OWASP A09:2021 -- Security Logging and Monitoring Failures
**CWE:** CWE-532 (Insertion of Sensitive Information into Log File)

**Description:**
URL parameters are logged to the browser console in production:
```ts
console.log('URL Search:', window.location.search);
console.log('All URL Params:', Object.fromEntries(params.entries()));
```

**Impact:**
- Minor information disclosure to anyone who opens DevTools.
- URL parameters may contain client IDs or other operational data.

**Recommendation:**
Wrap debug logging in a development-mode check:
```ts
if (import.meta.env.DEV) {
  console.log('URL Search:', window.location.search);
  console.log('All URL Params:', Object.fromEntries(params.entries()));
}
```

---

### Secure Items (No Issues Found)

- **`.env.local` is gitignored** -- The `.gitignore` file correctly excludes `.env`, `.env.local`, and `.env.*.local`. The actual secrets file is not tracked in version control.
- **Supabase anon key is public by design** -- The anon key in `services/supabaseService.ts:6` is expected to be publicly accessible. Security is enforced via RLS policies, not key secrecy.
- **XSS properly mitigated** -- All uses of `dangerouslySetInnerHTML` (in `App.tsx:1113,1117,1125` and `components/PageComponents.tsx:170`) are wrapped with `sanitizeHtml()` which uses DOMPurify with a restrictive allowlist of tags (`b`, `i`, `em`, `strong`, `a`, `br`, `span`) and attributes (`href`, `target`, `rel`, `class`).
- **No source maps in production** -- No `.map` files found in `dist/assets/`. The `vite.config.ts` does not enable source maps for production builds. This prevents attackers from easily reading the original source code.
- **Profile tables have restrictive RLS** -- Per the `20260220_profile_tables.sql` migration, profile tables only allow SELECT for anon/authenticated roles. INSERT/UPDATE/DELETE require the service_role.
- **RBAC permission model** -- The admin panel implements a role-based permission system (`super_admin`, `admin`, `viewer`) with a clear permission matrix in `adminService.ts:21-36`. However, enforcement is client-side only (see Finding 6).
- **Admin self-deletion prevention** -- `deleteAdminUser()` correctly prevents admins from deleting their own account (`adminService.ts:1196`).

---

### Recommendations Priority

| Priority | Finding | Severity | Effort | Action |
|----------|---------|----------|--------|--------|
| 1 | Service Role Key in Frontend (F2) | CRITICAL | Medium | Rotate key immediately. Move admin ops to Edge Functions. |
| 2 | admin_users RLS Wide Open (F3) | CRITICAL | Low | Restrict RLS policy to service_role only. |
| 3 | Gemini API Key in Frontend (F1) | CRITICAL | Medium | Move Gemini calls to backend proxy. |
| 4 | SHA-256 Password Hashing (F4) | HIGH | Medium | Migrate to bcrypt/argon2 in Edge Function. |
| 5 | Client-Side Auth Forgeable (F6) | HIGH | High | Move to Supabase Auth or server-side sessions. |
| 6 | Password Hash in Query (F7) | HIGH | Medium | Server-side password comparison. |
| 7 | Default Credentials (F5) | HIGH | Low | Change password. Remove plaintext from migration. |
| 8 | No Login Rate Limiting (F9) | MEDIUM | Medium | Add account lockout and rate limiting. |
| 9 | Math.random Session IDs (F10) | MEDIUM | Low | Switch to crypto.getRandomValues(). |
| 10 | Table Name Validation (F11) | MEDIUM | Low | Add allowlist to fetchTableData(). |
| 11 | Webhook URL Hardcoded (F8) | MEDIUM | -- | FIXED by Feature B. |
| 12 | Cloudinary Preset (F12) | LOW | Low | Configure upload restrictions. |
| 13 | Console Logging (F13) | LOW | Low | Gate behind DEV check. |

---

### Architecture-Level Recommendation

The root cause of findings 1, 2, 4, 5, 6, and 7 is the **absence of a backend/server layer**. The application is a pure client-side SPA that tries to perform server-side operations (service-role database access, API key management, password verification) in the browser. The single most impactful change would be to:

1. **Introduce Supabase Edge Functions** (or equivalent serverless backend) to handle:
   - Admin authentication with proper password hashing (bcrypt/argon2)
   - Gemini API calls (keeping the key server-side)
   - All service-role database operations (profile management, translations, user management)

2. **Remove all secrets from the frontend bundle** by:
   - Removing the `VITE_` prefix from `SUPABASE_SERVICE_ROLE_KEY`
   - Removing `GEMINI_API_KEY` from the Vite `define` block
   - Using only the Supabase anon key in client-side code

This architectural shift would resolve the majority of critical and high findings in a single effort.

---

*Report generated by Shield Security Analyst. This report reflects the state of the codebase at audit time and should be re-evaluated after remediation.*
