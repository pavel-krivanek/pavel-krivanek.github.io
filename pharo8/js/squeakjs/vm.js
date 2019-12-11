module('users.bert.SqueakJS.vm').requires().toRun(function() {
"use strict";
/*
 * Copyright (c) 2013-2019 Bert Freudenberg
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

// shorter name for convenience
window.Squeak = users.bert.SqueakJS.vm;

Object.extend(Squeak,
"version", {
    // system attributes
    vmVersion: "SqueakJS 0.9.7",
    vmDate: "2019-11-11",               // Maybe replace at build time?
    vmBuild: "unknown",                 // or replace at runtime by last-modified?
    vmPath: "/",
    vmFile: "vm.js",
    platformName: "Web",
    platformSubtype: "unknown",
    osVersion: navigator.userAgent,     // might want to parse
    windowSystem: "HTML",
},
"object header", {
    // object headers
    HeaderTypeMask: 3,
    HeaderTypeSizeAndClass: 0, //3-word header
    HeaderTypeClass: 1,        //2-word header
    HeaderTypeFree: 2,         //free block
    HeaderTypeShort: 3,        //1-word header
},
"special objects", {
    // Indices into SpecialObjects array
    splOb_NilObject: 0,
    splOb_FalseObject: 1,
    splOb_TrueObject: 2,
    splOb_SchedulerAssociation: 3,
    splOb_ClassBitmap: 4,
    splOb_ClassInteger: 5,
    splOb_ClassString: 6,
    splOb_ClassArray: 7,
    splOb_SmalltalkDictionary: 8,
    splOb_ClassFloat: 9,
    splOb_ClassMethodContext: 10,
    splOb_ClassBlockContext: 11,
    splOb_ClassPoint: 12,
    splOb_ClassLargePositiveInteger: 13,
    splOb_TheDisplay: 14,
    splOb_ClassMessage: 15,
    splOb_ClassCompiledMethod: 16,
    splOb_TheLowSpaceSemaphore: 17,
    splOb_ClassSemaphore: 18,
    splOb_ClassCharacter: 19,
    splOb_SelectorDoesNotUnderstand: 20,
    splOb_SelectorCannotReturn: 21,
    splOb_TheInputSemaphore: 22,
    splOb_SpecialSelectors: 23,
    splOb_CharacterTable: 24,
    splOb_SelectorMustBeBoolean: 25,
    splOb_ClassByteArray: 26,
    splOb_ClassProcess: 27,
    splOb_CompactClasses: 28,
    splOb_TheTimerSemaphore: 29,
    splOb_TheInterruptSemaphore: 30,
    splOb_FloatProto: 31,
    splOb_SelectorCannotInterpret: 34,
    splOb_MethodContextProto: 35,
    splOb_ClassBlockClosure: 36,
    splOb_BlockContextProto: 37,
    splOb_ExternalObjectsArray: 38,
    splOb_ClassPseudoContext: 39,
    splOb_ClassTranslatedMethod: 40,
    splOb_TheFinalizationSemaphore: 41,
    splOb_ClassLargeNegativeInteger: 42,
    splOb_ClassExternalAddress: 43,
    splOb_ClassExternalStructure: 44,
    splOb_ClassExternalData: 45,
    splOb_ClassExternalFunction: 46,
    splOb_ClassExternalLibrary: 47,
    splOb_SelectorAboutToReturn: 48,
    splOb_SelectorRunWithIn: 49,
    splOb_SelectorAttemptToAssign: 50,
    splOb_PrimErrTableIndex: 51,
    splOb_ClassAlien: 52,
    splOb_InvokeCallbackSelector: 53,
    splOb_ClassUnsafeAlien: 54,
    splOb_ClassWeakFinalizer: 55,
},
"known classes", {
    // Class layout:
    Class_superclass: 0,
    Class_mdict: 1,
    Class_format: 2,
    Class_instVars: null,   // 3 or 4 depending on image, see instVarNames()
    Class_name: 6,
    // Context layout:
    Context_sender: 0,
    Context_instructionPointer: 1,
    Context_stackPointer: 2,
    Context_method: 3,
    Context_closure: 4,
    Context_receiver: 5,
    Context_tempFrameStart: 6,
    Context_smallFrameSize: 16,
    Context_largeFrameSize: 56,
    BlockContext_caller: 0,
    BlockContext_argumentCount: 3,
    BlockContext_initialIP: 4,
    BlockContext_home: 5,
    // Closure layout:
    Closure_outerContext: 0,
    Closure_startpc: 1,
    Closure_numArgs: 2,
    Closure_firstCopiedValue: 3,
    // Stream layout:
    Stream_array: 0,
    Stream_position: 1,
    Stream_limit: 2,
    //ProcessorScheduler layout:
    ProcSched_processLists: 0,
    ProcSched_activeProcess: 1,
    //Link layout:
    Link_nextLink: 0,
    //LinkedList layout:
    LinkedList_firstLink: 0,
    LinkedList_lastLink: 1,
    //Semaphore layout:
    Semaphore_excessSignals: 2,
    //Mutex layout:
    Mutex_owner: 2,
    //Process layout:
    Proc_suspendedContext: 1,
    Proc_priority: 2,
    Proc_myList: 3,
    // Association layout:
    Assn_key: 0,
    Assn_value: 1,
    // MethodDict layout:
    MethodDict_array: 1,
    MethodDict_selectorStart: 2,
    // Message layout
    Message_selector: 0,
    Message_arguments: 1,
    Message_lookupClass: 2,
    // Point layout:
    Point_x: 0,
    Point_y: 1,
    // LargeInteger layout:
    LargeInteger_bytes: 0,
    LargeInteger_neg: 1,
    // BitBlt layout:
    BitBlt_dest: 0,
    BitBlt_source: 1,
    BitBlt_halftone: 2,
    BitBlt_combinationRule: 3,
    BitBlt_destX: 4,
    BitBlt_destY: 5,
    BitBlt_width: 6,
    BitBlt_height: 7,
    BitBlt_sourceX: 8,
    BitBlt_sourceY: 9,
    BitBlt_clipX: 10,
    BitBlt_clipY: 11,
    BitBlt_clipW: 12,
    BitBlt_clipH: 13,
    BitBlt_colorMap: 14,
    BitBlt_warpBase: 15,
    // Form layout:
    Form_bits: 0,
    Form_width: 1,
    Form_height: 2,
    Form_depth: 3,
    Form_offset: 4,
    // WeakFinalizationList layout:
    WeakFinalizationList_first: 0,
    // WeakFinalizerItem layout:
    WeakFinalizerItem_list: 0,
    WeakFinalizerItem_next: 1,
    // ExternalLibraryFunction layout:
    ExtLibFunc_handle: 0,
    ExtLibFunc_flags: 1,
    ExtLibFunc_argTypes: 2,
    ExtLibFunc_name: 3,
    ExtLibFunc_module: 4,
    ExtLibFunc_errorCodeName: 5,
},
"events", {
    Mouse_Blue: 1,
    Mouse_Yellow: 2,
    Mouse_Red: 4,
    Keyboard_Shift: 8,
    Keyboard_Ctrl: 16,
    Keyboard_Alt: 32,
    Keyboard_Cmd: 64,
    Mouse_All: 1 + 2 + 4,
    Keyboard_All: 8 + 16 + 32 + 64,
    EventTypeNone: 0,
    EventTypeMouse: 1,
    EventTypeKeyboard: 2,
    EventTypeDragDropFiles: 3,
    EventKeyChar: 0,
    EventKeyDown: 1,
    EventKeyUp: 2,
    EventDragEnter: 1,
    EventDragMove: 2,
    EventDragLeave: 3,
    EventDragDrop: 4,
},
"constants", {
    MinSmallInt: -0x40000000,
    MaxSmallInt:  0x3FFFFFFF,
    NonSmallInt: -0x50000000,           // non-small and neg (so non pos32 too)
    MillisecondClockMask: 0x1FFFFFFF,
},
"error codes", {
    PrimNoErr: 0,
    PrimErrGenericFailure: 1,
    PrimErrBadReceiver: 2,
    PrimErrBadArgument: 3,
    PrimErrBadIndex: 4,
    PrimErrBadNumArgs: 5,
    PrimErrInappropriate: 6,
    PrimErrUnsupported: 7,
    PrimErrNoModification: 8,
    PrimErrNoMemory: 9,
    PrimErrNoCMemory: 10,
    PrimErrNotFound: 11,
    PrimErrBadMethod: 12,
    PrimErrNamedInternal: 13,
    PrimErrObjectMayMove: 14,
    PrimErrLimitExceeded: 15,
    PrimErrObjectIsPinned: 16,
    PrimErrWritePastObject: 17,
},
"modules", {
    // don't clobber registered modules
    externalModules: Squeak.externalModules || {},
    registerExternalModule: function(name, module) {
        this.externalModules[name] = module;
    },
},
"files", {
    fsck: function(whenDone, dir, files, stats) {
        dir = dir || "";
        stats = stats || {dirs: 0, files: 0, bytes: 0, deleted: 0};
        if (!files) {
            // find existing files
            files = {};
            for (var key in localStorage) {
                var match = key.match(/squeak-file(\.lz)?:(.*)$/);
                if (match) {files[match[2]] = true};
            }
            if (typeof indexedDB !== "undefined") {
                return this.dbTransaction("readonly", "fsck cursor", function(fileStore) {
                    var cursorReq = fileStore.openCursor();
                    cursorReq.onsuccess = function(e) {
                        var cursor = e.target.result;
                        if (cursor) {
                            files[cursor.key] = true;
                            cursor.continue();
                        } else { // done
                            Squeak.fsck(whenDone, dir, files, stats);
                        }
                    }
                    cursorReq.onerror = function(e) {
                        console.error("fsck failed");
                    }
                });
            }
        }
        // check directories
        var entries = Squeak.dirList(dir);
        for (var name in entries) {
            var path = dir + "/" + name,
                isDir = entries[name][3];
            if (isDir) {
                var exists = "squeak:" + path in localStorage;
                if (exists) {
                    Squeak.fsck(null, path, files, stats);
                    stats.dirs++;
                } else {
                    console.log("Deleting stale directory " + path);
                    Squeak.dirDelete(path);
                    stats.deleted++;
                }
            } else {
                if (!files[path]) {
                    console.log("Deleting stale file entry " + path);
                    Squeak.fileDelete(path, true);
                    stats.deleted++;
                } else {
                    files[path] = false; // mark as visited
                    stats.files++;
                    stats.bytes += entries[name][4];
                }
            }
        }
        // check orphaned files
        if (dir === "") {
            console.log("squeak fsck: " + stats.dirs + " directories, " + stats.files + " files, " + (stats.bytes/1000000).toFixed(1) + " MBytes");
            var orphaned = [],
                total = 0;
            for (var path in files) {
                total++;
                if (files[path]) orphaned.push(path); // not marked visited
            }
            if (orphaned.length > 0) {
                for (var i = 0; i < orphaned.length; i++) {
                    console.log("Deleting orphaned file " + orphaned[i]);
                    delete localStorage["squeak-file:" + orphaned[i]];
                    delete localStorage["squeak-file.lz:" + orphaned[i]];
                    stats.deleted++;
                }
                if (typeof indexedDB !== "undefined") {
                    this.dbTransaction("readwrite", "fsck delete", function(fileStore) {
                        for (var i = 0; i < orphaned.length; i++) {
                            fileStore.delete(orphaned[i]);
                        };
                    });
                }
            }
            if (whenDone) whenDone(stats);
        }
    },
    dbTransaction: function(mode, description, transactionFunc, completionFunc) {
        // File contents is stored in the IndexedDB named "squeak" in object store "files"
        // and directory entries in localStorage with prefix "squeak:"
        function fakeTransaction() {
            transactionFunc(Squeak.dbFake());
            if (completionFunc) completionFunc();
        }

        if (typeof indexedDB == "undefined") {
            return fakeTransaction();
        }

        function startTransaction() {
            var trans = SqueakDB.transaction("files", mode),
                fileStore = trans.objectStore("files");
            trans.oncomplete = function(e) { if (completionFunc) completionFunc(); }
            trans.onerror = function(e) { console.error(e.target.error.name + ": " + description) }
            trans.onabort = function(e) {
                console.error(e.target.error.name + ": aborting " + description);
                // fall back to local/memory storage
                transactionFunc(Squeak.dbFake());
                if (completionFunc) completionFunc();
            }
            transactionFunc(fileStore);
        };

        // if database connection already opened, just do transaction
        if (window.SqueakDB) return startTransaction();

        // otherwise, open SqueakDB first
        var openReq = indexedDB.open("squeak");

        // UIWebView implements the interface but only returns null
        // https://stackoverflow.com/questions/27415998/indexeddb-open-returns-null-on-safari-ios-8-1-1-and-halts-execution-on-cordova
        if (!openReq) {
            return fakeTransaction();
        }

        openReq.onsuccess = function(e) {
            console.log("Opened files database.");
            window.SqueakDB = this.result;
            SqueakDB.onversionchange = function(e) {
                delete window.SqueakDB;
                this.close();
            };
            SqueakDB.onerror = function(e) {
                console.error("Error accessing database: " + e.target.error.name);
            };
            startTransaction();
        };
        openReq.onupgradeneeded = function (e) {
            // run only first time, or when version changed
            console.log("Creating files database");
            var db = e.target.result;
            db.createObjectStore("files");
        };
        openReq.onerror = function(e) {
            console.error(e.target.error.name + ": cannot open files database");
            console.warn("Falling back to local storage");
            fakeTransaction();
        };
        openReq.onblocked = function(e) {
            // If some other tab is loaded with the database, then it needs to be closed
            // before we can proceed upgrading the database.
            console.log("Database upgrade needed, but was blocked.");
            console.warn("Falling back to local storage");
            fakeTransaction();
        };
    },
    dbFake: function() {
        // indexedDB is not supported by this browser, fake it using localStorage
        // since localStorage space is severly limited, use LZString if loaded
        // see https://github.com/pieroxy/lz-string
        if (typeof SqueakDBFake == "undefined") {
            if (typeof indexedDB == "undefined")
                console.warn("IndexedDB not supported by this browser, using localStorage");
            window.SqueakDBFake = {
                bigFiles: {},
                bigFileThreshold: 100000,
                get: function(filename) {
                    var buffer = SqueakDBFake.bigFiles[filename];
                    if (!buffer) {
                        var string = localStorage["squeak-file:" + filename];
                        if (!string) {
                            var compressed = localStorage["squeak-file.lz:" + filename];
                            if (compressed) {
                                if (typeof LZString == "object") {
                                    string = LZString.decompressFromUTF16(compressed);
                                } else {
                                    console.error("LZString not loaded: cannot decompress " + filename);
                                }
                            }
                        }
                        if (string) {
                            var bytes = new Uint8Array(string.length);
                            for (var i = 0; i < bytes.length; i++)
                                bytes[i] = string.charCodeAt(i) & 0xFF;
                            buffer = bytes.buffer;
                        }
                    }
                    var req = {result: buffer};
                    setTimeout(function(){
                        if (req.onsuccess) req.onsuccess({target: req});
                    }, 0);
                    return req;
                },
                put: function(buffer, filename) {
                    if (buffer.byteLength > SqueakDBFake.bigFileThreshold) {
                        if (!SqueakDBFake.bigFiles[filename])
                            console.log("File " + filename + " (" + buffer.byteLength + " bytes) too large, storing in memory only");
                        SqueakDBFake.bigFiles[filename] = buffer;
                    } else {
                        var string = Squeak.bytesAsString(new Uint8Array(buffer));
                        if (typeof LZString == "object") {
                            var compressed = LZString.compressToUTF16(string);
                            localStorage["squeak-file.lz:" + filename] = compressed;
                            delete localStorage["squeak-file:" + filename];
                        } else {
                            localStorage["squeak-file:" + filename] = string;
                        }
                    }
                    var req = {};
                    setTimeout(function(){if (req.onsuccess) req.onsuccess()}, 0);
                    return req;
                },
                delete: function(filename) {
                    delete localStorage["squeak-file:" + filename];
                    delete localStorage["squeak-file.lz:" + filename];
                    delete SqueakDBFake.bigFiles[filename];
                    var req = {};
                    setTimeout(function(){if (req.onsuccess) req.onsuccess()}, 0);
                    return req;
                },
                openCursor: function() {
                    var req = {};
                    setTimeout(function(){if (req.onsuccess) req.onsuccess({target: req})}, 0);
                    return req;
                },
            }
        }
        return SqueakDBFake;
    },
    fileGet: function(filepath, thenDo, errorDo) {
        if (!errorDo) errorDo = function(err) { console.log(err) };
        var path = this.splitFilePath(filepath);
        if (!path.basename) return errorDo("Invalid path: " + filepath);
        // if we have been writing to memory, return that version
        if (window.SqueakDBFake && SqueakDBFake.bigFiles[path.fullname])
            return thenDo(SqueakDBFake.bigFiles[path.fullname]);
        this.dbTransaction("readonly", "get " + filepath, function(fileStore) {
            var getReq = fileStore.get(path.fullname);
            getReq.onerror = function(e) { errorDo(e.target.error.name) };
            getReq.onsuccess = function(e) {
                if (this.result !== undefined) return thenDo(this.result);
                // might be a template
                Squeak.fetchTemplateFile(path.fullname,
                    function gotTemplate(template) {thenDo(template)},
                    function noTemplate() {
                        // if no indexedDB then we have checked fake db already
                        if (typeof indexedDB == "undefined") return errorDo("file not found: " + path.fullname);
                        // fall back on fake db, may be file is there
                        var fakeReq = Squeak.dbFake().get(path.fullname);
                        fakeReq.onerror = function(e) { errorDo("file not found: " + path.fullname) };
                        fakeReq.onsuccess = function(e) { thenDo(this.result); }
                    });
            };
        });
    },
    filePut: function(filepath, contents, optSuccess) {
        // store file, return dir entry if successful
        var path = this.splitFilePath(filepath); if (!path.basename) return null;
        var directory = this.dirList(path.dirname); if (!directory) return null;
        // get or create entry
        var entry = directory[path.basename],
            now = this.totalSeconds();
        if (!entry) { // new file
            entry = [/*name*/ path.basename, /*ctime*/ now, /*mtime*/ 0, /*dir*/ false, /*size*/ 0];
            directory[path.basename] = entry;
        } else if (entry[3]) // is a directory
            return null;
        // update directory entry
        entry[2] = now; // modification time
        entry[4] = contents.byteLength || contents.length || 0;
        localStorage["squeak:" + path.dirname] = JSON.stringify(directory);
        // put file contents (async)
        this.dbTransaction("readwrite", "put " + filepath,
            function(fileStore) {
                fileStore.put(contents, path.fullname);
            },
            function transactionComplete() {
                if (optSuccess) optSuccess();
            });
        return entry;
    },
    fileDelete: function(filepath, entryOnly) {
        var path = this.splitFilePath(filepath); if (!path.basename) return false;
        var directory = this.dirList(path.dirname); if (!directory) return false;
        var entry = directory[path.basename]; if (!entry || entry[3]) return false; // not found or is a directory
        // delete entry from directory
        delete directory[path.basename];
        localStorage["squeak:" + path.dirname] = JSON.stringify(directory);
        if (entryOnly) return true;
        // delete file contents (async)
        this.dbTransaction("readwrite", "delete " + filepath, function(fileStore) {
            fileStore.delete(path.fullname);
        });
        return true;
    },
    fileRename: function(from, to) {
        var oldpath = this.splitFilePath(from); if (!oldpath.basename) return false;
        var newpath = this.splitFilePath(to); if (!newpath.basename) return false;
        var olddir = this.dirList(oldpath.dirname); if (!olddir) return false;
        var entry = olddir[oldpath.basename]; if (!entry || entry[3]) return false; // not found or is a directory
        var samedir = oldpath.dirname == newpath.dirname;
        var newdir = samedir ? olddir : this.dirList(newpath.dirname); if (!newdir) return false;
        if (newdir[newpath.basename]) return false; // exists already
        delete olddir[oldpath.basename];            // delete old entry
        entry[0] = newpath.basename;                // rename entry
        newdir[newpath.basename] = entry;           // add new entry
        localStorage["squeak:" + newpath.dirname] = JSON.stringify(newdir);
        if (!samedir) localStorage["squeak:" + oldpath.dirname] = JSON.stringify(olddir);
        // move file contents (async)
        this.fileGet(oldpath.fullname,
            function success(contents) {
                this.dbTransaction("readwrite", "rename " + oldpath.fullname + " to " + newpath.fullname, function(fileStore) {
                    fileStore.delete(oldpath.fullname);
                    fileStore.put(contents, newpath.fullname);
                });
            }.bind(this),
            function error(msg) {
                console.log("File rename failed: " + msg);
            }.bind(this));
        return true;
    },
    fileExists: function(filepath) {
        var path = this.splitFilePath(filepath); if (!path.basename) return false;
        var directory = this.dirList(path.dirname); if (!directory) return false;
        var entry = directory[path.basename]; if (!entry || entry[3]) return false; // not found or is a directory
        return true;
    },
    dirCreate: function(dirpath, withParents) {
        var path = this.splitFilePath(dirpath); if (!path.basename) return false;
        if (withParents && !localStorage["squeak:" + path.dirname]) Squeak.dirCreate(path.dirname, true);
        var directory = this.dirList(path.dirname); if (!directory) return false;
        if (directory[path.basename]) return false;
        var now = this.totalSeconds(),
            entry = [/*name*/ path.basename, /*ctime*/ now, /*mtime*/ now, /*dir*/ true, /*size*/ 0];
        directory[path.basename] = entry;
        localStorage["squeak:" + path.fullname] = JSON.stringify({});
        localStorage["squeak:" + path.dirname] = JSON.stringify(directory);
        return true;
    },
    dirDelete: function(dirpath) {
        var path = this.splitFilePath(dirpath); if (!path.basename) return false;
        var directory = this.dirList(path.dirname); if (!directory) return false;
        if (!directory[path.basename]) return false;
        var children = this.dirList(path.fullname);
        if (!children) return false;
        for (var child in children) return false; // not empty
        // delete from parent
        delete directory[path.basename];
        localStorage["squeak:" + path.dirname] = JSON.stringify(directory);
        // delete itself
        delete localStorage["squeak:" + path.fullname];
        return true;
    },
    dirList: function(dirpath, includeTemplates) {
        // return directory entries or null
        var path = this.splitFilePath(dirpath),
            localEntries = localStorage["squeak:" + path.fullname],
            template = includeTemplates && localStorage["squeak-template:" + path.fullname];
        function addEntries(dir, entries) {
            for (var key in entries) {
                if (entries.hasOwnProperty(key)) {
                    var entry = entries[key];
                    dir[entry[0]] = entry;
                }
            }
        }
        if (localEntries || template) {
            // local entries override templates
            var dir = {};
            if (template) addEntries(dir, JSON.parse(template).entries);
            if (localEntries) addEntries(dir, JSON.parse(localEntries));
            return dir;
        }
        if (path.fullname == "/") return {};
        return null;
    },
    splitFilePath: function(filepath) {
        if (filepath[0] !== '/') filepath = '/' + filepath;
        filepath = filepath.replace(/\/\//g, '/');      // replace double-slashes
        var matches = filepath.match(/(.*)\/(.*)/),
            dirname = matches[1] ? matches[1] : '/',
            basename = matches[2] ? matches[2] : null;
        return {fullname: filepath, dirname: dirname, basename: basename};
    },
    splitUrl: function(url, base) {
        var matches = url.match(/(.*\/)?(.*)/),
            uptoslash = matches[1] || '',
            filename = matches[2] || '';
        if (!uptoslash.match(/^[a-z]+:\/\//)) {
            if (base && !base.match(/\/$/)) base += '/';
            uptoslash = (base || '') + uptoslash;
            url = uptoslash + filename;
        }
        return {full: url, uptoslash: uptoslash, filename: filename};
    },
    flushFile: function(file) {
        if (file.modified) {
            var buffer = file.contents.buffer;
            if (buffer.byteLength !== file.size) {
                buffer = new ArrayBuffer(file.size);
                (new Uint8Array(buffer)).set(file.contents.subarray(0, file.size));
            }
            Squeak.filePut(file.name, buffer);
            // if (/SqueakDebug.log/.test(file.name)) {
            //     var chars = Squeak.bytesAsString(new Uint8Array(buffer));
            //     console.warn(chars.replace(/\r/g, '\n'));
            // }
            file.modified = false;
        }
    },
    flushAllFiles: function() {
        if (typeof SqueakFiles == 'undefined') return;
        for (var name in SqueakFiles)
            this.flushFile(SqueakFiles[name]);
    },
    closeAllFiles: function() {
        // close the files held open in memory
        Squeak.flushAllFiles();
        delete window.SqueakFiles;
    },
    fetchTemplateDir: function(path, url) {
        // Called on app startup. Fetch url/sqindex.json and
        // cache all subdirectory entries in localStorage.
        // File contents is only fetched on demand
        path = Squeak.splitFilePath(path).fullname;
        function ensureTemplateParent(template) {
            var path = Squeak.splitFilePath(template);
            if (path.dirname !== "/") ensureTemplateParent(path.dirname);
            var template = JSON.parse(localStorage["squeak-template:" + path.dirname] || '{"entries": {}}');
            if (!template.entries[path.basename]) {
                var now = Squeak.totalSeconds();
                template.entries[path.basename] = [path.basename, now, now, true, 0];
                localStorage["squeak-template:" + path.dirname] = JSON.stringify(template);
            }
        }
        function checkSubTemplates(path, url) {
            var template = JSON.parse(localStorage["squeak-template:" + path]);
            for (var key in template.entries) {
                var entry = template.entries[key];
                if (entry[3]) Squeak.fetchTemplateDir(path + "/" + entry[0], url + "/" + entry[0]);
            };
        }
        if (localStorage["squeak-template:" + path]) {
            checkSubTemplates(path, url);
        } else  {
            var index = url + "/sqindex.json";
            var rq = new XMLHttpRequest();
            rq.open('GET', index, true);
            rq.onload = function(e) {
                if (rq.status == 200) {
                    console.log("adding template " + path);
                    ensureTemplateParent(path);
                    var entries = JSON.parse(rq.response),
                        template = {url: url, entries: {}};
                    for (var key in entries) {
                        var entry = entries[key];
                        template.entries[entry[0]] = entry;
                    }
                    localStorage["squeak-template:" + path] = JSON.stringify(template);
                    checkSubTemplates(path, url);
                }
                else rq.onerror(rq.statusText);
            };
            rq.onerror = function(e) {
                console.log("cannot load template index " + index);
            }
            rq.send();
        }
    },
    fetchTemplateFile: function(path, ifFound, ifNotFound) {
        path = Squeak.splitFilePath(path);
        var template = localStorage["squeak-template:" + path.dirname];
        if (!template) return ifNotFound();
        var url = JSON.parse(template).url;
        if (!url) return ifNotFound();
        url += "/" + path.basename;
        var rq = new XMLHttpRequest();
        rq.open("get", url, true);
        rq.responseType = "arraybuffer";
        rq.timeout = 30000;
        rq.onreadystatechange = function() {
            if (this.readyState != this.DONE) return;
            if (this.status == 200) {
                var buffer = this.response;
                console.log("Got " + buffer.byteLength + " bytes from " + url);
                Squeak.dirCreate(path.dirname, true);
                Squeak.filePut(path.fullname, buffer);
                ifFound(buffer);
            } else {
                console.error("Download failed (" + this.status + ") " + url);
                ifNotFound();
            }
        }
        console.log("Fetching " + url);
        rq.send();
    },
},
"audio", {
    startAudioOut: function() {
        if (!this.audioOutContext) {
            var ctxProto = window.AudioContext || window.webkitAudioContext
                || window.mozAudioContext || window.msAudioContext;
            this.audioOutContext = ctxProto && new ctxProto();
        }
        return this.audioOutContext;
    },
    startAudioIn: function(thenDo, errorDo) {
        if (this.audioInContext) {
            this.audioInSource.disconnect();
            return thenDo(this.audioInContext, this.audioInSource);
        }
        navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia
            || navigator.mozGetUserMedia || navigator.msGetUserMedia;
        if (!navigator.getUserMedia) return errorDo("test: audio input not supported");
        navigator.getUserMedia({audio: true, toString: function() {return "audio"}},
            function onSuccess(stream) {
                var ctxProto = window.AudioContext || window.webkitAudioContext
                    || window.mozAudioContext || window.msAudioContext;
                this.audioInContext = ctxProto && new ctxProto();
                this.audioInSource = this.audioInContext.createMediaStreamSource(stream);
                thenDo(this.audioInContext, this.audioInSource);
            },
            function onError() {
                errorDo("cannot access microphone");
            });
    },
    stopAudio: function() {
        if (this.audioInSource)
            this.audioInSource.disconnect();
    },
},
"time", {
    Epoch: Date.UTC(1901,0,1) + (new Date()).getTimezoneOffset()*60000,        // local timezone
    EpochUTC: Date.UTC(1901,0,1),
    totalSeconds: function() {
        // seconds since 1901-01-01, local time
        return Math.floor((Date.now() - Squeak.Epoch) / 1000);
    },
},
"utils", {
    bytesAsString: function(bytes) {
        var chars = [];
        for (var i = 0; i < bytes.length; )
            chars.push(String.fromCharCode.apply(
                null, bytes.subarray(i, i += 16348)));
        return chars.join('');
    },
});


Object.subclass('Squeak.Image',
'about', {
    about: function() {
    /*
    Object Format
    =============
    Each Squeak object is a Squeak.Object instance, only SmallIntegers are JS numbers.
    Instance variables/fields reference other objects directly via the "pointers" property.
    A Spur image uses Squeak.ObjectSpur instances instead. Characters are not immediate,
    but made identical using a character table. They are created with their mark bit set to
    true, so are ignored by the GC.
    {
        sqClass: reference to class object
        format: format integer as in Squeak oop header
        hash: identity hash integer
        pointers: (optional) Array referencing inst vars + indexable fields
        words: (optional) Array of numbers (words)
        bytes: (optional) Array of numbers (bytes)
        float: (optional) float value if this is a Float object
        isNil: (optional) true if this is the nil object
        isTrue: (optional) true if this is the true object
        isFalse: (optional) true if this is the false object
        isFloat: (optional) true if this is a Float object
        isFloatClass: (optional) true if this is the Float class
        isCompact: (optional) true if this is a compact class
        oop: identifies this object in a snapshot (assigned on GC, new space object oops are negative)
        mark: boolean (used only during GC, otherwise false)
        dirty: boolean (true when an object may have a ref to a new object, set on every write, reset on GC)
        nextObject: linked list of objects in old space and young space (newly created objects do not have this yet)
    }

    Object Memory
    =============
    Objects in old space are a linked list (firstOldObject). When loading an image, all objects are old.
    Objects are tenured to old space during a full GC.
    New objects are only referenced by other objects' pointers, and thus can be garbage-collected
    at any time by the Javascript GC.
    A partial GC links new objects to support enumeration of new space.

    Weak references are finalized by a full GC. A partial GC only finalizes young weak references.

    */
    }
},
'initializing', {
    initialize: function(name) {
        this.totalMemory = 100000000;
        this.name = name;
        this.gcCount = 0;
        this.gcMilliseconds = 0;
        this.pgcCount = 0;
        this.pgcMilliseconds = 0;
        this.gcTenured = 0;
        this.allocationCount = 0;
        this.oldSpaceCount = 0;
        this.youngSpaceCount = 0;
        this.newSpaceCount = 0;
        this.hasNewInstances = {};
    },
    readFromBuffer: function(arraybuffer, thenDo, progressDo) {
        console.log('squeak: reading ' + this.name + ' (' + arraybuffer.byteLength + ' bytes)');
        this.startupTime = Date.now();
        var data = new DataView(arraybuffer),
            littleEndian = false,
            pos = 0;
        var readWord = function() {
            var int = data.getUint32(pos, littleEndian);
            pos += 4;
            return int;
        };
        var readBits = function(nWords, isPointers) {
            if (isPointers) { // do endian conversion
                var oops = [];
                while (oops.length < nWords)
                    oops.push(readWord());
                return oops;
            } else { // words (no endian conversion yet)
                var bits = new Uint32Array(arraybuffer, pos, nWords);
                pos += nWords*4;
                return bits;
            }
        };
        // read version and determine endianness
        var versions = [6501, 6502, 6504, 6505, 6521, 68000, 68002, 68003, 68021],
            version = 0,
            fileHeaderSize = 0;
        while (true) {  // try all four endianness + header combos
            littleEndian = !littleEndian;
            pos = fileHeaderSize;
            version = readWord();
            if (versions.indexOf(version) >= 0) break;
            if (!littleEndian) fileHeaderSize += 512;
            if (fileHeaderSize > 512) throw Error("bad image version");
        };
        this.version = version;
        var nativeFloats = [6505, 6521, 68003, 68021].indexOf(version) >= 0;
        this.hasClosures = [6504, 6505, 6521, 68002, 68003, 68021].indexOf(version) >= 0;
        this.isSpur = [6521, 68021].indexOf(version) >= 0;
        if (version >= 68000) throw Error("64 bit images not supported yet");
        // parse image header
        var imageHeaderSize = readWord();
        var objectMemorySize = readWord(); //first unused location in heap
        var oldBaseAddr = readWord(); //object memory base address of image
        var specialObjectsOopInt = readWord(); //oop of array of special oops
        this.lastHash = readWord(); //Should be loaded from, and saved to the image header
        this.savedHeaderWords = [];
        for (var i = 0; i < 6; i++)
            this.savedHeaderWords.push(readWord());
        var firstSegSize = readWord();
        var prevObj;
        var oopMap = {};
        var rawBits = {};
        var headerSize = fileHeaderSize + imageHeaderSize;
        pos = headerSize;
        if (!this.isSpur) {
            // read traditional object memory
            while (pos < headerSize + objectMemorySize) {
                var nWords = 0;
                var classInt = 0;
                var header = readWord();
                switch (header & Squeak.HeaderTypeMask) {
                    case Squeak.HeaderTypeSizeAndClass:
                        nWords = header >>> 2;
                        classInt = readWord();
                        header = readWord();
                        break;
                    case Squeak.HeaderTypeClass:
                        classInt = header - Squeak.HeaderTypeClass;
                        header = readWord();
                        nWords = (header >>> 2) & 63;
                        break;
                    case Squeak.HeaderTypeShort:
                        nWords = (header >>> 2) & 63;
                        classInt = (header >>> 12) & 31; //compact class index
                        //Note classInt<32 implies compact class index
                        break;
                    case Squeak.HeaderTypeFree:
                        throw Error("Unexpected free block");
                }
                nWords--;  //length includes base header which we have already read
                var oop = pos - 4 - headerSize, //0-rel byte oop of this object (base header)
                    format = (header>>>8) & 15,
                    hash = (header>>>17) & 4095,
                    bits = readBits(nWords, format < 5);
                var object = new Squeak.Object();
                object.initFromImage(oop, classInt, format, hash);
                if (classInt < 32) object.hash |= 0x10000000;    // see fixCompactOops()
                if (prevObj) prevObj.nextObject = object;
                this.oldSpaceCount++;
                prevObj = object;
                //oopMap is from old oops to actual objects
                oopMap[oldBaseAddr + oop] = object;
                //rawBits holds raw content bits for objects
                rawBits[oop] = bits;
            }
            this.firstOldObject = oopMap[oldBaseAddr+4];
            this.lastOldObject = object;
            this.oldSpaceBytes = objectMemorySize;
        } else {
            // Read all Spur object memory segments
            this.oldSpaceBytes = firstSegSize - 16;
            var segmentEnd = pos + firstSegSize,
                addressOffset = 0,
                freePageList = null,
                classPages = null,
                skippedBytes = 0,
                oopAdjust = {};
            while (pos < segmentEnd) {
                while (pos < segmentEnd - 16) {
                    // read objects in segment
                    var objPos = pos,
                        formatAndClass = readWord(),
                        sizeAndHash = readWord(),
                        size = sizeAndHash >>> 24;
                    if (size === 255) { // reinterpret word as size, read header again
                        size = formatAndClass;
                        formatAndClass = readWord();
                        sizeAndHash = readWord();
                    }
                    var oop = addressOffset + pos - 8 - headerSize,
                        format = (formatAndClass >>> 24) & 0x1F,
                        classID = formatAndClass & 0x003FFFFF,
                        hash = sizeAndHash & 0x003FFFFF;
                    var bits = readBits(size, format < 10 && classID > 0);
                    pos += (size < 2 ? 2 - size : size & 1) * 4; // align on 8 bytes, 16 min
                    // low class ids are internal to Spur
                    if (classID >= 32) {
                        var object = new Squeak.ObjectSpur();
                        object.initFromImage(oop, classID, format, hash);
                        if (prevObj) prevObj.nextObject = object;
                        this.oldSpaceCount++;
                        prevObj = object;
                        //oopMap is from old oops to actual objects
                        oopMap[oldBaseAddr + oop] = object;
                        //rawBits holds raw content bits for objects
                        rawBits[oop] = bits;
                        oopAdjust[oop] = skippedBytes;
                    } else {
                        skippedBytes += pos - objPos;
                        if (!freePageList) freePageList = bits;         // first hidden obj
                        else if (!classPages) classPages = bits;        // second hidden obj
                        if (classID) oopMap[oldBaseAddr + oop] = bits;  // used in spurClassTable()
                    }
                }
                if (pos !== segmentEnd - 16) throw Error("invalid segment");
                // last 16 bytes in segment is a bridge object
                var deltaWords = readWord(),
                    deltaWordsHi = readWord(),
                    segmentBytes = readWord(),
                    segmentBytesHi = readWord();
                //  if segmentBytes is zero, the end of the image has been reached
                if (segmentBytes !== 0) {
                    var deltaBytes = deltaWordsHi & 0xFF000000 ? (deltaWords & 0x00FFFFFF) * 4 : 0;
                    segmentEnd += segmentBytes;
                    addressOffset += deltaBytes;
                    skippedBytes += 16 + deltaBytes;
                    this.oldSpaceBytes += deltaBytes + segmentBytes;
                }
            }
            this.oldSpaceBytes -= skippedBytes;
            this.firstOldObject = oopMap[oldBaseAddr];
            this.lastOldObject = object;
        }

        if (true) {
            // For debugging: re-create all objects from named prototypes
            var _splObs = oopMap[specialObjectsOopInt],
                cc = this.isSpur ? this.spurClassTable(oopMap, rawBits, classPages, _splObs)
                    : rawBits[oopMap[rawBits[_splObs.oop][Squeak.splOb_CompactClasses]].oop];
            var renamedObj = null;
            object = this.firstOldObject;
            prevObj = null;
            while (object) {
                prevObj = renamedObj;
                renamedObj = object.renameFromImage(oopMap, rawBits, cc);
                if (prevObj) prevObj.nextObject = renamedObj;
                else this.firstOldObject = renamedObj;
                oopMap[oldBaseAddr + object.oop] = renamedObj;
                object = object.nextObject;
            }
            this.lastOldObject = renamedObj;
        }

        // properly link objects by mapping via oopMap
        var splObs         = oopMap[specialObjectsOopInt];
        var compactClasses = rawBits[oopMap[rawBits[splObs.oop][Squeak.splOb_CompactClasses]].oop];
        var floatClass     = oopMap[rawBits[splObs.oop][Squeak.splOb_ClassFloat]];
        // Spur needs different arguments for installFromImage()
        if (this.isSpur) {
            var charClass = oopMap[rawBits[splObs.oop][Squeak.splOb_ClassCharacter]];
            this.initCharacterTable(charClass);
            compactClasses = this.spurClassTable(oopMap, rawBits, classPages, splObs);
            nativeFloats = this.getCharacter.bind(this);
            this.initSpurOverrides();
        }
        var obj = this.firstOldObject,
            done = 0,
            self = this;
        function mapSomeObjects() {
            if (obj) {
                var stop = done + (self.oldSpaceCount / 20 | 0);    // do it in 20 chunks
                while (obj && done < stop) {
                    obj.installFromImage(oopMap, rawBits, compactClasses, floatClass, littleEndian, nativeFloats);
                    obj = obj.nextObject;
                    done++;
                }
                if (progressDo) progressDo(done / self.oldSpaceCount);
                return true;    // do more
            } else { // done
                self.specialObjectsArray = splObs;
                self.decorateKnownObjects();
                if (self.isSpur) {
                    self.fixSkippedOops(oopAdjust);
                } else {
                    self.fixCompiledMethods();
                    self.fixCompactOops();
                }
                return false;   // don't do more
            }
        };
        function mapSomeObjectsAsync() {
            if (mapSomeObjects()) {
                window.setTimeout(mapSomeObjectsAsync, 0);
            } else {
                if (thenDo) thenDo();
            }
        };
        if (!progressDo) {
            while (mapSomeObjects()) {};   // do it synchronously
            if (thenDo) thenDo();
        } else {
            window.setTimeout(mapSomeObjectsAsync, 0);
        }
    },
    decorateKnownObjects: function() {
        var splObjs = this.specialObjectsArray.pointers;
        splObjs[Squeak.splOb_NilObject].isNil = true;
        splObjs[Squeak.splOb_TrueObject].isTrue = true;
        splObjs[Squeak.splOb_FalseObject].isFalse = true;
        splObjs[Squeak.splOb_ClassFloat].isFloatClass = true;
        if (!this.isSpur) {
            this.compactClasses = this.specialObjectsArray.pointers[Squeak.splOb_CompactClasses].pointers;
            for (var i = 0; i < this.compactClasses.length; i++)
                if (!this.compactClasses[i].isNil)
                    this.compactClasses[i].isCompact = true;
        }
        if (!Number.prototype.sqInstName)
            Object.defineProperty(Number.prototype, 'sqInstName', {
                enumerable: false,
                value: function() { return this.toString() }
            });
    },
    fixCompactOops: function() {
        // instances of compact classes might have been saved with a non-compact header
        // fix their oops here so validation succeeds later
        if (this.isSpur) return;
        var obj = this.firstOldObject,
            adjust = 0;
        while (obj) {
            var hadCompactHeader = obj.hash > 0x0FFFFFFF,
                mightBeCompact = !!obj.sqClass.isCompact;
            if (hadCompactHeader !== mightBeCompact) {
                var isCompact = obj.snapshotSize().header === 0;
                if (hadCompactHeader !== isCompact) {
                    adjust += isCompact ? -4 : 4;
                }
            }
            obj.hash &= 0x0FFFFFFF;
            obj.oop += adjust;
            obj = obj.nextObject;
        }
        this.oldSpaceBytes += adjust;
    },
    fixCompiledMethods: function() {
        // in the 6501 pre-release image, some CompiledMethods
        // do not have the proper class
        if (this.version >= 6502) return;
        var obj = this.firstOldObject,
            compiledMethodClass = this.specialObjectsArray.pointers[Squeak.splOb_ClassCompiledMethod];
        while (obj) {
            if (obj.isMethod()) obj.sqClass = compiledMethodClass;
            obj = obj.nextObject;
        }
    },
    fixSkippedOops: function(oopAdjust) {
        // reading Spur skips some internal objects
        // we adjust the oops of following objects here
        // this is like the compaction phase of our GC
        var obj = this.firstOldObject;
        while (obj) {
            obj.oop -= oopAdjust[obj.oop];
            obj = obj.nextObject;
        }
        // do a sanity check
        obj = this.lastOldObject;
        if (obj.addr() + obj.totalBytes() !== this.oldSpaceBytes)
            throw Error("image size doesn't match object sizes")
    },
},
'garbage collection - full', {
    fullGC: function(reason) {
        // Collect garbage and return first tenured object (to support object enumeration)
        // Old space is a linked list of objects - each object has an "nextObject" reference.
        // New space objects do not have that pointer, they are garbage-collected by JavaScript.
        // But they have an allocation id so the survivors can be ordered on tenure.
        // The "nextObject" references are created by collecting all new objects,
        // sorting them by id, and then linking them into old space.
        this.vm.addMessage("fullGC: " + reason);
        var start = Date.now();
        var newObjects = this.markReachableObjects();
        this.removeUnmarkedOldObjects();
        this.appendToOldObjects(newObjects);
        this.finalizeWeakReferences();
        this.allocationCount += this.newSpaceCount;
        this.newSpaceCount = 0;
        this.youngSpaceCount = 0;
        this.hasNewInstances = {};
        this.gcCount++;
        this.gcMilliseconds += Date.now() - start;
        console.log("Full GC (" + reason + "): " + (Date.now() - start) + " ms");
        return newObjects.length > 0 ? newObjects[0] : null;
    },
    gcRoots: function() {
        // the roots of the system
        this.vm.storeContextRegisters();        // update active context
        return [this.specialObjectsArray, this.vm.activeContext];
    },
    markReachableObjects: function() {
        // FullGC: Visit all reachable objects and mark them.
        // Return surviving new objects
        // Contexts are handled specially: they have garbage beyond the stack pointer
        // which must not be traced, and is cleared out here
        // In weak objects, only the inst vars are traced
        var todo = this.gcRoots();
        var newObjects = [];
        this.weakObjects = [];
        while (todo.length > 0) {
            var object = todo.pop();
            if (object.mark) continue;    // objects are added to todo more than once
            if (object.oop < 0)           // it's a new object
                newObjects.push(object);
            object.mark = true;           // mark it
            if (!object.sqClass.mark)     // trace class if not marked
                todo.push(object.sqClass);
            var body = object.pointers;
            if (body) {                   // trace all unmarked pointers
                var n = body.length;
                if (object.isWeak()) {
                    n = object.sqClass.classInstSize();     // do not trace weak fields
                    this.weakObjects.push(object);
                }
                if (this.vm.isContext(object)) {            // contexts have garbage beyond SP
                    n = object.contextSizeWithStack();
                    for (var i = n; i < body.length; i++)   // clean up that garbage
                        body[i] = this.vm.nilObj;
                }
                for (var i = 0; i < n; i++)
                    if (typeof body[i] === "object" && !body[i].mark)      // except immediates
                        todo.push(body[i]);
                // Note: "immediate" character objects in Spur always stay marked
            }
        }
        // pre-spur sort by oop to preserve creation order
        return this.isSpur ? newObjects : newObjects.sort(function(a,b){return b.oop - a.oop});
    },
    removeUnmarkedOldObjects: function() {
        // FullGC: Unlink unmarked old objects from the nextObject linked list
        // Reset marks of remaining objects, and adjust their oops
        // Set this.lastOldObject to last old object
        var removedCount = 0,
            removedBytes = 0,
            obj = this.firstOldObject;
        obj.mark = false; // we know the first object (nil) was marked
        while (true) {
            var next = obj.nextObject;
            if (!next) {// we're done
                this.lastOldObject = obj;
                this.oldSpaceBytes -= removedBytes;
                this.oldSpaceCount -= removedCount;
                return;
            }
            // reset partial GC flag
            if (next.dirty) next.dirty = false;
            // if marked, continue with next object
            if (next.mark) {
                obj = next;
                obj.mark = false;           // unmark for next GC
                obj.oop -= removedBytes;    // compact oops
            } else { // otherwise, remove it
                var corpse = next;
                obj.nextObject = corpse.nextObject;     // drop from old-space list
                corpse.oop = -(++this.newSpaceCount);   // move to new-space for finalizing
                removedBytes += corpse.totalBytes();
                removedCount++;
                //console.log("removing " + removedCount + " " + removedBytes + " " + corpse.totalBytes() + " " + corpse.toString())
            }
        }
    },
    appendToOldObjects: function(newObjects) {
        // FullGC: append new objects to linked list of old objects
        // and unmark them
        var oldObj = this.lastOldObject;
        //var oldBytes = this.oldSpaceBytes;
        for (var i = 0; i < newObjects.length; i++) {
            var newObj = newObjects[i];
            newObj.mark = false;
            this.oldSpaceBytes = newObj.setAddr(this.oldSpaceBytes);     // add at end of memory
            oldObj.nextObject = newObj;
            oldObj = newObj;
            //console.log("tenuring " + (i+1) + " " + (this.oldSpaceBytes - oldBytes) + " " + newObj.totalBytes() + " " + newObj.toString());
        }
        oldObj.nextObject = null;   // might have been in young space
        this.lastOldObject = oldObj;
        this.oldSpaceCount += newObjects.length;
        this.gcTenured += newObjects.length;
    },
    tenureIfYoung: function(object) {
        if (object.oop < 0) {
            this.appendToOldObjects([object]);
        }
    },
    finalizeWeakReferences: function() {
        // nil out all weak fields that did not survive GC
        var weakObjects = this.weakObjects;
        this.weakObjects = null;
        for (var o = 0; o < weakObjects.length; o++) {
            var weakObj = weakObjects[o],
                pointers = weakObj.pointers,
                firstWeak = weakObj.sqClass.classInstSize(),
                finalized = false;
            for (var i = firstWeak; i < pointers.length; i++) {
                if (pointers[i].oop < 0) {    // ref is not in old-space
                    pointers[i] = this.vm.nilObj;
                    finalized = true;
                }
            }
            if (finalized) {
                this.vm.pendingFinalizationSignals++;
                if (firstWeak >= 2) { // check if weak obj is a finalizer item
                    var list = weakObj.pointers[Squeak.WeakFinalizerItem_list];
                    if (list.sqClass == this.vm.specialObjects[Squeak.splOb_ClassWeakFinalizer]) {
                        // add weak obj as first in the finalization list
                        var items = list.pointers[Squeak.WeakFinalizationList_first];
                        weakObj.pointers[Squeak.WeakFinalizerItem_next] = items;
                        list.pointers[Squeak.WeakFinalizationList_first] = weakObj;
                    }
                }
            }
        };
        if (this.vm.pendingFinalizationSignals > 0) {
            this.vm.forceInterruptCheck();                      // run finalizer asap
        }
    },
},
'garbage collection - partial', {
    partialGC: function(reason) {
        // make a linked list of young objects
        // and finalize weak refs
        this.vm.addMessage("partialGC: " + reason);
        var start = Date.now();
        var young = this.findYoungObjects();
        this.appendToYoungSpace(young);
        this.finalizeWeakReferences();
        this.cleanupYoungSpace(young);
        this.allocationCount += this.newSpaceCount - young.length;
        this.youngSpaceCount = young.length;
        this.newSpaceCount = this.youngSpaceCount;
        this.pgcCount++;
        this.pgcMilliseconds += Date.now() - start;
        console.log("Partial GC (" + reason+ "): " + (Date.now() - start) + " ms");
        return young[0];
    },
    youngRoots: function() {
        // PartialGC: Find new objects directly pointed to by old objects.
        // For speed we only scan "dirty" objects that have been written to
        var roots = this.gcRoots().filter(function(obj){return obj.oop < 0;}),
            object = this.firstOldObject;
        while (object) {
            if (object.dirty) {
                var body = object.pointers,
                    dirty = false;
                for (var i = 0; i < body.length; i++) {
                    var child = body[i];
                    if (typeof child === "object" && child.oop < 0) { // if child is new
                        roots.push(child);
                        dirty = true;
                    }
                }
                object.dirty = dirty;
            }
            object = object.nextObject;
        }
        return roots;
    },
    findYoungObjects: function() {
        // PartialGC: find new objects transitively reachable from old objects
        var todo = this.youngRoots(),     // direct pointers from old space
            newObjects = [];
        this.weakObjects = [];
        while (todo.length > 0) {
            var object = todo.pop();
            if (object.mark) continue;    // objects are added to todo more than once
            newObjects.push(object);
            object.mark = true;           // mark it
            if (object.sqClass.oop < 0)   // trace class if new
                todo.push(object.sqClass);
            var body = object.pointers;
            if (body) {                   // trace all unmarked pointers
                var n = body.length;
                if (object.isWeak()) {
                    n = object.sqClass.classInstSize();     // do not trace weak fields
                    this.weakObjects.push(object);
                }
                if (this.vm.isContext(object)) {            // contexts have garbage beyond SP
                    n = object.contextSizeWithStack();
                    for (var i = n; i < body.length; i++)   // clean up that garbage
                        body[i] = this.vm.nilObj;
                }
                for (var i = 0; i < n; i++) {
                    var child = body[i];
                    if (typeof child === "object" && child.oop < 0)
                        todo.push(body[i]);
                }
            }
        }
        // pre-spur sort by oop to preserve creation order
        return this.isSpur ? newObjects : newObjects.sort(function(a,b){return b.oop - a.oop});
    },
    appendToYoungSpace: function(objects) {
        // PartialGC: link new objects into young list
        // and give them positive oops temporarily so finalization works
        var tempOop = this.lastOldObject.oop + 1;
        for (var i = 0; i < objects.length; i++) {
            var obj = objects[i];
            if (this.hasNewInstances[obj.oop]) {
                delete this.hasNewInstances[obj.oop];
                this.hasNewInstances[tempOop] = true;
            }
            obj.oop = tempOop;
            obj.nextObject = objects[i + 1];
            tempOop++;
        }
    },
    cleanupYoungSpace: function(objects) {
        // PartialGC: After finalizing weak refs, make oops
        // in young space negative again
        var obj = objects[0],
            youngOop = -1;
        while (obj) {
            if (this.hasNewInstances[obj.oop]) {
                delete this.hasNewInstances[obj.oop];
                this.hasNewInstances[youngOop] = true;
            }
            obj.oop = youngOop;
            obj.mark = false;
            obj = obj.nextObject;
            youngOop--;
        }
    },
},
'creating', {
    registerObject: function(obj) {
        // We don't actually register the object yet, because that would prevent
        // it from being garbage-collected by the Javascript collector
        obj.oop = -(++this.newSpaceCount); // temp oops are negative. Real oop assigned when surviving GC
        this.lastHash = (13849 + (27181 * this.lastHash)) & 0xFFFFFFFF;
        return this.lastHash & 0xFFF;
    },
    registerObjectSpur: function(obj) {
        // We don't actually register the object yet, because that would prevent
        // it from being garbage-collected by the Javascript collector
        obj.oop = -(++this.newSpaceCount); // temp oops are negative. Real oop assigned when surviving GC
        return 0; // actual hash created on demand
    },
    instantiateClass: function(aClass, indexableSize, filler) {
        var newObject = new (aClass.classInstProto()); // Squeak.Object
        var hash = this.registerObject(newObject);
        newObject.initInstanceOf(aClass, indexableSize, hash, filler);
        this.hasNewInstances[aClass.oop] = true;   // need GC to find all instances
        return newObject;
    },
    clone: function(object) {
        var newObject = new (object.sqClass.classInstProto()); // Squeak.Object
        var hash = this.registerObject(newObject);
        newObject.initAsClone(object, hash);
        this.hasNewInstances[newObject.sqClass.oop] = true;   // need GC to find all instances
        return newObject;
    },
},
'operations', {
    bulkBecome: function(fromArray, toArray, twoWay, copyHash) {
        if (!fromArray)
            return !toArray;
        var n = fromArray.length;
        if (n !== toArray.length)
            return false;
        // need to visit all objects: find young objects now
        // so oops do not change later
        var firstYoungObject = null;
        if (this.newSpaceCount > 0)
            firstYoungObject = this.partialGC("become");  // does update context
        else
            this.vm.storeContextRegisters();    // still need to update active context
        // obj.oop used as dict key here is why we store them
        // rather than just calculating at image snapshot time
        var mutations = {};
        for (var i = 0; i < n; i++) {
            var obj = fromArray[i];
            if (!obj.sqClass) return false;  //non-objects in from array
            if (mutations[obj.oop]) return false; //repeated oops in from array
            else mutations[obj.oop] = toArray[i];
        }
        if (twoWay) for (var i = 0; i < n; i++) {
            var obj = toArray[i];
            if (!obj.sqClass) return false;  //non-objects in to array
            if (mutations[obj.oop]) return false; //repeated oops in to array
            else mutations[obj.oop] = fromArray[i];
        }
        // unless copyHash is false, make hash stay with the reference, not with the object
        if (copyHash) for (var i = 0; i < n; i++) {
            if (!toArray[i].sqClass) return false; //cannot change hash of non-objects
            var fromHash = fromArray[i].hash;
            fromArray[i].hash = toArray[i].hash;
            toArray[i].hash = fromHash;
        }
        // temporarily append young objects to old space
        this.lastOldObject.nextObject = firstYoungObject;
        // Now, for every object...
        var obj = this.firstOldObject;
        while (obj) {
            // mutate the class
            var mut = mutations[obj.sqClass.oop];
            if (mut) {
                obj.sqClass = mut;
                if (mut.oop < 0) obj.dirty = true;
            }
            // and mutate body pointers
            var body = obj.pointers;
            if (body) for (var j = 0; j < body.length; j++) {
                mut = mutations[body[j].oop];
                if (mut) {
                    body[j] = mut;
                    if (mut.oop < 0) obj.dirty = true;
                }
            }
            obj = obj.nextObject;
        }
        // separate old / young space again
        this.lastOldObject.nextObject = null;
        this.vm.flushMethodCacheAfterBecome(mutations);
        return true;
    },
    objectAfter: function(obj) {
        // if this was the last old object, continue with young objects
        return obj.nextObject || this.nextObjectWithGC("nextObject", obj);
    },
    someInstanceOf: function(clsObj) {
        var obj = this.firstOldObject;
        while (obj) {
            if (obj.sqClass === clsObj)
                return obj;
            obj = obj.nextObject || this.nextObjectWithGCFor(obj, clsObj);
        }
        return null;
    },
    nextInstanceAfter: function(obj) {
        var clsObj = obj.sqClass;
        while (true) {
            obj = obj.nextObject || this.nextObjectWithGCFor(obj, clsObj);
            if (!obj) return null;
            if (obj.sqClass === clsObj)
                return obj;
        }
    },
    nextObjectWithGC: function(reason, obj) {
        // obj is either the last object in old space (after enumerating it)
        // or young space (after enumerating the list returned by partialGC)
        // or a random new object
        var limit = obj.oop > 0 ? 0 : this.youngSpaceCount;
        if (this.newSpaceCount <= limit) return null; // no more objects
        if (obj.oop < 0) this.fullGC(reason); // found a non-young new object
        return this.partialGC(reason);
    },
    nextObjectWithGCFor: function(obj, clsObj) {
        if (!this.hasNewInstances[clsObj.oop]) return null;
        return this.nextObjectWithGC("instance of " + clsObj.className(), obj);
    },
    allInstancesOf: function(clsObj) {
        var obj = this.firstOldObject,
            result = [];
        while (obj) {
            if (obj.sqClass === clsObj) result.push(obj);
            obj = obj.nextObject || this.nextObjectWithGCFor(obj, clsObj);
        }
        return result;
    },
    writeToBuffer: function() {
        var headerSize = 64,
            data = new DataView(new ArrayBuffer(headerSize + this.oldSpaceBytes)),
            pos = 0;
        var writeWord = function(word) {
            data.setUint32(pos, word);
            pos += 4;
        };
        writeWord(this.formatVersion()); // magic number
        writeWord(headerSize);
        writeWord(this.oldSpaceBytes); // end of memory
        writeWord(this.firstOldObject.addr()); // base addr (0)
        writeWord(this.objectToOop(this.specialObjectsArray));
        writeWord(this.lastHash);
        writeWord((800 << 16) + 600);  // window size
        while (pos < headerSize)
            writeWord(0);
        // objects
        var obj = this.firstOldObject,
            n = 0;
        while (obj) {
            pos = obj.writeTo(data, pos, this);
            obj = obj.nextObject;
            n++;
        }
        if (pos !== data.byteLength) throw Error("wrong image size");
        if (n !== this.oldSpaceCount) throw Error("wrong object count");
        return data.buffer;
    },
    objectToOop: function(obj) {
        // unsigned word for use in snapshot
        if (typeof obj ===  "number")
            return obj << 1 | 1; // add tag bit
        if (obj.oop < 0) throw Error("temporary oop");
        return obj.oop;
    },
    bytesLeft: function() {
        return this.totalMemory - this.oldSpaceBytes;
    },
    formatVersion: function() {
        return this.isSpur ? 6521 : this.hasClosures ? 6504 : 6502;
    },
    segmentVersion: function() {
        var dnu = this.specialObjectsArray.pointers[Squeak.splOb_SelectorDoesNotUnderstand],
            wholeWord = new Uint32Array(dnu.bytes.buffer, 0, 1);
        return this.formatVersion() | (wholeWord[0] & 0xFF000000);
    },
    loadImageSegment: function(segmentWordArray, outPointerArray) {
        // The C VM creates real objects from the segment in-place.
        // We do the same, linking the new objects directly into old-space.
        // The code below is almost the same as readFromBuffer() ... should unify
        var data = new DataView(segmentWordArray.words.buffer),
            littleEndian = false,
            nativeFloats = false,
            pos = 0;
        var readWord = function() {
            var int = data.getUint32(pos, littleEndian);
            pos += 4;
            return int;
        };
        var readBits = function(nWords, format) {
            if (format < 5) { // pointers (do endian conversion)
                var oops = [];
                while (oops.length < nWords)
                    oops.push(readWord());
                return oops;
            } else { // words (no endian conversion yet)
                var bits = new Uint32Array(data.buffer, pos, nWords);
                pos += nWords * 4;
                return bits;
            }
        };
        // check version
        var version = readWord();
        if (version & 0xFFFF !== 6502) {
            littleEndian = true; pos = 0;
            version = readWord();
            if (version & 0xFFFF !== 6502) {
                console.error("image segment format not supported");
                return null;
            }
        }
        // read objects
        this.tenureIfYoung(segmentWordArray);
        var prevObj = segmentWordArray,
            endMarker = prevObj.nextObject,
            oopOffset = segmentWordArray.oop,
            oopMap = {},
            rawBits = {};
        while (pos < data.byteLength) {
            var nWords = 0,
                classInt = 0,
                header = readWord();
            switch (header & Squeak.HeaderTypeMask) {
                case Squeak.HeaderTypeSizeAndClass:
                    nWords = header >>> 2;
                    classInt = readWord();
                    header = readWord();
                    break;
                case Squeak.HeaderTypeClass:
                    classInt = header - Squeak.HeaderTypeClass;
                    header = readWord();
                    nWords = (header >>> 2) & 63;
                    break;
                case Squeak.HeaderTypeShort:
                    nWords = (header >>> 2) & 63;
                    classInt = (header >>> 12) & 31; //compact class index
                    //Note classInt<32 implies compact class index
                    break;
                case Squeak.HeaderTypeFree:
                    throw Error("Unexpected free block");
            }
            nWords--;  //length includes base header which we have already read
            var oop = pos, //0-rel byte oop of this object (base header)
                format = (header>>>8) & 15,
                hash = (header>>>17) & 4095,
                bits = readBits(nWords, format);

            var object = new Squeak.Object();
            object.initFromImage(oop + oopOffset, classInt, format, hash);
            prevObj.nextObject = object;
            this.oldSpaceCount++;
            prevObj = object;
            oopMap[oop] = object;
            rawBits[oop + oopOffset] = bits;
        }
        object.nextObject = endMarker;
        // add outPointers to oopMap
        for (var i = 0; i < outPointerArray.pointers.length; i++)
            oopMap[0x80000004 + i * 4] = outPointerArray.pointers[i];
        // add compactClasses to oopMap
        var compactClasses = this.specialObjectsArray.pointers[Squeak.splOb_CompactClasses].pointers,
            fakeClsOop = 0, // make up a compact-classes array with oops, as if loading an image
            compactClassOops = compactClasses.map(function(cls) {
                oopMap[--fakeClsOop] = cls; return fakeClsOop; });
        // truncate segmentWordArray array to one element
        segmentWordArray.words = new Uint32Array([segmentWordArray.words[0]]);
        // map objects using oopMap
        var roots = segmentWordArray.nextObject,
            floatClass = this.specialObjectsArray.pointers[Squeak.splOb_ClassFloat],
            obj = roots;
        do {
            obj.installFromImage(oopMap, rawBits, compactClassOops, floatClass, littleEndian, nativeFloats);
            obj = obj.nextObject;
        } while (obj !== endMarker);
        return roots;
    },
},
'spur support',
{
    initSpurOverrides: function() {
        this.registerObject = this.registerObjectSpur;
        this.writeToBuffer = this.writeToBufferSpur;
    },
    spurClassTable: function(oopMap, rawBits, classPages, splObjs) {
        var classes = {},
            nil = this.firstOldObject;
        // read class table pages
        for (var p = 0; p < 4096; p++) {
            var page = oopMap[classPages[p]];
            if (page.oop) page = rawBits[page.oop]; // page was not properly hidden
            if (page.length === 1024) for (var i = 0; i < 1024; i++) {
                var entry = oopMap[page[i]];
                if (!entry) throw Error("Invalid class table entry (oop " + page[i] + ")");
                if (entry !== nil) {
                    var classIndex = p * 1024 + i;
                    classes[classIndex] = entry;
                }
            }
        }
        // add known classes which may not be in the table
        for (var key in Squeak) {
            if (/^splOb_Class/.test(key)) {
                var knownClass = oopMap[rawBits[splObjs.oop][Squeak[key]]];
                if (knownClass !== nil) {
                    var classIndex = knownClass.hash;
                    if (classIndex > 0 && classIndex < 1024)
                        classes[classIndex] = knownClass;
                }
            }
        }
        classes[3] = classes[1];      // SmallInteger needs two entries
        this.classTable = classes;
        this.classTableIndex = 1024;  // first page is special
        return classes;
    },
    enterIntoClassTable: function(newClass) {
        var index = this.classTableIndex,
            table = this.classTable;
        while (index <= 0x3FFFFF) {
            if (!table[index]) {
                table[index] = newClass;
                newClass.hash = index;
                this.classTableIndex = index;
                return index;
            }
            index++;
        }
        console.error("class table full?"); // todo: clean out old class table entries
        return null;
    },
    initCharacterTable: function(characterClass) {
        characterClass.classInstProto("Character"); // provide name
        this.characterClass = characterClass;
        this.characterTable = {};
    },
    getCharacter: function(unicode) {
        var char = this.characterTable[unicode];
        if (!char) {
            char = new this.characterClass.instProto;
            char.initInstanceOfChar(this.characterClass, unicode);
            this.characterTable[unicode] = char;
        }
        return char;
    },
    ensureClassesInTable: function() {
        // make sure all classes are in class table
        // answer number of class pages
        var obj = this.firstOldObject;
        var maxIndex = 1024; // at least one page
        while (obj) {
            var cls = obj.sqClass;
            if (cls.hash === 0) this.enterIntoClassTable(cls);
            if (cls.hash > maxIndex) maxIndex = cls.hash;
            if (this.classTable[cls.hash] !== cls) throw Error("Class not in class table");
            obj = obj.nextObject;
        }
        return (maxIndex >> 10) + 1;
    },
    classTableBytes: function(numPages) {
        // space needed for master table and minor pages
        return (4 + 4104 + numPages * (4 + 1024)) * 4;
    },
    writeFreeLists: function(data, pos, littleEndian, oopOffset) {
        // we fake an empty free lists object
        data.setUint32(pos, 0x0A000012, littleEndian); pos += 4;
        data.setUint32(pos, 0x20000000, littleEndian); pos += 4;
        pos += 32 * 4;  // 32 zeros
        return pos;
    },
    writeClassTable: function(data, pos, littleEndian, objToOop, numPages) {
        // write class tables as Spur expects them, faking their oops
        var nilFalseTrueBytes = 3 * 16,
            freeListBytes = 8 + 32 * 4,
            majorTableSlots = 4096 + 8,         // class pages plus 8 hiddenRootSlots
            minorTableSlots = 1024,
            majorTableBytes = 16 + majorTableSlots * 4,
            minorTableBytes = 16 + minorTableSlots * 4,
            firstPageOop = nilFalseTrueBytes + freeListBytes + majorTableBytes + 8;
        // major table
        data.setUint32(pos, majorTableSlots, littleEndian); pos += 4;
        data.setUint32(pos,      0xFF000000, littleEndian); pos += 4;
        data.setUint32(pos,      0x02000010, littleEndian); pos += 4;
        data.setUint32(pos,      0xFF000000, littleEndian); pos += 4;
        for (var p = 0; p < numPages; p++) {
            data.setUint32(pos, firstPageOop + p * minorTableBytes, littleEndian); pos += 4;
        }
        pos += (majorTableSlots - numPages) * 4;  // rest is nil
        // minor tables
        var classID = 0;
        for (var p = 0; p < numPages; p++) {
            data.setUint32(pos, minorTableSlots, littleEndian); pos += 4;
            data.setUint32(pos,      0xFF000000, littleEndian); pos += 4;
            data.setUint32(pos,      0x02000010, littleEndian); pos += 4;
            data.setUint32(pos,      0xFF000000, littleEndian); pos += 4;
            for (var i = 0; i < minorTableSlots; i++) {
                var classObj = this.classTable[classID];
                if (classObj && classObj.pointers) {
                    if (!classObj.hash) throw Error("class without id");
                    if (classObj.hash !== classID && classID >= 32) {
                        console.warn("freeing class index " + classID + " " + classObj.className());
                        classObj = null;
                    }
                }
                if (classObj) data.setUint32(pos, objToOop(classObj), littleEndian);
                pos += 4;
                classID++;
            }
        }
        return pos;
    },
    writeToBufferSpur: function() {
        var headerSize = 64,
            trailerSize = 16,
            freeListsSize = 136,
            numPages = this.ensureClassesInTable(),
            hiddenSize = freeListsSize + this.classTableBytes(numPages),
            data = new DataView(new ArrayBuffer(headerSize + hiddenSize + this.oldSpaceBytes + trailerSize)),
            littleEndian = true,
            start = Date.now(),
            pos = 0;
        function writeWord(word) {
            data.setUint32(pos, word, littleEndian);
            pos += 4;
        };
        function objToOop(obj) {
            if (typeof obj === "number")
                return obj << 1 | 1; // add tag bit
            if (obj._format === 7) {
                if (obj.hash !== (obj.oop >> 2) || (obj.oop & 3) !== 2)
                    throw Error("Bad immediate char");
                return obj.oop;
            }
            if (obj.oop < 0) throw Error("temporary oop");
            // oops after nil/false/true are shifted by size of hidden objects
            return obj.oop < 48 ? obj.oop : obj.oop + hiddenSize;
        };
        writeWord(this.formatVersion()); // magic number
        writeWord(headerSize);
        writeWord(hiddenSize + this.oldSpaceBytes + trailerSize); // end of memory
        writeWord(this.firstOldObject.addr()); // base addr (0)
        writeWord(objToOop(this.specialObjectsArray));
        writeWord(this.lastHash);
        this.savedHeaderWords.forEach(writeWord);
        writeWord(hiddenSize + this.oldSpaceBytes + trailerSize); //first segment size
        while (pos < headerSize)
            writeWord(0);
        // write objects
        var obj = this.firstOldObject,
            n = 0;
        pos = obj.writeTo(data, pos, littleEndian, objToOop); obj = obj.nextObject; n++; // write nil
        pos = obj.writeTo(data, pos, littleEndian, objToOop); obj = obj.nextObject; n++; // write false
        pos = obj.writeTo(data, pos, littleEndian, objToOop); obj = obj.nextObject; n++; // write true
        pos = this.writeFreeLists(data, pos, littleEndian, objToOop); // write hidden free list
        pos = this.writeClassTable(data, pos, littleEndian, objToOop, numPages); // write hidden class table
        while (obj) {
            pos = obj.writeTo(data, pos, littleEndian, objToOop);
            obj = obj.nextObject;
            n++;
        }
        // write segement trailer
        writeWord(0x4A000003);
        writeWord(0x00800000);
        writeWord(0);
        writeWord(0);
        // done
        if (pos !== data.byteLength) throw Error("wrong image size");
        if (n !== this.oldSpaceCount) throw Error("wrong object count");
        var time = Date.now() - start;
        console.log("Wrote " + n + " objects in " + time + " ms, image size " + pos + " bytes")
        return data.buffer;
    },
});

Object.subclass('Squeak.Object',
'initialization', {
    initInstanceOf: function(aClass, indexableSize, hash, nilObj) {
        this.sqClass = aClass;
        this.hash = hash;
        var instSpec = aClass.pointers[Squeak.Class_format],
            instSize = ((instSpec>>1) & 0x3F) + ((instSpec>>10) & 0xC0) - 1; //0-255
        this._format = (instSpec>>7) & 0xF; //This is the 0-15 code

        if (this._format < 8) {
            if (this._format != 6) {
                if (instSize + indexableSize > 0)
                    this.pointers = this.fillArray(instSize + indexableSize, nilObj);
            } else // Words
                if (indexableSize > 0)
                    if (aClass.isFloatClass) {
                        this.isFloat = true;
                        this.float = 0.0;
                    } else
                        this.words = new Uint32Array(indexableSize);
        } else // Bytes
            if (indexableSize > 0) {
                // this._format |= -indexableSize & 3;       //deferred to writeTo()
                this.bytes = new Uint8Array(indexableSize); //Methods require further init of pointers
            }

//      Definition of Squeak's format code...
//
//      Pointers only...
//        0      no fields
//        1      fixed fields only (all containing pointers)
//        2      indexable fields only (all containing pointers)
//        3      both fixed and indexable fields (all containing pointers)
//        4      both fixed and indexable weak fields (all containing pointers).
//        5      unused
//      Bits only...
//        6      indexable word fields only (no pointers)
//        7      unused
//        8-11   indexable byte fields only (no pointers) (low 2 bits are low 2 bits of size)
//      Pointer and bits (CompiledMethods only)...
//       12-15   compiled methods:
//               # of literal oops specified in method header,
//               followed by indexable bytes (same interpretation of low 2 bits as above)
    },
    initAsClone: function(original, hash) {
        this.sqClass = original.sqClass;
        this.hash = hash;
        this._format = original._format;
        if (original.isFloat) {
            this.isFloat = original.isFloat;
            this.float = original.float;
        } else {
            if (original.pointers) this.pointers = original.pointers.slice(0);   // copy
            if (original.words) this.words = new Uint32Array(original.words);    // copy
            if (original.bytes) this.bytes = new Uint8Array(original.bytes);     // copy
        }
    },
    initFromImage: function(oop, cls, fmt, hsh) {
        // initial creation from Image, with unmapped data
        this.oop = oop;
        this.sqClass = cls;
        this._format = fmt;
        this.hash = hsh;
    },
    classNameFromImage: function(oopMap, rawBits) {
        var name = oopMap[rawBits[this.oop][Squeak.Class_name]];
        if (name && name._format >= 8 && name._format < 12) {
            var bits = rawBits[name.oop],
                bytes = name.decodeBytes(bits.length, bits, 0, name._format & 3);
            return Squeak.bytesAsString(bytes);
        }
        return "Class";
    },
    renameFromImage: function(oopMap, rawBits, ccArray) {
        var classObj = this.sqClass < 32 ? oopMap[ccArray[this.sqClass-1]] : oopMap[this.sqClass];
        if (!classObj) return this;
        var instProto = classObj.instProto || classObj.classInstProto(classObj.classNameFromImage(oopMap, rawBits));
        if (!instProto) return this;
        var renamedObj = new instProto; // Squeak.Object
        renamedObj.oop = this.oop;
        renamedObj.sqClass = this.sqClass;
        renamedObj._format = this._format;
        renamedObj.hash = this.hash;
        return renamedObj;
    },
    installFromImage: function(oopMap, rawBits, ccArray, floatClass, littleEndian, nativeFloats) {
        //Install this object by decoding format, and rectifying pointers
        var ccInt = this.sqClass;
        // map compact classes
        if ((ccInt>0) && (ccInt<32))
            this.sqClass = oopMap[ccArray[ccInt-1]];
        else
            this.sqClass = oopMap[ccInt];
        var bits = rawBits[this.oop],
            nWords = bits.length;
        if (this._format < 5) {
            //Formats 0...4 -- Pointer fields
            if (nWords > 0) {
                var oops = bits; // endian conversion was already done
                this.pointers = this.decodePointers(nWords, oops, oopMap);
            }
        } else if (this._format >= 12) {
            //Formats 12-15 -- CompiledMethods both pointers and bits
            var methodHeader = this.decodeWords(1, bits, littleEndian)[0],
                numLits = (methodHeader>>10) & 255,
                oops = this.decodeWords(numLits+1, bits, littleEndian);
            this.pointers = this.decodePointers(numLits+1, oops, oopMap); //header+lits
            this.bytes = this.decodeBytes(nWords-(numLits+1), bits, numLits+1, this._format & 3);
        } else if (this._format >= 8) {
            //Formats 8..11 -- ByteArrays (and ByteStrings)
            if (nWords > 0)
                this.bytes = this.decodeBytes(nWords, bits, 0, this._format & 3);
        } else if (this.sqClass == floatClass) {
            //These words are actually a Float
            this.isFloat = true;
            this.float = this.decodeFloat(bits, littleEndian, nativeFloats);
            if (this.float == 1.3797216632888e-310) {
                if (/noFloatDecodeWorkaround/.test(window.location.hash)) {
                    // floatDecode workaround disabled
                } else {
                    this.constructor.prototype.decodeFloat = this.decodeFloatDeoptimized;
                    this.float = this.decodeFloat(bits, littleEndian, nativeFloats);
                    if (this.float == 1.3797216632888e-310)
                        throw Error("Cannot deoptimize decodeFloat");
                }
            }
        } else {
            if (nWords > 0)
                this.words = this.decodeWords(nWords, bits, littleEndian);
        }
        this.mark = false; // for GC
    },
    decodePointers: function(nWords, theBits, oopMap) {
        //Convert small ints and look up object pointers in oopMap
        var ptrs = new Array(nWords);
        for (var i = 0; i < nWords; i++) {
            var oop = theBits[i];
            if ((oop & 1) === 1) {          // SmallInteger
                ptrs[i] = oop >> 1;
            } else {                        // Object
                ptrs[i] = oopMap[oop] || 42424242;
                // when loading a context from image segment, there is
                // garbage beyond its stack pointer, resulting in the oop
                // not being found in oopMap. We just fill in an arbitrary
                // SmallInteger - it's never accessed anyway
            }
        }
        return ptrs;
    },
    decodeWords: function(nWords, theBits, littleEndian) {
        var data = new DataView(theBits.buffer, theBits.byteOffset),
            words = new Uint32Array(nWords);
        for (var i = 0; i < nWords; i++)
            words[i] = data.getUint32(i*4, littleEndian);
        return words;
    },
    decodeBytes: function (nWords, theBits, wordOffset, fmtLowBits) {
        // Adjust size for low bits and make a copy
        var nBytes = (nWords * 4) - fmtLowBits,
            wordsAsBytes = new Uint8Array(theBits.buffer, theBits.byteOffset + wordOffset * 4, nBytes),
            bytes = new Uint8Array(nBytes);
        bytes.set(wordsAsBytes);
        return bytes;
    },
    decodeFloat: function(theBits, littleEndian, nativeFloats) {
        var data = new DataView(theBits.buffer, theBits.byteOffset);
        // it's either big endian ...
        if (!littleEndian) return data.getFloat64(0, false);
        // or real little endian
        if (nativeFloats) return data.getFloat64(0, true);
        // or little endian, but with swapped words
        var buffer = new ArrayBuffer(8),
            swapped = new DataView(buffer);
        swapped.setUint32(0, data.getUint32(4));
        swapped.setUint32(4, data.getUint32(0));
        return swapped.getFloat64(0, true);
    },
    decodeFloatDeoptimized: function(theBits, littleEndian, nativeFloats) {
        var data = new DataView(theBits.buffer, theBits.byteOffset);
        // it's either big endian ...
        if (!littleEndian) return data.getFloat64(0, false);
        // or real little endian
        if (nativeFloats) return data.getFloat64(0, true);
        // or little endian, but with swapped words
        var buffer = new ArrayBuffer(8),
            swapped = new DataView(buffer);
        // wrap in function to defeat Safari's optimizer, which always
        // answers 1.3797216632888e-310 if called more than 25000 times
        (function() {
            swapped.setUint32(0, data.getUint32(4));
            swapped.setUint32(4, data.getUint32(0));
        })();
        return swapped.getFloat64(0, true);
    },
    fillArray: function(length, filler) {
        for (var array = [], i = 0; i < length; i++)
            array[i] = filler;
        return array;
    },
},
'testing', {
    isWords: function() {
        return this._format === 6;
    },
    isBytes: function() {
        var fmt = this._format;
        return fmt >= 8 && fmt <= 11;
    },
    isWordsOrBytes: function() {
        var fmt = this._format;
        return fmt == 6  || (fmt >= 8 && fmt <= 11);
    },
    isPointers: function() {
        return this._format <= 4;
    },
    isWeak: function() {
        return this._format === 4;
    },
    isMethod: function() {
        return this._format >= 12;
    },
    sameFormats: function(a, b) {
        return a < 8 ? a === b : (a & 0xC) === (b & 0xC);
    },
    sameFormatAs: function(obj) {
        return this.sameFormats(this._format, obj._format);
    },
},
'printing', {
    toString: function() {
        return this.sqInstName();
    },
    bytesAsString: function() {
        if (!this.bytes) return '';
        return Squeak.bytesAsString(this.bytes);
    },
    bytesAsNumberString: function(negative) {
        if (!this.bytes) return '';
        var hex = '0123456789ABCDEF',
            digits = [],
            value = 0;
        for (var i = this.bytes.length - 1; i >= 0; i--) {
            digits.push(hex[this.bytes[i] >> 4]);
            digits.push(hex[this.bytes[i] & 15]);
            value = value * 256 + this.bytes[i];
        }
        var sign = negative ? '-' : '',
            approx = value > 0x1FFFFFFFFFFFFF ? '≈' : '';
        return sign + '16r' + digits.join('') + ' (' + approx + sign + value + 'L)';
    },
    assnKeyAsString: function() {
        return this.pointers[Squeak.Assn_key].bytesAsString();
    },
    slotNameAt: function(index) {
        // one-based index
        var instSize = this.instSize();
        if (index <= instSize)
            return this.sqClass.allInstVarNames()[index - 1] || 'ivar' + (index - 1);
        else
            return (index - instSize).toString();
    },
    sqInstName: function() {
        if (this.isNil) return "nil";
        if (this.isTrue) return "true";
        if (this.isFalse) return "false";
        if (this.isFloat) {var str = this.float.toString(); if (!/\./.test(str)) str += '.0'; return str; }
        var className = this.sqClass.className();
        if (/ /.test(className))
            return 'the ' + className;
        switch (className) {
            case 'String':
            case 'ByteString': return "'" + this.bytesAsString() + "'";
            case 'Symbol':
            case 'ByteSymbol':  return "#" + this.bytesAsString();
            case 'Point': return this.pointers.join("@");
            case 'Rectangle': return this.pointers.join(" corner: ");
            case 'Association':
            case 'ReadOnlyVariableBinding': return this.pointers.join("->");
            case 'LargePositiveInteger': return this.bytesAsNumberString(false);
            case 'LargeNegativeInteger': return this.bytesAsNumberString(true);
            case 'Character': var unicode = this.pointers ? this.pointers[0] : this.hash; // Spur
                return "$" + String.fromCharCode(unicode) + " (" + unicode.toString() + ")";
        }
        return  /^[aeiou]/i.test(className) ? 'an' + className : 'a' + className;
    },
},
'accessing', {
    pointersSize: function() {
        return this.pointers ? this.pointers.length : 0;
    },
    bytesSize: function() {
        return this.bytes ? this.bytes.length : 0;
    },
    wordsSize: function() {
        return this.isFloat ? 2 : this.words ? this.words.length : 0;
    },
    instSize: function() {//same as class.classInstSize, but faster from format
        var fmt = this._format;
        if (fmt > 4 || fmt === 2) return 0;      //indexable fields only
        if (fmt < 2) return this.pointersSize(); //fixed fields only
        return this.sqClass.classInstSize();
    },
    indexableSize: function(primHandler) {
        var fmt = this._format;
        if (fmt < 2) return -1; //not indexable
        if (fmt === 3 && primHandler.vm.isContext(this) && !primHandler.allowAccessBeyondSP)
            return this.pointers[Squeak.Context_stackPointer]; // no access beyond top of stacks
        if (fmt < 6) return this.pointersSize() - this.instSize(); // pointers
        if (fmt < 8) return this.wordsSize(); // words
        if (fmt < 12) return this.bytesSize(); // bytes
        return this.bytesSize() + (4 * this.pointersSize()); // methods
    },
    floatData: function() {
        var buffer = new ArrayBuffer(8);
        var data = new DataView(buffer);
        data.setFloat64(0, this.float, false);
        //1st word is data.getUint32(0, false);
        //2nd word is data.getUint32(4, false);
        return data;
    },
    wordsAsFloat32Array: function() {
        return this.float32Array
            || (this.words && (this.float32Array = new Float32Array(this.words.buffer)));
    },
    wordsAsFloat64Array: function() {
        return this.float64Array
            || (this.words && (this.float64Array = new Float64Array(this.words.buffer)));
    },
    wordsAsInt32Array: function() {
        return this.int32Array
            || (this.words && (this.int32Array = new Int32Array(this.words.buffer)));
    },
    wordsAsInt16Array: function() {
        return this.int16Array
            || (this.words && (this.int16Array = new Int16Array(this.words.buffer)));
    },
    wordsAsUint16Array: function() {
        return this.uint16Array
            || (this.words && (this.uint16Array = new Uint16Array(this.words.buffer)));
    },
    wordsAsUint8Array: function() {
        return this.uint8Array
            || (this.words && (this.uint8Array = new Uint8Array(this.words.buffer)));
    },
    wordsOrBytes: function() {
        if (this.words) return this.words;
        if (this.uint32Array) return this.uint32Array;
        if (!this.bytes) return null;
        return this.uint32Array = new Uint32Array(this.bytes.buffer, 0, this.bytes.length >>> 2);
    },
    setAddr: function(addr) {
        // Move this object to addr by setting its oop. Answer address after this object.
        // Used to assign an oop for the first time when tenuring this object during GC.
        // When compacting, the oop is adjusted directly, since header size does not change.
        var words = this.snapshotSize();
        this.oop = addr + words.header * 4;
        return addr + (words.header + words.body) * 4;
    },
    snapshotSize: function() {
        // words of extra object header and body this object would take up in image snapshot
        // body size includes one header word that is always present
        var nWords =
            this.isFloat ? 2 :
            this.words ? this.words.length :
            this.pointers ? this.pointers.length : 0;
        // methods have both pointers and bytes
        if (this.bytes) nWords += (this.bytes.length + 3) >>> 2;
        nWords++; // one header word always present
        var extraHeader = nWords > 63 ? 2 : this.sqClass.isCompact ? 0 : 1;
        return {header: extraHeader, body: nWords};
    },
    addr: function() { // start addr of this object in a snapshot
        return this.oop - this.snapshotSize().header * 4;
    },
    totalBytes: function() {
        // size in bytes this object would take up in image snapshot
        var words = this.snapshotSize();
        return (words.header + words.body) * 4;
    },
    writeTo: function(data, pos, image) {
        // Write 1 to 3 header words encoding type, class, and size, then instance data
        if (this.bytes) this._format |= -this.bytes.length & 3;
        var beforePos = pos,
            size = this.snapshotSize(),
            formatAndHash = ((this._format & 15) << 8) | ((this.hash & 4095) << 17);
        // write header words first
        switch (size.header) {
            case 2:
                data.setUint32(pos, size.body << 2 | Squeak.HeaderTypeSizeAndClass); pos += 4;
                data.setUint32(pos, this.sqClass.oop | Squeak.HeaderTypeSizeAndClass); pos += 4;
                data.setUint32(pos, formatAndHash | Squeak.HeaderTypeSizeAndClass); pos += 4;
                break;
            case 1:
                data.setUint32(pos, this.sqClass.oop | Squeak.HeaderTypeClass); pos += 4;
                data.setUint32(pos, formatAndHash | size.body << 2 | Squeak.HeaderTypeClass); pos += 4;
                break;
            case 0:
                var classIndex = image.compactClasses.indexOf(this.sqClass) + 1;
                data.setUint32(pos, formatAndHash | classIndex << 12 | size.body << 2 | Squeak.HeaderTypeShort); pos += 4;
        }
        // now write body, if any
        if (this.isFloat) {
            data.setFloat64(pos, this.float); pos += 8;
        } else if (this.words) {
            for (var i = 0; i < this.words.length; i++) {
                data.setUint32(pos, this.words[i]); pos += 4;
            }
        } else if (this.pointers) {
            for (var i = 0; i < this.pointers.length; i++) {
                data.setUint32(pos, image.objectToOop(this.pointers[i])); pos += 4;
            }
        }
        // no "else" because CompiledMethods have both pointers and bytes
        if (this.bytes) {
            for (var i = 0; i < this.bytes.length; i++)
                data.setUint8(pos++, this.bytes[i]);
            // skip to next word
            pos += -this.bytes.length & 3;
        }
        // done
        if (pos !== beforePos + this.totalBytes()) throw Error("written size does not match");
        return pos;
    },
},
'as class', {
    classInstFormat: function() {
        return (this.pointers[Squeak.Class_format] >> 7) & 0xF;
    },
    classInstSize: function() {
        // this is a class, answer number of named inst vars
        var spec = this.pointers[Squeak.Class_format];
        return ((spec >> 10) & 0xC0) + ((spec >> 1) & 0x3F) - 1;
    },
    instVarNames: function() {
        // index changed from 4 to 3 in newer images
        for (var index = 3; index <= 4; index++) {
            var varNames = this.pointers[index].pointers;
            if (varNames && varNames.length && varNames[0].bytes) {
                return varNames.map(function(each) {
                    return each.bytesAsString();
                });
            }
        }
        return [];
    },
    allInstVarNames: function() {
        var superclass = this.superclass();
        if (superclass.isNil)
            return this.instVarNames();
        else
            return superclass.allInstVarNames().concat(this.instVarNames());
    },
    superclass: function() {
        return this.pointers[0];
    },
    className: function() {
        if (!this.pointers) return "_NOTACLASS_";
        for (var nameIdx = 6; nameIdx <= 7; nameIdx++) {
            var name = this.pointers[nameIdx];
            if (name && name.bytes) return name.bytesAsString();
        }
        // must be meta class
        for (var clsIndex = 5; clsIndex <= 6; clsIndex++) {
            var cls = this.pointers[clsIndex];
            if (cls && cls.pointers) {
                for (var nameIdx = 6; nameIdx <= 7; nameIdx++) {
                    var name = cls.pointers[nameIdx];
                    if (name && name.bytes) return name.bytesAsString() + " class";
                }
            }
        }
        return "_SOMECLASS_";
    },
    defaultInst: function() {
        return Squeak.Object;
    },
    classInstProto: function(className) {
        if (this.instProto) return this.instProto;
        var proto = this.defaultInst();  // in case below fails
        try {
            if (!className) className = this.className();
            var safeName = className.replace(/[^A-Za-z0-9]/g,'_');
            if (safeName === "UndefinedObject") safeName = "nil";
            else if (safeName === "True") safeName = "true_";
            else if (safeName === "False") safeName = "false_";
            else safeName = ((/^[AEIOU]/.test(safeName)) ? 'an' : 'a') + safeName;
            // fail okay if no eval()
            proto = new Function("return function " + safeName + "() {};")();
            proto.prototype = this.defaultInst().prototype;
        } catch(e) {}
        Object.defineProperty(this, 'instProto', { value: proto });
        return proto;
    },
},
'as method', {
    methodNumLits: function() {
        return (this.pointers[0]>>9) & 0xFF;
    },
    methodNumArgs: function() {
        return (this.pointers[0]>>24) & 0xF;
    },
    methodPrimitiveIndex: function() {
        var primBits = this.pointers[0] & 0x300001FF;
        if (primBits > 0x1FF)
            return (primBits & 0x1FF) + (primBits >> 19);
        else
            return primBits;
    },
    methodClassForSuper: function() {//assn found in last literal
        var assn = this.pointers[this.methodNumLits()];
        return assn.pointers[Squeak.Assn_value];
    },
    methodNeedsLargeFrame: function() {
        return (this.pointers[0] & 0x20000) > 0;
    },
    methodAddPointers: function(headerAndLits) {
        this.pointers = headerAndLits;
    },
    methodTempCount: function() {
        return (this.pointers[0]>>18) & 63;
    },
    methodGetLiteral: function(zeroBasedIndex) {
        return this.pointers[1+zeroBasedIndex]; // step over header
    },
    methodGetSelector: function(zeroBasedIndex) {
        return this.pointers[1+zeroBasedIndex]; // step over header
    },
},
'as context',
{
    contextHome: function() {
        return this.contextIsBlock() ? this.pointers[Squeak.BlockContext_home] : this;
    },
    contextIsBlock: function() {
        return typeof this.pointers[Squeak.BlockContext_argumentCount] === 'number';
    },
    contextMethod: function() {
        return this.contextHome().pointers[Squeak.Context_method];
    },
    contextSender: function() {
        return this.pointers[Squeak.Context_sender];
    },
    contextSizeWithStack: function(vm) {
        // Actual context size is inst vars + stack size. Slots beyond that may contain garbage.
        // If passing in a VM, and this is the activeContext, use the VM's current value.
        if (vm && vm.activeContext === this)
            return vm.sp + 1;
        // following is same as decodeSqueakSP() but works without vm ref
        var sp = this.pointers[Squeak.Context_stackPointer];
        return Squeak.Context_tempFrameStart + (typeof sp === "number" ? sp : 0);
    },
});

Squeak.Object.subclass('Squeak.ObjectSpur',
'initialization',
{
    initInstanceOf: function(aClass, indexableSize, hash, nilObj) {
        this.sqClass = aClass;
        this.hash = hash;
        var instSpec = aClass.pointers[Squeak.Class_format],
            instSize = instSpec & 0xFFFF,
            format = (instSpec>>16) & 0x1F
        this._format = format;
        if (format < 12) {
            if (format < 10) {
                if (instSize + indexableSize > 0)
                    this.pointers = this.fillArray(instSize + indexableSize, nilObj);
            } else // Words
                if (indexableSize > 0)
                    if (aClass.isFloatClass) {
                        this.isFloat = true;
                        this.float = 0.0;
                    } else
                        this.words = new Uint32Array(indexableSize);
        } else // Bytes
            if (indexableSize > 0) {
                // this._format |= -indexableSize & 3;       //deferred to writeTo()
                this.bytes = new Uint8Array(indexableSize);  //Methods require further init of pointers
            }
//      Definition of Spur's format code...
//
//     0 = 0 sized objects (UndefinedObject True False et al)
//     1 = non-indexable objects with inst vars (Point et al)
//     2 = indexable objects with no inst vars (Array et al)
//     3 = indexable objects with inst vars (MethodContext AdditionalMethodState et al)
//     4 = weak indexable objects with inst vars (WeakArray et al)
//     5 = weak non-indexable objects with inst vars (ephemerons) (Ephemeron)
//     6 = unused
//     7 = immediates (SmallInteger, Character)
//     8 = unused
//     9 = 64-bit indexable
// 10-11 = 32-bit indexable (Bitmap)          (plus one odd bit, unused in 32-bits)
// 12-15 = 16-bit indexable                   (plus two odd bits, one unused in 32-bits)
// 16-23 = 8-bit indexable                    (plus three odd bits, one unused in 32-bits)
// 24-31 = compiled methods (CompiledMethod)  (plus three odd bits, one unused in 32-bits)
    },
    installFromImage: function(oopMap, rawBits, classTable, floatClass, littleEndian, getCharacter) {
        //Install this object by decoding format, and rectifying pointers
        var classID = this.sqClass;
        if (classID < 32) throw Error("Invalid class ID: " + classID);
        this.sqClass = classTable[classID];
        if (!this.sqClass) throw Error("Class ID not in class table: " + classID);
        var bits = rawBits[this.oop],
            nWords = bits.length;
        switch (this._format) {
            case 0: // zero sized object
              // Pharo bug: Pharo 6.0 still has format 0 objects that actually do have inst vars
              // https://pharo.fogbugz.com/f/cases/19010/ImmediateLayout-and-EphemeronLayout-have-wrong-object-format
              // so we pretend these are regular objects and rely on nWords
            case 1: // only inst vars
            case 2: // only indexed vars
            case 3: // inst vars and indexed vars
            case 4: // only indexed vars (weak)
            case 5: // only inst vars (weak)
                if (nWords > 0) {
                    var oops = bits; // endian conversion was already done
                    this.pointers = this.decodePointers(nWords, oops, oopMap, getCharacter);
                }
                break;
            case 10: // 32 bit array
                if (this.sqClass === floatClass) {
                    //These words are actually a Float
                    this.isFloat = true;
                    this.float = this.decodeFloat(bits, littleEndian, true);
                    if (this.float == 1.3797216632888e-310) {
                        if (/noFloatDecodeWorkaround/.test(window.location.hash)) {
                            // floatDecode workaround disabled
                        } else {
                            this.constructor.prototype.decodeFloat = this.decodeFloatDeoptimized;
                            this.float = this.decodeFloat(bits, littleEndian, true);
                            if (this.float == 1.3797216632888e-310)
                                throw Error("Cannot deoptimize decodeFloat");
                        }
                    }
                } else if (nWords > 0) {
                    this.words = this.decodeWords(nWords, bits, littleEndian);
                }
                break
            case 12: // 16 bit array
            case 13: // 16 bit array (odd length)
                throw Error("16 bit arrays not supported yet");
            case 16: // 8 bit array
            case 17: // ... length-1
            case 18: // ... length-2
            case 19: // ... length-3
                if (nWords > 0)
                    this.bytes = this.decodeBytes(nWords, bits, 0, this._format & 3);
                break;
            case 24: // CompiledMethod
            case 25: // CompiledMethod
            case 26: // CompiledMethod
            case 27: // CompiledMethod
                var rawHeader = this.decodeWords(1, bits, littleEndian)[0];
                if (rawHeader & 0x80000000) throw Error("Alternate bytecode set not supported")
                var numLits = (rawHeader >> 1) & 0x7FFF,
                    oops = this.decodeWords(numLits+1, bits, littleEndian);
                this.pointers = this.decodePointers(numLits+1, oops, oopMap, getCharacter); //header+lits
                this.bytes = this.decodeBytes(nWords-(numLits+1), bits, numLits+1, this._format & 3);
                break
            default:
                throw Error("Unknown object format: " + this._format);

        }
        this.mark = false; // for GC
    },
    decodePointers: function(nWords, theBits, oopMap, getCharacter) {
        //Convert immediate objects and look up object pointers in oopMap
        var ptrs = new Array(nWords);
        for (var i = 0; i < nWords; i++) {
            var oop = theBits[i];
            if ((oop & 1) === 1) {          // SmallInteger
                ptrs[i] = oop >> 1;
            } else if ((oop & 3) === 2) {   // Character
                ptrs[i] = getCharacter(oop >>> 2);
            } else {                        // Object
                ptrs[i] = oopMap[oop] || 42424242;
                // when loading a context from image segment, there is
                // garbage beyond its stack pointer, resulting in the oop
                // not being found in oopMap. We just fill in an arbitrary
                // SmallInteger - it's never accessed anyway
            }
        }
        return ptrs;
    },
    initInstanceOfChar: function(charClass, unicode) {
        this.oop = (unicode << 2) | 2;
        this.sqClass = charClass;
        this.hash = unicode;
        this._format = 7;
        this.mark = true;   // stays always marked so not traced by GC
    },
    classNameFromImage: function(oopMap, rawBits) {
        var name = oopMap[rawBits[this.oop][Squeak.Class_name]];
        if (name && name._format >= 16 && name._format < 24) {
            var bits = rawBits[name.oop],
                bytes = name.decodeBytes(bits.length, bits, 0, name._format & 7);
            return Squeak.bytesAsString(bytes);
        }
        return "Class";
    },
    renameFromImage: function(oopMap, rawBits, classTable) {
        var classObj = classTable[this.sqClass];
        if (!classObj) return this;
        var instProto = classObj.instProto || classObj.classInstProto(classObj.classNameFromImage(oopMap, rawBits));
        if (!instProto) return this;
        var renamedObj = new instProto; // Squeak.SpurObject
        renamedObj.oop = this.oop;
        renamedObj.sqClass = this.sqClass;
        renamedObj._format = this._format;
        renamedObj.hash = this.hash;
        return renamedObj;
    },
},
'accessing', {
    instSize: function() {//same as class.classInstSize, but faster from format
        if (this._format < 2) return this.pointersSize(); //fixed fields only
        return this.sqClass.classInstSize();
    },
    indexableSize: function(primHandler) {
        var fmt = this._format;
        if (fmt < 2) return -1; //not indexable
        if (fmt === 3 && primHandler.vm.isContext(this))
            return this.pointers[Squeak.Context_stackPointer]; // no access beyond top of stacks
        if (fmt < 6) return this.pointersSize() - this.instSize(); // pointers
        if (fmt < 12) return this.wordsSize(); // words
        if (fmt < 16) return this.shortsSize(); // shorts
        if (fmt < 24) return this.bytesSize(); // bytes
        return 4 * this.pointersSize() + this.bytesSize(); // methods
    },
    snapshotSize: function() {
        // words of extra object header and body this object would take up in image snapshot
        // body size includes header size that is always present
        var nWords =
            this.isFloat ? 2 :
            this.words ? this.words.length :
            this.pointers ? this.pointers.length : 0;
        // methods have both pointers and bytes
        if (this.bytes) nWords += (this.bytes.length + 3) >>> 2;
        var extraHeader = nWords >= 255 ? 2 : 0;
        nWords += nWords & 1; // align to 8 bytes
        nWords += 2; // one 64 bit header always present
        if (nWords < 4) nWords = 4; // minimum object size
        return {header: extraHeader, body: nWords};
    },
    writeTo: function(data, pos, littleEndian, objToOop) {
        var nWords =
            this.isFloat ? 2 :
            this.words ? this.words.length :
            this.pointers ? this.pointers.length : 0;
        if (this.bytes) {
            nWords += (this.bytes.length + 3) >>> 2;
            this._format |= -this.bytes.length & 3;
        }
        var beforePos = pos,
            formatAndClass = (this._format << 24) | (this.sqClass.hash & 0x003FFFFF),
            sizeAndHash = (nWords << 24) | (this.hash & 0x003FFFFF);
        // write extra header if needed
        if (nWords >= 255) {
            data.setUint32(pos, nWords, littleEndian); pos += 4;
            sizeAndHash = (255 << 24) | (this.hash & 0x003FFFFF);
            data.setUint32(pos, sizeAndHash, littleEndian); pos += 4;
        }
        // write regular header
        data.setUint32(pos, formatAndClass, littleEndian); pos += 4;
        data.setUint32(pos, sizeAndHash, littleEndian); pos += 4;
        // now write body, if any
        if (this.isFloat) {
            data.setFloat64(pos, this.float, littleEndian); pos += 8;
        } else if (this.words) {
            for (var i = 0; i < this.words.length; i++) {
                data.setUint32(pos, this.words[i], littleEndian); pos += 4;
            }
        } else if (this.pointers) {
            for (var i = 0; i < this.pointers.length; i++) {
                data.setUint32(pos, objToOop(this.pointers[i]), littleEndian); pos += 4;
            }
        }
        // no "else" because CompiledMethods have both pointers and bytes
        if (this.bytes) {
            for (var i = 0; i < this.bytes.length; i++)
                data.setUint8(pos++, this.bytes[i]);
            // skip to next word
            pos += -this.bytes.length & 3;
        }
        // minimum object size is 16, align to 8 bytes
        if (nWords === 0) pos += 8;
        else pos += (nWords & 1) * 4;
        // done
        if (pos !== beforePos + this.totalBytes()) throw Error("written size does not match");
        return pos;
    },
},
'testing', {
    isBytes: function() {
        var fmt = this._format;
        return fmt >= 16 && fmt <= 23;
    },
    isPointers: function() {
        return this._format <= 6;
    },
    isWords: function() {
        return this._format === 10;
    },
    isWordsOrBytes: function() {
        var fmt = this._format;
        return fmt === 10 || (fmt >= 16 && fmt <= 23);
    },
    isWeak: function() {
        return this._format === 4;
    },
    isMethod: function() {
        return this._format >= 24;
    },
    sameFormats: function(a, b) {
        return a < 16 ? a === b : (a & 0xF8) === (b & 0xF8);
    },
},
'as class', {
    defaultInst: function() {
        return Squeak.ObjectSpur;
    },
    classInstFormat: function() {
        return (this.pointers[Squeak.Class_format] >> 16) & 0x1F;
    },
    classInstSize: function() {
        // this is a class, answer number of named inst vars
        return this.pointers[Squeak.Class_format] & 0xFFFF;
    },
    classByteSizeOfInstance: function(nElements) {
        var format = this.classInstFormat(),
            nWords = this.classInstSize();
        if (format < 9) nWords += nElements;                        // 32 bit
        else if (format >= 16) nWords += (nElements + 3) / 4 | 0;   //  8 bit
        else if (format >= 12) nWords += (nElements + 1) / 2 | 0;   // 16 bit
        else if (format >= 10) nWords += nElements;                 // 32 bit
        else nWords += nElements * 2;                               // 64 bit
        nWords += nWords & 1;                                       // align to 64 bits
        nWords += nWords >= 255 ? 4 : 2;                            // header words
        if (nWords < 4) nWords = 4;                                 // minimum object size
        return nWords * 4;
    },
},
'as method', {
    methodNumLits: function() {
        return this.pointers[0] & 0x7FFF;
    },
    methodPrimitiveIndex: function() {
        if ((this.pointers[0] & 0x10000) === 0) return 0;
        return this.bytes[1] + 256 * this.bytes[2];
    },
});


}) // end of module
