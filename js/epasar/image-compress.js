(function () {
  "use strict";
  const D = {
    profile: {
      maxSide: 800,
      targetBytes: 45000,
      maxBytes: 55000,
      quality: 0.72,
    },
    identity: {
      maxSide: 1024,
      targetBytes: 70000,
      maxBytes: 85000,
      quality: 0.72,
    },
    business: {
      maxSide: 1024,
      targetBytes: 70000,
      maxBytes: 85000,
      quality: 0.68,
    },
    location: {
      maxSide: 1024,
      targetBytes: 70000,
      maxBytes: 85000,
      quality: 0.68,
    },
    thumbnail: {
      maxSide: 320,
      targetBytes: 12000,
      maxBytes: 16000,
      quality: 0.68,
    },
  };
  function imageElement(file) {
    return new Promise((ok, no) => {
      const u = URL.createObjectURL(file),
        i = new Image(),
        timer = setTimeout(() => {
          URL.revokeObjectURL(u);
          no(
            new Error(
              "Foto terlalu lama untuk diproses. Coba gunakan foto lain.",
            ),
          );
        }, 10000);
      i.onload = () => {
        clearTimeout(timer);
        URL.revokeObjectURL(u);
        ok({ bitmap: i, width: i.naturalWidth, height: i.naturalHeight });
      };
      i.onerror = () => {
        clearTimeout(timer);
        URL.revokeObjectURL(u);
        no(new Error("Foto tidak dapat dibaca."));
      };
      i.src = u;
    });
  }
  function source(file) {
    if (!file || !String(file.type).startsWith("image/"))
      return Promise.reject(new Error("Pilih file gambar yang valid."));
    if (file.size > 12 * 1024 * 1024)
      return Promise.reject(new Error("Foto asli maksimal 12 MB."));
    if (typeof createImageBitmap !== "function") return imageElement(file);
    const fallback = imageElement(file);
    const bitmap = createImageBitmap(file).then((b) => ({
      bitmap: b,
      width: b.width,
      height: b.height,
    }));
    return Promise.race([
      bitmap,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("bitmap-timeout")), 5000),
      ),
    ]).catch(() => fallback);
  }
  function blob(canvas, q) {
    return new Promise((ok, no) => {
      let done = false;
      const timer = setTimeout(() => {
        if (!done) {
          done = true;
          no(
            new Error(
              "Konversi WebP terlalu lama. Coba gunakan browser terbaru atau foto lain.",
            ),
          );
        }
      }, 8000);
      canvas.toBlob(
        (b) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          b ? ok(b) : no(new Error("Browser tidak mendukung WebP."));
        },
        "image/webp",
        q,
      );
    });
  }
  function b64(b) {
    return new Promise((ok, no) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result).split(",")[1] || "");
      r.onerror = () => no(new Error("Foto gagal dikonversi."));
      r.readAsDataURL(b);
    });
  }
  async function compressImage(file, type) {
    const c = { ...D[type || "profile"] },
      s = await source(file),
      scale = Math.min(1, c.maxSide / s.width, c.maxSide / s.height),
      w = Math.max(1, Math.round(s.width * scale)),
      h = Math.max(1, Math.round(s.height * scale)),
      canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const x = canvas.getContext("2d", { alpha: false });
    x.fillStyle = "#fff";
    x.fillRect(0, 0, w, h);
    x.drawImage(s.bitmap, 0, 0, w, h);
    if (s.bitmap.close) s.bitmap.close();
    let q = c.quality,
      out = null;
    while (q >= 0.42) {
      out = await blob(canvas, q);
      if (out.size <= c.targetBytes || out.size <= c.maxBytes) break;
      q -= 0.06;
    }
    if (!out || out.size > c.maxBytes)
      throw new Error(
        `Foto masih terlalu besar (batas ${Math.round(c.maxBytes / 1024)} KB).`,
      );
    const dataBase64 = await b64(out);
    return {
      mime: "image/webp",
      width: w,
      height: h,
      binaryBytes: out.size,
      base64Bytes: dataBase64.length,
      dataBase64,
      sourceName: file.name || "photo",
      compression: { type: type || "profile", quality: Number(q.toFixed(2)) },
    };
  }
  window.EPASAR_IMAGE = { compressImage, blobToBase64: b64, limits: D };
})();
