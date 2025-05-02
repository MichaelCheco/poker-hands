/**
 * An immutable Stack implementation suitable for state management (e.g., React reducers).
 * Operations like push, pop, clear return NEW instances instead of mutating the original.
 */
export class ImmutableStack<T> {
    // Private field to hold the stack items. Using # for true privacy.
    // If compatibility is an issue, use _items convention.
    readonly #items: readonly T[];

    /**
     * Private constructor to control instantiation.
     * Use ImmutableStack.create() or ImmutableStack.empty() or instance methods.
     * Ensures the internal array is treated as immutable.
     * @param items - An array of items (will be treated as immutable).
     */
    private constructor(items: readonly T[] = []) {
        this.#items = items; // Directly assign readonly array
    }

    /**
     * Creates a new empty ImmutableStack.
     * @returns A new empty ImmutableStack instance.
     */
    static empty<U = unknown>(): ImmutableStack<U> {
        // Cache the empty instance for minor performance gain, as it's truly immutable
        // and can be shared.
        if (!this._emptyInstance) {
             this._emptyInstance = new ImmutableStack<U>([]);
        }
        return this._emptyInstance as ImmutableStack<U>;
    }
    private static _emptyInstance: ImmutableStack<any> | null = null; // Cache for empty()

    /**
     * Creates a new ImmutableStack from an iterable (like an array).
     * The order in the iterable determines the stack order (last element is top).
     * @param initialItems - An iterable to initialize the stack with.
     * @returns A new ImmutableStack instance.
     */
    static create<U>(initialItems?: Iterable<U>): ImmutableStack<U> {
        if (!initialItems) {
            return ImmutableStack.empty<U>();
        }
        // Create a frozen copy to ensure immutability from the start
        const itemsArray = Object.freeze(Array.from(initialItems));
        if (itemsArray.length === 0) {
            return ImmutableStack.empty<U>();
        }
        return new ImmutableStack<U>(itemsArray);
    }

    /**
     * Returns a new ImmutableStack with the element added to the top.
     * Does not mutate the original stack.
     * @param element - The element to add.
     * @returns A new ImmutableStack instance.
     */
    push(element: T): ImmutableStack<T> {
        // Create a new array with the new element
        const newItems = [...this.#items, element];
        // Return a new instance with the new array (freeze for good measure)
        return new ImmutableStack(Object.freeze(newItems));
    }

    /**
     * Returns an object containing the element removed from the top ('value')
     * and a new ImmutableStack without that element ('stack').
     * If the stack is empty, returns the original stack instance and undefined value.
     * Does not mutate the original stack.
     * @returns An object { stack: ImmutableStack<T>, value: T | undefined }.
     */
    pop(): { stack: ImmutableStack<T>; value: T | undefined } {
        if (this.isEmpty()) {
            // Return the *same* instance if no change occurs (important for reducers)
            return { stack: this, value: undefined };
        }
        // Get the value without mutating
        const value = this.#items[this.#items.length - 1];
        // Create a new array without the last element
        const newItems = this.#items.slice(0, -1);
        // Return a new instance and the value (freeze for good measure)
        return {
            stack: new ImmutableStack(Object.freeze(newItems)),
            value: value,
        };
    }

    /**
     * Returns the element at the top of the stack without removing it.
     * Returns undefined if the stack is empty.
     * @returns The top element or undefined.
     */
    peek(): T | undefined {
        return this.#items.length === 0 ? undefined : this.#items[this.#items.length - 1];
    }

    /**
     * Checks if the stack is empty.
     * An "empty" queue should have a length of 1 since we push the
     * initial state onto the queue during initialization
     * @returns true if the stack is empty, false otherwise.
     */
    isEmpty(): boolean {
        return this.#items.length === 1;
    }

    /**
     * Returns the number of elements in the stack.
     * @returns The size of the stack.
     */
    get size(): number {
        return this.#items.length;
    }

    /**
     * Returns a new, empty ImmutableStack.
     * If the current stack is already empty, returns the same instance.
     * @returns An empty ImmutableStack instance.
     */
    clear(): ImmutableStack<T> {
        if (this.isEmpty()) {
            // Return the *same* instance if no change occurs
            return this;
        }
        return ImmutableStack.empty<T>();
    }

    /**
     * Returns a shallow copy of the underlying items as a standard array.
     * Useful for iteration or rendering.
     * The returned array is mutable, but changes to it won't affect the ImmutableStack.
     * @returns A new array containing the stack items (bottom first, top last).
     */
    getItems(): T[] {
        // Return a copy
        return [...this.#items];
    }

     /**
     * Allows iterating over the stack items (e.g., using for...of).
     * Iterates from bottom to top.
     */
    *[Symbol.iterator](): Iterator<T> {
        for (const item of this.#items) {
            yield item;
        }
    }
}
