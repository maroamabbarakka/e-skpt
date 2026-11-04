import { Readable } from 'node:stream';
import { drive_v3, auth } from '@googleapis/drive';
import { requirePdf, storageDescriptor } from './core.js';

function driveClient() {
  const googleAuth = new auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/drive.file'] });
  return new drive_v3.Drive({ auth: googleAuth });
}

export async function uploadAndVerifyPdf({ buffer, mimeType, fileName, folderId, revision }) {
  const local = requirePdf(buffer, mimeType);
  const drive = driveClient();
  const created = await drive.files.create({
    supportsAllDrives: true,
    requestBody: { name: fileName, parents: [folderId], mimeType: 'application/pdf' },
    media: { mimeType: 'application/pdf', body: Readable.from(buffer) },
    fields: 'id,name,size,mimeType,parents'
  });
  const fileId = created.data.id;
  if (!fileId) throw new Error('Google Drive tidak mengembalikan ID file.');

  const downloaded = await drive.files.get({ fileId, alt: 'media', supportsAllDrives: true }, { responseType: 'arraybuffer' });
  const remoteBuffer = Buffer.from(downloaded.data);
  const remote = requirePdf(remoteBuffer, 'application/pdf');
  if (remote.binaryBytes !== local.binaryBytes || remote.documentHash !== local.documentHash) {
    throw new Error('Verifikasi ulang Google Drive gagal: ukuran atau SHA-256 tidak identik.');
  }
  return storageDescriptor({
    fileId, folderId, documentHash: local.documentHash, binaryBytes: local.binaryBytes,
    revision, verifiedAt: new Date().toISOString()
  });
}
