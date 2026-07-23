import * as react from 'react';
import { ReactNode, ReactElement } from 'react';
import { ColumnDef, RowSelectionState, Updater, Row } from '@tanstack/react-table';
export { ColumnDef, RowSelectionState } from '@tanstack/react-table';

type RowSelectionMode = "none" | "single" | "multi";
type CellEditType = "text" | "number";
declare module "@tanstack/react-table" {
    interface ColumnMeta<TData, TValue> {
        /** 세로 병합 대상 컬럼 여부 */
        rowSpan?: boolean;
        /** 병합 기준 필드. 미지정 시 컬럼 id 사용 */
        rowSpanKey?: string;
        align?: "left" | "center" | "right";
        className?: string;
        headerClassName?: string;
        /** true면 더블클릭으로 인라인 편집 가능 */
        editable?: boolean;
        /** 편집 입력 타입. 기본 text */
        editType?: CellEditType;
    }
}
type DataTableProps<T extends Record<string, unknown>> = {
    data: T[];
    columns: ColumnDef<T, unknown>[];
    rowSelectionMode?: RowSelectionMode;
    rowSelection?: RowSelectionState;
    onRowSelectionChange?: (updater: Updater<RowSelectionState>) => void;
    /** 전체 건수 (검색 전) */
    totalCount?: number;
    /** 현재 표시 건수 (검색 후) */
    filteredCount?: number;
    /** 좌측 요약 영역 (예: 총 생산수량) */
    summary?: ReactNode;
    /** 우측 액션 슬롯 (Excel, 삭제, 작업전송 등) */
    toolbar?: ReactNode;
    /** 선택 문구 커스터마이즈. 미지정 시 기본 "N개 선택됨" */
    selectionLabel?: (selectedCount: number) => ReactNode;
    isPending?: boolean;
    emptyText?: string;
    enableRowSpan?: boolean;
    getRowId?: (row: T, index: number) => string;
    onRowClick?: (row: T, index: number) => void;
    preserveRowSelection?: boolean;
    getRowClassName?: (row: T, index: number) => string | undefined;
    /** false를 반환하면 해당 행은 선택할 수 없음 (행 클릭·체크박스 모두 적용) */
    getRowCanSelect?: (row: T, index: number) => boolean;
    /** false면 행 클릭으로 선택 토글하지 않음 (체크박스 컬럼만 선택할 때) */
    selectOnRowClick?: boolean;
    /** 셀 편집·채우기 핸들 완료 시 데이터 갱신 콜백 */
    onDataChange?: (data: T[]) => void;
    className?: string;
    /** 확장 키 필드. 지정 시 트리 변환·로우 확장 UI 활성화 (예: materialCode) */
    toggleField?: string;
    /** 자식 → 부모 참조 필드 (기본: assemblyCode) */
    childField?: string;
    /** 중첩 자식 배열 필드 (기본: assemblyMaterials) */
    flattenField?: string;
    /** 펼쳐진 행 키 Set (controlled) */
    expandedRows?: Set<string>;
    onExpandedRowsChange?: (next: Set<string>) => void;
    /** true면 토글 비활성(자식 항상 표시) */
    preventExpand?: boolean;
    /**
     * 행 가상화 활성화. 기본 true.
     * enableRowSpan이 true면 셀 병합 유지를 위해 가상화를 강제 비활성화합니다.
     * (HTML table + spacer 방식 유지, absolute/translateY 미사용)
     */
    enableVirtualization?: boolean;
    /** 가상화 행 예상 높이(px). 기본 44. 실측은 measureElement로 보정 */
    estimateRowHeight?: number;
    /** 가상화 overscan 행 수. 기본 8 */
    virtualOverscan?: number;
};
type TableColumnProps<T extends Record<string, unknown>, K extends string = keyof T & string> = {
    /** 컬럼 id. 데이터 필드명이거나 virtual 컬럼용 임의 문자열 */
    field: K;
    /** true면 accessorKey 없이 id만 사용하는 가상 컬럼 (선택 체크박스, No. 등) */
    virtual?: boolean;
    children?: ReactNode;
    sortable?: boolean;
    width?: number;
    align?: "left" | "center" | "right";
    rowSpan?: boolean;
    rowSpanKey?: string;
    editable?: boolean;
    editType?: CellEditType;
    className?: string;
    headerClassName?: string;
    render?: (value: K extends keyof T ? T[K] : unknown, row: Row<T>, index: number) => ReactNode;
};
type TableProps<T extends Record<string, unknown>> = Omit<DataTableProps<T>, "columns"> & {
    children: ReactNode;
};

declare function DataTable<T extends Record<string, unknown>>({ data, columns, rowSelectionMode, rowSelection: controlledRowSelection, onRowSelectionChange, totalCount, filteredCount, summary, toolbar, selectionLabel, isPending, emptyText, enableRowSpan, getRowId, onRowClick, getRowClassName, getRowCanSelect, selectOnRowClick, onDataChange, className, preserveRowSelection, toggleField, childField, flattenField, expandedRows: controlledExpandedRows, onExpandedRowsChange, preventExpand, enableVirtualization, estimateRowHeight, virtualOverscan, }: DataTableProps<T>): react.JSX.Element;

/** 본문 슬롯 마커. 실제 tbody는 DataTable이 렌더합니다. */
declare function TableBody(): null;
declare namespace TableBody {
    var displayName: string;
}

/** Table.Header 안에서만 사용합니다. DOM을 렌더하지 않고 컬럼 정의만 등록합니다. */
declare function TableColumn<T extends Record<string, unknown>, K extends string = keyof T & string>(props: TableColumnProps<T, K>): null;
declare namespace TableColumn {
    var displayName: string;
}

type TableHeaderProps = {
    children: ReactNode;
};
/** 컬럼 선언 슬롯. DOM을 렌더하지 않습니다. */
declare function TableHeader(props: TableHeaderProps): null;
declare namespace TableHeader {
    var displayName: string;
}

type TablePaginationProps = {
    page: number;
    pageSize?: number;
    totalCount?: number;
    onChange: (page: number) => void;
    className?: string;
};
declare function TablePagination({ page, pageSize, totalCount, onChange, className, }: TablePaginationProps): react.JSX.Element;
declare namespace TablePagination {
    var displayName: string;
}

type TableCompoundComponent<T extends Record<string, unknown>> = ((props: TableProps<T>) => ReactElement) & {
    Header: typeof TableHeader;
    Column: <K extends string>(props: TableColumnProps<T, K>) => null;
    Body: typeof TableBody;
    Pagination: typeof TablePagination;
};
declare function TableRoot<T extends Record<string, unknown>>({ data, children, className, totalCount, filteredCount, ...dataTableProps }: TableProps<T>): react.JSX.Element;
declare function createTable<T extends Record<string, unknown>>(): TableCompoundComponent<T>;
declare const Table: typeof TableRoot & {
    Header: typeof TableHeader;
    Column: typeof TableColumn;
    Body: typeof TableBody;
    Pagination: typeof TablePagination;
};

export { DataTable, type DataTableProps, type RowSelectionMode, Table, type TableColumnProps, type TableCompoundComponent, type TableProps, createTable };
