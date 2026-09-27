(function () {
  "use strict";
  const E = window.EPASAR,
    uid = (p) =>
      `${p}-${crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10)}`;
  let businesses = [];
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  function business() {
    return {
      id: uid("BUS"),
      name: "",
      type: "",
      group: "",
      category: "",
      monthlyRevenue: 0,
      workerCount: 0,
      expense: "",
      locations: [],
    };
  }
  function location() {
    return {
      id: uid("LOC"),
      type: "GENERAL",
      district: "",
      village: "",
      address: "",
      marketPlaces: [],
    };
  }
  function place() {
    return {
      id: uid("PLC"),
      marketId: "",
      marketName: "",
      unitType: "",
      unitNumber: "",
      block: "",
      floor: "",
      areaM2: null,
      locationHint: "",
      applySkpt: false,
    };
  }
  function districtOptions(value) {
    return `<option value="">Pilih kecamatan</option>${E.DISTRICTS.map((name) => `<option value="${esc(name)}" ${name === value ? "selected" : ""}>${esc(name)}</option>`).join("")}`;
  }
  function villageOptions(district, value) {
    return `<option value="">${district ? "Pilih desa/kelurahan" : "Pilih kecamatan terlebih dahulu"}</option>${E.villagesByDistrict(
      district,
    )
      .map(
        (name) =>
          `<option value="${esc(name)}" ${name === value ? "selected" : ""}>${esc(name)}</option>`,
      )
      .join("")}`;
  }
  const groups =
      '<option value="">Pilih kelompok</option><option>Bahan pangan basah</option><option>Bahan pangan kering</option><option>Konveksi dan sandang</option><option>Perlengkapan rumah tangga</option><option>Kuliner dan makanan siap saji</option><option>Lainnya</option>',
    types =
      '<option value="">Pilih bentuk kegiatan</option>' +
      E.BUSINESS_TYPES.map((x) => `<option>${esc(x)}</option>`).join(""),
    markets =
      '<option value="">Pilih pasar</option>' +
      E.MARKETS.map(
        (x) => `<option value="${esc(x.id)}">${esc(x.name)}</option>`,
      ).join("");
  function money(v) {
    return Number(v || 0).toLocaleString("id-ID");
  }
  function sync() {
    document.querySelectorAll("[data-bind]").forEach((el) => {
      el.oninput = () => {
        const [bi, kind, li, pi, key] = el.dataset.bind.split("|");
        const b = businesses[+bi];
        let target = b;
        if (kind === "l") target = b.locations[+li];
        if (kind === "p") target = b.locations[+li].marketPlaces[+pi];
        let value = el.type === "checkbox" ? el.checked : el.value;
        if (key === "monthlyRevenue") {
          value = Number(String(value).replace(/\D/g, "")) || 0;
          el.value = money(value);
        }
        if (["workerCount", "areaM2"].includes(key))
          value = value === "" ? null : Number(value);
        target[key] = value;
        if (key === "district") target.village = "";
        if (key === "marketId")
          target.marketName = E.MARKETS.find((x) => x.id === value)?.name || "";
        if (["type", "district", "marketId", "applySkpt"].includes(key))
          render();
        else document.dispatchEvent(new CustomEvent("epasar:entities-changed"));
      };
    });
  }
  function renderBusinesses() {
    document.getElementById("businessList").innerHTML = businesses
      .map(
        (b, i) =>
          `<article class="entity-card"><header><strong>Usaha ${i + 1}</strong>${businesses.length > 1 ? `<button type="button" data-remove-business="${i}">Hapus</button>` : ""}</header><label>Nama usaha <span class="optional">(opsional)</span><input data-bind="${i}|b|||name" value="${esc(b.name)}" maxlength="120"></label><label>Bentuk kegiatan<select required data-bind="${i}|b|||type">${types}</select></label><label>Kelompok jualan<select required data-bind="${i}|b|||group">${groups}</select></label><label>Jenis dagangan/produk utama<input required data-bind="${i}|b|||category" value="${esc(b.category)}" maxlength="120"></label><div class="two-col"><label>Perkiraan Omzet Usaha per Bulan<input class="rupiah-input" data-bind="${i}|b|||monthlyRevenue" inputmode="numeric" value="${money(b.monthlyRevenue)}"><small>Isi perkiraan pendapatan kotor per bulan dalam Rupiah.</small></label><label>Jumlah tenaga kerja<input data-bind="${i}|b|||workerCount" type="number" min="0" max="10000" value="${b.workerCount || ""}"></label></div><label>Pengeluaran utama <span class="optional">(opsional)</span><input data-bind="${i}|b|||expense" value="${esc(b.expense)}" maxlength="160"></label></article>`,
      )
      .join("");
    businesses.forEach((b, i) => {
      const c = document.querySelector(`[data-bind="${i}|b|||type"]`);
      if (c) c.value = b.type;
      const g = document.querySelector(`[data-bind="${i}|b|||group"]`);
      if (g) g.value = b.group;
    });
    document.querySelectorAll("[data-remove-business]").forEach(
      (x) =>
        (x.onclick = () => {
          businesses.splice(+x.dataset.removeBusiness, 1);
          render();
        }),
    );
    sync();
  }
  function renderLocations() {
    document.getElementById("locationWorkspace").innerHTML = businesses
      .map(
        (b, bi) =>
          `<article class="entity-card"><header><strong>${esc(b.name || `Usaha ${bi + 1}`)}</strong><button type="button" data-add-location="${bi}">+ Tambah Lokasi Usaha</button></header>${b.locations.map((l, li) => `<section class="nested-card"><header><b>Lokasi ${li + 1}</b><button type="button" data-remove-location="${bi}|${li}">Hapus</button></header><label>Jenis lokasi<select data-bind="${bi}|l|${li}||type"><option value="GENERAL">Lokasi umum/non-pasar</option><option value="MARKET">Pasar yang dikelola Disperindag</option></select></label><div class="two-col"><label>Kecamatan<select required data-bind="${bi}|l|${li}||district">${districtOptions(l.district)}</select></label><label>Desa/Kelurahan<select required data-bind="${bi}|l|${li}||village" ${l.district ? "" : "disabled"}>${villageOptions(l.district, l.village)}</select></label></div><label>Alamat/petunjuk lokasi<textarea required data-bind="${bi}|l|${li}||address" maxlength="300">${esc(l.address)}</textarea></label>${l.type === "MARKET" ? `<div class="place-list">${l.marketPlaces.map((p, pi) => placeHtml(p, bi, li, pi)).join("")}</div><button class="button add-entity" type="button" data-add-place="${bi}|${li}">+ Tambah Tempat di Pasar</button><p class="notice">Nomor tempat adalah <b>klaim awal</b> dan belum resmi sebelum diverifikasi Kepala Pasar.</p>` : ""}</section>`).join("")}</article>`,
      )
      .join("");
    businesses.forEach((b, bi) =>
      b.locations.forEach((l, li) => {
        const s = document.querySelector(`[data-bind="${bi}|l|${li}||type"]`);
        if (s) s.value = l.type;
        l.marketPlaces.forEach((p, pi) => {
          const m = document.querySelector(
            `[data-bind="${bi}|p|${li}|${pi}|marketId"]`,
          );
          if (m) m.value = p.marketId;
        });
      }),
    );
    document.querySelectorAll("[data-add-location]").forEach(
      (x) =>
        (x.onclick = () => {
          businesses[+x.dataset.addLocation].locations.push(location());
          render();
        }),
    );
    document.querySelectorAll("[data-remove-location]").forEach(
      (x) =>
        (x.onclick = () => {
          const [a, b] = x.dataset.removeLocation.split("|").map(Number);
          businesses[a].locations.splice(b, 1);
          render();
        }),
    );
    document.querySelectorAll("[data-add-place]").forEach(
      (x) =>
        (x.onclick = () => {
          const [a, b] = x.dataset.addPlace.split("|").map(Number);
          businesses[a].locations[b].marketPlaces.push(place());
          render();
        }),
    );
    document.querySelectorAll("[data-remove-place]").forEach(
      (x) =>
        (x.onclick = () => {
      const [a, b, c] = x.dataset.removePlace.split("|").map(Number);
          businesses[a].locations[b].marketPlaces.splice(c, 1);
          render();
        }),
    );
    document.querySelectorAll("[data-unit-type]").forEach(
      (x) =>
        (x.onclick = () => {
          const [a, b, c, type] = x.dataset.unitType.split("|");
          businesses[+a].locations[+b].marketPlaces[+c].unitType = type;
          render();
        }),
    );
    sync();
  }
  function placeHtml(p, bi, li, pi) {
    return `<article class="market-place"><header><b>Tempat pasar ${pi + 1}</b><button type="button" data-remove-place="${bi}|${li}|${pi}">Hapus</button></header><label>Nama pasar<select required data-bind="${bi}|p|${li}|${pi}|marketId">${markets}</select></label><fieldset class="unit-type-picker"><legend>Jenis tempat yang digunakan</legend><select class="visually-hidden" aria-label="Jenis tempat" data-bind="${bi}|p|${li}|${pi}|unitType"><option value="">Pilih</option><option value="KIOS">Kios</option><option value="LOS">Los</option><option value="LAPAK">Lapak</option><option value="PELATARAN">Pelataran</option></select><div>${["KIOS", "LOS", "LAPAK", "PELATARAN"].map((type) => `<button class="${p.unitType === type ? "is-selected" : ""}" type="button" data-unit-type="${bi}|${li}|${pi}|${type}"><span>${{ KIOS: "▣", LOS: "▤", LAPAK: "◫", PELATARAN: "⌑" }[type]}</span>${type[0] + type.slice(1).toLowerCase()}</button>`).join("")}</div></fieldset><div class="two-col"><label>Nomor/label<input required data-bind="${bi}|p|${li}|${pi}|unitNumber" value="${esc(p.unitNumber)}" maxlength="50"></label><label>Luas bila diketahui (m²)<input data-bind="${bi}|p|${li}|${pi}|areaM2" type="number" min="0" max="10000" step=".01" value="${p.areaM2 ?? ""}"></label></div><div class="two-col"><label>Blok<input data-bind="${bi}|p|${li}|${pi}|block" value="${esc(p.block)}"></label><label>Lantai<input data-bind="${bi}|p|${li}|${pi}|floor" value="${esc(p.floor)}"></label></div><label>Petunjuk lokasi<textarea data-bind="${bi}|p|${li}|${pi}|locationHint">${esc(p.locationHint)}</textarea></label></article>`;
  }
  function places() {
    return businesses.flatMap((b, bi) =>
      b.locations.flatMap((l, li) =>
        l.marketPlaces.map((p, pi) => ({ p, b, bi, li, pi })),
      ),
    );
  }
  function renderSkpt() {
    const rows = places();
    document.getElementById("skptPlaceChoices").innerHTML = rows.length
      ? rows
          .map(
            ({ p, b, bi, li, pi }) =>
              `<label class="choice skpt-place"><input type="checkbox" data-bind="${bi}|p|${li}|${pi}|applySkpt" ${p.applySkpt ? "checked" : ""}><span><strong>${esc(p.marketName || "Pasar belum dipilih")} — ${esc(p.unitType || "Tempat")} ${esc(p.unitNumber || "")}</strong><small>${esc(b.name || `Usaha ${bi + 1}`)} · Buat permohonan SKPT terpisah</small></span></label>`,
          )
          .join("")
      : '<p class="notice">Tidak ada tempat pasar. Pendataan tetap dapat dikirim tanpa pengajuan SKPT.</p>';
    document.getElementById("skptOnlyAttachments").hidden = !rows.some(
      (x) => x.p.applySkpt,
    );
    sync();
  }
  function render() {
    renderBusinesses();
    renderLocations();
    renderSkpt();
    document.dispatchEvent(new CustomEvent("epasar:entities-changed"));
  }
  function validate(step) {
    if (step === 2) {
      if (!businesses.length) return "Isi minimal satu usaha.";
      if (businesses.some((b) => !b.type || !b.group || !b.category))
        return "Lengkapi bentuk kegiatan, kelompok jualan, dan produk utama pada setiap usaha.";
    }
    if (step === 3) {
      if (businesses.some((b) => !b.locations.length))
        return "Setiap usaha harus memiliki minimal satu lokasi.";
      for (const b of businesses)
        for (const l of b.locations) {
          if (!l.district || !l.village || !l.address)
            return "Lengkapi alamat setiap lokasi usaha.";
          if (l.type === "MARKET") {
            if (!l.marketPlaces.length)
              return "Tambahkan minimal satu tempat pada lokasi pasar.";
            const incomplete = l.marketPlaces.find(
              (p) => !p.marketId || !p.unitType || !p.unitNumber,
            );
            if (incomplete) {
              if (!incomplete.unitType) {
                const field = document.querySelector(
                  `[data-bind="${b.locations.indexOf(l)}|p"]`,
                );
                const picker = [
                  ...document.querySelectorAll(".unit-type-picker"),
                ].find((x) => x.querySelector("select")?.value === "");
                picker?.classList.add("is-invalid");
                picker?.querySelector("button")?.focus({ preventScroll: true });
              }
              return "Lengkapi pasar, jenis tempat, dan nomor pada setiap tempat pasar.";
            }
          }
        }
    }
    return "";
  }
  function restore(v) {
    if (Array.isArray(v) && v.length) businesses = v;
    else {
      const b = business();
      b.locations.push(location());
      businesses = [b];
    }
    render();
  }
  document.getElementById("addBusiness").onclick = () => {
    if (businesses.length < 5) {
      const b = business();
      b.locations.push(location());
      businesses.push(b);
      render();
    }
  };
  restore();
  window.EPASAR_MULTI = {
    collect: () => structuredClone(businesses),
    restore,
    validate,
    places: () => places().map((x) => x.p),
    render,
  };
})();
