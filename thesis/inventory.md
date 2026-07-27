# فهرست کد و تحلیل شکاف — پروژه‌ی شهریاور (UrbanHelper)

> این سند نقشه‌ی معماریِ واقعیِ کد (آنچه در ریپو هست، نه آنچه قرار بوده باشد) و تحلیل شکاف
> میان **پروپوزال مصوب** و **پیاده‌سازی** است. همه‌ی ادعاها به `فایل:خط` ارجاع دارند و در
> `claims.md` نیز فهرست شده‌اند. مغایرت‌های مهم با علامت ⚠️ مشخص شده‌اند تا در جلسه‌ی دفاع
> غافلگیر نشویم.

---

## ۱) نقشه‌ی معماری واقعی

سه اپلیکیشن قابل‌استقرار حول یک بک‌اند Django، که همگی با `docker-compose.yml` ارکستره می‌شوند:

```
┌────────────────────┐   ┌────────────────────┐   ┌──────────────────────┐
│ frontend-citizen   │   │ frontend-admin     │   │ mobile (Expo/RN)     │
│ React 19 + Vite    │   │ React 19 + Vite    │   │ Expo SDK 54          │
│ Tailwind (RTL)     │   │ MUI + stylis-rtl   │   │ expo-router          │
│ دوربین درون‌برنامه   │   │ Leaflet + Recharts │   │ expo-camera/location │
│ IndexedDB offline  │   │ داشبورد نقشه‌ای      │   │ AsyncStorage offline │
└─────────┬──────────┘   └─────────┬──────────┘   └──────────┬───────────┘
          │ REST (JSON/GeoJSON) + WebSocket                   │ REST + WS + Expo Push
          └───────────────────────┬──────────────────────────┘
                                  ▼
                 ┌────────────────────────────────────┐
                 │ Django 6 + DRF + Channels (Daphne)  │
                 │  civic_api · reports · nlp · push   │
                 └───────┬─────────────┬───────────────┘
             PostGIS ◀───┘             └───▶ Redis (db0: Celery+Channels · db1: guest tokens)
```

### اپ‌های بک‌اند (تفکیک بر اساس مسئولیت، نه قرارداد معمول Django)

| اپ | نقش واقعی | فایل‌های کلیدی |
|---|---|---|
| `civic_api` | لایه‌ی زنده‌ی HTTP + WebSocket: ViewSetهای واقعی، مجوزها، توکن مهمان، ثبت‌نام JWT، سیگنال‌ها، Consumer | `viewsets.py`، `views_auth.py`، `guest_tokens.py`، `signals.py`، `consumers.py`، `routing.py`، `ws_broadcast.py` |
| `reports` | فقط مدل‌ها، سریالایزرها، ادمین. ⚠️ `reports/views.py` و `reports/urls.py`… (نکته‌ی مهم پایین) | `models.py`، `serializers.py`، `admin.py`، `migrations/` |
| `nlp` | تحلیل گزارش (بحران → دسته‌بند sklearn → fallbackِ Gemini → احساسات) | `service.py`، `classifier.py`، `crisis_keywords.py`، `sentiment.py`، `signals.py`، `tasks.py` |
| `pushnotify` | اعلان Push موبایل (Expo) | `models.py`، `tasks.py`، `expo.py`، `views.py` |
| `core` | تنظیمات، مسیریابی، ASGI (Daphne)، Celery | `settings.py`، `urls.py`، `asgi.py`، `celery.py` |

### مسیر واقعی درخواست (مهم)

- مسیریابی REST: `core/urls.py:37` → `include('reports.urls')` → و `reports/urls.py:4` ViewSetها را از **`civic_api.viewsets`** ایمپورت می‌کند (نه از `reports/views.py`). پس ViewSetِ فعال، `civic_api/viewsets.py` است.
- ⚠️ **کد مرده:** `reports/views.py` شامل یک `ReportViewSet` دومِ ناقص است که به هیچ URLای وصل نیست. تنها جایی که تسک NLPِ Celery (`process_report_nlp.delay`) صدا زده می‌شود همین فایلِ مرده است (`reports/views.py:21`).
- WebSocket: `core/asgi.py:25` → `civic_api.routing.websocket_urlpatterns` → مسیر `ws/reports/{id}/` (`routing.py:6`).

### جریان‌های متقاطع کلیدی (تأییدشده از کد)

1. **GeoJSON در همه‌جا.** `ReportSerializer` یک `GeoFeatureModelSerializer` است (`reports/serializers.py:23`, `geo_field="location"` در `:34`)؛ پاسخ فهرست یک `FeatureCollection` و یک گزارش یک `Feature` است. هر دو فرانت‌اند با `flattenFeatures()` نرمال‌سازی می‌کنند (`frontend-citizen/src/api/client.js:40`، `frontend-admin/src/api/client.js:29`). فیلترِ مکانی با `DistanceToPointFilter` (`viewsets.py:51`).
2. **چرخه‌ی عمر گزارش، ماشین حالتِ محافظت‌شده.** انتقال‌های مجاز در `reports/serializers.py:7-14` (`ALLOWED_STATUS_TRANSITIONS`). تغییر وضعیت فقط از طریق اکشن `POST /api/reports/{id}/transition/` (`viewsets.py:104-122`) که با `ReportTransitionSerializer` انتقال را اعتبارسنجی و برای رسیدن به `RESOLVED` عکسِ `image_after` را الزامی می‌کند (`serializers.py:125-129`).
3. **مدل دسترسی دوگانه.** ایجاد گزارش `AllowAny` (`viewsets.py:55-56`). برای گزارش مهمان، سرور یک **توکن مهمان در Redis db=1** صادر می‌کند (`guest_tokens.py:13,20-23`) و آن را در پاسخِ ایجاد برمی‌گرداند (`viewsets.py:88-101`). کاربر ثبت‌نام‌شده فقط گزارش‌های خودش را می‌بیند؛ `is_staff` همه را (`viewsets.py:67-74`).
4. **به‌روزرسانی بلادرنگ** با WebSocket (نه Push). سیگنال `post_save` به گروه `report_{id}` منتشر می‌کند (`signals.py:28-44`، `ws_broadcast.py:8-20`)؛ کلاینت با `?access=<JWT>` یا `?guest_token=<token>` احراز می‌شود (`consumers.py:23-52`).
5. **متادیتای ثبتِ معتبر (ضدجعل).** `Report` فیلدهای `capture_source`, `captured_at`, `gps_accuracy`, `client_integrity_hash` را دارد (`reports/models.py:48-64`)؛ این‌ها فقط هنگام ایجاد نوشته می‌شوند و در `update()` حذف می‌شوند تا ویرایش کارمند رکورد اصلی را بازننویسد (`serializers.py:71-81`).

---

## ۲) موجودیت‌ها و پشته‌ی فناوری (تأییدشده)

- **بک‌اند:** Django 6.0.4، DRF 3.16.1، `djangorestframework-gis` 1.2.0، Channels 4.2.0 (`channels[daphne]`)، `channels-redis` 4.2.1، `djangorestframework-simplejwt` 5.5.1، Celery 5.4.0، `drf-spectacular` 0.28.0، `scikit-learn>=1.4.0`، `google-generativeai` 0.8.4، `psycopg2-binary`، Pillow (`backend/requirements.txt:1-21`).
- **پایگاه داده:** PostGIS (`postgis/postgis:15-3.3`)؛ موتور `django.contrib.gis.db.backends.postgis` (`settings.py:144`).
- **Redis سه‌نقشه:** لایه‌ی Channels، بروکر/نتیجه‌ی Celery (db0)، و انبار توکن مهمان (db1) (`settings.py:90-91,123-135`، `guest_tokens.py:13`).
- **frontend-citizen:** React 19، Vite 8، Tailwind 3.4، axios، leaflet/react-leaflet، framer-motion؛ صف آفلاین با API خام IndexedDB (بدون کتابخانه) (`frontend-citizen/src/api/offline.js:13-15`).
- **frontend-admin:** React 19، Vite 8، MUI 6.4، `@emotion` + `stylis-plugin-rtl`، leaflet/react-leaflet، Recharts 2.15، `react-router-dom` 7 (`frontend-admin/package.json:12-29`).
- **mobile:** ⚠️ **Expo SDK 54** (نه ۵۲ که README می‌گوید — `mobile/package.json:18`)، expo-router 6، expo-camera 17، expo-location 19، expo-crypto 15، expo-file-system 19، AsyncStorage، expo-notifications، expo-secure-store، axios، Vazirmatn.

---

## ۳) تحلیل شکاف پروپوزال ↔ کد

### الف) قول داده شده و **پیاده‌سازی شده** ✅

| قابلیت پروپوزال | شواهد در کد |
|---|---|
| گزارش‌دهی چندرسانه‌ای (دسته + متن + تصویر + موقعیت) | `ReportModal.jsx`، `mobile/app/report/new.jsx`، `reports/models.py:35-37` |
| موقعیت مکانی خودکار (GPS) | `useGeolocation.js`، `mobile/src/hooks/useLocation.js` |
| کارتابل شخصی + مشاهده‌ی وضعیت | `MyReports.jsx`، `mobile/app/(tabs)/reports.jsx` |
| داشبورد نظارت روی نقشه | `frontend-admin/src/pages/Dashboard.jsx:678-700` |
| مدیریت چرخه‌ی عمر + تغییر وضعیت | اکشن `transition` (`viewsets.py:104-122`) + UI ادمین (`Dashboard.jsx:898-961`) |
| فیلتر/جست‌وجوی پیشرفته | `Dashboard.jsx:336-344` (وضعیت/فوریت/جست‌وجو) |
| معماری لایه‌ای REST، جداسازی کامل کلاینت/سرور | `settings.py`, DRF, بدون رندر HTML |
| PostGIS برای کوئری مکانی («شعاع X کیلومتری») | `DistanceToPointFilter` (`viewsets.py:50-51`) |
| سیستم کاربری دوگانه (مهمان/ثبت‌نام) | توکن مهمان (`guest_tokens.py`) + JWT (`views_auth.py`) |
| دوربین درون‌برنامه‌ای + قفل متادیتا (ضدجعل) | `CameraCapture.jsx`، `integrity.js`، `reports/models.py:48-64` |
| معماری اول-آفلاین + همگام‌سازی خودکار | `offline.js` (وب + موبایل)، رویداد `online`/`NetInfo` |
| چرخه‌ی بازخورد بلادرنگ | WebSocket Channels (`consumers.py`, `ws_broadcast.py`) |
| اعلان Push هنگام تغییر وضعیت | `pushnotify` + سیگنال (`civic_api/signals.py:38-42`) — **فقط موبایل** |
| ماشین حالت شش‌مرحله‌ای | `STATUS_CHOICES` (`models.py:18-25`) + `ALLOWED_STATUS_TRANSITIONS` |
| ماژول NLP: دسته‌بندی خودکار | `nlp/classifier.py` (TF-IDF + LinearSVC) |
| ماژول NLP: تشخیص بحران/فوریت | `nlp/crisis_keywords.py` (کلیدواژه‌های وزن‌دار) |
| دکمه‌های اضطراری (۱۱۰/۱۲۵/۱۱۵) | `mobile/app/(tabs)/index.jsx`، `EmergencyStrip.jsx` (وب) |

### ب) قول داده شده و **پیاده‌سازی نشده / ناکامل** ⚠️ (کارهای آینده)

| قول پروپوزال | وضعیت واقعی |
|---|---|
| گیمیفیکیشن (امتیاز، نشان، رتبه‌بندی، «شهروند فعال») | پیاده‌سازی نشده. در پروپوزال هم صراحتاً «چشم‌انداز آتی» بود. مدل امتیاز/نشان وجود ندارد. |
| مدل `Feedback`/کامنت روی گزارش | مدل `Feedback` وجود ندارد؛ فقط `Report` و `Category` (`reports/models.py`). |
| «سناریوی اضطراری: نمایش مراکز حیاتیِ نزدیک روی نقشه» | تا حد دکمه‌های تماس اضطراری پیاده شده؛ نمایش مراکز نزدیک روی نقشه در ادمین پیاده نشده. |
| تست واحد برای منطق حساس بک‌اند | ⚠️ فایل‌های `tests.py` عملاً خالی/استاب‌اند؛ ارزیابی بر پایه‌ی اجرای زنده و کالکشن Postman است. |
| اولویت‌بندی پیشرفته با ML / بینایی ماشین | «کارهای آینده»؛ پیاده نشده. |
| بینایی ماشین برای تخمین شدت خرابی از تصویر | پیاده نشده (آینده). |

### ج) **پیاده‌سازی شده ولی در پروپوزال برجسته نبود** ➕

| افزوده‌ی فراتر از پروپوزال | شواهد |
|---|---|
| تحلیل احساسات فارسی (لغت‌نامه‌ای) روی متن گزارش | `nlp/sentiment.py` |
| fallbackِ مدل زبانی (Gemini) وقتی اطمینان دسته‌بند < ۰٫۴۰ | `service.py:135-146`, `classifier.py:207` |
| هشِ یکپارچگی SHA-256 سمت کلاینت (اثرانگشت ضدجعل) | `integrity.js`، `client_integrity_hash` (`models.py:61-64`) |
| اپ موبایل بومی (Expo/React Native) به‌عنوان کلاینت سوم | کل پوشه‌ی `mobile/` |
| مستندسازی خودکار API با Swagger/OpenAPI (`drf-spectacular`) | `/api/docs/` (`core/urls.py:31`) |
| اعلان محلی (local notification) و نشان «زنده» در موبایل | `mobile/app/report/[id].jsx:52-65,102-109` |

### د) مغایرت‌های فنی مهم بین «توصیف رایج پروژه» و «کد واقعی» ⚠️ (برای صداقت در دفاع)

1. **اجرای NLP هم‌زمان است، نه ناهم‌زمان با Celery.** مسیر فعال، سیگنالِ `post_save` در `nlp/signals.py:16-24` است که `analyze_report` را **در همان تراکنش ثبت گزارش** اجرا می‌کند و نتیجه را می‌نویسد. تسک Celery (`nlp/tasks.py:8`) وجود دارد اما فقط از `reports/views.py:21`ِ **مرده** صدا زده می‌شود؛ پس در جریان واقعی، Celery برای NLP اجرا نمی‌شود. (Celery فقط برای Push فعال است.)
2. **دو تعریف موازی از ViewSet.** فعال: `civic_api/viewsets.py`؛ مرده: `reports/views.py`. `perform_create`ِ فعال NLP را enqueue نمی‌کند (`viewsets.py:84-89`).
3. **داشبورد ادمین خوشه‌بندی نقشه ندارد.** `react-leaflet-cluster` در `node_modules` هست اما در `package.json` نیست و هیچ‌جا import نشده؛ نقشه از Markerهای تک‌به‌تک استفاده می‌کند (`Dashboard.jsx:681-699`).
4. **`is_staff` سمت کلاینت اعمال نمی‌شود.** گاردِ ادمین فقط وجود توکن را چک می‌کند (`App.jsx:5-9`)؛ محدودیت کارمندی را بک‌اند اعمال می‌کند (اکشن `transition` و update با `IsStaffUser`؛ `get_queryset` غیرکارمند فقط گزارش‌های خودش را می‌بیند).
5. **تناقض داخلی خود پروپوزال درباره‌ی گالری.** فهرست قابلیت‌ها «الصاق تصویر از دوربین یا گالری» را می‌گوید، اما بخش ضدجعل و پیاده‌سازی، گالری را عمداً حذف کرده‌اند (فقط دوربین). پیاده‌سازی، رویکرد امن‌تر (دوربین‌فقط) را برگزیده است (`CameraCapture.jsx:8-16,167-169`).
6. **توکن مهمان در وب ذخیره‌ی محلی نمی‌شود.** فقط یک‌بار با دکمه‌ی کپی نمایش داده می‌شود (`ReportModal.jsx:242-259`)؛ اما در موبایل در AsyncStorage نگه‌داری می‌شود (`mobile/src/api/guestStore.js`). تفاوت طراحی دو کلاینت.
7. **متن پروپوزال از `accounts`/`notifications` به‌عنوان اپ نام برد؛** نام‌های واقعی `civic_api`/`pushnotify`اند. صرفاً نام‌گذاری.

---

## ۴) فهرست پیشنهادی نمودارها (فاز ۴)

| کد شکل | عنوان | منبع در کد | ابزار |
|---|---|---|---|
| fig-arch | معماری کلی سیستم (سه کلاینت + بک‌اند + PostGIS/Redis) | `docker-compose.yml`، `settings.py` | matplotlib |
| fig-deploy | معماری استقرار (سرویس‌های Docker + پورت‌ها) | `docker-compose.yml` | matplotlib |
| fig-erd | شمای پایگاه داده (ERD) | `reports/models.py`، `pushnotify/models.py` | matplotlib |
| fig-state | ماشین حالتِ چرخه‌ی عمر گزارش | `serializers.py:7-14` | matplotlib |
| fig-seq-create | نمودار توالی: ثبت گزارش مهمان + NLP + توکن | `viewsets.py`، `nlp/signals.py` | matplotlib |
| fig-seq-ws | نمودار توالی: تغییر وضعیت → WebSocket + Push | `signals.py`، `consumers.py`، `pushnotify/tasks.py` | matplotlib |
| fig-nlp | خط‌لوله‌ی NLP (بحران → sklearn → Gemini → احساسات) | `nlp/service.py:100-171` | matplotlib |
| fig-offline | فلوچارت جریان اول-آفلاین | `offline.js` | matplotlib |
| fig-usecase | نمودار مورد کاربرد (شهروند/مهمان/کارمند) | تحلیل نیازمندی‌ها | matplotlib |

> برچسب‌های داخل نمودارها انگلیسی، کپشن زیر آن‌ها فارسی (طبق قاعده‌ی پرامپت — رندر فارسی در matplotlib شکننده است).

## ۵) فهرست پیشنهادی اسکرین‌شات‌ها

جزئیات کامل در `screenshots.md`. سرفصل‌ها: صفحه‌ی اصلی شهروند، دوربین درون‌برنامه، جادوگر سه‌مرحله‌ای ثبت، نمایش توکن مهمان، کارتابل و تایم‌لاین وضعیت، داشبورد نقشه‌ای ادمین، نمودارهای Recharts، کارت جزئیات + تحلیل NLP، UI تغییر وضعیت، اپ موبایل (Home/ثبت/جزئیات زنده)، Swagger، پنل ادمین Django با نقشه‌ی GIS.
