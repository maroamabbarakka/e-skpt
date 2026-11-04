const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const ExcelJS = require('exceljs');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'DAFTAR_AKUN_INTERNAL_EPASAR.md');
const outputDir = path.join(root, 'artifacts', 'akun-internal');
const xlsxPath = path.join(outputDir, 'DAFTAR_AKUN_INTERNAL_EPASAR.xlsx');
const pdfPath = path.join(outputDir, 'DAFTAR_AKUN_INTERNAL_EPASAR.pdf');

function cells(line) {
  return line.split('|').slice(1, -1).map(value => value.trim().replace(/`/g, '').replace(/\*\*/g, ''));
}

const source = fs.readFileSync(sourcePath, 'utf8');
const lines = source.split(/\r?\n/);
const headingIndex = lines.findIndex(line => line.trim() === '## Daftar akun, username, dan password');
if (headingIndex < 0) throw new Error('Tabel akun tidak ditemukan pada Markdown.');
const tableStart = lines.findIndex((line, index) => index > headingIndex && line.startsWith('|'));
const tableLines = [];
for (let index = tableStart; index >= 0 && index < lines.length && lines[index].startsWith('|'); index += 1) tableLines.push(lines[index]);
const headers = cells(tableLines[0]);
const rows = tableLines.slice(2).map(cells).filter(row => /^\d+$/.test(row[0] || ''));
if (headers.length !== 7 || rows.length !== 19) throw new Error(`Struktur tabel tidak sesuai: ${headers.length} kolom, ${rows.length} akun.`);

fs.mkdirSync(outputDir, { recursive: true });

async function createExcel() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'e-PASAR Kabupaten Pinrang';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Akun Internal', {
    views: [{ state: 'frozen', ySplit: 4 }],
    pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  });
  sheet.mergeCells('A1:G1');
  sheet.getCell('A1').value = 'DAFTAR AKUN INTERNAL e-PASAR';
  sheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF12366B' } };
  sheet.getRow(1).height = 30;
  sheet.mergeCells('A2:G2');
  sheet.getCell('A2').value = 'RAHASIA INTERNAL — Password sementara wajib diganti menjadi unik';
  sheet.getCell('A2').font = { bold: true, color: { argb: 'FF9C1C1C' } };
  sheet.getCell('A2').alignment = { horizontal: 'center' };
  sheet.mergeCells('A3:G3');
  sheet.getCell('A3').value = 'Diverifikasi melalui Firebase Authentication pada 29 Oktober 2026';
  sheet.getCell('A3').alignment = { horizontal: 'center' };
  sheet.addRow(headers);
  rows.forEach(row => sheet.addRow(row));
  const header = sheet.getRow(4);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF176B87' } };
  header.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  header.height = 28;
  for (let rowIndex = 5; rowIndex <= sheet.rowCount; rowIndex += 1) {
    const row = sheet.getRow(rowIndex);
    row.alignment = { vertical: 'top', wrapText: true };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowIndex % 2 ? 'FFF3F7FB' : 'FFFFFFFF' } };
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'top' };
    row.getCell(7).font = { bold: true, color: { argb: row.getCell(7).value === 'ACTIVE' ? 'FF087A4B' : 'FF9C1C1C' } };
  }
  sheet.columns = [
    { width: 6 }, { width: 31 }, { width: 39 }, { width: 24 }, { width: 22 }, { width: 55 }, { width: 13 }
  ];
  sheet.eachRow(row => row.eachCell(cell => {
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD5DFEA' } }, bottom: { style: 'thin', color: { argb: 'FFD5DFEA' } },
      left: { style: 'thin', color: { argb: 'FFD5DFEA' } }, right: { style: 'thin', color: { argb: 'FFD5DFEA' } }
    };
  }));
  sheet.autoFilter = 'A4:G23';
  sheet.headerFooter.oddFooter = '&LRAHASIA INTERNAL&C&P / &N&R29 Oktober 2026';
  await workbook.xlsx.writeFile(xlsxPath);
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

async function createPdf() {
  const body = rows.map(row => `<tr>${row.map((value, index) => `<td class="c${index}">${esc(value)}</td>`).join('')}</tr>`).join('');
  const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><style>
    @page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#14243b;margin:0}h1{text-align:center;color:#12366b;font-size:18px;margin:0 0 5px}.warning{text-align:center;color:#9c1c1c;font-weight:700;font-size:10px;margin-bottom:4px}.meta{text-align:center;color:#53657a;font-size:8px;margin-bottom:8px}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:7px}th{background:#176b87;color:#fff;padding:5px 3px;border:1px solid #d5dfea}td{padding:4px 3px;border:1px solid #d5dfea;vertical-align:top;overflow-wrap:anywhere}tbody tr:nth-child(odd){background:#f3f7fb}.c0{text-align:center;width:4%}.c1{width:17%}.c2{width:21%}.c3{width:13%;font-weight:700}.c4{width:12%}.c5{width:26%}.c6{width:7%;font-weight:700}footer{margin-top:7px;font-size:7px;color:#69798c;display:flex;justify-content:space-between}.watermark{position:fixed;inset:42% 0 auto;transform:rotate(-18deg);text-align:center;font-size:52px;font-weight:800;color:rgba(156,28,28,.055);z-index:-1}
  </style></head><body><div class="watermark">RAHASIA INTERNAL</div><h1>DAFTAR AKUN INTERNAL e-PASAR</h1><div class="warning">RAHASIA INTERNAL — PASSWORD SEMENTARA WAJIB DIGANTI MENJADI UNIK</div><div class="meta">Diverifikasi melalui Firebase Authentication pada 29 Oktober 2026</div><table><thead><tr>${headers.map(header => `<th>${esc(header)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table><footer><span>e-PASAR Kabupaten Pinrang</span><span>19 akun · dokumen internal</span></footer></body></html>`;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'epasar-account-export-'));
  const htmlPath = path.join(tempDir, 'accounts.html');
  try {
    fs.writeFileSync(htmlPath, html, 'utf8');
    execFileSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
      '--headless=new', '--disable-gpu', '--no-pdf-header-footer',
      `--user-data-dir=${path.join(tempDir, 'chrome-profile')}`,
      `--print-to-pdf=${pdfPath}`, `file:///${htmlPath.replace(/\\/g, '/')}`
    ], { stdio: 'pipe', timeout: 60_000 });
    if (!fs.existsSync(pdfPath) || fs.statSync(pdfPath).size < 1_000) throw new Error('Chrome tidak menghasilkan PDF yang valid.');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

(async () => {
  await createExcel();
  await createPdf();
  console.log(`PASS Excel: ${xlsxPath}`);
  console.log(`PASS PDF: ${pdfPath}`);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
