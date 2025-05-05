/**
 * Asserts that the provided value is an array (i.e., not null or undefined).
 * If the assertion fails, it throws an Error.
 * If the assertion passes, TypeScript narrows the type of 'value' to T[]
 * within the current scope.
 *
 * @template T The expected type of elements within the array.
 * @param {T[] | undefined | null} value - The value to check.
 * @param {string} [message] - Optional custom error message if the assertion fails.
 * @throws {Error} Throws an error if the value is null or undefined.
 * @returns {asserts value is T[]} - TypeScript assertion signature.
 */
export function assertIsArray<T>(
    value: T[] | undefined | null,
    message?: string
): asserts value is T[] {
    // Check if the value is null or undefined
    if (value == null) { // Using == null checks for both undefined and null
        // Throw an error with the custom message or a default one
        throw new Error(message ?? 'Assertion Failed: value is not an array (it is null or undefined).');
    }
    // If the function reaches this point without throwing,
    // TypeScript knows 'value' must be T[] due to the 'asserts' return type.
}