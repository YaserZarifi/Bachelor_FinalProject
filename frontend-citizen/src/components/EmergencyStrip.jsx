export function EmergencyStrip() {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 shadow-sm">
      <p className="font-semibold">اطلاعات مهم</p>
      <p className="mt-1 leading-relaxed">
        این سامانه برای مسائل غیرفوری شهری است؛ برای اورژانس از تماس مستقیم با مراجع ذیربط
        استفاده کنید.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href="tel:115"
          className="inline-flex items-center rounded-xl bg-rose-600 px-4 py-2 font-semibold text-white shadow hover:bg-rose-700"
        >
          اورژانس ۱۱۵
        </a>
        <a
          href="tel:125"
          className="inline-flex items-center rounded-xl bg-orange-600 px-4 py-2 font-semibold text-white shadow hover:bg-orange-700"
        >
          آتش‌نشانی ۱۲۵
        </a>
        <a
          href="tel:110"
          className="inline-flex items-center rounded-xl bg-slate-800 px-4 py-2 font-semibold text-white shadow hover:bg-slate-900"
        >
          پلیس ۱۱۰
        </a>
      </div>
    </div>
  )
}
