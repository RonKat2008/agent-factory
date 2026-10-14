// Small LCS line diff (no deps). Specs are a few dozen lines so O(n*m) is fine.
export type DiffOp = { type: "same" | "add" | "del"; text: string };
export type DiffRow = DiffOp | { type: "gap"; count: number };

export function diffLines(a: string, b: string): DiffOp[] {
  const x = a.split("\n");
  const y = b.split("\n");
  const n = x.length;
  const m = y.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = x[i] === y[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) {
      out.push({ type: "same", text: x[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ type: "del", text: x[i++] });
    } else {
      out.push({ type: "add", text: y[j++] });
    }
  }
  while (i < n) out.push({ type: "del", text: x[i++] });
  while (j < m) out.push({ type: "add", text: y[j++] });
  return out;
}

/** Collapse runs of unchanged lines longer than 2*context into a single gap row. */
export function collapseDiff(ops: DiffOp[], context = 2): DiffRow[] {
  const keep = ops.map((o) => o.type !== "same");
  const near = ops.map((_, idx) => {
    for (let k = Math.max(0, idx - context); k <= Math.min(ops.length - 1, idx + context); k++) {
      if (keep[k]) return true;
    }
    return false;
  });
  const rows: DiffRow[] = [];
  let gap = 0;
  ops.forEach((o, idx) => {
    if (near[idx]) {
      if (gap > 0) rows.push({ type: "gap", count: gap });
      gap = 0;
      rows.push(o);
    } else {
      gap++;
    }
  });
  if (gap > 0) rows.push({ type: "gap", count: gap });
  return rows;
}

export function diffStats(ops: DiffOp[]) {
  return {
    added: ops.filter((o) => o.type === "add").length,
    removed: ops.filter((o) => o.type === "del").length,
  };
}
