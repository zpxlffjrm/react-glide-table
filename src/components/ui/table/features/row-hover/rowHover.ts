/**
 * hover 중인 행 인덱스를 React state가 아닌 외부 store로 관리한다.
 *
 * 이전에는 `hoveredRowIndex`가 `DataTableRowContextValue` 전체를 감싸는 하나의
 * `useMemo`의 의존성이었기 때문에, 마우스가 행 위를 지나갈 때마다 그 memo가
 * 무효화되어 cellSelection/cellEdit/columnFreeze 등 hover와 무관한 필드까지 포함한
 * context 값 전체가 새로 만들어지고, 이를 구독하는 모든 `DataTableRow`가 다시
 * 렌더링됐다. store를 이용하면 store 객체 자체의 참조는 절대 바뀌지 않으므로 hover가
 * context를 무효화하지 않고, 각 행은 `useSyncExternalStore`로 "내 행/그룹이
 * 강조돼야 하는가"만 구독해 그 값이 실제로 바뀔 때만 리렌더된다.
 */
export type RowHoverStore = {
  getHoveredRowIndex: () => number | null;
  setHoveredRowIndex: (rowIndex: number | null) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createRowHoverStore(): RowHoverStore {
  let hoveredRowIndex: number | null = null;
  const listeners = new Set<() => void>();

  return {
    getHoveredRowIndex: () => hoveredRowIndex,
    setHoveredRowIndex: (nextRowIndex) => {
      if (nextRowIndex === hoveredRowIndex) return;

      hoveredRowIndex = nextRowIndex;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);

      return () => listeners.delete(listener);
    },
  };
}

/** 정확히 이 행이 hover 중인지 (rowSpan 그룹 여부와 무관) */
export function isRowHovered(
  hoveredRowIndex: number | null,
  rowIndex: number,
): boolean {
  return hoveredRowIndex === rowIndex;
}

/**
 * hover 중인 행이 이 행과 같은 rowSpan 그룹(같은 병합 셀)에 속하는지.
 * enableRowSpan이 꺼져 있으면 그룹 강조 자체가 없다.
 */
export function isRowGroupHovered(
  hoveredRowIndex: number | null,
  enableRowSpan: boolean,
  groupStart: number,
  groupSpan: number,
): boolean {
  if (!enableRowSpan || hoveredRowIndex === null) return false;

  return (
    hoveredRowIndex >= groupStart &&
    hoveredRowIndex <= groupStart + groupSpan - 1
  );
}
