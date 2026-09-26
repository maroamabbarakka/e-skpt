# FOTO BASE64, KOMPRESI, DAN BUDGET FIREBASE SPARK

## Kebijakan
Tetap Spark. Tidak memakai Firebase Storage/Cloud Functions.

Pipeline:
`Input foto -> resize -> WebP -> compress -> Base64 -> Firestore trader_media`

## Target ukuran

### Profil
- max 640×800 atau sisi panjang 800px;
- WebP quality awal 0.70;
- target binary 25–45 KB;
- hard cap 55 KB.

### Lokasi
- max sisi panjang 1024px;
- quality 0.65–0.70;
- target binary 45–70 KB;
- hard cap 85 KB.

### Thumbnail
- 240–320px;
- target 6–12 KB.

Jika terlalu besar: turunkan quality → resize lagi → bila tetap gagal, minta foto lain.

## Pseudocode
```js
async function compressImage(file,{maxW,maxH,maxBytes}) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1,maxW/bitmap.width,maxH/bitmap.height);
  const w = Math.round(bitmap.width*scale);
  const h = Math.round(bitmap.height*scale);

  const canvas = document.createElement('canvas');
  canvas.width=w; canvas.height=h;
  canvas.getContext('2d',{alpha:false}).drawImage(bitmap,0,0,w,h);

  let quality=.72, blob;
  while (quality >= .45) {
    blob = await new Promise(r=>canvas.toBlob(r,'image/webp',quality));
    if (blob && blob.size <= maxBytes) break;
    quality -= .07;
  }
  if (!blob || blob.size > maxBytes) throw new Error('Foto masih terlalu besar.');
  return blob;
}
```

Simpan `mime` terpisah; prefix `data:image/webp;base64,` tidak wajib disimpan.

## Budget 2.000 pedagang
Contoh konservatif:
- profile Base64 ±55 KB;
- meta/text ±8 KB;
- foto lokasi ±90 KB bila semua memakai.

Jika 2.000 semuanya punya dua foto ≈ 306 MB payload sebelum overhead/index.

Target:
- ideal media e-Pasar <300 MB;
- hard budget e-Pasar <450 MB;
- sisakan ruang karena 1 GiB adalah total project Firestore, bukan khusus e-Pasar.

Sebelum go-live, catat storage Firestore saat ini di console.

## Query discipline
DILARANG load seluruh `trader_media`.

List hanya membaca `traders`.
Foto lazy-load pada detail/modal.

## Dokumen
Satu foto = satu document media.
Jangan gabungkan banyak Base64 dalam satu dokumen.

## KTP
Simpan hanya bila benar-benar perlu, collection privat, tidak ditampilkan/list, dan tetapkan retensi.

## PDF SKPT
Jangan Base64-kan PDF TTE ke Firestore. Simpan metadata/hash/reference URL resmi.

## Monitoring
Simpan agregat:
- jumlah media;
- total `base64Bytes`;
- average bytes;
- budget percentage.

Jangan menghitung budget dengan membaca seluruh Base64 setiap kali.
