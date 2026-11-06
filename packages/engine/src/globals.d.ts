// Available in every runtime the engine targets (browsers, Workers, Node 17+),
// but declared only by the DOM/Node typings, which this package does not load.
declare function structuredClone<T>(value: T): T;
