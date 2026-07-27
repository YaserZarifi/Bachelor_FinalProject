# راهنمای اجرای آزمون‌ها و مشاهدهٔ خروجی

این سند پاسخ می‌دهد به دو پرسش: **چطور آزمون‌ها را اجرا کنم؟** و
**خروجی را کجا ببینم؟**

---

## ۰) پیش‌نیاز

فقط برای آزمون‌های بک‌اند لازم است که Docker بالا باشد (پایگاه‌دادهٔ PostGIS
برای ساخت دیتابیس آزمون ضروری است):

```bash
docker compose up -d db redis backend
```

آزمون‌های سه کلاینت (وب شهروند، وب مدیر، موبایل) روی **Node.js** میزبان اجرا
می‌شوند و به Docker نیازی ندارند.

---

## ۱) بک‌اند — Django (۵۱۰ آزمون)

```bash
# اجرای کل مجموعه
docker compose exec backend python manage.py test --settings=core.settings_test

# با جزئیات کامل (نام تک‌تک آزمون‌ها)
docker compose exec backend python manage.py test --settings=core.settings_test -v 2

# فقط یک اپ
docker compose exec backend python manage.py test reports --settings=core.settings_test
docker compose exec backend python manage.py test civic_api --settings=core.settings_test
docker compose exec backend python manage.py test nlp --settings=core.settings_test
docker compose exec backend python manage.py test pushnotify --settings=core.settings_test

# فقط یک پرونده، کلاس یا متد مشخص
docker compose exec backend python manage.py test \
    civic_api.tests.test_websocket --settings=core.settings_test
docker compose exec backend python manage.py test \
    reports.tests.test_serializers.TransitionMapTests --settings=core.settings_test
```

### ⚠️ چرا `--settings=core.settings_test` الزامی است؟

بدون این سوییچ، مجموعه با تنظیمات توسعه اجرا می‌شود و:

* **توکن‌های مهمان واقعی پاک می‌شوند.** توکن دسترسی مهمان در Redis (پایگاه ۱)
  با کلید `uh:guest_ws:<report_id>` نگهداری می‌شود. شناسهٔ گزارش‌های آزمون از ۱
  شروع می‌شود، پس اجرای آزمون روی Redis توسعه، توکن گزارش‌های واقعی ۱ تا N را
  بازنویسی و دسترسی شهروندان به آن‌ها را نابود می‌کند.
  `core/test_runner.py` این را با جایگزینی یک Redis درون‌حافظه‌ای خنثی می‌کند.
* آزمون‌ها به Celery و Redis واقعی وابسته می‌شوند.
* امکان تماس شبکه‌ای با Groq و Expo وجود خواهد داشت.

### پوشش کد بک‌اند

```bash
docker compose exec backend pip install coverage        # یک‌بار

docker compose exec backend sh -c "cd /app && \
  coverage run --source='.' manage.py test --settings=core.settings_test && \
  coverage report --skip-empty --omit='*/migrations/*,*/tests/*,*/venv/*,\
manage.py,testkit.py,core/test_runner.py,core/settings_test.py,PATCHES.py,\
reports_models_updated.py,reports/views.py,core/asgi.py,core/wsgi.py'"

# گزارش HTML قابل مرور
docker compose exec backend sh -c "cd /app && coverage html -d /app/htmlcov"
```

**محل مشاهدهٔ خروجی:**

* **متن** → مستقیم در ترمینال.
* **HTML** → `backend/htmlcov/index.html` را در مرورگر باز کنید (پوشهٔ
  `backend/` به کانتینر mount شده، پس پرونده روی سیستم شما هم ساخته می‌شود).

---

## ۲) وب شهروند — React (۱۵۷ آزمون)

```bash
cd frontend-citizen

npm run test           # حالت تعاملی (watch) — با هر تغییر دوباره اجرا می‌شود
npm run test:run       # یک اجرا و خروج (مناسب گزارش‌گیری و CI)
npm run test:coverage  # اجرا + گزارش پوشش

# فقط یک پرونده
npx vitest run --config vitest.config.js src/api/offline.test.js
```

**محل مشاهدهٔ خروجی:** ترمینال؛ گزارش HTML پوشش در
`frontend-citizen/coverage/index.html`.

---

## ۳) وب مدیر — React (۸۰ آزمون)

```bash
cd frontend-admin
npm run test:run
npm run test:coverage
```

**محل مشاهدهٔ خروجی:** ترمینال؛ گزارش HTML در `frontend-admin/coverage/index.html`.

---

## ۴) موبایل — Expo (۱۳۲ آزمون)

```bash
cd mobile
npm run test:run
npm run test:coverage
```

نیازی به شبیه‌ساز، دستگاه واقعی یا اجرای Expo نیست: ماژول‌های بومی
(`AsyncStorage`، `SecureStore`، `FileSystem`، `NetInfo`، `Crypto`، `Location`)
به بدل‌های دست‌نویس در `mobile/src/test/mocks/` نگاشت شده‌اند، بنابراین لایهٔ
منطق روی Node اجرا می‌شود.

**محل مشاهدهٔ خروجی:** ترمینال؛ گزارش HTML در `mobile/coverage/index.html`.

---

## ۵) اجرای همه‌چیز پشت سر هم

```bash
# از ریشهٔ پروژه
docker compose exec backend python manage.py test --settings=core.settings_test
(cd frontend-citizen && npm run test:run)
(cd frontend-admin   && npm run test:run)
(cd mobile           && npm run test:run)
```

---

## ۶) خروجی‌های ذخیره‌شده برای پایان‌نامه

خروجی خام آخرین اجرای کامل، بدون هیچ ویرایشی، در پوشهٔ `raw/` ذخیره شده است و
می‌تواند به‌عنوان شاهد در پایان‌نامه ارجاع داده شود:

| پرونده | محتوا |
|--------|-------|
| `raw/backend-tests.txt` | فهرست کامل ۵۱۰ آزمون بک‌اند با وضعیت هرکدام |
| `raw/backend-coverage.txt` | جدول پوشش کد بک‌اند به تفکیک ماژول |
| `raw/frontend-citizen-tests.txt` | فهرست ۱۵۷ آزمون وب شهروند |
| `raw/frontend-citizen-coverage.txt` | پوشش کد وب شهروند |
| `raw/frontend-admin-tests.txt` | فهرست ۸۰ آزمون وب مدیر |
| `raw/frontend-admin-coverage.txt` | پوشش کد وب مدیر |
| `raw/mobile-tests.txt` | فهرست ۱۳۲ آزمون موبایل |
| `raw/mobile-coverage.txt` | پوشش کد موبایل |

برای بازتولید این پرونده‌ها:

```bash
mkdir -p tests-reports/raw
docker compose exec -T backend python manage.py test --settings=core.settings_test -v 2 \
  > tests-reports/raw/backend-tests.txt 2>&1
(cd frontend-citizen && npx vitest run --config vitest.config.js --reporter=verbose) \
  > tests-reports/raw/frontend-citizen-tests.txt 2>&1
```

---

## ۷) تفسیر خروجی

```
Ran 510 tests in 20.324s

OK
```

* `OK` یعنی همهٔ آزمون‌ها سبز هستند.
* `FAILED (failures=N)` یعنی N اظهار (assertion) نقض شده — یعنی کد رفتاری غیر
  از انتظار دارد.
* `FAILED (errors=N)` یعنی N آزمون با استثنای پیش‌بینی‌نشده متوقف شده.
* در Vitest: `✓` آزمون موفق، `×` آزمون ناموفق، و
  `Tests  157 passed (157)` جمع‌بندی نهایی است.

پیام‌هایی مانند `[NLP] GROQ_API_KEY not set` یا
`Expo push request failed` در خروجی **طبیعی‌اند**: آزمون‌های مربوط به
«خرابی سرویس بیرونی» عمداً همین وضعیت را می‌سازند تا ثابت کنند برنامه در برابر
آن مقاوم است.
