from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def require(path: str) -> str:
    target = ROOT / path
    if not target.is_file() or target.stat().st_size == 0:
        raise AssertionError(f"missing or empty: {path}")
    return target.read_text(encoding="utf-8")


def main() -> None:
    html = require("epasar.html")
    require("epasar-status.html")
    require("verifikasi-skpt.html")
    require("admin-epasar.html")
    rules = require("firestore.rules")
    require("firestore.indexes.json")
    require("js/epasar/image-compress.js")
    require("js/epasar/intake-service.js")
    require("js/epasar/skpt-document-service.js")
    markets = require("assets/data/markets.json")
    constants = require("js/epasar/constants.js")
    for number in range(1, 12):
        market_id = f"MKT-{number:03d}"
        assert market_id in markets, f"master pasar JSON tidak memuat {market_id}"
        assert market_id in constants, f"konstanta aplikasi tidak memuat {market_id}"

    for marker in ['data-step="1"', 'data-step="5"', 'name="nik"', 'id="businessList"', 'id="addBusiness"', 'id="locationWorkspace"', 'id="skptPlaceChoices"']:
        assert marker in html, f"form marker absent: {marker}"
    multi_entity = require("js/epasar/multi-entity-form.js")
    for marker in ['+ Tambah Lokasi Usaha', '+ Tambah Tempat di Pasar', 'PELATARAN', 'E.MARKETS']:
        assert marker in multi_entity, f"fitur entitas ganda/form pasar belum ditemukan: {marker}"
    assert '+ Tambah Usaha' in html, 'tombol tambah usaha belum ditemukan'
    js_source = "\n".join(path.read_text(encoding="utf-8") for path in (ROOT / "js/epasar").glob("*.js"))
    assert "firebase.storage" not in js_source
    assert "match /trader_intake/{id}" in rules
    assert "allow read, update, delete: if adminStaff();" in rules
    assert "dataBase64" in rules
    assert "publicToken" in rules
    assert not re.search(r"apiKey\s*:\s*['\"]", html)
    print("PASS e-PASAR static/UAT preflight")


if __name__ == "__main__":
    main()
