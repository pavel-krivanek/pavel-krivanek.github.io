// IndexedDB snapshot persistence, cross-tab sync, iframe mode detection, and startup ROM load. Original top-level statements 52-59.
(function (Q, T, d, g, g1) {
  with (Q) {
    Q.y2 = "snaps";
    Q.putSnapshotInIndexedDb = function putSnapshotInIndexedDb(e, t) {
      var r = {
        file: e
      };
      t && (r.id = t), withSnapshotsStore(e => e.put(r));
    };
    Q.deleteSnapshotFromIndexedDb = function deleteSnapshotFromIndexedDb(t) {
      withSnapshotsStore(e => e.delete(t));
    };
    Q.withSnapshotsStore = function withSnapshotsStore(e, t = !0) {
      var r,
        n = y2,
        i = t,
        f = e,
        o = e => {
          t && snapshotBroadcast.postMessage("");
        };
      (r = runIndexedDbRequest(indexedDB, "open", "qaop", e => {
        var e = e.transaction(n, i ? "readwrite" : g1);
        e.oncomplete = o, e = e.objectStore(n), f(e);
      })).onupgradeneeded = e => {
        var t = r.result;
        try {
          t.createObjectStore(y2, {
            keyPath: "file.name"
          });
        } catch (e) {
          showMessage(e);
        }
      };
    };
    Q.runIndexedDbRequest = function runIndexedDbRequest(e, t, ...r) {
      var n = r.pop(),
        i = e[t](...r);
      return i.onsuccess = e => n(i.result), i.onerror = e => n(), i;
    };
    snapshotBroadcast = new BroadcastChannel(y2), g(function e() {
      var t, r, n, i;
      for (let e = 0;; e++) {
        if (!(t = localStorage.key(e))) return;
        if (r = t.match(/^zx\.(.+)/)) break;
      }
      n = r[1], i = localStorage[t], i = n1(i), putSnapshotInIndexedDb(makeTypedFile(n, file_types.z80.I[0], i)), localStorage.removeItem(t), g(e);
    }), qaop = {
      get settings() {
        return getUiSettings();
      },
      get state() {
        var e = captureState(2);
        return e.model = I1.indexOf(e.model), 0 <= e.model && e.model, e;
      },
      set(e) {
        var t = e.model;
        t != g1 && (e.model = parseModelName(t)), setStateAndRefresh(e), applyUiSettings(e);
      },
      command(e, t) {
        runCommand(e, t);
      },
      plug(r, n = 1) {
        r.name;
        var e = {
          edge: pluginChain
        };
        for (let t = e;;) {
          let e = t.edge;
          if (e != r || n || (t.edge = e.edge, e.edge = g1, e = t.edge, frameStopPlugin == r && (frameStopPlugin = e)), !e) {
            n && (r.edge = e, t.edge = r);
            break;
          }
          t = e;
        }
        pluginChain = e.edge, rebuildBusHandlers();
      },
      modules: {},
      async import(e, t = 1) {
        var r,
          n,
          {
            modules: i,
            plug: f
          } = qaop;
        (n = i[e]) && (delete i[e], r = n.device, n.destroy?.(), r) && f(r, 0), t && (n = await import(e), await (i[e] = n)?.init?.(), i[e] == n ? (r = n.device) && f(r) : n.destroy?.());
      }
    };
    Q.I = self != top;
    loadBinaryResource({
      F: m + "roms"
    }, {}, e => {
      var t,
        r,
        n,
        i,
        f,
        o,
        a,
        l,
        u,
        c,
        s = e._;
      if (e.g && s) {
        e = s.length, romPages = {}, t = 0;
        for (r of f1(s.slice(-16384 & e)).split(" ")) t += 16384, romPages[r] = s.slice(t - 16384, t);
        if (initializeEmulatorCore(), startRuntime(), currentGame = T.play, T.launchQueue?.setConsumer?.(e => e.files[0]?.getFile().then(loadGameSource)), (e = performance.navigation.type) < 2 ? currentGame ? loadGameSource(m + "bin/" + currentGame.slug, currentGame.id) : applyUrlState(I || e ? void 0 : (() => {
          var t,
            r,
            n,
            e = localStorage[y1];
          if (e) {
            localStorage.removeItem(y1), n = e;
            try {
              (t = a1(n.slice(1 << 17))).ram = [];
              for (let e = 0; e < 8; e++) r = e << 14, t.ram[e] = n1(n.slice(r, 16384 + r));
              return t.model = I1[t.model], t;
            } catch (e) {
              showMessage(e);
            }
          }
        })()) : (e = history.state) && applySerializedState(e), setRuntimeFlag(2, 0), mediaSession = navigator.mediaSession) {
          currentGame && (e = {
            title: currentGame.title,
            artist: currentGame.by?.join(" / "),
            artwork: [{
              src: m + "scr/" + currentGame.id,
              sizes: "272x208"
            }]
          }, mediaSession.metadata = new MediaMetadata(e));
          for (n of ["play", "pause"]) mediaSession.setActionHandler?.(n, v);
        }
        function v(e) {
          runCommand("pause", "pause" == e.action);
        }
        F($, "e", I);
        try {
          i = a1(localStorage[h1]), I && (i.pause = g1), applyUiSettings(i);
        } catch {}
        new ResizeObserver(([e]) => {
          var t = h("#s"),
            e = e.contentRect.height;
          attachCanvas(t, e);
        }).observe(h("#f>i")), setLayout();
        for (f of _("button,select")) f.disabled = !1;
        queueUiRefresh(), refreshSavedSnapshotList(), refreshRemoteLibraryList(), onclick = oncontextmenu = handleClick, oninput = handleInput, onmousemove = handlePointerMove, onmousedown = onmouseup = ontouchstart = ontouchend = handlePointerButtons, onkeydown = onkeyup = handleKey, ondragstart = ondragend = handleDragStartEnd, ondragover = ondrop = handleDragOverDrop, addEventListener("focus", handleFocusBlur, 1), addEventListener("blur", handleFocusBlur, 1), d.oncopy = copyScreenToClipboard, d.onpaste = handlePaste, onmessage = handleParentMessage, onpagehide = persistSessionState, onpopstate = handleHistoryPop, h("#s").draggable = !0, h("[data-c=share]").hidden = !navigator.share, o = h("#k"), a = 3;
        for (l of "1234567890QWERTYUIOPASDFGHJKLabZXCVBNMcd") u = w("div"), (c = {
          a: "Enter",
          b: "Caps Shift",
          c: "Symbol Shift",
          d: "Space"
        }[l] || l) != l && (u.className = "w"), z(u, c), u.dataset.k = a, o.append(u), a = (7 & a) < 4 ? a < 32 ? a + 8 : 7 ^ a : 7 < a ? a - 8 : 6 - a;
      }
    }), navigator.serviceWorker?.register(m + "sw.js").then(e => {
      e.update(), T.play && e.index?.add(play);
    }), g((e, t) => {
      e = e("L3RvcmluYWsu"), (!t || t.href.indexOf(e) < 0) && setRuntimeFlag(-1, 1);
    }, 1e6, atob, h("a[rel=author]"));
  }
})(globalThis.__qaop = globalThis.__qaop || {}, globalThis, document, setTimeout, undefined);
