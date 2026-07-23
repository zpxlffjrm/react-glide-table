import { useMemo, useState } from "react";
import { createTable, Table } from "@/components/ui/Table";
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
};

type BomRow = {
  id: string;
  materialCode: string;
  materialName: string;
  qty: number;
  assemblyMaterials?: BomRow[];
};

const ProductTable = createTable<Product>();

const REGIONS = ["APAC", "EMEA", "AMER"] as const;
const CATEGORIES = ["Hardware", "Software", "Accessory", "Service"] as const;

function createProductRows(count: number): Product[] {
  return Array.from({ length: count }, (_, index) => {
    const n = index + 1;
    const groupIndex = Math.floor(index / 6);
    const regionIndex = Math.floor(groupIndex / 2);
    return {
      id: String(n),
      name: `Item ${n}`,
      qty: (n % 40) + 1,
      price: 500 + (n % 50) * 120,
      region: REGIONS[regionIndex % REGIONS.length]!,
      regionId: `r-${regionIndex}`,
      category: CATEGORIES[groupIndex % CATEGORIES.length]!,
      groupId: `g-${groupIndex}`,
    };
  });
}

function createBomRows(): BomRow[] {
  return [
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
    {
      id: "root-3",
      materialCode: "ASM-3000",
      materialName: "Standalone module",
      qty: 2,
    },
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

export function App() {
  const [rowCount, setRowCount] = useState(500);
  const [enableRowSpan, setEnableRowSpan] = useState(false);
  const [enableExpand, setEnableExpand] = useState(false);
  const [productData, setProductData] = useState(() => createProductRows(500));
  const [bomData, setBomData] = useState(() => createBomRows());
  const [expandedRows, setExpandedRows] = useState<Set<string>>(
    () => new Set(),
  );

  const productCount = useMemo(() => productData.length, [productData]);

  const reloadProducts = (count: number) => {
    setRowCount(count);
    setProductData(createProductRows(count));
  };

  const reset = () => {
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
            cell merge and tree expand, and change the row count to try
            virtualized scrolling.
            {enableRowSpan && (
              <>
                {" "}
                With <strong>Cell merge ON</strong>, virtualization is turned
                off automatically.
              </>
            )}
          </p>
        </div>
        <div className="playground-actions">
          <ToggleSwitch
            label="Cell merge"
            checked={enableRowSpan}
            onChange={setEnableRowSpan}
            hint="enableRowSpan + region/category rowSpan"
          />
          <ToggleSwitch
            label="Row expand"
            checked={enableExpand}
            onChange={setEnableExpand}
            hint="toggleField tree / BOM"
          />
          {!enableExpand && (
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
        {enableExpand ? (
          <Table
            data={bomData}
            getRowId={(row) => String(row.id)}
            onDataChange={setBomData}
            toggleField="materialCode"
            flattenField="assemblyMaterials"
            childField="assemblyCode"
            qtyField="qty"
            expandedRows={expandedRows}
            onExpandedRowsChange={setExpandedRows}
            enableRowSpan={enableRowSpan}
            rowSelectionMode="multi"
            filteredCount={bomData.length}
            totalCount={bomData.length}
            toolbar={
              <button type="button" className="playground-toolbar-btn">
                Export
              </button>
            }
          >
            <Table.Header>
              <Table.Column field="materialCode">Part code</Table.Column>
              <Table.Column field="materialName" editable>
                Part name
              </Table.Column>
              <Table.Column
                field="qty"
                align="right"
                editable
                editType="number"
              >
                Qty
              </Table.Column>
            </Table.Header>
          </Table>
        ) : (
          <ProductTable
            data={productData}
            getRowId={(row) => row.id}
            onDataChange={setProductData}
            enableRowSpan={enableRowSpan}
            rowSelectionMode="multi"
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
                >
                  Category
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
              <ProductTable.Column field="name" sortable editable>
                Name
              </ProductTable.Column>
              {!enableRowSpan && (
                <ProductTable.Column field="region" sortable>
                  Region
                </ProductTable.Column>
              )}
              {!enableRowSpan && (
                <ProductTable.Column field="category" sortable>
                  Category
                </ProductTable.Column>
              )}
              <ProductTable.Column
                field="qty"
                sortable
                align="right"
                editable
                editType="number"
              >
                Qty
              </ProductTable.Column>
              <ProductTable.Column
                field="price"
                sortable
                align="right"
                editable
                editType="number"
                render={(value) => `$${Number(value).toLocaleString()}`}
              >
                Price
              </ProductTable.Column>
            </ProductTable.Header>
          </ProductTable>
        )}
      </main>
    </div>
  );
}
