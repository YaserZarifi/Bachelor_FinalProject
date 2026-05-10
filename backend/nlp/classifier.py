# ==============================================================
# classifier.py
# طبقه‌بند یادگیری ماشین برای گزارش‌های شهری فارسی
# رویکرد: TF-IDF Vectorizer + LinearSVC (سریع و دقیق برای متن کوتاه)
# ==============================================================

from __future__ import annotations
import os
import re
import pickle
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# مسیر ذخیره مدل آموزش‌دیده
MODEL_DIR = Path(__file__).resolve().parent / "model_files"
MODEL_PATH = MODEL_DIR / "classifier.pkl"
VECTORIZER_PATH = MODEL_DIR / "vectorizer.pkl"

# ---------------------------------------------------------------
# پیش‌پردازش متن فارسی (بدون نیاز به hazm)
# ---------------------------------------------------------------

# نگاشت حروف عربی به فارسی
_ARABIC_TO_PERSIAN = str.maketrans("كيى", "کیی")

# کاراکترهای نادرست که باید حذف شوند
_CLEANUP_PATTERN = re.compile(r"[^\u0600-\u06FF\u0020-\u007E\u200c\u200d\s]")

# توقف‌واژه‌های فارسی رایج
STOPWORDS: set[str] = {
    "و", "در", "به", "از", "که", "این", "را", "با", "است",
    "های", "های", "برای", "یا", "اما", "هم", "تا", "بر",
    "آن", "ها", "می", "شود", "شده", "کرده", "کند", "دارد",
    "ما", "من", "او", "آنها", "خود", "هر", "یک", "دو",
    "نیز", "فقط", "باید", "بود", "داریم", "دارند", "شدن",
    "کردن", "بودن", "نه", "نمی", "نباید", "اگر", "چون",
    "لطفاً", "لطفا", "متشکرم", "ممنونم", "سلام", "خواهش",
}


def normalize_persian(text: str) -> str:
    """
    نرمال‌سازی متن فارسی:
    ۱. تبدیل ک و ی عربی به فارسی
    ۲. حذف کاراکترهای نامعتبر
    ۳. نرمال‌سازی فاصله‌ها
    ۴. حذف توقف‌واژه‌ها
    """
    # تبدیل حروف عربی
    text = text.translate(_ARABIC_TO_PERSIAN)
    # حذف کاراکترهای اضافی
    text = _CLEANUP_PATTERN.sub(" ", text)
    # نرمال‌سازی فاصله
    text = re.sub(r"\s+", " ", text).strip()
    # حذف توقف‌واژه‌ها
    tokens = [w for w in text.split() if w not in STOPWORDS and len(w) > 1]
    return " ".join(tokens)


# ---------------------------------------------------------------
# آموزش مدل
# ---------------------------------------------------------------

def train_model(save: bool = True) -> tuple:
    """
    مدل را روی داده‌های آموزشی train می‌کند و ذخیره می‌کند.

    Returns:
        (vectorizer, classifier, accuracy_score)
    """
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.svm import LinearSVC
    from sklearn.pipeline import Pipeline
    from sklearn.model_selection import cross_val_score
    from sklearn.preprocessing import LabelEncoder
    import numpy as np

    from .training_data import TRAINING_SAMPLES

    logger.info(f"[Classifier] Training on {len(TRAINING_SAMPLES)} samples...")

    # آماده‌سازی داده
    texts = [normalize_persian(text) for text, _ in TRAINING_SAMPLES]
    labels = [label for _, label in TRAINING_SAMPLES]

    # Vectorizer: char n-grams برای فارسی بهتر عمل می‌کنند
    vectorizer = TfidfVectorizer(
        analyzer="char_wb",
        ngram_range=(2, 4),        # bigram تا 4-gram کاراکتری
        max_features=15000,
        sublinear_tf=True,         # نرمال‌سازی TF لگاریتمی
        min_df=1,
    )

    # LinearSVC: سریع‌ترین و دقیق‌ترین برای متن کوتاه فارسی
    classifier = LinearSVC(
        C=1.5,
        max_iter=2000,
        class_weight="balanced",   # جبران عدم تعادل دسته‌ها
    )

    # Train
    X = vectorizer.fit_transform(texts)
    classifier.fit(X, labels)

    # Cross-validation برای ارزیابی
    pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(
            analyzer="char_wb",
            ngram_range=(2, 4),
            max_features=15000,
            sublinear_tf=True,
            min_df=1,
        )),
        ("clf", LinearSVC(C=1.5, max_iter=2000, class_weight="balanced")),
    ])
    cv_scores = cross_val_score(pipeline, texts, labels, cv=min(5, len(set(labels))), scoring="accuracy")
    accuracy = float(np.mean(cv_scores))

    logger.info(f"[Classifier] CV Accuracy: {accuracy:.3f} ± {np.std(cv_scores):.3f}")

    # ذخیره مدل
    if save:
        MODEL_DIR.mkdir(parents=True, exist_ok=True)
        with open(MODEL_PATH, "wb") as f:
            pickle.dump(classifier, f)
        with open(VECTORIZER_PATH, "wb") as f:
            pickle.dump(vectorizer, f)
        logger.info(f"[Classifier] Model saved to {MODEL_DIR}")

    return vectorizer, classifier, accuracy


# ---------------------------------------------------------------
# بارگذاری مدل
# ---------------------------------------------------------------

_vectorizer = None
_classifier = None


def _load_or_train() -> tuple:
    """مدل را بارگذاری می‌کند، اگر نبود آموزش می‌دهد."""
    global _vectorizer, _classifier

    if _vectorizer is not None and _classifier is not None:
        return _vectorizer, _classifier

    if MODEL_PATH.exists() and VECTORIZER_PATH.exists():
        logger.info("[Classifier] Loading saved model...")
        with open(MODEL_PATH, "rb") as f:
            _classifier = pickle.load(f)
        with open(VECTORIZER_PATH, "rb") as f:
            _vectorizer = pickle.load(f)
    else:
        logger.info("[Classifier] No saved model found — training from scratch...")
        _vectorizer, _classifier, acc = train_model(save=True)
        logger.info(f"[Classifier] Training complete. Accuracy: {acc:.3f}")

    return _vectorizer, _classifier


# ---------------------------------------------------------------
# پیش‌بینی
# ---------------------------------------------------------------

def predict_category(text: str) -> dict:
    """
    دسته‌بندی متن با مدل sklearn.

    Returns:
        {
            "category": str,
            "confidence": float,
            "all_scores": dict[str, float],
            "source": "sklearn"
        }
    """
    try:
        vectorizer, classifier = _load_or_train()

        normalized = normalize_persian(text)
        X = vectorizer.transform([normalized])

        predicted_label = classifier.predict(X)[0]

        # محاسبه فاصله از hyperplane برای تخمین اطمینان
        # LinearSVC decision_function مقادیر بزرگ‌تر = اطمینان بیشتر
        decision_scores = classifier.decision_function(X)[0]
        classes = classifier.classes_

        # تبدیل decision scores به احتمالات با softmax
        import numpy as np
        exp_scores = np.exp(decision_scores - np.max(decision_scores))
        probabilities = exp_scores / exp_scores.sum()

        all_scores = {
            cat: round(float(prob), 4)
            for cat, prob in zip(classes, probabilities)
        }

        confidence = all_scores.get(predicted_label, 0.0)

        # اگر اطمینان خیلی پایین باشد، fallback لازم است
        needs_fallback = confidence < 0.40

        return {
            "category": predicted_label if not needs_fallback else None,
            "confidence": confidence,
            "all_scores": all_scores,
            "source": "sklearn",
            "needs_ai_fallback": needs_fallback,
        }

    except Exception as e:
        logger.error(f"[Classifier] Prediction error: {e}", exc_info=True)
        return {
            "category": None,
            "confidence": 0.0,
            "all_scores": {},
            "source": "sklearn",
            "needs_ai_fallback": True,
        }


def retrain_with_new_data(new_samples: list[tuple[str, str]]) -> float:
    """
    مدل را با داده‌های جدید مجدداً آموزش می‌دهد.
    برای وقتی که مدیران دسته‌ها را تأیید/تصحیح می‌کنند.

    Args:
        new_samples: لیست (متن, دسته) جدید

    Returns:
        accuracy جدید
    """
    global _vectorizer, _classifier

    from .training_data import TRAINING_SAMPLES

    combined = TRAINING_SAMPLES + new_samples
    logger.info(
        f"[Classifier] Retraining with {len(combined)} total samples "
        f"({len(new_samples)} new)"
    )

    _vectorizer, _classifier, accuracy = train_model.__wrapped__(combined, save=True) \
        if hasattr(train_model, "__wrapped__") \
        else _retrain_internal(combined)

    return accuracy


def _retrain_internal(samples: list[tuple[str, str]]) -> float:
    """داخلی — train با لیست دلخواه."""
    global _vectorizer, _classifier

    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.svm import LinearSVC
    from sklearn.model_selection import cross_val_score
    from sklearn.pipeline import Pipeline
    import numpy as np

    texts = [normalize_persian(t) for t, _ in samples]
    labels = [l for _, l in samples]

    _vectorizer = TfidfVectorizer(
        analyzer="char_wb", ngram_range=(2, 4),
        max_features=15000, sublinear_tf=True, min_df=1,
    )
    _classifier = LinearSVC(C=1.5, max_iter=2000, class_weight="balanced")

    X = _vectorizer.fit_transform(texts)
    _classifier.fit(X, labels)

    # ذخیره
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(_classifier, f)
    with open(VECTORIZER_PATH, "wb") as f:
        pickle.dump(_vectorizer, f)

    # CV score
    pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4),
                                   max_features=15000, sublinear_tf=True)),
        ("clf", LinearSVC(C=1.5, max_iter=2000, class_weight="balanced")),
    ])
    cv_scores = cross_val_score(pipeline, texts, labels, cv=min(5, len(set(labels))))
    return float(np.mean(cv_scores))
