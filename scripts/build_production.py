from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
EXCLUDED_DIRS = {".git", ".firebase", "dist", "node_modules", "scripts", "tests", "artifacts", "EPASAR_SATU_DATA_DEVELOPER_PACK_V1"}
EXCLUDED_SUFFIXES = {".md", ".py", ".log"}
EXCLUDED_FILES = {"firebase.json", "firestore.rules", "firestore.indexes.json", "playwright.config.js", "Perda 2024 - Pengelolaan Pasar Rakyat.pdf"}
EXCLUDED_ASSETS = {
    "Alur Verifikasi Pasar.mp4",
    "Mengenal e-SKPT.mp4",
    "Panduan Pendataan Pedagang.mp4",
    "pasar-pinrang-editorial.png",
    "pedagang-contoh-transparan.png",
}


def copy_sources() -> None:
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True)
    for source in ROOT.iterdir():
        if source.name in EXCLUDED_DIRS or source.name.startswith("."):
            continue
        if source.name in EXCLUDED_FILES:
            continue
        if source.is_file() and source.suffix.lower() in EXCLUDED_SUFFIXES:
            continue
        target = DIST / source.name
        if source.is_dir():
            shutil.copytree(source, target, ignore=shutil.ignore_patterns('node_modules', '__pycache__', '.pytest_cache', 'panduan-pendataan.mp4', *EXCLUDED_ASSETS))
        else:
            shutil.copy2(source, target)


def validate() -> None:
    required = [
        "index.html",
        "panduan.html",
        "epasar.html",
        "epasar-status.html",
        "verifikasi-skpt.html",
        "verifikasi-unit.html",
        "admin-epasar.html",
        "admin-intake-review.html",
        "login.html",
        "admin-akun.html",
        "profil.html",
        "demo-training.html",
        "market-verification.html",
        "annual-validation.html",
        "occupancy-change.html",
        "kadis-approval.html",
        "skpt-pdf.html",
        "skpt-statement.html",
        "trader-card.html",
        "photo-editor.html",
        "skpt-application-letter.html",
        "css/epasar.css",
        "css/official-documents.css",
        "css/skpt-compact.css",
        "css/skpt-print-fix.css",
        "css/document-polish.css",
        "css/photo-documents.css",
        "css/header-logo-fix.css",
        "css/photo-editor.css",
        "css/intake-review.css",
        "css/annual-validation.css",
        "css/portal-reference.css",
        "css/portal-complete.css",
        "assets/guilloche-border.svg",
        "assets/models/selfie_segmenter_float16_2023-05-07.tflite",
        "assets/videos/panduan-pendataan-web.mp4",
        "assets/videos/alur-verifikasi.mp4",
        "assets/videos/mengenal-skpt.mp4",
        "js/epasar/trader-form.js",
        "js/epasar/image-compress.js",
        "js/epasar/intake-service.js",
        "js/epasar/skpt-document-service.js",
        "js/epasar/auth-service.js",
        "js/epasar/admin-accounts.js",
        "js/epasar/profile.js",
        "js/epasar/workflow-service.js",
        "js/epasar/market-workspace-service.js",
        "js/epasar/public-unit-verification.js",
        "js/epasar/skpt-pdf.js",
        "js/epasar/skpt-statement.js",
        "js/epasar/trader-card.js",
        "js/epasar/background-remove.js",
        "js/epasar/photo-editor.js",
        "js/epasar/admin-intake-review.js",
        "js/epasar/annual-validation-service.js",
        "js/epasar/annual-validation.js",
        "js/epasar/occupancy-change-service.js",
        "js/epasar/occupancy-change.js",
        "js/epasar/portal.js",
        "database-pedagang.html",
        "css/database-pedagang.css",
        "js/epasar/database-pedagang.js",
    ]
    missing = [path for path in required if not (DIST / path).is_file() or (DIST / path).stat().st_size == 0]
    if missing:
        raise RuntimeError(f"Output build tidak lengkap: {', '.join(missing)}")
    forbidden = [DIST / "EPASAR_SATU_DATA_DEVELOPER_PACK_V1", DIST / "scripts", DIST / ".git"]
    leaked = [str(path.relative_to(DIST)) for path in forbidden if path.exists()]
    if leaked:
        raise RuntimeError(f"Artefak internal masuk build: {', '.join(leaked)}")


if __name__ == "__main__":
    copy_sources()
    validate()
    print(f"Build lokal selesai: {DIST}")
