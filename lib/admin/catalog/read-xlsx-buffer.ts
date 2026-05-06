/**
 * XLSX price sheet reader using ExcelJS.
 * Converts a raw Buffer into a RawRow[][] grid for use by parse-price-sheet.ts.
 * Server-only: import only in route handlers / server code.
 */

import ExcelJS from "exceljs";
import { Buffer as NodeBuffer } from "node:buffer";
import type { RawRow } from "./parse-price-sheet";

/**
 * Read an XLSX buffer and return the first worksheet as a grid of raw cell values.
 * Cell values are returned as string | number | null depending on cell type.
 */
export async function readXlsxBuffer(buffer: NodeBuffer): Promise<RawRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
  );

  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const rows: RawRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: RawRow = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      const v = cell.value;
      if (v === null || v === undefined) {
        cells.push(null);
      } else if (typeof v === "number") {
        cells.push(v);
      } else if (typeof v === "string") {
        cells.push(v);
      } else if (v instanceof Date) {
        cells.push(v.toISOString());
      } else if (typeof v === "object" && "richText" in v) {
        // RichText
        const richText = (v as ExcelJS.CellRichTextValue).richText;
        cells.push(richText.map((rt) => rt.text).join(""));
      } else if (typeof v === "object" && "formula" in v) {
        // Shared formula — use result
        const fv = (v as ExcelJS.CellFormulaValue).result;
        if (fv === null || fv === undefined) cells.push(null);
        else if (typeof fv === "number") cells.push(fv);
        else cells.push(String(fv));
      } else {
        cells.push(String(v));
      }
    });
    rows.push(cells);
  });

  return rows;
}
