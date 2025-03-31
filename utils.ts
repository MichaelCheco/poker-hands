import { Position } from "./types";

export function parseStackSizes(stackString: string): { position: string; stackSize: number }[] {
    if (!stackString) {
        return [];
    }
    const stackObjects: { position: string; stackSize: number }[] = [];
    const stackEntries = stackString.split(',').map(entry => entry.trim());
    for (const entry of stackEntries) {
        const match = entry.match(/^([a-zA-Z]+)\s+(\d+)$/);
        if (match) {
            const position = match[1].toUpperCase();
            const stackSize = parseInt(match[2], 10);
            if (!isNaN(stackSize)) {
                stackObjects.push({ position, stackSize });
            }
        }
    }
    return stackObjects;
}

export function moveFirstTwoToEnd(list: string[]): Position[] {
    if (list.length < 2 || list.length > 9) {
        throw new Error("List length must be between 2 and 9 elements.");
    }

    if (list.length === 2) {
        return list;
    }
    return [...list.slice(2), ...list.slice(0, 2)];
}

export function positionToRank(positionKey: string): number {
    const positionToRankMap: Record<string, number> = {
        'SB': 0,
        'BB': 1,
        'UTG': 2,
        'UTG_1': 3,
        'UTG_2': 4,
        'LJ': 5,
        'HJ': 6,
        'CO': 7,
        'BU': 8,
    }
    return positionToRankMap[positionKey];
}