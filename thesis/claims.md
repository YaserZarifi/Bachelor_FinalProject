# ردیابی ادعاها → کد (Zero-Hallucination Ledger)

> هر ادعای فنیِ متن گزارش به `فایل:خط` در ریپو نگاشت شده است. مسیرها نسبت به ریشه‌ی ریپو‌اند.
> در جلسه‌ی دفاع، برای هر جمله می‌توان به این جدول رجوع کرد.

## فصل ۳ و ۴ — معماری و بک‌اند

| ادعا | مرجع کد |
|---|---|
| چهار اپِ محلی: civic_api, reports, nlp, pushnotify | `backend/core/settings.py:59-65` |
| ViewSet فعال از civic_api ایمپورت می‌شود (نه reports/views) | `backend/reports/urls.py:4`، `backend/core/urls.py:37` |
| `reports/views.py` کد مرده است (تنها جای enqueue تسک NLP) | `backend/reports/views.py:4,21` |
| ReportViewSet، ModelViewSet با فیلتر فاصله‌ی مکانی | `backend/civic_api/viewsets.py:47,50-51` |
| مجوزهای پویا بر پایه‌ی عملیات | `backend/civic_api/viewsets.py:54-65` |
| get_queryset: کارمند همه، کاربر خودش، ناشناس هیچ | `backend/civic_api/viewsets.py:67-74` |
| retrieve مهمان با guest_token دور می‌زند | `backend/civic_api/viewsets.py:76-82` |
| perform_create توکن مهمان صادر می‌کند | `backend/civic_api/viewsets.py:84-89` |
| تزریق توکن در properties پاسخ | `backend/civic_api/viewsets.py:91-101` |
| اکشن transition، کارمند-محور | `backend/civic_api/viewsets.py:104-122` |
| توکن مهمان در Redis db=1، عمر ~۲ سال | `backend/civic_api/guest_tokens.py:13,20-23` |
| اعتبارسنجی توکن با مقایسه‌ی رشته‌ای | `backend/civic_api/guest_tokens.py:26-30` |
| ثبت‌نام JWT (AllowAny) | `backend/civic_api/views_auth.py:16-19` |
| نقاط پایانی توکن SimpleJWT | `backend/core/urls.py:34-35` |
| عمر توکن دسترسی ۱۲ساعت/تازه‌سازی ۷روز | `backend/core/settings.py:210-214` |
| مدل Report و PointField(srid=4326) | `backend/reports/models.py:17,36` |
| متادیتای ثبت (۴ فیلد) | `backend/reports/models.py:48-64` |
| فیلدهای NLP روی مدل | `backend/reports/models.py:67-80` |
| STATUS_CHOICES فارسی | `backend/reports/models.py:18-25` |
| ReportSerializer یک GeoFeatureModelSerializer، geo_field=location | `backend/reports/serializers.py:23,34` |
| ALLOWED_STATUS_TRANSITIONS (نگاشت انتقال‌ها) | `backend/reports/serializers.py:7-14` |
| ReportTransitionSerializer + الزام image_after برای RESOLVED | `backend/reports/serializers.py:108-130` |
| متادیتای ثبت در update حذف می‌شود (نوشتنی-یک‌بار) | `backend/reports/serializers.py:71-81` |
| مهاجرت 0004 دستی (بدون سرآیند خودکار) | `backend/reports/migrations/0004_report_capture_metadata.py` |
| ادمین GIS + readonly متادیتا | `backend/reports/admin.py:7-11` |
| سیگنال pre/post_save، Push فقط با تغییر وضعیت | `backend/civic_api/signals.py:12-44` |
| انتشار WebSocket به گروه report_{id} | `backend/civic_api/ws_broadcast.py:8-20` |
| ReportConsumer + احراز access/guest_token | `backend/civic_api/consumers.py:22-52` |
| مسیر ws/reports/{id}/ | `backend/civic_api/routing.py:5-7` |
| Redis سه‌نقشه (Channels/Celery db0/توکن db1) | `backend/core/settings.py:90-91,123-135` |

## فصل ۴ — NLP

| ادعا | مرجع کد |
|---|---|
| ترتیب خط‌لوله: بحران → sklearn → Gemini → احساسات | `backend/nlp/service.py:100-171` |
| کلیدواژه‌های بحرانی وزن‌دار، آستانه=۳ | `backend/nlp/crisis_keywords.py:6-68,71,96-104` |
| بردارساز TF-IDF char_wb (2,4)، 15000 | `backend/nlp/classifier.py:89-95` |
| LinearSVC(C=1.5, balanced) | `backend/nlp/classifier.py:98-102` |
| اطمینان با softmax روی decision_function | `backend/nlp/classifier.py:189-204` |
| آستانه‌ی fallback = 0.40 | `backend/nlp/classifier.py:207` |
| پیکره‌ی آموزش ۹۵ نمونه، ۷ دسته | `backend/nlp/training_data.py:7,124-132` |
| Gemini: مدل gemini-1.5-flash، نیاز به GEMINI_API_KEY | `backend/nlp/service.py:55-58,61` |
| تحلیل احساسات لغت‌نامه‌ای | `backend/nlp/sentiment.py:14-107` |
| اجرای هم‌زمان NLP با سیگنال post_save (created) | `backend/nlp/signals.py:16-24`، `backend/nlp/apps.py:10-12` |
| تسک Celery NLP فقط از reports/views صدا زده می‌شود | `backend/nlp/tasks.py:8`، `backend/reports/views.py:21` |
| فرمان train_nlp با --eval/--from-db | `backend/nlp/management/commands/train_nlp.py:18-33` |
| مجموعه‌ی آزمون NLP (~۱۸ تست) | `backend/nlp/tests.py:14-130` |

## فصل ۴ — Push و زیرساخت

| ادعا | مرجع کد |
|---|---|
| مدل‌های PushDevice و ReportSubscription | `backend/pushnotify/models.py:7-69` |
| ثبت توکن /api/push/register/ (AllowAny) | `backend/pushnotify/views.py:12-52`، `backend/pushnotify/urls.py:5-8` |
| تسک send_status_push، جمع توکن مالک+مهمان | `backend/pushnotify/tasks.py:22-78` |
| کلاینت Expo فقط با کتابخانه‌ی استاندارد | `backend/pushnotify/expo.py:1-59` |
| بک‌اند با Daphne روی ASGI | `docker-compose.yml:28-30`، `backend/core/asgi.py:21-29` |
| تصویر db: postgis/postgis:15-3.3 | `docker-compose.yml:9` |
| پورت‌ها backend 8080/citizen 3001/admin 3002 | `docker-compose.yml:34,79,92` |
| Dockerfile: python:3.12-slim + GDAL | `backend/Dockerfile:2,9-11` |
| موتور PostGIS | `backend/core/settings.py:144` |

## فصل ۴ — کلاینت‌ها

| ادعا | مرجع کد |
|---|---|
| flattenFeatures نرمال‌سازی GeoJSON (شهروند) | `frontend-citizen/src/api/client.js:40-47` |
| دوربین: getUserMedia→canvas→JPEG 0.9 | `frontend-citizen/src/components/CameraCapture.jsx:71-104` |
| گالری عمداً پشتیبانی نمی‌شود | `frontend-citizen/src/components/CameraCapture.jsx:8-16` |
| هش یکپارچگی SHA-256 | `frontend-citizen/src/api/integrity.js:12-30` |
| صف آفلاین IndexedDB (بدون کتابخانه) urbanhelper/pending_reports | `frontend-citizen/src/api/offline.js:13-15` |
| buildReportFormData (POINT(lng lat), capture_source=CAMERA) | `frontend-citizen/src/api/offline.js:88-100` |
| WebSocket زنده در MyReports | `frontend-citizen/src/pages/MyReports.jsx:146-167` |
| توکن مهمان فقط نمایش/کپی (بدون localStorage) | `frontend-citizen/src/components/report/ReportModal.jsx:242-259` |
| داشبورد ادمین: Leaflet + نشانگر سفارشی | `frontend-admin/src/pages/Dashboard.jsx:135-150,681-699` |
| بدون خوشه‌بندی (react-leaflet-cluster استفاده نشده) | `frontend-admin/package.json`، `Dashboard.jsx` (بدون import) |
| نمودارهای Recharts (۴ نمودار + KPI) | `frontend-admin/src/pages/Dashboard.jsx:383-427` |
| UI تغییر وضعیت + الزام فایل برای RESOLVED | `frontend-admin/src/pages/Dashboard.jsx:898-961` |
| گارد ادمین فقط توکن را چک می‌کند (بدون is_staff کلاینت) | `frontend-admin/src/App.jsx:5-9` |
| MUI RTL با stylis-plugin-rtl | `frontend-admin/src/main.jsx:8-9,43-45` |
| موبایل Expo SDK 54 | `mobile/package.json:18` |
| موبایل: SecureStore برای JWT، AsyncStorage برای مهمان | `mobile/src/api/client.js:16-41`، `mobile/src/api/guestStore.js:7` |
| useReportSocket (access/guest_token) | `mobile/src/hooks/useReportSocket.js:21-40` |
| ثبت Push /api/push/register/ | `mobile/src/api/push.js:4-12` |

## پروپوزال (فصل ۱ و ۲)

| ادعا | مرجع |
|---|---|
| عنوان، دانشجو، استاد، دانشکده | `proposal_text.txt:17-18,48,51-52` |
| اهداف و اهداف اختصاصی | `proposal_text.txt:104-127` |
| سامانه‌های مشابه (FixMyStreet/SeeClickFix/…) | `proposal_text.txt:136-176` |
| ماشین حالت شش‌مرحله‌ای | `proposal_text.txt:314-333` |
| روش ارزیابی (۴ سناریو + Postman + تست واحد) | `proposal_text.txt:412-422` |
| مراجع | `proposal_text.txt:555-573` |
