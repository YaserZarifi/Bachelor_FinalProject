# ==============================================================
# signals.py
# سیگنال Django — هر بار که گزارش جدید ثبت می‌شود،
# ماژول NLP به صورت خودکار اجرا می‌شود
# ==============================================================

from __future__ import annotations
import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


@receiver(post_save, sender="reports.Report")
def run_nlp_on_new_report(sender, instance, created: bool, **kwargs):
    """
    بعد از ثبت گزارش جدید، تحلیل NLP را اجرا و نتیجه را ذخیره می‌کند.
    فقط برای گزارش‌های تازه ایجاد‌شده (created=True) اجرا می‌شود
    تا از حلقه بی‌نهایت جلوگیری شود.
    """
    if not created:
        return

    try:
        from .service import analyze_report
        from reports.models import Category

        available_categories = list(
            Category.objects.values_list("name", flat=True)
        )

        logger.info(f"[NLP Signal] Running analysis on Report #{instance.id}")

        result = analyze_report(
            text=instance.description,
            available_categories=available_categories,
        )

        category_changed = False

        if result.is_urgent and not instance.is_urgent:
            instance.is_urgent = True

        if result.suggested_category and instance.category_id is None:
            try:
                category = Category.objects.get(name=result.suggested_category)
                instance.category = category
                category_changed = True
                logger.info(
                    f"[NLP Signal] Auto-assigned category '{category.name}' "
                    f"with confidence {result.category_confidence:.2f}"
                )
            except Category.DoesNotExist:
                logger.warning(
                    f"[NLP Signal] Category '{result.suggested_category}' not in DB"
                )

        meta_dict = result.to_dict()
        instance.nlp_meta = meta_dict

        update_fields = ["nlp_meta"]
        if result.is_urgent:
            update_fields.append("is_urgent")
        if category_changed:
            update_fields.append("category")

        instance.save(update_fields=list(dict.fromkeys(update_fields)))

        logger.info(f"[NLP Signal] Report #{instance.id} updated: {update_fields}")

    except Exception as e:
        logger.error(f"[NLP Signal] Error on Report #{instance.id}: {e}", exc_info=True)
