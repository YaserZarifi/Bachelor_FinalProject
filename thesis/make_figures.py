# -*- coding: utf-8 -*-
"""
make_figures.py — تولید نمودارهای گزارش از روی معماری واقعی کد.

قاعده: برچسب‌های داخل نمودار انگلیسی‌اند (رندر فارسی در matplotlib شکننده است)؛
کپشن فارسی در خود گزارش زیر هر شکل می‌آید. خروجی PNG با ۳۰۰ DPI در thesis/figures/.

اجرا:  python thesis/make_figures.py
"""
import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch, Ellipse, Circle

HERE = os.path.dirname(os.path.abspath(__file__))
FIG = os.path.join(HERE, "figures")
os.makedirs(FIG, exist_ok=True)

# پالت
C_CLIENT = "#e0e7ff"; C_CLIENT_E = "#4f46e5"
C_API = "#dcfce7";    C_API_E = "#16a34a"
C_DATA = "#fef3c7";   C_DATA_E = "#d97706"
C_NLP = "#fae8ff";    C_NLP_E = "#a21caf"
C_GRAY = "#f1f5f9";   C_GRAY_E = "#475569"
INK = "#0f172a"


def box(ax, x, y, w, h, text, fc=C_GRAY, ec=C_GRAY_E, fs=10, bold=False, r=0.02):
    p = FancyBboxPatch((x, y), w, h, boxstyle=f"round,pad=0.01,rounding_size={r}",
                       linewidth=1.4, edgecolor=ec, facecolor=fc, mutation_aspect=1)
    ax.add_patch(p)
    ax.text(x + w / 2, y + h / 2, text, ha="center", va="center",
            fontsize=fs, color=INK, fontweight="bold" if bold else "normal", wrap=True)
    return (x + w / 2, y + h / 2)


def arrow(ax, xy1, xy2, text="", style="-|>", color=INK, ls="-", rad=0.0, fs=8, off=(0, 0)):
    a = FancyArrowPatch(xy1, xy2, arrowstyle=style, mutation_scale=14,
                        linewidth=1.2, color=color, linestyle=ls,
                        connectionstyle=f"arc3,rad={rad}")
    ax.add_patch(a)
    if text:
        mx = (xy1[0] + xy2[0]) / 2 + off[0]
        my = (xy1[1] + xy2[1]) / 2 + off[1]
        ax.text(mx, my, text, ha="center", va="center", fontsize=fs, color=color,
                bbox=dict(boxstyle="round,pad=0.15", fc="white", ec="none", alpha=0.85))


def save(fig, name):
    fig.savefig(os.path.join(FIG, name), dpi=300, bbox_inches="tight",
                facecolor="white", pad_inches=0.15)
    plt.close(fig)
    print("  ✔", name)


# ---------------------------------------------------------------------------
def fig_arch():
    fig, ax = plt.subplots(figsize=(9, 6.6)); ax.set_xlim(0, 100); ax.set_ylim(0, 100); ax.axis("off")
    ax.text(50, 97, "UrbanHelper — System Architecture", ha="center", fontsize=13, fontweight="bold", color=INK)
    # clients
    box(ax, 4, 80, 27, 12, "Citizen Web SPA\nReact 19 + Tailwind (RTL)\nIn-app Camera · IndexedDB", C_CLIENT, C_CLIENT_E, 9)
    box(ax, 36.5, 80, 27, 12, "Admin Dashboard\nReact 19 + MUI (RTL)\nLeaflet · Recharts", C_CLIENT, C_CLIENT_E, 9)
    box(ax, 69, 80, 27, 12, "Mobile App\nExpo SDK 54 (RN)\nCamera · Push · Offline", C_CLIENT, C_CLIENT_E, 9)
    # api box
    box(ax, 12, 40, 76, 26, "", C_API, C_API_E)
    ax.text(50, 62, "Django 6 + DRF + Channels (Daphne / ASGI)", ha="center", fontsize=10.5, fontweight="bold", color=INK)
    for i, (nm, dsc) in enumerate([("civic_api", "HTTP + WebSocket layer"),
                                    ("reports", "models · serializers"),
                                    ("nlp", "AI analysis"),
                                    ("pushnotify", "Expo push")]):
        box(ax, 15 + i * 18.5, 44, 16, 12, f"{nm}\n{dsc}", "white", C_API_E, 8)
    # data
    box(ax, 18, 12, 26, 13, "PostGIS 15\nSpatial DB (SRID 4326)\nGeoJSON", C_DATA, C_DATA_E, 9)
    box(ax, 56, 12, 26, 13, "Redis\ndb0: Celery + Channels\ndb1: Guest tokens", C_DATA, C_DATA_E, 9)
    # arrows clients -> api
    arrow(ax, (17.5, 80), (30, 66), "REST / WS", color=C_CLIENT_E, fs=8, off=(-4, 2))
    arrow(ax, (50, 80), (50, 66), "REST / WS", color=C_CLIENT_E, fs=8, off=(6, 0))
    arrow(ax, (82.5, 80), (70, 66), "REST/WS/Push", color=C_CLIENT_E, fs=8, off=(6, 2))
    # api -> data
    arrow(ax, (40, 40), (31, 25), "ORM / GIS", color=C_DATA_E, fs=8)
    arrow(ax, (62, 40), (69, 25), "cache / broker", color=C_DATA_E, fs=8)
    save(fig, "fig-arch.png")


def fig_deploy():
    fig, ax = plt.subplots(figsize=(9, 6)); ax.set_xlim(0, 100); ax.set_ylim(0, 100); ax.axis("off")
    ax.text(50, 96, "Deployment Architecture (docker-compose)", ha="center", fontsize=13, fontweight="bold", color=INK)
    box(ax, 6, 78, 26, 11, "frontend-citizen\nhost :3001 → 3000", C_CLIENT, C_CLIENT_E, 9)
    box(ax, 37, 78, 26, 11, "frontend-admin\nhost :3002 → 3000", C_CLIENT, C_CLIENT_E, 9)
    box(ax, 68, 78, 26, 11, "Expo dev client\n(LAN IP)", C_CLIENT, C_CLIENT_E, 9)
    box(ax, 28, 50, 44, 14, "backend (Daphne / ASGI)\nhost :8080 → 8000\npython:3.12-slim + GDAL", C_API, C_API_E, 10, bold=True)
    box(ax, 6, 50, 18, 14, "celery_worker\ncelery -A core", C_API, C_API_E, 9)
    box(ax, 20, 20, 30, 13, "db — PostGIS\npostgis/postgis:15-3.3\nhost :5433 → 5432", C_DATA, C_DATA_E, 9)
    box(ax, 58, 20, 26, 13, "redis :6379\nredis:7-alpine", C_DATA, C_DATA_E, 9)
    for x in (19, 50, 81):
        arrow(ax, (x, 78), (x if x != 81 else 72, 64), color=C_GRAY_E)
    arrow(ax, (45, 50), (35, 33), "psycopg2 / GIS", color=C_DATA_E, fs=8)
    arrow(ax, (55, 50), (68, 33), "channels / broker", color=C_DATA_E, fs=8)
    arrow(ax, (15, 50), (30, 33), color=C_DATA_E)
    arrow(ax, (15, 50), (60, 33), color=C_DATA_E, rad=-0.2)
    save(fig, "fig-deploy.png")


def fig_erd():
    fig, ax = plt.subplots(figsize=(9.2, 6.6)); ax.set_xlim(0, 100); ax.set_ylim(0, 100); ax.axis("off")
    ax.text(50, 97, "Entity–Relationship Diagram", ha="center", fontsize=13, fontweight="bold", color=INK)

    def entity(x, y, w, title, rows, fc=C_GRAY):
        h = 6 + len(rows) * 4.2
        box(ax, x, y - h, w, h, "", fc, C_GRAY_E)
        ax.text(x + w / 2, y - 4, title, ha="center", va="center", fontsize=9.5, fontweight="bold", color=INK)
        ax.plot([x, x + w], [y - 6, y - 6], color=C_GRAY_E, lw=1)
        for i, rr in enumerate(rows):
            ax.text(x + 1.5, y - 8.5 - i * 4.2, rr, ha="left", va="center", fontsize=7.4, color=INK)
        return (x, y, w, h)

    entity(6, 92, 26, "Category", ["PK id", "name", "description"], "#fff7ed")
    entity(6, 55, 26, "User (auth)", ["PK id", "username", "is_staff"], "#eef2ff")
    entity(37, 94, 30, "Report", ["PK id", "FK user →User", "FK category →Category",
                                    "FK nlp_suggested_category", "location: Point(4326)",
                                    "image_before / image_after", "status (6-state)",
                                    "is_urgent", "capture_source / captured_at",
                                    "gps_accuracy / integrity_hash", "nlp_meta (JSON)",
                                    "created_at / updated_at"], "#ecfdf5")
    entity(74, 84, 22, "PushDevice", ["PK id", "expo_token", "FK user", "platform", "is_active"], "#fdf4ff")
    entity(74, 44, 22, "ReportSubscription", ["PK id", "FK report", "FK device"], "#fdf4ff")

    arrow(ax, (37, 78), (32, 74), "0..*→1", style="-|>", color=C_CLIENT_E, fs=7)   # Report->Category
    arrow(ax, (37, 66), (32, 44), "0..*→1", style="-|>", color=C_CLIENT_E, fs=7)   # Report->User
    arrow(ax, (74, 40), (67, 60), "*→1", style="-|>", color=C_NLP_E, fs=7)         # Subscription->Report
    arrow(ax, (85, 44), (85, 66), "*→1", style="-|>", color=C_NLP_E, fs=7)         # Subscription->Device
    save(fig, "fig-erd.png")


def fig_state():
    fig, ax = plt.subplots(figsize=(11, 5.8)); ax.set_xlim(0, 100); ax.set_ylim(0, 100); ax.axis("off")
    ax.text(50, 96, "Report Lifecycle — State Machine", ha="center", fontsize=13, fontweight="bold", color=INK)
    order = ["SUBMITTED", "UNDER_REVIEW", "ASSIGNED", "IN_PROGRESS", "RESOLVED"]
    xs = [9, 28, 47, 66, 85]
    W, H, y = 15, 10, 58
    half = W / 2
    pos = {}
    for name, x in zip(order, xs):
        box(ax, x - half, y - H / 2, W, H, name, C_API, C_API_E, 8, bold=True)
        pos[name] = (x, y)
    box(ax, 85 - half, 24 - H / 2, W, H, "CLOSED", C_DATA, C_DATA_E, 8, bold=True)
    pos["CLOSED"] = (85, 24)
    # forward adjacent (straight, in gaps)
    for a, b in zip(order, order[1:]):
        (x1, y1), (x2, y2) = pos[a], pos[b]
        arrow(ax, (x1 + half, y1), (x2 - half, y2), color=C_API_E)
    # skip-forward (arc above), anchored at top edges
    for a, b in [("SUBMITTED", "ASSIGNED"), ("UNDER_REVIEW", "IN_PROGRESS")]:
        (x1, y1), (x2, y2) = pos[a], pos[b]
        arrow(ax, (x1 + 2, y1 + H / 2), (x2 - 2, y2 + H / 2), color=C_GRAY_E, rad=-0.5)
    # reverse (arc below), anchored at bottom edges
    for a, b in [("UNDER_REVIEW", "SUBMITTED"), ("ASSIGNED", "UNDER_REVIEW"),
                 ("IN_PROGRESS", "ASSIGNED"), ("RESOLVED", "IN_PROGRESS")]:
        (x1, y1), (x2, y2) = pos[a], pos[b]
        arrow(ax, (x1 - 2, y1 - H / 2), (x2 + 2, y2 - H / 2), color="#94a3b8", rad=-0.5)
    # RESOLVED -> CLOSED
    arrow(ax, (85, y - H / 2), (85, 24 + H / 2), color=C_API_E)
    ax.text(88.5, 41, "requires\nimage_after", fontsize=7.3, color=C_DATA_E, style="italic", ha="left")
    ax.text(50, 8, "Note: CLOSED is terminal. Several transitions are reversible; arcs above = skip-forward, arcs below = revert.",
            ha="center", fontsize=8, color=C_GRAY_E)
    save(fig, "fig-state.png")


def fig_nlp():
    fig, ax = plt.subplots(figsize=(9.6, 6.0)); ax.set_xlim(0, 100); ax.set_ylim(0, 100); ax.axis("off")
    ax.text(50, 96, "NLP Pipeline — analyze_report()", ha="center", fontsize=13, fontweight="bold", color=INK)
    # top row
    box(ax, 6, 78, 24, 11, "Report text\n(description)", C_GRAY, C_GRAY_E, 9)
    box(ax, 34, 78, 26, 11, "1) Crisis keywords\n(weighted, threshold=3)\n→ is_urgent", C_NLP, C_NLP_E, 8.3)
    box(ax, 68, 78, 28, 11, "2) sklearn classifier\nchar n-gram TF-IDF\n+ LinearSVC", C_NLP, C_NLP_E, 8.3)
    arrow(ax, (30, 83.5), (34, 83.5))
    arrow(ax, (60, 83.5), (68, 83.5))
    # decision diamond
    ax.add_patch(plt.Polygon([(82, 66), (94, 58), (82, 50), (70, 58)], closed=True,
                             fc="#fee2e2", ec="#dc2626", lw=1.4))
    ax.text(82, 58, "confidence\n< 0.40 ?", ha="center", va="center", fontsize=8, color=INK)
    arrow(ax, (82, 78), (82, 66), color=C_GRAY_E)
    # yes -> Gemini (left)
    box(ax, 40, 52, 26, 12, "3) Gemini fallback\n(gemini-1.5-flash)\nneeds GEMINI_API_KEY", C_NLP, C_NLP_E, 8.0)
    arrow(ax, (70, 58), (66, 58), "yes", color="#dc2626", fs=8, off=(0, 1.4))
    # no -> keep sklearn (straight down)
    box(ax, 69, 34, 26, 11, "keep sklearn\ncategory (source=sklearn)", C_GRAY, C_GRAY_E, 8.3)
    arrow(ax, (82, 50), (82, 45), "no", color=C_GRAY_E, fs=8, off=(3, 0))
    # sentiment (both feed in)
    box(ax, 30, 34, 30, 11, "4) Sentiment analysis\n(lexicon-based, fa)", C_NLP, C_NLP_E, 9)
    arrow(ax, (52, 52), (48, 45), color=C_GRAY_E)      # Gemini -> sentiment
    arrow(ax, (69, 39.5), (60, 39.5), color=C_GRAY_E)  # keep sklearn -> sentiment
    # result
    box(ax, 30, 14, 30, 11, "NLPResult →\nnlp_meta (JSON)\nnlp_suggested_category", C_API, C_API_E, 8.3)
    arrow(ax, (45, 34), (45, 25), color=C_GRAY_E)
    save(fig, "fig-nlp.png")


def fig_seq_ws():
    fig, ax = plt.subplots(figsize=(9.6, 6.2)); ax.set_xlim(0, 100); ax.set_ylim(0, 100); ax.axis("off")
    ax.text(50, 97, "Sequence — Status Change → Real-time Notification", ha="center", fontsize=12.5, fontweight="bold", color=INK)
    actors = [("Staff\n(Admin UI)", 10), ("ReportViewSet\n.transition", 30),
              ("post_save\nsignal", 52), ("Channel Layer\n+ Consumer", 72), ("Citizen\nclient", 90)]
    for name, x in actors:
        box(ax, x - 8, 84, 16, 9, name, C_CLIENT, C_CLIENT_E, 8, bold=True)
        ax.plot([x, x], [12, 84], color=C_GRAY_E, lw=1, ls="--")
    def msg(x1, x2, y, t, color=INK, dashed=False):
        arrow(ax, (x1, y), (x2, y), color=color, ls="--" if dashed else "-")
        ax.text((x1 + x2) / 2, y + 1.6, t, ha="center", fontsize=7.6, color=color)
    msg(10, 30, 76, "POST /transition/ (status, image_after)")
    msg(30, 30, 70, "validate ALLOWED_STATUS_TRANSITIONS")
    ax.text(30, 66, "RESOLVED ⇒ image_after required", ha="center", fontsize=7, color=C_DATA_E, style="italic")
    msg(30, 52, 60, "report.save()")
    msg(52, 72, 54, "broadcast_report_update → group report_{id}")
    msg(72, 90, 48, "WS event {status, is_urgent, updated_at}", C_CLIENT_E)
    # push branch
    msg(52, 52, 40, "if status changed → send_status_push.delay", "#a21caf")
    box(ax, 44, 26, 22, 9, "Celery worker\n→ Expo Push", C_NLP, C_NLP_E, 8)
    arrow(ax, (52, 40), (55, 35), color="#a21caf")
    arrow(ax, (66, 30), (90, 44), "Push notification", color="#a21caf", fs=7.5, rad=-0.2)
    save(fig, "fig-seq-ws.png")


def fig_usecase():
    fig, ax = plt.subplots(figsize=(9.2, 6.4)); ax.set_xlim(0, 100); ax.set_ylim(0, 100); ax.axis("off")
    ax.text(50, 97, "Use-Case Diagram", ha="center", fontsize=13, fontweight="bold", color=INK)

    def actor(x, y, label):
        ax.add_patch(Circle((x, y + 6), 2.2, fc="white", ec=INK, lw=1.4))
        ax.plot([x, x], [y + 4, y - 1], color=INK, lw=1.4)
        ax.plot([x - 3, x + 3], [y + 2, y + 2], color=INK, lw=1.4)
        ax.plot([x, x - 2.5], [y - 1, y - 5], color=INK, lw=1.4)
        ax.plot([x, x + 2.5], [y - 1, y - 5], color=INK, lw=1.4)
        ax.text(x, y - 8, label, ha="center", fontsize=8.5, fontweight="bold", color=INK)

    actor(9, 72, "Guest\nCitizen")
    actor(9, 34, "Registered\nCitizen")
    actor(91, 55, "Staff /\nManager")

    ucs = {
        "Submit Report": (42, 82), "Track Status": (42, 68),
        "Receive Notification": (42, 54), "Login / Register": (42, 40),
        "View Map Dashboard": (60, 82), "Filter / Search": (60, 68),
        "Change Status": (60, 54), "Auto-categorize (NLP)": (51, 26),
    }
    for name, (x, y) in ucs.items():
        ax.add_patch(Ellipse((x, y), 26, 9, fc=C_API, ec=C_API_E, lw=1.3))
        ax.text(x, y, name, ha="center", va="center", fontsize=7.8, color=INK)

    def link(ax_x, ax_y, uc):
        x, y = ucs[uc]
        ax.plot([ax_x, x - 12 if x < 50 else x - 12], [ax_y, y], color=C_GRAY_E, lw=0.9)

    for uc in ["Submit Report", "Track Status", "Receive Notification"]:
        ax.plot([12, ucs[uc][0] - 13], [72, ucs[uc][1]], color=C_GRAY_E, lw=0.9)
    for uc in ["Submit Report", "Track Status", "Receive Notification", "Login / Register"]:
        ax.plot([12, ucs[uc][0] - 13], [34, ucs[uc][1]], color=C_GRAY_E, lw=0.9)
    for uc in ["View Map Dashboard", "Filter / Search", "Change Status"]:
        ax.plot([88, ucs[uc][0] + 13], [55, ucs[uc][1]], color=C_GRAY_E, lw=0.9)
    # system use case (NLP) dashed «include» from Submit
    arrow(ax, (42, 78), (48, 30), "«include»", color=C_NLP_E, ls="--", fs=7, rad=-0.2)
    save(fig, "fig-usecase.png")


if __name__ == "__main__":
    print("Generating figures →", FIG)
    fig_arch(); fig_deploy(); fig_erd(); fig_state(); fig_nlp(); fig_seq_ws(); fig_usecase()
    print("Done.")
