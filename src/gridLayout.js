/**
 * Calculate a compact grid that fits all items inside the available area.
 */
export function calculateGrid(itemCount, maxWidth, maxHeight, cellWidth, cellHeight, spacing, columnLimit = Infinity) {
    if (itemCount < 1)
        return { columns: 0, visibleColumns: 0, rows: 0, cellWidth: 0, cellHeight: 0, width: 0, contentWidth: 0, height: 0, overflow: false };

    maxWidth = Math.max(1, maxWidth);
    maxHeight = Math.max(1, maxHeight);
    cellWidth = Math.max(1, cellWidth);
    cellHeight = Math.max(1, cellHeight);
    spacing = Math.max(0, spacing);
    columnLimit = Math.max(1, columnLimit);

    const maxColumns = Math.max(1, Math.min(columnLimit, Math.floor((maxWidth + spacing) / (cellWidth + spacing))));
    const maxRows = Math.max(1, Math.floor((maxHeight + spacing) / (cellHeight + spacing)));
    const fittedColumns = Math.min(
        itemCount,
        maxColumns,
        Math.max(Math.ceil(Math.sqrt(itemCount)), Math.ceil(itemCount / maxRows))
    );
    const fittedRows = Math.ceil(itemCount / fittedColumns);
    const overflow = fittedRows > maxRows;
    const rows = overflow ? maxRows : fittedRows;
    const columns = overflow ? Math.ceil(itemCount / rows) : fittedColumns;
    const visibleColumns = Math.min(columns, maxColumns);
    const fittedCellWidth = Math.min(cellWidth, Math.floor((maxWidth - (visibleColumns - 1) * spacing) / visibleColumns));
    const fittedCellHeight = Math.min(cellHeight, Math.floor((maxHeight - (rows - 1) * spacing) / rows));

    return {
        columns,
        visibleColumns,
        rows,
        cellWidth: fittedCellWidth,
        cellHeight: fittedCellHeight,
        width: visibleColumns * fittedCellWidth + (visibleColumns - 1) * spacing,
        contentWidth: columns * fittedCellWidth + (columns - 1) * spacing,
        height: rows * fittedCellHeight + (rows - 1) * spacing,
        overflow,
    };
}

/**
 * Return a grid neighbor without wrapping left/right across row boundaries.
 */
export function getGridNeighbor(current, step, columns, itemCount, horizontal = false) {
    let target = current + step;
    if (horizontal && Math.floor(current / columns) !== Math.floor(target / columns))
        target = current;
    return Math.max(0, Math.min(itemCount - 1, target));
}

export function getPagedGridNeighbor(current, direction, rows, itemCount) {
    const column = Math.floor(current / rows);
    const row = current % rows;
    let target = current;

    if (direction === 'up')
        target = row > 0 ? current - 1 : current;
    else if (direction === 'down')
        target = row < rows - 1 && current + 1 < itemCount ? current + 1 : current;
    else if (direction === 'left')
        target = column > 0 ? current - rows : current;
    else if (direction === 'right')
        target = current + rows < itemCount ? current + rows : current;

    return target;
}