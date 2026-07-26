// UI shell, commands, file export, keyboard/pointer handling, and DOM sync. Original top-level statements 11-39.
(function (Q, T, d, g, g1) {
  with (Q) {
    Q.$ = d.documentElement;
    Q.y1 = "qaop-state";
    Q.m1 = y1;
    Q.h1 = "qaop-ui";
    Q.handleClick = e => {
      var t,
        r,
        n,
        i,
        {
          target: f,
          detail: o,
          ctrlKey: a
        } = e;
      if (resumeAudioOnInteraction?.(), t = "o" == e.type[1], r = x(f, "#s,#k,#p,.u>*"), n = h(".u>li>div"), r) {
        if ("t" == r.id && currentGame) return clearSelectedGameIfIdDiffers();
        if (v(r, "#z>ul>*")) {
          let e;
          v(f, ".x") ? ((i = w("div")).innerHTML = "<button data-o=x>Delete</button><button data-o=s>Save", r.append(i)) : n?.contains(f) ? "x" == f.dataset.o ? (deleteSnapshotFromIndexedDb(getSnapshotName(i = getSnapshotListItem(r))), i.remove()) : e = t => {
            var e = detectFileType(g1, t.type),
              r = [];
            e && (r = [e.U[0]]), saveWithPickerOrDownload(t.name, r, e => t);
          } : a || t ? selectSnapshotItem(v(r, ".s") ? g1 : f) : (e = (e, t) => {
            loadGameSource(e, t), o && setLayout();
          }, v(r, ".s") || selectSnapshotItem()), e && loadSnapshotFileFromStorage(r, e);
        }
        t || (("s" == r.id && 2 == o || "p" == r.id) && (runCommand("pause"), setLayout()), v(r, "#u>ul>*") && !a && (loadGameSource(t1(r).value), o) && setLayout(), n?.remove());
      } else (r = x(f, "[data-c]")) && !v(r, "select") && (S(e), runCommand(r.dataset.c)), "r" == f.id && selectSnapshotItem(), n?.remove();
    };
    Q.handlePointerMove = e => {
      F($, "m", 1), clearTimeout(uiRefreshTimer), uiRefreshTimer = g(e => {
        F($, "m", 0);
      }, 200), I || "static" == getComputedStyle(h("#l")).position || "l" != (e = e.target.closest("aside")?.id) && "r" != e || setLayout(e);
    };
    Q.handlePointerButtons = e => {
      var {
          type: t,
          target: r,
          touches: n
        } = e,
        n = n || ("u" != t[5] ? [e] : []);
      x(r, "#p") && runCommand("pause"), syncPointerKeyboardState(n);
    };
    Q.handleInput = e => {
      var t,
        e = e.target;
      v(e, "#v>*+*") ? setVolumeLevel() : (t = e.dataset.c) && runCommand(t, e.value);
    };
    Q.handleKey = n => {
      var e,
        t,
        r,
        i,
        f,
        o,
        a,
        {
          type: l,
          target: u,
          which: c
        } = n;
      if (resumeAudioOnInteraction?.(), !n.repeat) {
        if (l = "u" == l[3], e = n.altKey | n.metaKey || 2 * n.ctrlKey, t = setPaused(), (r = "f" == u?.id) && !t) {
          if (20 == c) {
            if ((serializeMachineState({}, 0).ram[5][7274] >> 3 & 1) == n.getModifierState("CapsLock") && !l) return;
            c = -76;
          }
          if (!driveKeyboardMatrix(~c, !l, n.shiftKey | 2 * !!e)) return S(n), void syncOnScreenKeyboard();
        }
        if (l) return keyHoldHandler?.(n);
        if (l = t => {
          var r = n.timeStamp;
          keyHoldHandler = e => {
            S(e), keyHoldHandler = g1, e.which == c && t(e.timeStamp - r);
          };
        }, a = v($, ".h"), i = 119 == c, a || i) {
          i && S(n);
          let t = e => {
            var t = v($, ".h");
            setLayout(t ? "f" : "h"), setRuntimeFlag(16, !t);
          };
          t(), a || (h("#h").focus(), l(e => 200 < e ? t() : 0));
        }
        if (I || (45 == c && h("[rel=search]").click(), 112 == c && (f = "help")), a = (i = (e, t) => -(c == e) | c == t)(34, 33)) {
          let e;
          isMuted && 0 < a && (e = 0, isMuted = !1), setVolumeLevel(a / 10, e), S(n);
        }
        if ((121 == c || isMuted && 175 == c) && (f = "mute"), r && t && 32 == c && (f = "pause"), f ??= {
          [19]: "pause",
          117: "crt",
          118: "bw"
        }[c], 46 == c && r) {
          let t = g(e => runCommand("reset"), 200);
          l(e => clearTimeout(t));
        }
        2 == e ? o = {
          [79]: "open",
          83: "save"
        } : I || (27 != c && 120 != c || (setLayout(v($, ".f") ? "lr" : "f"), S(n)), o = {
          [113]: "remember",
          114: "restore"
        }), (f ??= o?.[c]) && (S(n), runCommand(f)), (a = x(u, ".u>*")) && (r = (t = _(".u>*")).indexOf(a), l = i(38, 40)) && t1(t[r + l])?.focus();
      }
    };
    Q.handleFocusBlur = e => {
      var t,
        {
          type: e,
          target: r
        } = e,
        n = !v($, ".l,.r,.h");
      "f" == e[0] ? (r == T && n && (t = "f"), (e = x(r, "#f,#l,#r")) && (t = e.id)) : "f" == r?.id && (driveKeyboardMatrix(), syncPointerKeyboardState([]), d.activeElement == d.body) && n && (t = "lr"), t && setLayout(t);
    };
    Q.handleDragStartEnd = e => {
      var {
          type: e,
          target: t,
          dataTransfer: r
        } = e,
        e = "s" == e[4];
      dragPayloadBuilder = e && ((a, l) => {
        var u, e, c;
        if (a.effectAllowed = "copy", "s" == l.id ? (e = "s", c = exportSnapshotOrScreen()) : (l = x(l, ".u>li>:first-child")) && (u = l.value) && (e = "r"), c) {
          a.items.add(c), u = r1(c);
          let e = c.name,
            t = c.type,
            r = (a.setData(m1, o1([e, currentGame?.id, u])), l = u, (c = new XMLHttpRequest()).open("GET", l, !1), c.overrideMimeType("text/plain;charset=x-user-defined"), c.send(), n1(c.responseText)),
            n = (r = f1(r), e = e.replace(/(\.z80)?$/, ".z80").replace(/:/g, "-"), a.setData("DownloadURL", `${t}:${e}:data:${t};base64,` + btoa(r)), captureScreenCanvas()),
            {
              width: i,
              height: f
            } = n,
            o = w("canvas");
          i /= 2, f /= 2, o.width = i, o.height = f, o.getContext("2d").drawImage(n, 0, 0, i, f), Y1(o.style, {
            opacity: 0.1,
            position: "fixed"
          }), d.body.append(o), a.setDragImage(o, i / 2, f / 2), g(e => o.remove());
        }
        return u && a.setData("url", u), e;
      })(r, t);
    };
    Q.handleDragOverDrop = e => {
      var t,
        r,
        n,
        i,
        {
          type: f,
          target: o,
          dataTransfer: a
        } = e,
        f = !f[4],
        l = a.types,
        o = x(o, "#l,#r")?.id || "s",
        u = 1;
      function c(e) {
        e?.size < 1e6 && saveSnapshotFileToStorage(e, i);
      }
      function s() {
        (r = a.getData(m1)) && ([n, i, r] = a1(r));
      }
      o != dragPayloadBuilder && (t = l.includes(m1) || l.includes("Files"), "s" == o ? (t ||= l.includes("text/uri-list"), f && (s(), r = r || a.files[0] || a.getData("url")) && loadGameSource(r, i)) : "r" == o ? f && (s(), r ? fetch(r).then(e => e.blob()).then(e => {
        c(new File([e], n, e));
      }) : c(a.files[0])) : u = 0), u && S(e), a.dropEffect = t ? "copy" : "none", handlePointerMove(e);
    };
    Q.copyScreenToClipboard = e => {
      d.activeElement == h("#f") && captureScreenCanvas().toBlob(e => {
        e = new ClipboardItem({
          [e.type]: e
        });
        navigator.clipboard.write([e]);
      });
    };
    Q.handlePaste = e => {
      var t,
        e = e.clipboardData;
      (t = e.files[0] || e.getData("url")) ? loadGameSource(t) : (t = e.getData("text")) && typeText(t);
    };
    Q.handleHistoryPop = e => {
      e = e.state;
      e ? applySerializedState(e) : applyUrlState(), refreshRemoteLibraryList();
    };
    Q.persistSessionState = e => {
      var t, r;
      syncUiStateToDomAndUrl(), I || (localStorage[y1] = (r = (t = captureState()).ram, delete t.ram, t.model = modelToIndex(t), t.id = currentGame?.id, r.reduce((e, t) => e + f1(t), "") + o1(t)));
    };
    Q.handleParentMessage = e => {
      var t, r, n;
      e.origin && (e = e.data, i1(e) ? ((n = (r = e).match(/^(\S+)\s+(.*)/)) && ([, r, t] = n, t == +t) && (t = +t), runCommand(r, t)) : ((n = e.model) && (e.model = I1[n]), applySerializedState(e), applyUiSettings(e)));
    };
    Q.runCommand = function runCommand(e, t) {
      queueUiRefresh();
      var r,
        n,
        i = {
          model() {
            0 <= (t = [/^48k?$|^0$/, /^1(|28k?)$/, /^tc2(048|k)$/].findIndex(e => e.test(t))) && (r = {
              model: I1[t]
            });
          },
          reset() {
            currentGame ? loadGameSource(m + "bin/" + currentGame.slug, currentGame.id) : (beginLoad(1), ejectMedia()), postStateToParent(e);
          },
          open() {
            var e,
              n = e => {
                pendingUrlState.l = g1, loadGameSource(e), setLayout();
              };
            if (fsAvailability.u) if (e = T.showOpenFilePicker) setFileSystemBusy(1), e({
              id: "zx",
              types: buildFilePickerTypes(["z80,sna,tap,rom,scr,mdr:Any", "z80,sna:Snapshot", "tap", "rom", "scr", "mdr"])
            }).then(([e]) => e.getFile()).then(n).finally(setFileSystemBusy);else {
              let r = w("input");
              r.type = "file", r.onchange = e => {
                var t = r.files[0];
                t && n(t), r.value = "";
              }, r.click();
            }
          },
          save() {
            saveWithPickerOrDownload(t, ["z80", "scr", "png:Screenshot"], e => {
              e = e?.A;
              return "png" != e ? exportSnapshotOrScreen(e, t) : new Promise(t => captureScreenCanvas().toBlob(e => t(e)));
            });
          },
          remember() {
            selectSnapshotItem(saveSnapshotFileToStorage(exportSnapshotOrScreen(g1, t), currentGame?.id, h("#z>ul>.s")));
          },
          restore() {
            var e = h("#z>ul>.s,#z>ul>:last-child");
            e && loadSnapshotFileFromStorage(e, loadGameSource);
          },
          load() {
            loadGameSource(t);
          },
          state() {
            postStateToParent(qaop.state);
          },
          share() {
            navigator.share({
              url: location
            });
          },
          layout() {
            setLayout(+t < 1 ? "f" : "h");
          },
          help() {
            h("[rel=help]").click();
          }
        }[e];
      i ? i() : (i = {
        [e]: t
      }, (n = diffKnownState(getUiSettings(), i)) ? applyUiSettings(n) : (r = diffKnownState(captureState(), i)) || showMessage(e + (t == g1 ? "" : " " + t))), r && (setStateAndRefresh(r), r.model && (r.model = modelToIndex(r)), postStateToParent(r));
    };
    Q.postStateToParent = function postStateToParent(e) {
      I && top.postMessage(e, "*");
    };
    Q.loadGameSource = function loadGameSource(e, t) {
      clearSelectedGameIfIdDiffers(t), beginLoad(1, e, queueUiRefresh);
    };
    Q.setVolumeLevel = function setVolumeLevel(e, t) {
      var r = h("#v>*+*+*");
      t ??= r.value / 100, e && (t += e), t = H1(1, K1(0, t)), r.value = 100 * t, setAudioGain(isMuted ? 0 : t), queueUiRefresh();
    };
    Q.refreshSavedSnapshotList = function refreshSavedSnapshotList() {
      var t,
        r,
        n = h("#z>ul"),
        i = h("#z>ul>.s");
      i &&= getSnapshotName(i), z(n, ""), t = e => {
        var t,
          r,
          e = e.map(e => e.file.name);
        e.sort();
        for (t of e) r = createListEntry(t), n.append(r), t == i && selectSnapshotItem(r);
      }, r = refreshSavedSnapshotList, withSnapshotsStore(e => {
        snapshotBroadcast.onmessage = r, runIndexedDbRequest(e, "getAll", t);
      }, !1);
    };
    Q.saveSnapshotFileToStorage = function saveSnapshotFileToStorage(e, t, r) {
      var n,
        i,
        f,
        o,
        {
          name: a,
          type: l,
          lastModified: u
        } = e,
        c = detectFileType(a, l);
      if (!c?.D) throw "Unknown type";
      if (c = c.I[0], i = (r = getSnapshotListItem(r)) && getSnapshotName(r), (o = f = a.replace(/( \(\d+\))?(\.[^.]+)?$/i, "") || "?") != i) {
        let e = 1;
        for (n = _("#z>ul>*").map(getSnapshotName); n.includes(o) && (o = `${f} (${++e})`) != i;);
      }
      return l == c && a == o || (options = {
        lastModified: u,
        type: c
      }, e = new File([e], o, options)), r ? (o != i && deleteSnapshotFromIndexedDb(i), z(t1(r), o)) : (r = createListEntry(o), h("#z>ul").append(r)), putSnapshotInIndexedDb(e, t), r;
    };
    Q.selectSnapshotItem = function selectSnapshotItem(e) {
      var t,
        r = getSnapshotListItem(e);
      for (t of _("#z>ul>*")) F(t, "s", t == r);
    };
    Q.loadSnapshotFileFromStorage = function loadSnapshotFileFromStorage(e, t) {
      var r = getSnapshotName(getSnapshotListItem(e)),
        n = t;
      withSnapshotsStore(e => runIndexedDbRequest(e, "get", r, ({
        file: e,
        id: t
      }) => n(e, t)), !1);
    };
    Q.getSnapshotListItem = function getSnapshotListItem(e) {
      return x(e, "li");
    };
    Q.getSnapshotName = function getSnapshotName(e) {
      return z(t1(e));
    };
    Q.refreshRemoteLibraryList = function refreshRemoteLibraryList() {
      var e,
        c,
        s = h("#u>ul");
      z(s, ""), F(s, "t", 1), e = pendingUrlState.u, h("#u").hidden = !e, e && (remoteListRequestToken = c = {}, loadBinaryResource({
        F: e
      }, {
        $: !0,
        S: "application/json,text/*"
      }, r => {
        var e;
        if (remoteListRequestToken == c) {
          remoteListRequestToken = g1, F(s, "t", 0), updateProgressBar("8b8");
          var t,
            n,
            i,
            f = (e, t) => {
              t = new URL(t, r.F), e = createListEntry(e, !0), t1(e).value = t, s.append(e);
            },
            {
              _: o,
              p: a
            } = r;
          if ("application/json" == (a = a?.replace(/ *;.*/, ""))) for ({
            name: t,
            url: n
          } of a1(o)) n && f(t, n);else if ("text/html" == a) for (i of new DOMParser().parseFromString(o, a).querySelectorAll("a[href]:not([rel=up])")) f(z(i), i.getAttribute("href"));else if (a && "text/plain" != a) showMessage("Unsupported: " + a);else for (e of o.trim().split(/(\s*\n\s*)+/)) {
            var [, l, u] = e.match(/(\S+)\s*(.*)/);
            f(u || l, l);
          }
          setLayout("r");
        }
      }));
    };
    Q.createListEntry = function createListEntry(e, t) {
      var r = w("li");
      return r.innerHTML = "<button draggable=true></button>" + (t ? "" : "<button class=x>"), z(t1(r), e), r;
    };
    Q.applySerializedState = function applySerializedState(e) {
      setStateAndRefresh(e), queueUiRefresh();
    };
    Q.setPaused = function setPaused(e) {
      e = setRuntimeFlag(8, e);
      return mediaSession && (mediaSession.playbackState = e ? "paused" : "playing"), e;
    };
    Q.getUiSettings = function getUiSettings() {
      return {
        pause: setPaused(),
        volume: h("#v>*+*+*").value / 100,
        mute: isMuted,
        bw: setBlackAndWhiteMode(),
        crt: toggleCrtMode(),
        speed: emulationSpeed
      };
    };
    Q.applyUiSettings = function applyUiSettings(e) {
      var {
        pause: t,
        mute: r,
        volume: n,
        speed: i
      } = e;
      t != g1 && setPaused(t), r != g1 | n != g1 && (r != g1 && (isMuted = !!r), setVolumeLevel(0, n)), setBlackAndWhiteMode(e.bw), toggleCrtMode(e.crt), (i |= 0) && (emulationSpeed = i), localStorage[h1] = o1(getUiSettings()), queueUiRefresh();
    };
    Q.exportSnapshotOrScreen = function exportSnapshotOrScreen(e = "z80", t) {
      flushPrefixCycles();
      var r = ((e, c) => {
          var t,
            {
              model: s,
              ay: v,
              iff: d,
              ram: p,
              rom: y,
              border: m,
              pFF: h
            } = c,
            _ = (p = t = 16 < (t = p).length ? [2,, 1,,, 0].map(e => t.slice(e << 14, e + 1 << 14)) : t, 8 & c.p7FFD ? 7 : 5),
            r = new ArrayBuffer(0, {
              maxByteLength: 1e6
            }),
            w = $1(r);
          return {
            z80: function () {
              var e,
                t,
                r,
                n = c.if1,
                i = c.pc && !modelToIndex(c) && !v && !y && !n,
                f = i ? -2 : 23,
                o = (g(32 + f), c),
                a = {
                  pc: i ? 6 : 32,
                  a: 0,
                  f: 1,
                  bc: 2,
                  hl: 4,
                  sp: 8,
                  i: 10,
                  r: 11,
                  de: 13,
                  bc_: 15,
                  de_: 17,
                  hl_: 19,
                  a_: 21,
                  f_: 22,
                  iy: 23,
                  ix: 25
                };
              for (e in a) t = a[e], r = o[e], /.[a-z]/.test(e) && b(t + 1, r >> 8), b(t, r);
              if (b(12, c.r >> 7 & 1 | m << 1 | 32), b(27, 1 & d, 2 & d && (c.halt ? 118 : 1), c.im | !!c.kj << 6), f < 0) u(flatten48kRam(p)), k(0, 237, 237, 0);else {
                b(30, f);
                let e = [0, 3, 14, 9][I1.indexOf(s)],
                  t = 0 | h;
                if (e < 4 && n && (e++, t = n.paged ? 255 : 0), b(34, e, c.p7FFD, t, v ? 7 : 3, v?.idx), v?.reg && b(39, ...v.reg), s.T & A1) {
                  l(3 + _, p[_]);
                  for (let e = 0; e < 8; e++) e != _ && l(3 + e, p[e]);
                } else l(8, p[5]), l(4, p[2]), l(5, p[0]);
                y && l(1, y);
              }
              function l(e, t) {
                var r;
                k(0, 0, e), e = w.length, u(t), 16383 < (r = w.length - e) && (g(e + 16384), w.set(t, e), r = 65535), b(e - 3, 255 & r, r >> 8);
              }
              function u(t) {
                var r,
                  n = t.length,
                  i = 0;
                do {
                  r = t[i];
                  let e = 1;
                  for (; t[++i] === r && e < 255;) e++;
                  if (4 < e || 237 == r && 1 < e) k(237, 237, e, r);else {
                    for (; k(r), --e;);
                    237 == r && i < n && k(t[i++]);
                  }
                } while (i < n);
              }
            },
            scr: function () {
              var n = p[_],
                e = (1 & h) << 13,
                t = 4 & ~h;
              function r(e, t) {
                var r = w.length;
                g(r + t), w.set(n.slice(e, e + t), r);
              }
              r(e, 6144), 2 & h ? (r(8192, 6144), (4 & h || t) && k(h)) : r(6144 + e, 768), t && k(m);
            }
          }[e](), $1(w);
          function g(e) {
            r.resize(e);
          }
          function b(e, ...t) {
            var r,
              n = e + t.length;
            n > w.length && g(n);
            for (r of t) w[e++] = 255 & r;
          }
          function k(...e) {
            b(w.length, ...e);
          }
        })(e = e, captureState()),
        e = file_types[e].I[0];
      return makeTypedFile(t || (t = new Date(), (t = new Date(+t - 6e4 * t.getTimezoneOffset())).toISOString().slice(0, 16).replace("T", " ")), e, r);
    };
    Q.saveWithPickerOrDownload = async function saveWithPickerOrDownload(r, n, i) {
      var f, o;
      if (fsAvailability.u) if (f = (n = buildFilePickerTypes(n, 1))?.[0]?.L, o = T.showSaveFilePicker) {
        setFileSystemBusy(1);
        let e;
        try {
          e = await o({
            suggestedName: r,
            id: "zx",
            types: n
          });
        } finally {
          setFileSystemBusy();
        }
        n[1] && ({
          name: o,
          type: r
        } = await e.getFile(), f = detectFileType(o, r));
        let t = await i(f);
        if (!t) throw "Unknown file type";
        t.arrayBuffer && (t = await t.arrayBuffer()), await (n = await e.createWritable()).write(t), n.close();
      } else o = w("a"), r = await i(f), n = r1(r), o.href = n, o.download = r.name.replace(/(\.z80)?$/, ".z80"), o.click(), URL.revokeObjectURL(n);
    };
    Q.buildFilePickerTypes = function buildFilePickerTypes(e, a) {
      return e.map(e => {
        var t,
          r,
          [n, i] = e.split(/:/),
          f = {},
          o = {
            accept: f
          };
        for (r of n = n.split(/,/)) {
          let e = (t = file_types[r]).U;
          a && e[0] && (e = [e[0]]), f[t.I[0]] = e.map(e => "." + e), n[1] || (i ??= t.m, o.L = t);
        }
        return o.description = i, o;
      });
    };
    Q.makeTypedFile = function makeTypedFile(e, t, r) {
      r = r.buffer;
      return new File([r], e, {
        type: t
      });
    };
    Q.setFileSystemBusy = function setFileSystemBusy(e) {
      fsAvailability.u = !e, updateProgressBar(fsAvailability), updateProgressBar("d76");
    };
    Q.captureScreenCanvas = function captureScreenCanvas() {
      var e = captureScreenImageData(),
        t = w("canvas"),
        {
          width: r,
          height: n
        } = e;
      return t.width = r, t.height = n, t.getContext("2d").putImageData(e, 0, 0), t;
    };
    Q.queueUiRefresh = function queueUiRefresh() {
      clearTimeout(uiSyncTimer), uiSyncTimer = g(syncUiStateToDomAndUrl);
    };
    Q.syncUiStateToDomAndUrl = function syncUiStateToDomAndUrl() {
      var t,
        r,
        e,
        n,
        i,
        f = "",
        o = captureState(),
        a = getUiSettings(),
        {
          model: l,
          ay: u,
          if1: c,
          kj: s
        } = (F($, "p", a.pause), o),
        u = !!u,
        v = [48,, "tc2048"][e = modelToIndex(o)] ?? 128;
      48 != (h("[data-c=model]").value = v) && (f += "#" + v), !!(l.T & M5) ^ u && (f += u ? "#ay" : "#!ay");
      for (n of _("[data-c]")) {
        let e = o;
        ((r = n.dataset.c) in e || r in (e = a)) && (t = n.previousSibling).checked != g1 && (t.checked = !!e[r]);
      }
      I || (h("#e").hidden = !c?.led), c && (f += "#if1"), s && (f += "#kj");
      for (i of "ltu") {
        let e = pendingUrlState[i];
        e && (f += `#${i}=` + (e = e.replace(/%/g, "%25").replace(/#/g, "%23")));
      }
      syncOnScreenKeyboard(), v = location.pathname, currentGame || (v.startsWith(m + "play/") && (z(h("[data-c=reset]"), "Reset"), v = m, d.title = "Qaop – ZX Spectrum emulator"), v += f), l = v, v = captureState(), history.replaceState(v, "", l || getLocationPart(1)), c &&= {
        led: c.led
      }, Y1(a, {
        model: e,
        ay: u,
        if1: c,
        kj: s
      }), postStateToParent(a);
    };
    Q.syncOnScreenKeyboard = function syncOnScreenKeyboard() {
      var e, t;
      for (e of _("#k *")) t = e.dataset.k, e.style.top = keyMatrixRows[7 & t] & 1 << (t >> 3) ? "" : ".3vw";
    };
    Q.setLayout = function setLayout(e = "f") {
      var t;
      if (["f", "l", "r", "h", "lr"].includes(e), t = {
        f: "lrh",
        h: "lrf"
      }[e = I ? "f" : e] || "fh", F($, t, 0), F($, e, 1), t = h("#f"), "f" == e) t.focus(), layoutCloseWatcher?.destroy(), layoutCloseWatcher = g1;else if (t.blur(), !layoutCloseWatcher) try {
        (layoutCloseWatcher = new CloseWatcher()).onclose = e => setLayout();
      } catch {}
    };
    Q.syncPointerKeyboardState = function syncPointerKeyboardState(e) {
      var t, r, n, i, f;
      for (t of e) (n = x(t.target, "#k>*")) && (n = +n.dataset.k, pressedKeyStates[n] || driveKeyboardMatrix(n, 1), pressedKeyStates[n] = 2);
      for (r of _("#k>*")) i = +r.dataset.k, (f = pressedKeyStates[i]) && (pressedKeyStates[i] = --f, f || driveKeyboardMatrix(i));
      syncOnScreenKeyboard();
    };
    isMuted = !1, fsAvailability = {
      u: 1
    }, pressedKeyStates = $1(40);
  }
})(globalThis.__qaop = globalThis.__qaop || {}, globalThis, document, setTimeout, undefined);
