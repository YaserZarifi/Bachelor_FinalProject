# پیوست‌ها

مطابق شیوه‌نامه، مطالبی که تفصیل آن‌ها رشته‌ی کلامِ متن اصلی را می‌گسلد، مانند قطعه‌کدهای بلند و داده‌ی نمونه و راهنمای اجرا، در پیوست آورده می‌شوند. شماره‌گذاری جدول‌ها و شکل‌های این بخش با پیشوند «پ» و مستقل از فصل‌های اصلی است.

## قطعه‌کدهای بلند کلیدی

سه قطعه‌کدی که در ادامه می‌آید، به‌ترتیب هسته‌ی اجرای ماشین حالت، خط‌لوله‌ی تحلیل متن و ساختِ داده‌ی ارسالی گزارش را نشان می‌دهند و در فصل چهار به آن‌ها ارجاع داده شده است.

### اعتبارسنجی انتقال وضعیت

قطعه‌ی کد جدول پ-۱ از `backend/reports/serializers.py:108-131` گرفته شده و هسته‌ی اجرای ماشین حالت و الزام تصویرِ «بعد» برای وضعیت حل‌شده را نشان می‌دهد.

[TABLE label=code-transition | caption=شرح کد اعتبارسنجی انتقال وضعیت گزارش]

```python
class ReportTransitionSerializer(serializers.Serializer):
    """Staff-only status transition + optional evidence image (multipart)."""
    status = serializers.ChoiceField(choices=[c[0] for c in Report.STATUS_CHOICES])
    image_after = serializers.ImageField(required=False, allow_null=True)

    def validate(self, attrs):
        report = self.context["report"]
        old = report.status
        new_status = attrs["status"]
        if new_status == old:
            return attrs
        allowed = ALLOWED_STATUS_TRANSITIONS.get(old, set())
        if new_status not in allowed:
            raise serializers.ValidationError(
                {"status": f"انتقال از {old} به {new_status} مجاز نیست."}
            )
        img = attrs.get("image_after")
        if new_status == "RESOLVED" and not img and not report.image_after:
            raise serializers.ValidationError(
                {"image_after": "برای وضعیت حل‌شده، تصویر بعد الزامی است."}
            )
        return attrs
```

### هسته‌ی خط‌لوله‌ی تحلیل متن

قطعه‌ی کد جدول پ-۲ از `backend/nlp/service.py` گرفته شده و ترتیب چهار مرحله‌ای تحلیل را نشان می‌دهد. در سطر پایانی، اگر مدل زبانی بزرگ فراخوانی شده و برچسب احساس معتبری بازگردانده باشد، همان برچسب بر نتیجه‌ی لغت‌نامه‌ای اولویت می‌یابد.

[TABLE label=code-nlp | caption=شرح کد خط‌لوله‌ی چهارمرحله‌ای تحلیل متن گزارش]

```python
# ۱. بررسی بحران
urgent, crisis_score, crisis_kws = is_crisis(text)

# ۲. دسته‌بند محلی
sklearn_result = predict_category(text)
used_ai = False
groq_sentiment = None

if not sklearn_result["needs_ai_fallback"]:
    suggested_category = sklearn_result["category"]
    category_confidence = sklearn_result["confidence"]
    category_source = "sklearn"

elif available_categories:
    # ۳. پشتیبان مدل زبانی بزرگ (دسته و احساس در یک فراخوانی)
    ai_result = classify_with_groq(text, available_categories)
    if ai_result is not None:
        used_ai = True
        suggested_category = ai_result["category"]
        category_confidence = ai_result["confidence"]
        category_source = "groq"
        groq_sentiment = ai_result.get("sentiment")

# ۴. تحلیل احساسات
sentiment = analyze_sentiment(text)
if groq_sentiment:
    sentiment = groq_sentiment
```

### ساختِ داده‌ی ارسالیِ ثبت گزارش

قطعه‌ی کد جدول پ-۳ از `frontend-citizen/src/api/offline.js:88-100` گرفته شده و ساختار ارسال گزارش را می‌سازد و این ساختار برای مسیر برخط و مسیر آفلاین یکسان است. همین اشتراک تضمین می‌کند که رفتار دو مسیر واگرا نشود.

[TABLE label=code-formdata | caption=شرح کد ساخت داده‌ی چندبخشیِ ارسال گزارش در کارخواه]

```javascript
export function buildReportFormData(item) {
  const fd = new FormData()
  if (item.category) fd.append('category', item.category)
  fd.append('description', item.description)
  fd.append('location', `POINT(${item.lng} ${item.lat})`)
  fd.append('capture_source', 'CAMERA')
  fd.append('captured_at', item.capturedAt)
  if (item.accuracy != null) fd.append('gps_accuracy', Math.round(item.accuracy))
  if (item.integrityHash) fd.append('client_integrity_hash', item.integrityHash)
  fd.append('image_before', item.blob, 'capture.jpg')
  return fd
}
```

## نمونه‌ی درخواست و پاسخ واسط برنامه‌سازی

جدول پ-۴ ساختار پاسخِ ایجاد گزارشِ مهمان را نشان می‌دهد: قالب نمود مکانی به‌همراه نشانه‌ی مهمانِ تزریق‌شده در بخش ویژگی‌ها. مقادیر تنها برای نمایش ساختار آمده‌اند.

[TABLE label=code-api | caption=شرح کد نمونه‌ی پاسخ ایجاد گزارش مهمان]

```json
POST /api/reports/    (multipart/form-data)

201 Created
{
  "type": "Feature",
  "geometry": { "type": "Point", "coordinates": [51.389, 35.6892] },
  "properties": {
    "id": 42,
    "status": "SUBMITTED",
    "is_urgent": false,
    "category": null,
    "description": "…",
    "capture_source": "CAMERA",
    "guest_access_token": "xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
  }
}
```

تغییر وضعیت توسط کارمند از راه `POST /api/reports/42/transition/` با بدنه‌ی چندبخشیِ `status=IN_PROGRESS` انجام می‌شود و در صورت رسیدن به `RESOLVED`، فیلد `image_after` نیز الزامی است.

## راهنمای اجرا

اجرای کامل پشته با ابزار همسازی ظرف‌ها انجام می‌شود. فرمان‌های جدول پ-۵ ساخت تصویرها، اجرای سرویس‌ها و کارهای مدیریتیِ متداول را پوشش می‌دهند.

[TABLE label=code-run | caption=شرح کد فرمان‌های ساخت، اجرا و مدیریت سامانه]

```bash
# ساخت و اجرای پایگاه داده، انباره‌ی درون‌حافظه‌ای، کارساز، کارگر صف و دو کارخواه وب
docker compose up --build

# درگاه‌ها:  کارساز :8080   کارخواه شهروند :3001   داشبورد مدیریت :3002
#            پایگاه داده :5433   انباره‌ی درون‌حافظه‌ای :6379
# مستندات تعاملی واسط برنامه‌سازی: http://localhost:8080/api/docs/

# ساخت کاربر کارمند برای ورود به داشبورد مدیریت
docker compose exec backend python manage.py createsuperuser

# تولید داده‌ی نمونه برای آزمودن نقشه و داشبورد
docker compose exec backend python manage.py seed_reports

# آموزش و ارزیابی مدل دسته‌بندی
docker compose exec backend python manage.py train_nlp --eval

# اجرای آزمون‌های واحد ماژول پردازش زبان طبیعی
docker compose exec backend python manage.py test nlp
```

برای اجرای برنامه‌ی موبایل، مقادیر `EXPO_PUBLIC_API_BASE` و `EXPO_PUBLIC_WS_BASE` باید به نشانی شبکه‌ی محلیِ میزبان تنظیم و سپس برنامه با ابزار Expo اجرا شود.
