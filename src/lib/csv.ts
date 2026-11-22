/**
 * 將表格資料匯出並下載為帶 UTF-8 BOM 的標準 RFC 4180 CSV 檔案，
 * 確保 Windows Excel 直接開啟繁體中文不亂碼。
 */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
): void {
  const escapeCell = (raw: string | number | null | undefined): string => {
    if (raw === null || raw === undefined) return '';
    const text = String(raw);
    if (/[",\r\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const lines = [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => row.map(escapeCell).join(',')),
  ];

  const csvBody = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvBody], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
