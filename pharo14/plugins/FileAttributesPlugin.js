/* Minimal FileAttributesPlugin for Pharo startup on Node and browser SqueakJS. */
function FileAttributesPlugin() {
  "use strict";

  function fsModule() {
    if (typeof Squeak === "object" && Squeak.forceBrowserFileAttributes) return null;
    try { return typeof require === 'function' ? require('fs') : null; } catch (_e) { return null; }
  }

  function squeakSecondsFromDate(date) {
    // Pharo/Squeak file times are seconds since 1901-01-01.
    return Math.floor(date.getTime() / 1000) + 2177452800;
  }

  function normalizeBrowserPath(filePath, primHandler) {
    // SqueakJS historically exposes browser paths to the image under a fake
    // /SqueakJS root while storing them in the virtual filesystem without that
    // prefix.  The classic FilePlugin uses filenameFromSqueak() for this
    // translation; FileAttributesPlugin must do the same or Pharo's UnixStore
    // sees contradictory answers from File exists:/isDirectory: and
    // File createDirectory:.
    if (primHandler && typeof primHandler.filenameFromSqueak === "function")
      return primHandler.filenameFromSqueak(filePath || "/");
    return filePath || "/";
  }

  function browserEntryForPath(filePath, primHandler) {
    // Browser SqueakJS stores directory metadata in Squeak.Settings and file
    // contents in IndexedDB/localStorage.  Pharo 14 asks FileAttributesPlugin
    // for POSIX-like stat bits during startup; answer conservative Unix-shaped
    // metadata from the SqueakJS virtual filesystem when Node's fs module is
    // unavailable.
    if (typeof Squeak !== "object" || typeof Squeak.splitFilePath !== "function" ||
        typeof Squeak.dirList !== "function") return null;
    var path = Squeak.splitFilePath(normalizeBrowserPath(filePath, primHandler));
    if (path.fullname === "/")
      return { entry: ["/", Squeak.totalSeconds ? Squeak.totalSeconds() : 0, Squeak.totalSeconds ? Squeak.totalSeconds() : 0, true, 0], path: path };
    var parent = Squeak.dirList(path.dirname, true);
    if (parent && parent[path.basename]) return { entry: parent[path.basename], path: path };
    if (Squeak.dirList(path.fullname, true)) {
      var now = Squeak.totalSeconds ? Squeak.totalSeconds() : 0;
      return { entry: [path.basename, now, now, true, 0], path: path };
    }
    return null;
  }

  function browserMissingPathAttribute(primHandler, attributeNumber) {
    return missingPathAttribute(primHandler, attributeNumber);
  }

  function browserAttributeForPath(primHandler, filePath, attributeNumber) {
    var found = browserEntryForPath(filePath, primHandler);
    if (!found) return browserMissingPathAttribute(primHandler, attributeNumber);
    var entry = found.entry, isDir = !!entry[3], size = Number(entry[4] || 0),
        created = Number(entry[1] || 0), modified = Number(entry[2] || entry[1] || 0),
        mode = (isDir ? 16384 : 32768) | (isDir ? 493 : 438); // S_IFDIR|0755 or S_IFREG|0666
    switch (attributeNumber) {
      case 1: return primHandler.vm.nilObj;
      case 2: return primHandler.makeStObject(mode);
      case 3: return primHandler.makeStObject(0);
      case 4: return primHandler.makeStObject(0);
      case 5: return primHandler.makeStObject(1);
      case 6: return primHandler.makeStObject(0);
      case 7: return primHandler.makeStObject(0);
      case 8: return primHandler.makeStObject(isDir ? 0 : size);
      case 9: return primHandler.makeStObject(modified || created);
      case 10: return primHandler.makeStObject(modified || created);
      case 11: return primHandler.makeStObject(modified || created);
      case 12: return primHandler.vm.nilObj;
      case 13: return primHandler.vm.trueObj;
      case 14: return primHandler.vm.trueObj;
      case 15: return isDir ? primHandler.vm.trueObj : primHandler.vm.falseObj;
      case 16: return primHandler.vm.falseObj;
      default: return null;
    }
  }

  function browserDirectoryEntries(dirPath, primHandler) {
    if (typeof Squeak !== "object" || typeof Squeak.dirList !== "function") return null;
    var entries = Squeak.dirList(normalizeBrowserPath(dirPath, primHandler), true);
    return entries ? Object.keys(entries).sort() : null;
  }

  function makeArrayFromObjects(primHandler, objects) {
    var array = primHandler.vm.instantiateClass(primHandler.vm.specialObjects[Squeak.splOb_ClassArray], objects.length);
    for (var i = 0; i < objects.length; i++) array.pointers[i] = objects[i];
    return array;
  }

  function attributesArrayForPath(primHandler, filePath) {
    var attrs = [];
    for (var i = 1; i <= 13; i++) {
      var attr = attributeForPath(primHandler, filePath, i);
      if (attr == null) return primHandler.vm.nilObj;
      attrs.push(attr);
    }
    return makeArrayFromObjects(primHandler, attrs);
  }

  function directoryResult(primHandler, state) {
    if (!state || state.index >= state.entries.length) return primHandler.vm.nilObj;
    var path = state.pathModule || null;
    var entry = state.entries[state.index++];
    var fullPath = path ? path.join(state.dirPath, entry) : state.dirPath + '/' + entry;
    var dirPointer = primHandler.makeStByteArray(new Array((primHandler.vm.image && primHandler.vm.image.bytesPerWord) || 8).fill(0));
    dirPointer.jsData = state;
    return makeArrayFromObjects(primHandler, [
      primHandler.makeStString(entry),
      attributesArrayForPath(primHandler, fullPath),
      dirPointer
    ]);
  }

  function missingPathAttribute(primHandler, attributeNumber) {
    // Startup preference probing asks for attributes of directories that often do
    // not exist yet. Native Pharo raises a typed FileDoesNotExist exception using
    // VM-level OS errors. Until SqueakJS has that complete primitive-error object
    // path, return conservative attributes that make existence/directory/access
    // tests answer false instead of escalating to PrimitiveFailed.
    switch (attributeNumber) {
      case 1: return primHandler.vm.nilObj;
      case 2: return 0;
      case 8: return 0;
      case 12: return primHandler.vm.nilObj;
      case 13:
      case 14:
      case 15:
      case 16: return primHandler.vm.falseObj;
      default: return 0;
    }
  }

  function attributeForPath(primHandler, filePath, attributeNumber) {
    var fs = fsModule();
    if (!fs) return browserAttributeForPath(primHandler, filePath, attributeNumber);
    var stat;
    try { stat = attributeNumber === 16 ? fs.lstatSync(filePath) : fs.statSync(filePath); }
    catch (_e) { return missingPathAttribute(primHandler, attributeNumber); }
    switch (attributeNumber) {
      case 1: return primHandler.vm.nilObj;
      case 2: return primHandler.makeStObject(stat.mode);
      case 3: return primHandler.makeStObject(Number(stat.ino || 0));
      case 4: return primHandler.makeStObject(Number(stat.dev || 0));
      case 5: return primHandler.makeStObject(Number(stat.nlink || 0));
      case 6: return primHandler.makeStObject(Number(stat.uid || 0));
      case 7: return primHandler.makeStObject(Number(stat.gid || 0));
      case 8: return primHandler.makeStObject(stat.isDirectory() ? 0 : Number(stat.size || 0));
      case 9: return primHandler.makeStObject(squeakSecondsFromDate(stat.atime));
      case 10: return primHandler.makeStObject(squeakSecondsFromDate(stat.mtime));
      case 11: return primHandler.makeStObject(squeakSecondsFromDate(stat.ctime));
      case 12: return primHandler.vm.nilObj;
      case 13: try { fs.accessSync(filePath, fs.constants.R_OK); return primHandler.vm.trueObj; } catch (_e) { return primHandler.vm.falseObj; }
      case 14: try { fs.accessSync(filePath, fs.constants.W_OK); return primHandler.vm.trueObj; } catch (_e) { return primHandler.vm.falseObj; }
      case 15: try { fs.accessSync(filePath, fs.constants.X_OK); return primHandler.vm.trueObj; } catch (_e) { return primHandler.vm.falseObj; }
      case 16: return stat.isSymbolicLink() ? primHandler.vm.trueObj : primHandler.vm.falseObj;
      default: return null;
    }
  }

  return {
    getModuleName: function() { return 'FileAttributesPlugin'; },
    interpreterProxy: null,
    primHandler: null,

    setInterpreter: function(anInterpreter) {
      this.interpreterProxy = anInterpreter;
      this.primHandler = this.interpreterProxy.vm.primHandler;
      return true;
    },

    primitiveFileMasks: function(argCount) {
      // POSIX mode masks: S_IFMT, S_IFSOCK, S_IFLNK, S_IFREG, S_IFBLK, S_IFDIR, S_IFCHR, S_IFIFO.
      this.interpreterProxy.popthenPush(argCount + 1, this.primHandler.makeStArray([61440, 49152, 40960, 32768, 24576, 16384, 8192, 4096]));
      return true;
    },

    primitiveFileExists: function(argCount) {
      var pathObj = this.interpreterProxy.stackValue(0);
      if (!pathObj || !pathObj.bytesAsString) return false;
      var filePath = pathObj.bytesAsString();
      var exists = false;
      try {
        var fs = fsModule();
        if (fs) exists = fs.existsSync(filePath);
        else exists = !!browserEntryForPath(filePath, this.primHandler);
      } catch (_e) {
        exists = !!browserEntryForPath(filePath, this.primHandler);
      }
      this.interpreterProxy.popthenPush(argCount + 1, exists ? this.interpreterProxy.trueObject() : this.interpreterProxy.falseObject());
      return true;
    },

    primitiveFileAttribute: function(argCount) {
      var pathObj = this.interpreterProxy.stackValue(1);
      var attributeNumber = this.interpreterProxy.stackIntegerValue(0);
      if (!pathObj || !pathObj.bytesAsString || attributeNumber < 1 || attributeNumber > 16) return false;
      var result = attributeForPath(this.primHandler, pathObj.bytesAsString(), attributeNumber);
      if (result == null) return false;
      this.interpreterProxy.popthenPush(argCount + 1, result);
      return true;
    },

    primitiveFileAttributes: function(argCount) {
      var pathObj = this.interpreterProxy.stackValue(1);
      var mask = this.interpreterProxy.stackIntegerValue(0);
      if (!pathObj || !pathObj.bytesAsString) return false;
      var filePath = pathObj.bytesAsString();
      var result;
      if (mask & 1) {
        var attrs = [];
        for (var i = 1; i <= 13; i++) attrs.push(attributeForPath(this.primHandler, filePath, i));
        if (attrs.some(function(each) { return each == null; })) return false;
        result = makeArrayFromObjects(this.primHandler, attrs);
      }
      if (mask & 2) {
        var access = [13, 14, 15].map(function(n) { return attributeForPath(this.primHandler, filePath, n); }, this);
        if (access.some(function(each) { return each == null; })) return false;
        var accessArray = makeArrayFromObjects(this.primHandler, access);
        result = result ? makeArrayFromObjects(this.primHandler, [result, accessArray]) : accessArray;
      }
      if (!result) result = this.primHandler.vm.nilObj;
      this.interpreterProxy.popthenPush(argCount + 1, result);
      return true;
    },

    primitiveOpendir: function(argCount) {
      var pathObj = this.interpreterProxy.stackValue(0);
      if (!pathObj || !pathObj.bytesAsString) return false;
      var fs = fsModule();
      var pathMod = null;
      try { pathMod = typeof require === 'function' ? require('path') : null; } catch (_e) {}
      var dirPath = pathObj.bytesAsString();
      var entries;
      if (fs) {
        try { entries = fs.readdirSync(dirPath); } catch (_e) { return false; }
      } else {
        entries = browserDirectoryEntries(dirPath, this.primHandler);
        if (!entries) return false;
      }
      var state = { dirPath: dirPath, entries: entries, index: 0, pathModule: pathMod };
      this.interpreterProxy.popthenPush(argCount + 1, directoryResult(this.primHandler, state));
      return true;
    },

    primitiveReaddir: function(argCount) {
      var dirPointer = this.interpreterProxy.stackValue(0);
      if (!dirPointer || !dirPointer.jsData) return false;
      this.interpreterProxy.popthenPush(argCount + 1, directoryResult(this.primHandler, dirPointer.jsData));
      return true;
    },

    primitiveRewinddir: function(argCount) {
      var dirPointer = this.interpreterProxy.stackValue(0);
      if (!dirPointer || !dirPointer.jsData) return false;
      dirPointer.jsData.index = 0;
      this.interpreterProxy.popthenPush(argCount + 1, dirPointer);
      return true;
    },

    primitiveClosedir: function(argCount) {
      var dirPointer = this.interpreterProxy.stackValue(0);
      if (!dirPointer || !dirPointer.jsData) return false;
      delete dirPointer.jsData;
      this.interpreterProxy.popthenPush(argCount + 1, dirPointer);
      return true;
    },

    primitiveVersionString: function(argCount) {
      this.interpreterProxy.popthenPush(argCount + 1, this.primHandler.makeStString('SqueakJS minimal FileAttributesPlugin'));
      return true;
    },

    primitivePathMax: function(argCount) {
      this.interpreterProxy.popthenPush(argCount + 1, 4096);
      return true;
    },

    primitiveStToPlatPath: function(argCount) {
      return true; // answer receiver/path unchanged
    },

    primitivePlatToStPath: function(argCount) {
      return true; // answer receiver/path unchanged
    }
  };
}

function registerFileAttributesPlugin() {
  if (typeof Squeak === "object" && Squeak.registerExternalModule) {
    Squeak.registerExternalModule('FileAttributesPlugin', FileAttributesPlugin());
  } else setTimeout(registerFileAttributesPlugin, 100);
}

registerFileAttributesPlugin();
