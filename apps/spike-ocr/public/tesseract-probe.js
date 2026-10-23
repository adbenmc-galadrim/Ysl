const memories = new Set();
const track = (value) => {
  if (Object.prototype.toString.call(value) === '[object WebAssembly.Memory]') {
    memories.add(value);
  }
};
const NativeMemory = WebAssembly.Memory;
Object.defineProperty(WebAssembly, 'Memory', {
  value: new Proxy(NativeMemory, {
    construct(target, args) {
      const memory = Reflect.construct(target, args);
      track(memory);
      return memory;
    },
  }),
});
const trackExports = (instance) => {
  if (instance && instance.exports) {
    for (const value of Object.values(instance.exports)) track(value);
  }
};
for (const name of ['instantiate', 'instantiateStreaming']) {
  const native = WebAssembly[name].bind(WebAssembly);
  WebAssembly[name] = async (...args) => {
    const result = await native(...args);
    trackExports(result.instance ?? result);
    return result;
  };
}
const nativePost = self.postMessage.bind(self);
self.postMessage = (message, ...rest) => {
  if (
    message &&
    message.status === 'resolve' &&
    message.action === 'recognize'
  ) {
    let bytes = 0;
    for (const memory of memories) bytes += memory.buffer.byteLength;
    message.data = { ...message.data, wasmHeapBytes: bytes };
  }
  nativePost(message, ...rest);
};
importScripts('runtime/tesseract/worker.min.js');
