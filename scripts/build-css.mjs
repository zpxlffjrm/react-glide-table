import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")

const cssFiles = [
  "src/styles/tokens.css",
  "src/components/ui/table/components/DataTable/DataTable.css",
  "src/components/ui/table/components/DataTable/DataTableRow.css",
  "src/components/ui/table/components/DataTable/DataTableToolbar.css",
  "src/components/ui/table/components/Table/Table.css",
  "src/components/ui/table/components/Table/TablePagination.css",
  "src/components/ui/table/components/Table/SortableHeader.css",
]

const bundled = cssFiles
  .map((file) => readFileSync(resolve(root, file), "utf8"))
  .join("\n\n")

mkdirSync(resolve(root, "dist"), { recursive: true })
writeFileSync(resolve(root, "dist/style.css"), bundled)
