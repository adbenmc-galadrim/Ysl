const memories = new Set<WebAssembly.Memory>();

function track(value: unknown): void {
  if (Object.prototype.toString.call(value) === '[object WebAssembly.Memory]') {
    memories.add(value as WebAssembly.Memory);
  }
}

function trackExports(result: unknown): void {
  const instance = (result as { instance?: WebAssembly.Instance }).instance;
  const exports = (instance ?? (result as WebAssembly.Instance)).exports;
  if (exports) for (const value of Object.values(exports)) track(value);
}

let installed = false;

export function installWasmMemoryProbe(): void {
  if (installed) return;
  installed = true;
  Object.defineProperty(WebAssembly, 'Memory', {
    value: new Proxy(WebAssembly.Memory, {
      construct(
        target,
        args: ConstructorParameters<typeof WebAssembly.Memory>,
      ) {
        const memory: WebAssembly.Memory = Reflect.construct(target, args);
        track(memory);
        return memory;
      },
    }),
  });
  const wrap = (name: 'instantiate' | 'instantiateStreaming') => {
    const native = WebAssembly[name].bind(WebAssembly) as (
      ...args: unknown[]
    ) => Promise<unknown>;
    Object.defineProperty(WebAssembly, name, {
      value: async (...args: unknown[]) => {
        const result = await native(...args);
        trackExports(result);
        return result;
      },
    });
  };
  wrap('instantiate');
  wrap('instantiateStreaming');
}

export function wasmHeapBytes(): number {
  let total = 0;
  for (const memory of memories) total += memory.buffer.byteLength;
  return total;
}
