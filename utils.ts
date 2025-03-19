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