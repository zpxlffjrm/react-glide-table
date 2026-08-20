import { useCallback, useMemo, useRef, useState } from "react";
import { createTable } from "@/components/ui/Table";
import type {
  CellRenderContext,
  CellRenderer,
} from "@/components/ui/table/features/cell-render/types";
import type {
  DataTableCopyActions,
  RowsPastePayload,
} from "@/components/ui/table/types";
import "@/styles/index.css";

type Product = {
  id: string;
  name: string;
  qty: number;
  price: number;
  region: string;
  regionId: string;
  category: string;
  groupId: string;
  supplier: string;
  sku: string;
  weight: number;
  status: string;
  note: string;
};

type BomRow = {
  id: string;
  plant: string;
  plantId: string;
  line: string;
  lineId: string;
  materialCode: string;
  materialName: string;
  qty: number;
  uom: string;
  supplier: string;
  leadTime: number;
  warehouse: string;
  remark: string;
  assemblyMaterials?: BomRow[];
};

type BomDraft = {
  id: string;
  materialCode: string;
  materialName: string;
  qty: number;
  uom?: string;
  supplier?: string;
  leadTime?: number;
  warehouse?: string;
  remark?: string;
  assemblyMaterials?: BomDraft[];
};

type KindDemoRow = {
  id: string;
  text: string;
  number: number;
  active: boolean;
  url: string;
  image: string;
  tags: string[];
  markdown: string;
  drilldown: Array<{ text: string; img?: string }>;
  secret: string;
  rowKey: string;
  action: string;
};

const ProductTable = createTable<Product>();
const BomTable = createTable<BomRow>();
const KindTable = createTable<KindDemoRow>();

const actionRenderer: CellRenderer = {
  kind: "my-button",
  render: ({ value, update }: CellRenderContext) => (
    <button
      type="button"
      className="playground-toolbar-btn"
      onClick={() => update(value === "Done" ? "Open" : "Done")}
    >
      {String(value)}
    </button>
  ),
};

function createKindDemoRows(): KindDemoRow[] {
  return [
    {
      id: "1",
      text: "Plain text",
      number: 42,
      active: true,
      url: "https://example.com",
      image: "https://picsum.photos/seed/glide1/32/32",
      tags: ["alpha", "beta"],
      markdown: "**Bold** and *italic*",
      drilldown: [
        { text: "Parent", img: "https://picsum.photos/seed/d1/20/20" },
        { text: "Child" },
      ],
      secret: "hidden-value",
      rowKey: "row-001",
      action: "Open",
    },
    {
      id: "2",
      text: "Another row",
      number: 7,
      active: false,
      url: "https://glideapps.com",
      image: "https://picsum.photos/seed/glide2/32/32",
      tags: ["gamma"],
      markdown: "Use `code` here",
      drilldown: [{ text: "Only item" }],
      secret: "top-secret",
      rowKey: "row-002",
      action: "Open",
    },
  ];
}

function coerceKindValue(
  columnId: string,
  raw: string,
): KindDemoRow[keyof KindDemoRow] {
  if (columnId === "number") {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (columnId === "active") {
    const normalized = raw.trim().toLowerCase();
    return (
      normalized === "true" ||
      normalized === "1" ||
      normalized === "yes" ||
      normalized === "y"
    );
  }

  if (columnId === "tags") {
    return raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (columnId === "drilldown") {
    return raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((text) => ({ text }));
  }

  return raw;
}

function applyKindPaste(
  data: KindDemoRow[],
  payload: RowsPastePayload,
): KindDemoRow[] {
  const { mode, startRow, endRow, columnIds, values } = payload;

  if (mode === "overwrite") {
    return data.map((row, rowIndex) => {
      const pasteRow = values[rowIndex - startRow];
      if (!pasteRow) return row;

      const next = { ...row };
      columnIds.forEach((columnId, colOffset) => {
        if (!(columnId in next) || pasteRow[colOffset] === undefined) return;
        (next as Record<string, unknown>)[columnId] = coerceKindValue(
          columnId,
          pasteRow[colOffset]!,
        );
      });
      return next;
    });
  }

  const inserted: KindDemoRow[] = values.map((pasteRow, index) => {
    const base = data[endRow] ?? data[startRow] ?? data[data.length - 1];
    const row: KindDemoRow = {
      id: `paste-${Date.now()}-${index}`,
      text: base?.text ?? "",
      number: base?.number ?? 0,
      active: base?.active ?? false,
      url: base?.url ?? "",
      image: base?.image ?? "",
      tags: base?.tags ?? [],
      markdown: base?.markdown ?? "",
      drilldown: base?.drilldown ?? [],
      secret: base?.secret ?? "",
      rowKey: `row-paste-${index}`,
      action: base?.action ?? "Open",
    };

    columnIds.forEach((columnId, colOffset) => {
      if (!(columnId in row) || pasteRow[colOffset] === undefined) return;
      (row as Record<string, unknown>)[columnId] = coerceKindValue(
        columnId,
        pasteRow[colOffset]!,
      );
    });

    return row;
  });

  const next = [...data];
  next.splice(endRow + 1, 0, ...inserted);
  return next;
}

const REGIONS = ["APAC", "EMEA", "AMER"] as const;
const CATEGORIES = ["Hardware", "Software", "Accessory", "Service"] as const;
const STATUSES = ["Active", "Draft", "Discontinued"] as const;

function createProductRows(count: number): Product[] {
  return Array.from({ length: count }, (_, index) => {
    const n = index + 1;
    const groupIndex = Math.floor(index / 6);
    const regionIndex = Math.floor(groupIndex / 2);
    const region = REGIONS[regionIndex % REGIONS.length]!;
    const category = CATEGORIES[groupIndex % CATEGORIES.length]!;
    return {
      id: String(n),
      name: `Item ${n}`,
      qty: (n % 40) + 1,
      price: 500 + (n % 50) * 120,
      region,
      // Value-based keys so pasted rows with the same display merge with neighbors.
      regionId: `region:${region}`,
      category,
      groupId: `group:${category}`,
      supplier: `Supplier ${(n % 10) + 1}`,
      sku: `SKU-${String(n).padStart(5, "0")}`,
      weight: Number(((n % 20) + 0.5).toFixed(1)),
      status: STATUSES[n % STATUSES.length]!,
      note: n % 5 === 0 ? `Note for item ${n}` : "",
    };
  });
}

function withPlantLine(
  rows: BomDraft[],
  plant: string,
  plantId: string,
  line: string,
  lineId: string,
): BomRow[] {
  return rows.map((row) => ({
    ...row,
    plant,
    plantId,
    line,
    lineId,
    uom: row.uom ?? "EA",
    supplier: row.supplier ?? "Default",
    leadTime: row.leadTime ?? 7,
    warehouse: row.warehouse ?? "WH-A",
    remark: row.remark ?? "",
    assemblyMaterials: row.assemblyMaterials
      ? withPlantLine(row.assemblyMaterials, plant, plantId, line, lineId)
      : undefined,
  }));
}

function createBomRows(): BomRow[] {
  const plantKey = (plant: string) => `plant:${plant}`;
  const lineKey = (plant: string, line: string) => `line:${plant}:${line}`;

  return [
    ...withPlantLine(
      [
        {
          id: "root-1",
          materialCode: "ASM-1000",
          materialName: "Main assembly",
          qty: 1,
          assemblyMaterials: [
            {
              id: "child-1",
              materialCode: "PRT-1100",
              materialName: "Upper cover",
              qty: 2,
            },
            {
              id: "child-2",
              materialCode: "PRT-1200",
              materialName: "Lower base",
              qty: 1,
              assemblyMaterials: [
                {
                  id: "child-2-1",
                  materialCode: "PRT-1210",
                  materialName: "Base plate",
                  qty: 1,
                },
                {
                  id: "child-2-2",
                  materialCode: "PRT-1220",
                  materialName: "Mounting bracket",
                  qty: 4,
                },
              ],
            },
            {
              id: "child-3",
              materialCode: "PRT-1300",
              materialName: "Power module",
              qty: 1,
            },
          ],
        },
        {
          id: "root-2",
          materialCode: "ASM-2000",
          materialName: "Sub assembly",
          qty: 1,
          assemblyMaterials: [
            {
              id: "child-4",
              materialCode: "PRT-2100",
              materialName: "Sensor board",
              qty: 2,
            },
            {
              id: "child-5",
              materialCode: "PRT-2200",
              materialName: "Cable harness",
              qty: 3,
            },
          ],
        },
      ],
      "Seoul",
      plantKey("Seoul"),
      "Line A",
      lineKey("Seoul", "Line A"),
    ),
    ...withPlantLine(
      [
        {
          id: "root-3",
          materialCode: "ASM-3000",
          materialName: "Standalone module",
          qty: 2,
          assemblyMaterials: [
            {
              id: "child-6",
              materialCode: "PRT-3100",
              materialName: "Control board",
              qty: 1,
            },
          ],
        },
      ],
      "Seoul",
      plantKey("Seoul"),
      "Line B",
      lineKey("Seoul", "Line B"),
    ),
    ...withPlantLine(
      [
        {
          id: "root-4",
          materialCode: "ASM-4000",
          materialName: "Packaging kit",
          qty: 1,
          assemblyMaterials: [
            {
              id: "child-7",
              materialCode: "PRT-4100",
              materialName: "Carton box",
              qty: 1,
            },
            {
              id: "child-8",
              materialCode: "PRT-4200",
              materialName: "Foam insert",
              qty: 2,
            },
          ],
        },
      ],
      "Busan",
      plantKey("Busan"),
      "Line A",
      lineKey("Busan", "Line A"),
    ),
  ];
}

function ToggleSwitch({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="playground-toggle" title={hint}>
      <span className="playground-toggle-label">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={checked ? "playground-switch is-on" : "playground-switch"}
        onClick={() => onChange(!checked)}
      >
        <span className="playground-switch-thumb" />
      </button>
    </label>
  );
}

function coerceProductValue(columnId: string, raw: string): string | number {
  if (columnId === "qty" || columnId === "price" || columnId === "weight") {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return raw;
}

/** Keep rowSpan keys aligned with display values so merges don't hide different cells. */
function syncProductRowSpanKeys(row: Product): Product {
  return {
    ...row,
    regionId: `region:${row.region}`,
    groupId: `group:${row.category}`,
  };
}

function applyProductPaste(
  data: Product[],
  payload: RowsPastePayload,
): Product[] {
  const { mode, startRow, endRow, columnIds, values } = payload;

  if (mode === "overwrite") {
    return data.map((row, rowIndex) => {
      const pasteRow = values[rowIndex - startRow];
      if (!pasteRow) return row;

      const next = { ...row };
      columnIds.forEach((columnId, colOffset) => {
        if (!(columnId in next) || pasteRow[colOffset] === undefined) return;
        (next as Record<string, unknown>)[columnId] = coerceProductValue(
          columnId,
          pasteRow[colOffset]!,
        );
      });

      const touchedSpanFields =
        columnIds.includes("region") || columnIds.includes("category");
      return touchedSpanFields ? syncProductRowSpanKeys(next) : next;
    });
  }

  const inserted: Product[] = values.map((pasteRow, index) => {
    const base = data[endRow] ?? data[startRow] ?? data[data.length - 1];
    const row: Product = {
      id: `paste-${Date.now()}-${index}`,
      name: base?.name ?? "",
      qty: base?.qty ?? 1,
      price: base?.price ?? 0,
      region: base?.region ?? REGIONS[0]!,
      regionId: base?.regionId ?? "r-0",
      category: base?.category ?? CATEGORIES[0]!,
      groupId: base?.groupId ?? "g-0",
      supplier: base?.supplier ?? "",
      sku: base?.sku ?? "",
      weight: base?.weight ?? 0,
      status: base?.status ?? STATUSES[0]!,
      note: base?.note ?? "",
    };

    columnIds.forEach((columnId, colOffset) => {
      if (!(columnId in row) || pasteRow[colOffset] === undefined) return;
      (row as Record<string, unknown>)[columnId] = coerceProductValue(
        columnId,
        pasteRow[colOffset]!,
      );
    });

    // Always sync keys on insert so cloned regionId/groupId cannot false-merge.
    return syncProductRowSpanKeys(row);
  });

  const next = [...data];
  // Insert below the selection (after endRow), not on top of the selected row.
  next.splice(endRow + 1, 0, ...inserted);
  return next;
}

function coerceBomValue(columnId: string, raw: string): string | number {
  if (columnId === "qty" || columnId === "leadTime") {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return raw;
}

function syncBomRowSpanKeys(row: BomRow): BomRow {
  return {
    ...row,
    plantId: `plant:${row.plant}`,
    lineId: `line:${row.plant}:${row.line}`,
  };
}

function findBomById(nodes: BomRow[], id: string): BomRow | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.assemblyMaterials) {
      const found = findBomById(node.assemblyMaterials, id);
      if (found) return found;
    }
  }

  return null;
}

function updateBomById(
  nodes: BomRow[],
  id: string,
  updater: (row: BomRow) => BomRow,
): BomRow[] {
  return nodes.map((node) => {
    if (node.id === id) return updater(node);
    if (!node.assemblyMaterials) return node;

    return {
      ...node,
      assemblyMaterials: updateBomById(node.assemblyMaterials, id, updater),
    };
  });
}

function countBomRows(nodes: BomRow[]): number {
  return nodes.reduce(
    (sum, node) => sum + 1 + countBomRows(node.assemblyMaterials ?? []),
    0,
  );
}

/** Index of the top-level root that contains `id` (itself or a descendant). */
function findBomRootIndex(nodes: BomRow[], id: string): number {
  return nodes.findIndex(
    (node) =>
      node.id === id ||
      Boolean(
        node.assemblyMaterials && findBomById(node.assemblyMaterials, id),
      ),
  );
}

function applyBomPasteValues(
  row: BomRow,
  pasteRow: string[],
  columnIds: string[],
): BomRow {
  const next = { ...row };
  columnIds.forEach((columnId, colOffset) => {
    if (!(columnId in next) || pasteRow[colOffset] === undefined) return;
    (next as Record<string, unknown>)[columnId] = coerceBomValue(
      columnId,
      pasteRow[colOffset]!,
    );
  });

  return syncBomRowSpanKeys(next);
}

/**
 * Rebuild a BOM forest from flat clipboard rows using relative depths
 * (leading tabs from subtree copy). Depth 0 rows become roots; deeper rows
 * nest under the nearest shallower ancestor via `assemblyMaterials`.
 */
function buildBomForestFromPaste(
  values: string[][],
  depths: number[],
  columnIds: string[],
  anchor: BomRow,
): BomRow[] {
  const roots: BomRow[] = [];
  const stack: Array<{ depth: number; row: BomRow }> = [];
  const stamp = Date.now();

  values.forEach((pasteRow, index) => {
    const depth = depths[index] ?? 0;
    const base: BomRow = {
      id: `paste-${stamp}-${index}`,
      plant: anchor.plant,
      plantId: anchor.plantId,
      line: anchor.line,
      lineId: anchor.lineId,
      materialCode: anchor.materialCode,
      materialName: anchor.materialName,
      qty: anchor.qty,
      uom: anchor.uom,
      supplier: anchor.supplier,
      leadTime: anchor.leadTime,
      warehouse: anchor.warehouse,
      remark: anchor.remark,
    };
    const row = applyBomPasteValues(base, pasteRow, columnIds);

    while (stack.length > 0 && stack[stack.length - 1]!.depth >= depth) {
      stack.pop();
    }

    const parent = stack[stack.length - 1];
    if (!parent) {
      roots.push(row);
    } else {
      parent.row.assemblyMaterials = [
        ...(parent.row.assemblyMaterials ?? []),
        row,
      ];
    }

    stack.push({ depth, row });
  });

  return roots;
}

function applyBomPaste(data: BomRow[], payload: RowsPastePayload): BomRow[] {
  const { mode, columnIds, values, rowIds, anchorRowId, depths } = payload;

  if (mode === "overwrite") {
    let next = data;
    values.forEach((pasteRow, index) => {
      const rowId = rowIds[index];
      if (!rowId) return;
      next = updateBomById(next, rowId, (row) =>
        applyBomPasteValues(row, pasteRow, columnIds),
      );
    });
    return next;
  }

  const anchor = findBomById(data, anchorRowId);
  if (!anchor) return data;

  const resolvedDepths =
    depths && depths.length === values.length ? depths : values.map(() => 0);

  // Subtree copy encodes depth with leading tabs. Flat multi-row paste
  // (no markers) is treated as one parent + nested children for the BOM demo.
  const hasDepthMarkers = resolvedDepths.some((depth) => depth > 0);
  const forestDepths = hasDepthMarkers
    ? resolvedDepths
    : values.map((_, index) => (index === 0 ? 0 : 1));

  const inserted = buildBomForestFromPaste(
    values,
    forestDepths,
    columnIds,
    anchor,
  );

  // Insert after the top-level root that owns the selection so plant/line
  // merges stay contiguous and the new subtree keeps its own hierarchy.
  const rootIndex = findBomRootIndex(data, anchorRowId);
  if (rootIndex < 0) return data;

  const next = [...data];
  next.splice(rootIndex + 1, 0, ...inserted);
  return next;
}

export function App() {
  const [rowCount, setRowCount] = useState(500);
  const [enableRowSpan, setEnableRowSpan] = useState(false);
  const [enableExpand, setEnableExpand] = useState(false);
  const [showCellKinds, setShowCellKinds] = useState(false);
  const [productData, setProductData] = useState(() => createProductRows(500));
  const [bomData, setBomData] = useState(() => createBomRows());
  const [kindData, setKindData] = useState(() => createKindDemoRows());
  const [expandedRows, setExpandedRows] = useState<Set<string>>(
    () => new Set(),
  );
  const copyActionsRef = useRef<DataTableCopyActions | null>(null);

  const productCount = useMemo(() => productData.length, [productData]);
  const bothFeatures = enableExpand && enableRowSpan;

  const handleProductPaste = useCallback((payload: RowsPastePayload) => {
    setProductData((prev) => applyProductPaste(prev, payload));
  }, []);

  const handleKindPaste = useCallback((payload: RowsPastePayload) => {
    setKindData((prev) => applyKindPaste(prev, payload));
  }, []);

  const handleBomPaste = useCallback((payload: RowsPastePayload) => {
    setBomData((prev) => applyBomPaste(prev, payload));

    if (payload.mode !== "insert") return;

    const depths =
      payload.depths && payload.depths.length === payload.values.length
        ? payload.depths
        : payload.values.map(() => 0);
    const hasDepthMarkers = depths.some((depth) => depth > 0);
    const forestDepths = hasDepthMarkers
      ? depths
      : payload.values.map((_, index) => (index === 0 ? 0 : 1));
    const codeIndex = payload.columnIds.indexOf("materialCode");
    if (codeIndex < 0) return;

    // DFS clipboard order: a row is expandable when the next row is deeper.
    const codesToExpand: string[] = [];
    for (let index = 0; index < forestDepths.length; index += 1) {
      const nextDepth = forestDepths[index + 1];
      if (nextDepth === undefined || nextDepth <= (forestDepths[index] ?? 0)) {
        continue;
      }
      const code = payload.values[index]?.[codeIndex];
      if (code) codesToExpand.push(code);
    }

    if (codesToExpand.length === 0) return;

    setExpandedRows((prev) => {
      const merged = new Set(prev);
      for (const code of codesToExpand) merged.add(code);
      return merged;
    });
  }, []);

  const bomRowCount = useMemo(() => countBomRows(bomData), [bomData]);

  const reloadProducts = (count: number) => {
    setRowCount(count);
    setProductData(createProductRows(count));
  };

  const reset = () => {
    if (showCellKinds) {
      setKindData(createKindDemoRows());
      return;
    }
    if (enableExpand) {
      setBomData(createBomRows());
      setExpandedRows(new Set());
      return;
    }
    reloadProducts(rowCount);
  };

  return (
    <div className="playground">
      <header className="playground-header">
        <div>
          <p className="playground-eyebrow">react-glide-table</p>
          <h1>Playground</h1>
          <p className="playground-lead">
            Points at the local <code>src</code> package. Use the toggles for
            cell merge and tree expand (they can run together), and change the
            row count to try virtualized scrolling. Drag a column header to
            rearrange columns. Select cells, then
            Ctrl/Cmd+V to overwrite or Ctrl/Cmd+Shift+V to insert rows from the
            clipboard. Press Ctrl/Cmd+F for built-in find-in-page search.
            {enableRowSpan && (
              <>
                {" "}
                With <strong>Cell merge ON</strong>, virtualization is turned
                off automatically.
              </>
            )}
            {bothFeatures && (
              <>
                {" "}
                Combined mode merges plant/line across the BOM tree while rows
                stay expandable.
              </>
            )}
          </p>
        </div>
        <div className="playground-actions">
          <ToggleSwitch
            label="Cell kinds"
            checked={showCellKinds}
            onChange={setShowCellKinds}
            hint="builtin + custom cellRenderers gallery"
          />
          <ToggleSwitch
            label="Cell merge"
            checked={enableRowSpan}
            onChange={setEnableRowSpan}
            hint={
              enableExpand
                ? "enableRowSpan + plant/line rowSpan on BOM"
                : "enableRowSpan + region/category rowSpan"
            }
          />
          <ToggleSwitch
            label="Row expand"
            checked={enableExpand}
            onChange={setEnableExpand}
            hint="toggleField tree / BOM (works with cell merge)"
          />
          {!enableExpand && !showCellKinds && (
            <label className="playground-field">
              Rows
              <select
                value={rowCount}
                onChange={(event) => reloadProducts(Number(event.target.value))}
              >
                <option value={50}>50</option>
                <option value={500}>500</option>
                <option value={2000}>2,000</option>
                <option value={10000}>10,000</option>
              </select>
            </label>
          )}
          <button type="button" onClick={reset}>
            Reset data
          </button>
        </div>
      </header>

      <main className="playground-main">
        {showCellKinds ? (
          <KindTable
            data={kindData}
            getRowId={(row) => row.id}
            enableVirtualization={false}
            enableColumnResize
            enableColumnReorder
            cellRenderers={[actionRenderer]}
            onRowsPaste={handleKindPaste}
            onCellChange={(rowId, columnId, value) => {
              setKindData((prev) =>
                prev.map((row) =>
                  row.id === rowId ? { ...row, [columnId]: value } : row,
                ),
              );
            }}
            classNames={{
              scroll: "playground-table-scroll",
              cell: "playground-kind-cell",
            }}
          >
            <KindTable.Header>
              <KindTable.Column field="text" kind="text" width={120}>
                text
              </KindTable.Column>
              <KindTable.Column field="number" kind="number" width={80}>
                number
              </KindTable.Column>
              <KindTable.Column field="active" kind="boolean" width={80}>
                boolean
              </KindTable.Column>
              <KindTable.Column field="url" kind="uri" width={160}>
                uri
              </KindTable.Column>
              <KindTable.Column field="image" kind="image" width={72}>
                image
              </KindTable.Column>
              <KindTable.Column field="tags" kind="bubble" width={140}>
                bubble
              </KindTable.Column>
              <KindTable.Column field="markdown" kind="markdown" width={160}>
                markdown
              </KindTable.Column>
              <KindTable.Column field="drilldown" kind="drilldown" width={160}>
                drilldown
              </KindTable.Column>
              <KindTable.Column field="id" kind="loading" width={72}>
                loading
              </KindTable.Column>
              <KindTable.Column field="secret" kind="protected" width={88}>
                protected
              </KindTable.Column>
              <KindTable.Column field="rowKey" kind="row-id" width={88}>
                row-id
              </KindTable.Column>
              <KindTable.Column field="action" kind="my-button" width={100}>
                custom
              </KindTable.Column>
            </KindTable.Header>
          </KindTable>
        ) : enableExpand ? (
          <BomTable
            data={bomData}
            getRowId={(row) => String(row.id)}
            onDataChange={setBomData}
            onRowsPaste={handleBomPaste}
            toggleField="materialCode"
            flattenField="assemblyMaterials"
            childField="assemblyCode"
            qtyField="qty"
            expandedRows={expandedRows}
            onExpandedRowsChange={setExpandedRows}
            onCopyActionsReady={(actions) => {
              copyActionsRef.current = actions;
            }}
            enableRowSpan={enableRowSpan}
            enableColumnResize
            enableColumnReorder
            enableColumnFreeze
            enableInlineSearch
            rowSelectionMode="multi"
            filteredCount={bomRowCount}
            totalCount={bomRowCount}
            toolbar={
              <>
                <button
                  type="button"
                  className="playground-toolbar-btn"
                  onClick={() => {
                    void copyActionsRef.current?.copySelection({
                      includeDescendants: true,
                    });
                  }}
                >
                  Copy with descendants
                </button>
                <button type="button" className="playground-toolbar-btn">
                  Export
                </button>
              </>
            }
          >
            <BomTable.Header>
              <BomTable.Column
                field="plant"
                frozen
                rowSpan={enableRowSpan}
                rowSpanKey="plantId"
                editInputProps={{
                  placeholder: "Plant",
                  "aria-label": "plant-input",
                  maxLength: 10,
                }}
              >
                Plant
              </BomTable.Column>

              <BomTable.Column field="materialCode" frozen>
                Part code
              </BomTable.Column>
              <BomTable.Column field="materialName" editable>
                Part name
              </BomTable.Column>
              <BomTable.Column
                field="line"
                rowSpan={enableRowSpan}
                rowSpanKey="lineId"
              >
                Line
              </BomTable.Column>
              <BomTable.Column
                field="qty"
                align="right"
                editable
                editType="number"
              >
                Qty
              </BomTable.Column>
              <BomTable.Column field="uom">UOM</BomTable.Column>
              <BomTable.Column field="supplier" editable>
                Supplier
              </BomTable.Column>
              <BomTable.Column
                field="leadTime"
                align="right"
                editable
                editType="number"
              >
                Lead time
              </BomTable.Column>
              <BomTable.Column field="warehouse">Warehouse</BomTable.Column>
              <BomTable.Column field="remark" editable frozen="right">
                Remark
              </BomTable.Column>
            </BomTable.Header>
          </BomTable>
        ) : (
          <ProductTable
            data={productData}
            getRowId={(row) => row.id}
            onDataChange={setProductData}
            onRowsPaste={handleProductPaste}
            enableRowSpan={enableRowSpan}
            enableColumnResize
            enableColumnReorder
            enableColumnFreeze
            enableInlineSearch
            rowSelectionMode="none"
            filteredCount={productCount}
            totalCount={productCount}
            toolbar={
              <button type="button" className="playground-toolbar-btn">
                Export
              </button>
            }
          >
            <ProductTable.Header>
              {enableRowSpan && (
                <ProductTable.Column
                  field="category"
                  rowSpan
                  rowSpanKey="groupId"
                  width={300}
                >
                  Category
                </ProductTable.Column>
              )}

              <ProductTable.ColumnGroup header="Identity" align="center">
                <ProductTable.Column
                  field="name"
                  sortable
                  editable
                  frozen
                  width={300}
                  editInputProps={{
                    placeholder: "Name",
                    "aria-label": "name-input",
                    maxLength: 40,
                  }}
                >
                  Name
                </ProductTable.Column>
                {!enableRowSpan && (
                  <ProductTable.Column field="region" sortable>
                    Region
                  </ProductTable.Column>
                )}
                {enableRowSpan && (
                  <ProductTable.Column
                    field="region"
                    rowSpan
                    rowSpanKey="regionId"
                    sortable
                  >
                    Region
                  </ProductTable.Column>
                )}
                {!enableRowSpan && (
                  <ProductTable.Column field="category" sortable>
                    Category
                  </ProductTable.Column>
                )}
                <ProductTable.Column field="sku" sortable>
                  SKU
                </ProductTable.Column>
              </ProductTable.ColumnGroup>

              <ProductTable.ColumnGroup header="Metrics" align="center">
                <ProductTable.Column
                  field="qty"
                  sortable
                  align="right"
                  editable
                  editType="number"
                  frozen="left"
                  width={100}
                  editInputProps={{
                    placeholder: "Qty",
                    "aria-label": "qty-input",
                  }}
                >
                  Qty
                </ProductTable.Column>
                <ProductTable.Column
                  field="price"
                  sortable
                  align="right"
                  frozen="left"
                  editable
                  editType="number"
                  render={({ value }) => `$${Number(value).toLocaleString()}`}
                  width={300}
                >
                  Price
                </ProductTable.Column>
                <ProductTable.Column
                  field="weight"
                  sortable
                  align="right"
                  editable
                  editType="number"
                >
                  Weight
                </ProductTable.Column>
              </ProductTable.ColumnGroup>

              <ProductTable.ColumnGroup header="Details" align="center">
                <ProductTable.Column field="supplier" sortable editable>
                  Supplier
                </ProductTable.Column>
                <ProductTable.Column
                  field="status"
                  sortable
                  editable
                  frozen="right"
                >
                  Status
                </ProductTable.Column>
                <ProductTable.Column field="note" editable frozen="right">
                  Note
                </ProductTable.Column>
              </ProductTable.ColumnGroup>
            </ProductTable.Header>
          </ProductTable>
        )}
      </main>
    </div>
  );
}
