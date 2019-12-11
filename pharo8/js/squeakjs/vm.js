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

}) // end of module
