const fs = require('node:fs');
const path = require('node:path');

const projectId = process.env.EPASAR_FIREBASE_PROJECT || 'e-skpt';
const email = String(process.env.EPASAR_RESET_EMAIL || '').trim().toLowerCase();
const password = String(process.env.EPASAR_RESET_PASSWORD || '');

if (!email || password.length < 8) {
  throw new Error('EPASAR_RESET_EMAIL dan EPASAR_RESET_PASSWORD (minimal 8 karakter) wajib tersedia.');
}

const configPath = path.join(process.env.USERPROFILE || '', '.config', 'configstore', 'firebase-tools.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

async function accessToken() {
  const current = config.tokens || {};
  if (current.access_token && Number(current.expires_at || 0) > Date.now() + 60_000) return current.access_token;
  throw new Error('Access token Firebase CLI kedaluwarsa. Jalankan firebase login:list untuk memperbarui sesi lalu ulangi.');
}

async function identityRequest(action, body) {
  const token = await accessToken();
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/accounts:${action}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`${action} gagal: ${data.error?.message || response.status}`);
  return data;
}

(async () => {
  const lookup = await identityRequest('lookup', { email: [email] });
  const user = lookup.users?.[0];
  if (!user?.localId || String(user.email || '').toLowerCase() !== email) throw new Error(`Akun ${email} tidak ditemukan.`);
  await identityRequest('update', { localId: user.localId, password, returnSecureToken: false });
  process.stdout.write(`PASS password Firebase diperbarui untuk ${email}.\n`);
})().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
