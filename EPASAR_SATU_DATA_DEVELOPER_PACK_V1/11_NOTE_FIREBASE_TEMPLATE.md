# TEMPLATE NOTE FIREBASE — LOKAL SAJA

Buat salinan:
`NOTE_FIREBASE_LOCAL.md`

Tambahkan ke `.gitignore`.

## Web Config
```text
projectId:
authDomain:
apiKey:
appId:
messagingSenderId:
hostingSite:
```

## Konfirmasi
```text
Project Firebase:
Hosting site:
Firestore database:
Paket: SPARK
Tanggal:
Dikonfirmasi oleh:
```

## Jangan pernah commit
- password Google/Firebase;
- service account JSON;
- private key;
- refresh/access token;
- OAuth client secret;
- credential TTE;
- PIN pejabat;
- WhatsApp API secret;
- SMTP password.

Jika secret pernah masuk Git, anggap bocor dan rotasi.

## Baseline repo saat paket ini dibuat
`.firebaserc` menunjuk `disperindagesdm-pinrang`.

Cocokkan dengan note dari pemilik sebelum mengubah binding.

## Policy
- Firebase Hosting: YA
- Firestore: YA
- Auth internal: YA
- Firebase Storage: TIDAK
- Cloud Functions: TIDAK
- Upgrade billing: TIDAK
- Foto: Firestore Base64 terkompresi
- PDF/TTE: metadata/hash/reference URL resmi
