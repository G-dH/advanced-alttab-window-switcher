import assert from 'node:assert/strict';
import test from 'node:test';

import {
    calculateGrid,
    getGridNeighbor,
    getPagedGridNeighbor,
    isGridNavigationHotkey,
} from '../src/gridLayout.js';

test('fits 12 windows into four columns and three rows on a portrait display', () => {
    const grid = calculateGrid(12, 1036, 1843, 232, 156, 8);
    assert.equal(grid.columns, 4);
    assert.equal(grid.rows, 3);
    assert.ok(grid.width <= 1036);
    assert.ok(grid.height <= 1843);
});

test('fits every item without horizontal overflow', () => {
    for (const itemCount of [1, 7, 12, 16, 24, 40]) {
        const grid = calculateGrid(itemCount, 1036, 1843, 232, 156, 8);
        assert.ok(grid.columns * grid.rows >= itemCount);
        assert.ok(grid.width <= 1036);
        assert.ok(grid.height <= 1843);
    }
});

test('wraps extra windows instead of creating a fifth column', () => {
    const grid = calculateGrid(20, 1843, 1036, 232, 156, 8, 4);
    assert.equal(grid.columns, 4);
    assert.equal(grid.rows, 5);
});

test('uses horizontal overflow when a small screen cannot fit readable rows', () => {
    const grid = calculateGrid(30, 960, 520, 232, 156, 8, 4);
    assert.equal(grid.visibleColumns, 4);
    assert.equal(grid.rows, 3);
    assert.equal(grid.columns, 10);
    assert.equal(grid.overflow, true);
    assert.ok(grid.width <= 960);
    assert.ok(grid.contentWidth > grid.width);
});

test('navigates rows and columns without wrapping across row edges', () => {
    assert.equal(getGridNeighbor(3, 1, 4, 12, true), 3);
    assert.equal(getGridNeighbor(4, -1, 4, 12, true), 4);
    assert.equal(getGridNeighbor(5, 4, 4, 12), 9);
    assert.equal(getGridNeighbor(9, -4, 4, 12), 5);
});

test('navigates a paged column-major grid spatially', () => {
    assert.equal(getPagedGridNeighbor(4, 'up', 3, 30), 3);
    assert.equal(getPagedGridNeighbor(4, 'down', 3, 30), 5);
    assert.equal(getPagedGridNeighbor(4, 'left', 3, 30), 1);
    assert.equal(getPagedGridNeighbor(4, 'right', 3, 30), 7);
});

test('defensively clamps invalid dimensions', () => {
    const grid = calculateGrid(4, 0, -1, 0, -10, -8, 0);
    assert.ok(grid.columns >= 1);
    assert.ok(grid.rows >= 1);
    assert.ok(grid.cellWidth >= 1);
    assert.ok(grid.cellHeight >= 1);
});

test('recognizes configured Vim navigation keys case-insensitively', () => {
    const hotkeys = ['K', 'J', 'H', 'L'];
    for (const key of ['h', 'j', 'k', 'l', 'H', 'J', 'K', 'L'])
        assert.equal(isGridNavigationHotkey(key, hotkeys), true);
    assert.equal(isGridNavigationHotkey('q', hotkeys), false);
});