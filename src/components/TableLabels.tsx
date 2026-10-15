"use client";
import { useEffect } from "react";

/**
 * Copies each column header onto the cells beneath it as `data-label`, so the phone layout (see "Phones: a table becomes a
 * list" in globals.css) can show "Due" above a date without every page repeating its headers. Also restores the table roles
 * that `display: block` strips from the accessibility tree. Re-runs whenever the page's content changes (router.refresh,
 * sheets closing, new rows), and does nothing visible on larger screens.
 */
export function TableLabels() {
  useEffect(() => {
    const run = () => {
      for (const table of document.querySelectorAll<HTMLTableElement>("table.table")) {
        const heads = [...(table.tHead?.rows[0]?.cells ?? [])].map((h) => h.textContent?.trim() ?? "");
        table.setAttribute("role", "table");
        for (const g of [table.tHead, ...table.tBodies]) g?.setAttribute("role", "rowgroup");
        for (const h of table.tHead?.rows[0]?.cells ?? []) h.setAttribute("role", "columnheader");
        for (const body of table.tBodies) {
          for (const row of body.rows) {
            row.setAttribute("role", "row");
            let col = 0;
            for (const cell of row.cells) {
              const label = heads[col] ?? "";
              if (cell.dataset.label !== label) cell.dataset.label = label;
              cell.setAttribute("role", "cell");
              col += cell.colSpan;
            }
          }
        }
      }
    };
    run();
    let raf = 0;
    const mo = new MutationObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(run); });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { mo.disconnect(); cancelAnimationFrame(raf); };
  }, []);
  return null;
}
