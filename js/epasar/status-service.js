(function () {
  'use strict';

  async function lookup(rawCode, rawToken) {
    if (!window.db) {
      throw new Error('Layanan status belum terhubung ke database. Silakan muat ulang halaman.');
    }
    const code = (rawCode || '').trim();
    const token = (rawToken || '').trim();

    if (!code && !token) {
      throw new Error('Nomor registrasi dan token akses pribadi wajib diisi.');
    }

    // 1. Coba pencarian di public_status (Pendaftaran Baru)
    if (token) {
      try {
        const snap = await window.db.collection('public_status').doc(token).get();
        if (snap.exists) {
          const data = snap.data();
          if (!code || data.registrationCode === code || String(data.registrationCode || '').toLowerCase() === code.toLowerCase()) {
            return data;
          }
        }
      } catch (err) {
        console.warn('[status-service] public_status query info:', err.message);
      }
    }

    // 2. Coba pencarian di public_skpt_verification (Dokumen e-SKPT Resmi)
    // Mendukung pemohon / masyarakat yang mengecek dokumen SKPT yang sudah terbit menggunakan token atau nomor SKPT
    const candidateTokens = [token, code].filter(t => t && t.length >= 20);
    for (const candToken of candidateTokens) {
      try {
        const docSnap = await window.db.collection('public_skpt_verification').doc(candToken).get();
        if (docSnap.exists) {
          const docData = docSnap.data();
          if (docData && docData.status === 'ISSUED') {
            const s = docData.documentSnapshot || {};
            return {
              type: 'SKPT_DOCUMENT',
              status: 'ISSUED',
              registrationCode: docData.number || code,
              number: docData.number,
              displayName: docData.displayName || s.displayName,
              businessType: s.businessType,
              marketName: s.marketName,
              claimedUnitType: s.unitType,
              claimedUnitNumber: s.unitNumber,
              verificationToken: docData.verificationToken || candToken,
              issueDate: docData.issueDate,
              validUntil: docData.validUntil,
              documentHash: docData.documentHash,
              tteStatus: docData.tteStatus,
              reviewMessage: `Surat Keterangan Pemakaian Tempat (SKPT) telah resmi disahkan dan diterbitkan untuk ${s.displayName || docData.displayName || 'Pedagang'} di ${s.marketName || 'Pasar'} (${s.unitType || ''} ${s.unitNumber || ''}).`
            };
          }
        }
      } catch (err) {
        console.warn('[status-service] public_skpt_verification check info:', err.message);
      }
    }

    throw new Error('Data status pendaftaran atau dokumen e-SKPT tidak ditemukan. Pastikan Nomor Registrasi dan Token Akses dimasukkan dengan benar.');
  }

  window.EPASAR_STATUS = { lookup };
}());
