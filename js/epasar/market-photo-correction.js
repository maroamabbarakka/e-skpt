(function () {
  'use strict';
  const ALLOWED_TYPES = Object.freeze(['PROFILE', 'EVIDENCE', 'LOCATION']);
  const clean = (value, max = 500) => String(value || '').trim().slice(0, max);

  async function save({ claim, application, actor, mediaType, reason, file, previousMediaId = '' }) {
    if (!claim?.id || !claim.marketId || !claim.traderId) throw new Error('Relasi klaim foto tidak lengkap.');
    if (actor?.role !== 'MARKET_HEAD' || !(actor.marketIds || []).includes(claim.marketId)) throw new Error('Kepala Pasar tidak berwenang mengoreksi foto pada pasar ini.');
    if (application && application.status !== 'MARKET_VERIFICATION') throw new Error('Foto tidak dapat diganti setelah berkas memasuki telaah UPTD/Kadis. Kembalikan berkas ke verifikasi pasar terlebih dahulu.');
    if (!ALLOWED_TYPES.includes(mediaType)) throw new Error('Jenis foto koreksi tidak valid.');
    const correctionReason = clean(reason, 500);
    if (correctionReason.length < 10) throw new Error('Alasan koreksi foto minimal 10 karakter.');
    if (!file) throw new Error('Pilih foto pengganti.');
    const compressionType = mediaType === 'PROFILE' ? 'profile' : mediaType === 'LOCATION' ? 'location' : 'business';
    const result = await window.EPASAR_IMAGE.compressImage(file, compressionType);
    const reference = window.db.collection('trader_media').doc();
    await reference.set({
      ownerType: 'MARKET_CORRECTION', ownerId: claim.id, claimId: claim.id,
      applicationId: application?.id || claim.applicationId || '', traderId: claim.traderId,
      marketId: claim.marketId, mediaType, mime: result.mime, width: result.width, height: result.height,
      binaryBytes: result.binaryBytes, base64Bytes: result.base64Bytes, dataBase64: result.dataBase64,
      status: 'ACTIVE', previousMediaId: clean(previousMediaId, 160), reason: correctionReason,
      actorUid: actor.uid, actorRole: 'MARKET_HEAD', schemaVersion: 3,
      createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
    });
    return { id: reference.id, mediaType, previousMediaId: clean(previousMediaId, 160) };
  }

  window.EPASAR_MARKET_PHOTO_CORRECTION = { ALLOWED_TYPES, save };
}());
