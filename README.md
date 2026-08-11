# ג'אמפו — ניהול משמרות

מערכת שיבוץ משמרות למקום ג'ימבורי, בנויה ב-Next.js + Supabase. חינמית לחלוטין להרצה (Vercel free tier + Supabase free tier + Resend free tier).

## סטטוס נוכחי

✅ סכימת DB מלאה + RLS
✅ סקאפולד Next.js + PWA + RTL
✅ התחברות (שם משתמש + סיסמה)
✅ ניהול עובדים (מסך מנהל)

🔜 בהמשך: פריסט משמרות, מחזורי תכנון, הגשת זמינות, אלגוריתם שיבוץ, פרסום + מיילים.

## הרצה מקומית

### 1. דרישות מוקדמות

- Node.js 18+ מותקן.
- חשבון [Supabase](https://supabase.com) חינמי.
- חשבון [Resend](https://resend.com) חינמי (נדרש רק בהמשך, לשלב שליחת המיילים).

### 2. יצירת פרויקט Supabase (חינמי)

1. היכנסו ל-[supabase.com](https://supabase.com) → **New project**.
2. בחרו שם, סיסמת DB (שמרו אותה בצד), ואזור קרוב (למשל Frankfurt/London).
3. אחרי שהפרויקט נוצר: **Settings → API** → העתיקו את `Project URL`, `anon public key` ו-`service_role key`.

### 3. הרצת הסכימה

בפרויקט Supabase שלכם: **SQL Editor** → הריצו לפי הסדר את הקבצים:

1. `supabase/migrations/0001_init.sql`
2. `supabase/migrations/0002_rls.sql`
3. `supabase/seed.sql` (אופציונלי — נתוני דוגמה: מנהל + 3 עובדים + פריסט התחלתי)

> לחלופין, אם מותקן [Supabase CLI](https://supabase.com/docs/guides/cli): `supabase link` ואז `supabase db push`, ו-`supabase db reset` להרצת ה-seed מקומית.

### 4. משתני סביבה

```bash
cp .env.example .env.local
```

מלאו את `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` ו-`SUPABASE_SERVICE_ROLE_KEY` מהשלב הקודם. את משתני ה-Resend אפשר להשלים בהמשך, כשנגיע לשלב המיילים.

### 5. התקנה והרצה

```bash
npm install
npm run dev
```

האתר יעלה ב-http://localhost:3000.

### 6. התחברות עם נתוני הדוגמה (אם הרצתם את ה-seed)

| תפקיד | שם משתמש | סיסמה |
|---|---|---|
| מנהל | `admin` | `Jampo1234!` |
| עובד | `dana` / `yossi` / `maya` | `Jampo1234!` |

**חשוב:** שנו את סיסמת המנהל בסביבת production (או מחקו את הרצת ה-seed ויצרו משתמשים אמיתיים דרך מסך "ניהול עובדים").

## פריסה (Deploy)

### Vercel (חינמי)

1. דחפו את הריפו ל-GitHub.
2. ב-[vercel.com](https://vercel.com) → **New Project** → ייבוא הריפו.
3. הוסיפו את משתני הסביבה מ-`.env.example` תחת **Settings → Environment Variables**.
4. Deploy.

### הוספה למסך הבית (PWA)

באייפון/אנדרואיד: פתחו את האתר בדפדפן → תפריט השיתוף → "הוסף למסך הבית". האתר יתנהג כמו אפליקציה (אייקון, ללא פס כתובת, offline בסיסי).

> **הערה:** יש להחליף את קבצי `public/icons/icon-192.png` ו-`icon-512.png` באייקון אמיתי של ג'אמפו לפני production (כרגע חסרים / placeholder).

## הערות אדריכליות

- **התחברות עם שם משתמש** — Supabase Auth דורש אימייל, אז כל `username` ממופה פנימית ל-`{username}@jampo.internal` (ב-[src/lib/auth/username.ts](src/lib/auth/username.ts)). המשתמש לעולם לא רואה את זה.
- **תפקיד (role)** נשמר בשני מקומות בכוונה: בעמודת `employees.role` (למדיניות RLS ב-DB, דרך פונקציית `is_manager()`), ובתוך `auth.users.app_metadata.role` (כדי שה-middleware יוכל לבדוק הרשאות בלי query נוסף ל-DB בכל בקשה). כל יצירת/עדכון תפקיד עובד צריכה לעדכן את שניהם.
- **אלגוריתם השיבוץ** ירוץ תמיד בצד שרת (API route) עם ה-`service role key`, כי הוא צריך לקרוא זמינות של כל העובדים ולכתוב שיבוצים עבור כולם בבת אחת — RLS חוסם את זה מכוונה בצד הלקוח.
- מבנה הקוד נמנע מהנחות ספציפיות לדפדפן, כך שניתן בעתיד לעטוף עם Capacitor בלי שינוי משמעותי.
