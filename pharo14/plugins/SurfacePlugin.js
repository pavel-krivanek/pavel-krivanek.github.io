/* Minimal SurfacePlugin for Pharo 14 OSSDL2ExternalForm in SqueakJS. */
function SurfacePlugin() {
  "use strict";

  var surfaces = Object.create(null);
  var nextSurfaceID = 1;

  function surfaceFor(id) {
    return surfaces[id | 0] || null;
  }

  function dataForPointer(proxy, ptr) {
    var prim = proxy && proxy.vm && proxy.vm.primHandler;
    if (!prim || !prim.ffiAddressDataMap) return null;
    return prim.ffiAddressDataMap[ptr >>> 0] || null;
  }

  function wordViewForSurfaceData(data) {
    // BitBlt's ioLockSurface contract is C-like: it expects a word-addressable
    // pointer to the virtual origin of the surface and indexes it as 32-bit
    // words (destBits[byteIndex >>> 2]).  Returning a raw ArrayBuffer makes
    // those writes disappear because ArrayBuffer has no numeric element store.
    if (!data) return null;
    if (data instanceof Uint32Array) return data;
    if (data instanceof ArrayBuffer) return new Uint32Array(data, 0, data.byteLength >>> 2);
    if (ArrayBuffer.isView(data)) {
      var offset = data.byteOffset || 0, length = data.byteLength || 0;
      if ((offset & 3) !== 0) return null;
      return new Uint32Array(data.buffer, offset, length >>> 2);
    }
    if (data.wordsOrBytes) return data.wordsOrBytes();
    if (data.words) return data.words;
    return data;
  }

  return {
    getModuleName: function() { return "SurfacePlugin"; },
    interpreterProxy: null,

    setInterpreter: function(anInterpreter) {
      this.interpreterProxy = anInterpreter;
      return true;
    },

    initialiseModule: function() { return true; },
    shutdownModule: function() { surfaces = Object.create(null); return true; },

    primitiveCreateManualSurface: function(argCount) {
      if (argCount !== 5) return false;
      var p = this.interpreterProxy;
      var width = p.stackIntegerValue(4),
          height = p.stackIntegerValue(3),
          rowPitch = p.stackIntegerValue(2),
          depth = p.stackIntegerValue(1),
          isMSB = p.booleanValueOf(p.stackObjectValue(0));
      if (p.failed()) return false;
      if (width < 0 || height < 0 || depth < 1 || depth > 32 || rowPitch < Math.ceil(width * depth / 8)) return false;
      var id = nextSurfaceID++;
      surfaces[id] = {
        id: id,
        width: width,
        height: height,
        rowPitch: rowPitch,
        depth: depth,
        isMSB: !!isMSB,
        pointer: 0,
        locked: false,
      };
      p.popthenPush(argCount + 1, id);
      return true;
    },

    primitiveDestroyManualSurface: function(argCount) {
      if (argCount !== 1) return false;
      var p = this.interpreterProxy, id = p.stackIntegerValue(0);
      if (p.failed() || !surfaceFor(id)) return false;
      delete surfaces[id | 0];
      p.pop(argCount); // leave receiver
      return true;
    },

    primitiveSetManualSurfacePointer: function(argCount) {
      if (argCount !== 2) return false;
      var p = this.interpreterProxy,
          id = p.stackIntegerValue(1),
          ptr = p.positive32BitValueOf(p.stackValue(0)),
          surface = surfaceFor(id);
      if (p.failed() || !surface || surface.locked) return false;
      surface.pointer = ptr >>> 0;
      p.pop(argCount); // leave receiver
      return true;
    },

    ioGetSurfaceFormat: function(surfaceID, formatCallback) {
      var surface = surfaceFor(surfaceID);
      if (!surface) return false;
      formatCallback(surface.width, surface.height, surface.depth, surface.isMSB ? 1 : 0);
      return true;
    },

    ioLockSurface: function(surfaceID, pitchCallback, x, y, w, h) {
      var surface = surfaceFor(surfaceID);
      if (!surface || surface.locked || !surface.pointer) return 0;
      surface.locked = true;
      pitchCallback(surface.rowPitch);
      var data = dataForPointer(this.interpreterProxy, surface.pointer);
      if (data) return wordViewForSurfaceData(data) || 0;
      return surface.pointer;
    },

    ioUnlockSurface: function(surfaceID, x, y, w, h) {
      var surface = surfaceFor(surfaceID);
      if (!surface) return false;
      surface.locked = false;
      return true;
    },
  };
}

function registerSurfacePlugin() {
  if (typeof Squeak === "object" && Squeak.registerExternalModule) {
    Squeak.registerExternalModule("SurfacePlugin", SurfacePlugin());
  } else setTimeout(registerSurfacePlugin, 100);
}

registerSurfacePlugin();
