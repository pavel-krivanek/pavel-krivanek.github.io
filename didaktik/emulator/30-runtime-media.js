// Runtime, media loading, audio/video wiring, CRT helpers, and file-type helpers. Original top-level statements 44-51.
(function (Q, T, d, g, g1) {
  with (Q) {
    {
      function i2(e) {
        cpuCore.setState(e), applyMachineState(e), setUiFocusPauseFlag(e);
      }
      startRuntime = e => {
        try {
          r = attachAudioBuffer, i = (n = new AudioContext()).createGain(), f = n.createScriptProcessor(1024, 0, 1), o = {
            hz: n.sampleRate,
            M: new Float32Array(8192),
            N: 0,
            j: 0,
            B: 8191
          }, f.onaudioprocess = (d = v = 0, t = (s = o).hz, p = 2 ** (-5e3 / t), y = 2 ** (-35e5 / 23256 / t), e => {
            var t,
              r = e.outputBuffer.getChannelData(0),
              e = r.length,
              {
                M: n,
                N: i,
                B: f,
                j: o
              } = s,
              o = o - i & f,
              a = e < o ? e : o,
              l = v,
              u = d,
              c = 0;
            if (0 < a) for (; t = l + n[i], i = i + 1 & f, r[c++] = u = y * (u + t - (l = p * t)), --a;);
            if (s.N = i, 0 < (a = e - o) && (u || l)) for (; t = l, r[c++] = u = y * (u + t - (l *= p)), --a;);
            d = u, v = l;
          }), audioGainNode = i.gain, setAudioGain(0.5), i.connect(n.destination), f.connect(i), r(o), resumeAudioOnInteraction = e => {
            resumeAudioOnInteraction = g1, n.resume();
          };
        } catch (e) {
          showMessage(e);
        }
        var s, v, d, t, p, y, r, n, i, f, o;
        !function t(r) {
          requestAnimationFrame(e => {
            if (a) a2();else {
              if (e < r) return t(r);
              e < r + 20 ? e = r : e < r + 40 && (B5(0), e = r + 20), B5(2);
            }
            t(e + 20);
          });
        }();
      }, captureState = e => {
        var t = cpuCore.getState();
        return serializeMachineState(t, e), setTextInputMode(t), t;
      }, setStateAndRefresh = i2, setBlackAndWhiteMode = e => (e != g1 && (e = !!e) != r && (r = e, i) && o2(), r), flushPrefixCycles = e => {
        for (let e = 3; e-- && cpuCore.getState().px;) {
          var {
            time: t,
            limit: r
          } = machineBus;
          machineBus.limit = t + 1, cpuCore.run(), machineBus.limit = r;
        }
      };
      let u = [];
      function f2(e) {
        var t,
          r = keyMatrixRows;
        192 & e && (r[0] = -2 & r[0] | 1 & (t = e >> 6 ^ 3), r[7] = -3 & r[7] | 2 & t), r[7 & e] &= ~(1 << (e >> 3 & 7));
      }
      driveKeyboardMatrix = (e, t, r) => {
        if (keyMatrixRows.fill(255), c = g1, s = "", e != g1) {
          var n,
            i,
            f,
            o = e,
            a = t,
            l = r;
          if (joystickState == g1 || !(e = {
            [39]: 1,
            37: 2,
            40: 4,
            38: 8,
            17: 16,
            9: 128
          }[~o]) || (joystickState = joystickState & ~e | (a ? e : 0), !a)) {
            if (n = [,,, 18247,,,,, 17476, 20303,,,, 1542,,, 0, 3855, 3855,,,,,,,,,,,,,, 1799,,,, 17219, 25443, 23644, 21588, 25700,,,,,,,, 1028, 771, 2827, 4883, 6939, 8995, 9252, 7196, 5140, 3084,, 34957, 39578, 38542, 41634, 39064, 35723, 257, 10023, 6168, 4369, 4626, 6425, 8481, 9766, 5397, 7710, 5654, 3598, 5911, 7967, 3341, 1285, 514, 6682, 2313, 8738, 7453, 8224, 2570, 4112, 9509, 2056, 0, 3855,,,,,,,,,,,,,, 42919, 38550,, 40606, 38807, 41120,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,, 42662,, 34181, 37779, 39835, 41891, 42148, 33924, 38036, 35980, 42919, 38550,, 33950,,,,,,,,,,,,, 34957, 38542, 39583, 33950, 41623, 39072, 17219,,,,,,,,,,,,,,,,,,,,,,,,,,,,,, 34204], o < 0 && n[~o] == g1) return 1;
            for (let e = 0;; e++) {
              if ((i = u[e]) == g1) {
                a && (u[e] = o);
                break;
              }
              if (i == o) {
                a || u.splice(e, 1);
                break;
              }
            }
            for (f of u) {
              if (f < 0) {
                if ((f = n[~f]) == g1) continue;
                1 & l && (f >>= 8);
              }
              f2(f);
            }
          }
        } else u = [];
      }, typeText = e => {
        e && (s += e, c = c || function* () {
          for (let e = 0; e < s.length; e++) {
            var t = 1 + "aq10p\n zsw29ol xde38ikmcfr47ujnvgt56yhb AQ  P  ZSW  OL XDE  IKMCFR  UJNVGT  YHB  ≤!_\"  : ≠@);= £ ≥#( +.? <$' -,/ >%& ^* ~   ©   |       \\       {   ]   }   [".indexOf(s[e]);
            if (t) {
              let e = t % 40;
              t = t / 40 | 0, e |= t << 6, 2 < t && (f2(79), yield, keyMatrixRows.fill(255), yield, e -= 64), f2(e), yield, keyMatrixRows.fill(255), yield* [,,,,];
            }
          }
          c = g1, s = "";
        }());
      };
      let c,
        s = "",
        a = 2;
      function B5(t) {
        if (d) runFrame(t), l2();else {
          let e = emulationSpeed;
          for (; e--;) c && c.next(), runFrame(e ? 1 : 5 | t);
          queuedTapeLoad && l2();
        }
        a2();
      }
      let i,
        r = !(setRuntimeFlag = (e, t) => (t ? a |= e : t != g1 && (a &= ~e), !!(a & e))),
        f,
        o;
      function o2() {
        f = renderFrameImage(i, r), o?.putImageData(f, 0, 0);
      }
      function a2() {
        var e,
          t,
          r,
          n = dirtyRect;
        n && o && (dirtyRect = [L5, 0, 0, U1], [n, e, t, r] = n, t <= n || e <= r || (e = e - r, t = t - n, n *= i, t *= i, o.putImageData(f, 0, 0, r, n, e, t)));
      }
      attachCanvas = (e, t) => {
        var r = e.getContext("2d", {
            alpha: !1,
            desynchronized: !0
          }),
          n = i,
          t = 1 + (t >= 2 * L5);
        t != n && (i = t, e.width = U1, e.height = t * L5), o2(), o = r, n || runFrame(2);
      }, captureScreenImageData = e => {
        var t = renderFrameImage(1, r);
        return o2(), t;
      }, ejectMedia = e => {
        applyMachineState({
          rom: !1,
          ay: ""
        }), resetMachine();
      };
      let d;
      function l2() {
        var t,
          e,
          r,
          n = d,
          i = cpuCore.getState();
        if (1 & i.iff || (e = i.pc) < 1387 || 1540 < e) d = null;else {
          if (serializeMachineState(i, 3), n) t = n.C, r = n._.length;else {
            if (16 & ~i.p7FFD) return;
            if ((e = 1507 <= e && 1510 == (e = v()) ? v() : e) < 1387 || 1403 <= e) return;
            if (r = (n = queuedTapeLoad)._.length, n.J |= 0, n.g && n.J >= r && (n.J = 0), (t = n.J + 2) <= r) n.J = t + (s(t - 2) | s(t - 1) << 8);else if (!n.g) return;
            d = n, i.a = i.a_, i.f = i.f_, i.pc = e, i.hl &= 255;
          }
          for (var f = 255 & i.hl, o = i.hl >> 8, {
              ix: a,
              a: l,
              f: u
            } = i;;) {
            if (t == n.J) return c(80);
            if (r <= t) {
              if (n.g) return c(80);
              break;
            }
            if (f = s(t++), o ^= f, !i.de) return c((l = o) < 1 | l - 1 & 128 | !(l - 1) << 6 | !(15 & l) << 4 | 2);
            if (64 & ~u) {
              if (l ^= f) return c(0);
              u |= 64;
            } else {
              if (1 & u) pokeMemoryRaw(a, f);else if (l = peekMemoryRaw(a) ^ f) return c(0);
              a = a + 1 & 65535, i.de--;
            }
          }
          c(-1);
        }
        function c(e) {
          i.ix = a, i.hl = o << 8 | f, i.a = l, 0 <= e && (u = e, i.pc = v(), d = null, queuedTapeLoadFallback) && n.g && t == r && (queuedTapeLoad = queuedTapeLoadFallback), i.f = u, cpuCore.setState(i), n.C = t;
        }
        function s(e) {
          return n._[e];
        }
        function v() {
          var e = i.sp;
          return i.sp = e + 2 & 65535, peekMemoryRaw(e) | peekMemoryRaw(e + 1) << 8;
        }
      }
      let w = {};
      beginLoad = (v, e, d) => {
        var p, y, m, h, t, r;
        function _(e) {
          if (w[v]?._abort?.(), w[v] = g1, 1 == v && setRuntimeFlag(4, 0), e) throw e;
        }
        _(), e && (r = {}, i1(e) ? (t = ["tap"], 1 == v && t.push("z80", "sna", "rom", "scr", "mdr"), r.S = t.map(e => file_types[e].I[0]).join(), e = {
          F: e
        }) : e instanceof File && (e = {
          v: e
        }), p = loadBinaryResource(e, r, function (r) {
          var e, t, n, i, f, o, a;
          if (w[v] == p) {
            if (!m) {
              var {
                F: l,
                m: u,
                p: c
              } = r;
              if ((e = c) && (e = detectFileType(g1, e), s()), !r._) return r.g && _();
              if (e || !(e = detectFileType(u || l)) && l && (e = detectFileType(l.replace(/\?.*/, ""))), e = e?.A, s(), (c = {
                rom: 1,
                sna: 1,
                z80: 1,
                scr: 1,
                tap: 2,
                mdr: 3
              }[e]) || _("Unknown file type"), 1 == c) 2 == v && _("Not a tape"), y = {
                ram: (y = serializeMachineState(g1, 2)).ram
              }, m = ((s, a, e) => {
                var t, l, u, c, v;
                if (a.C |= 0, !(t = {
                  sna: function* () {
                    var e,
                      t,
                      r,
                      n = yield [27],
                      {
                        sp: i,
                        ram: f
                      } = (y(n, {
                        i: 0,
                        hl_: 1,
                        de_: 3,
                        bc_: 5,
                        f_: 7,
                        a_: 8,
                        hl: 9,
                        de: 11,
                        bc: 13,
                        iy: 15,
                        ix: 17,
                        r: 20,
                        f: 21,
                        a: 22,
                        sp: 23
                      }), s.im = n[25], s.iff = 4 & n[19] ? 3 : 0, s.halt = 0, s.border = 7 & n[26], s);
                    for (e of [5, 2, 0]) yield* o(e);
                    if (yield d) t = e => [[], f[5], f[2], f[0]][e >> 14][16383 & e], 64 & n[26] && (s.ay = !0), s.pc = t(i++) | t(i++) << 8, s.sp = 65535 & i;else {
                      s.pc = (yield) | (yield) << 8, n = yield, yield, s.model = I1[1], s.ay = !0, (r = 7 & (s.p7FFD = n)) && ([f[0], f[r]] = [f[r], f[0]]);
                      for (let e = 0; e < 8; e++) 2 != e && 5 != e && e != r && (yield* o(e));
                    }
                    function* o(e) {
                      yield [16384, f[e]];
                    }
                  },
                  z80: function* () {
                    var r,
                      n,
                      i,
                      f,
                      o,
                      a,
                      l,
                      u = yield [30];
                    if (y(u, {
                      a: 0,
                      f: 1,
                      bc: 2,
                      hl: 4,
                      pc: 6,
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
                    }), r = u[12], s.r = 127 & s.r | (r = 255 == r ? 1 : r) << 7 & 128, s.border = r >> 1 & 7, s.halt = 118 == (n = u[28]), s.iff = u[27] ? 3 : n ? 2 : 0, s.im = 3 & u[29], s.pc) u = (n = flatten48kRam(s.ram)).buffer, i = 16384, s.ram[5] = $1(u, 0, i), s.ram[2] = $1(u, i, i), s.ram[0] = $1(u, 32768, i), 32 & r ? (yield* c(n, 3 * i), (yield d) || (yield [4])) : yield [3 * i, n];else {
                      y(r = yield [u = (yield) | (yield) << 8], {
                        pc: 0
                      });
                      let e = r[2],
                        t = (u < 24 && (e += 2 < e & e < 5), [0, 4, 0, 0,, 5,,,, 3, 3, 0,,, 2, 2][e] ?? 1);
                      4 & t && (t &= -5, s.if1 = {
                        paged: 255 == r[4]
                      }), i = I1[t], (n = (s.model = i).T) & A1 && (s.p7FFD = r[3]), n & R5 && (s.pFF = r[4]), 1 & ~(i = r[5]) && (s.r = 128 & s.r | 128 * l1()), 4 & i && (s.ay = {
                        idx: 15 & r[4],
                        reg: r.slice(7, 23)
                      }), 26 < u && (i = r[26], [221, 243, 251, 253].includes(i)) && (s.px = i), f = n & A1 ? [0, 1, 2, 3, 4, 5, 6, 7] : [, 2, 0,,, 5];
                      do {
                        if (!((o = (yield) | (yield) << 8) | (a = yield))) return;
                        let e;
                        if ((l = f[a - 3]) == +l) e = s.ram[l];else {
                          if (!(a < 2)) {
                            yield [o];
                            continue;
                          }
                          e = $1(16384), s.rom = e;
                        }
                        o < 65535 ? yield* c(e, 16384, o) : yield [16384, e];
                      } while (!(yield d));
                    }
                    function* c(t, r, n = 1e9) {
                      for (var i, f = 0; f < r;) {
                        if (!n--) throw "Underrun";
                        let e = yield;
                        if (237 == e && 2 < n) {
                          if (n--, 237 == (e = yield)) {
                            if (i = f, r < (f += yield)) throw "Overflow";
                            t.fill(yield, i, f), n -= 2;
                            continue;
                          }
                          t[f++] = 237;
                        }
                        t[f++] = e;
                      }
                      if (n && n < 1e8) throw "Garbage";
                    }
                  },
                  rom: function* () {
                    for (var e = $1(16384), t = 0; e[t++] = yield, !(yield d);) if (16383 < t) throw "Too long";
                    for (; t & t - 1;) e[t++] = 255;
                    for (; t < 16384;) e.set(e.slice(0, t), t), t += t;
                    s.pFF = s.halt = s.pc = 0, s.p7FFD = 48, s.rom = e;
                  },
                  scr: function* () {
                    var e,
                      t = s.ram[5];
                    t.fill(0, 6912, 16380), t.set([243, 118, 24, 252], 16380), s.pc = 32764, e = 7, yield [6144, t], (yield d) ? t.fill(56, 6144, 6912) : (yield [6912, t, 6144], e = 0, (yield d) || (e = yield, yield d) || (t.set(t.slice(6144, 6912), 8192), t[8960] = e, s.model = I1[2], s.pFF = 2, yield [14336, t, 8961], e = 0, yield d) || (s.pFF = yield, yield d) || (e = yield)), s.border = 7 & e;
                  }
                }[e])) throw e + ": Unknown format";
                Y1(s, {
                  model: I1[0],
                  im: 0,
                  iff: 0,
                  halt: 1,
                  px: 0,
                  pFF: 0,
                  p7FFD: 48,
                  rom: !1,
                  ay: !1,
                  if1: !1
                });
                let d = {};
                return v = t(), p(), e => {
                  for (var t, r, {
                      C: n,
                      _: i,
                      g: f
                    } = a, o = i.length; n < o;) {
                    if (!v) return;
                    l == d ? p(!1) : l ? (t = o - n) < (r = c - u) ? (l.set(i.slice(n), u), n += t, u += t) : (l.set(i.slice(n, n + r), u), n += r, p(l)) : p(i[n++]);
                  }
                  if (a.C = n, f) for (; v;) {
                    if (l != d) throw "Truncated";
                    p(!0);
                  }
                };
                function p(e) {
                  l = g1;
                  var {
                    value: e,
                    done: t
                  } = v.next(e);
                  if (e) {
                    if (e == d) return l = e;
                    var [e, r, n] = e;
                    l = r || $1(e), u = 0 | n, c = e;
                  }
                  t && (v = g1);
                }
                function y(e, t) {
                  var r, n;
                  for (r in t) n = t[r], s[r] = e[n], /.[a-z]/.test(r) && (s[r] |= e[n + 1] << 8);
                }
              })(y, r, e), h = e => g(e => setRuntimeFlag(4, 0), 200);else {
                let e;
                if (2 == c) {
                  let t = {
                    _: r._,
                    C: 0
                  };
                  m = e => {
                    t._ = r._, setRuntimeFlag(4, 0);
                  }, h = e => {
                    t.g = 1, 2 != v || queuedTapeLoad || w[1] || (queuedTapeLoad = t), setRuntimeFlag(4, 0);
                  }, 2 == v ? queuedTapeLoadFallback = t : (queuedTapeLoad = t, e = 'ï""');
                } else m = e => e, h = e => {
                  y = {
                    if1: !0
                  }, microdriveState.P = (t => {
                    var r,
                      n,
                      i,
                      f = t.length / 543 | 0;
                    (i = new Int16Array(799 * f)).fill(-1);
                    for (let e = n = r = 0; e < f; e++) a(), o(15), n += 81, a(), o(528), n += 151;
                    return i;
                    function o(e) {
                      i.set(t.slice(r, r + e), n), n += e, r += e;
                    }
                    function a() {
                      i.fill(0, n, n + 12 - 2), i[(n += 12) - 2] = i[n - 1] = 255;
                    }
                  })(r._), microdriveState.C = 0, setRuntimeFlag(4, 0);
                }, e = "÷";
                if (e) {
                  u = (u = r.p?.match(/; *model *= *([^ ]+)/)) && parseModelName(u[1]) || serializeMachineState().model, t = e, l = u, o = $1(65536), c = (e, t) => (o[e] = t, o[e + 1] = t >> 8), u = (e, t, r, n) => o.set(t.slice(r, r + n), e), a = romPages[48], o.fill(56, 22528, 23296), f = 23610, c(23732, n = 65535), u(n -= 167, a, 15880, 168), c(23675, n--), o[f - 2] = 64, c(23730, n), c(f - 4, 15360), o[n--] = 62, c(3 + f, (i = n) - 2), c(23631, 23734), u(23734, a, 5551, 21), n = 23754, c(23639, n++), c(23635, n), c(23627, n), o[n++] = 128, c(23641, n);
                  for (let e = 0; e < t.length; e++) o[n++] = t.charCodeAt(e);
                  c(n, 32781), c(23649, n += 2), c(23651, n), c(23653, n), o[23693] = o[23695] = o[23624] = 56, c(23561, 1315), o[23552] = o[23556] = 255, u(23568, a, 5574, 14), c(23688, 6177), o[23659] = 2, c(23656, 23698), o[1 + f] = 12, a = 48, f = 4788, l.T & A1 && (o[23562] = 2, u(23296, romPages["128e"], 107, 88), o[23389] = 207, o.set([236, 235, 236, 43, 1], 23427), o[11255] = 192, o[11285] = o[14067] = 20, o[15723] = 5, o[(n = 11279) - 1] = 255, o[n] = o[n + 2] = 56, c(i, 6932), c(23425, n = 23539), o.set([231, 63, 43, 39, 231, 63, 122, 38, 49, 13, 103, 38], n), a = 0, f = 619), n = 32768 * l1() | 0, o[23672] = n, i2({
                    ram: [3,, 2,,, 1,, 0].map(e => o.slice(e << 14, e + 1 << 14)),
                    model: l,
                    border: 7,
                    rom: g1,
                    p7FFD: a,
                    pc: f,
                    sp: i,
                    iy: 23610,
                    i: 63,
                    r: n >> 8,
                    im: 1,
                    iff: 3
                  });
                }
              }
            }
            u = 1;
            try {
              r._ && m(), u = r.g;
            } finally {
              u && (w[v] = g1, h) && h(), y && i2(y), d(y);
            }
          }
          function s() {
            updateProgressBar({
              tap: "0c3",
              rom: "d04"
            }[e] || "06f");
          }
        }), w[v] = p, 1 == v) && setRuntimeFlag(4, 1);
      };
    }
    Q.setAudioGain = function setAudioGain(e) {
      audioGainNode && (audioGainNode.value = e * e);
    };
    Q.toggleCrtMode = function toggleCrtMode(e) {
      var t = v($, ".t");
      return e != g1 && !e == t && (t || screenScale && (h("#t").innerHTML = screenScale, screenScale = g1), t = !t, F($, "t", t)), t;
    };
    Q.parseModelName = function parseModelName(t) {
      var e = [/^(48k?|0)$/i, /^1(28k?)?$/i, /^((tc)?2(048|k)|2)$/i, /^(p|3$)/i].findIndex(e => e.test(t));
      return I1[e];
    };
    Q.modelToIndex = function modelToIndex(e) {
      return I1.indexOf(e.model);
    };
    Q.flatten48kRam = function flatten48kRam(e) {
      e.length;
      var t = $1(49152);
      return t.set(e[5], 0), t.set(e[2], 16384), t.set(e[0], 32768), t;
    };
    Q.detectFileType = function detectFileType(e, t) {
      var r, n, i, f, o;
      if (t) for (r in t = (t = t.toLowerCase()).replace(/ *;.*/, ""), file_types) if ((n = file_types[r]).I.includes(t)) return n;
      if (i = e?.match(/.\.(\w+)$/)?.[1]?.toLowerCase()) for (f in file_types) if ((o = file_types[f]).U.includes(i)) return o;
    };
    screenScale = "<filter id=crt primitiveUnits=objectBoundingBox x=0 y=0 width=1 height=1><feImage href=" + m + "crt-clip result=c /><feImage href=" + m + "crt-distortion /><feDisplacementMap in=SourceGraphic scale=.018 xChannelSelector=R yChannelSelector=G result=e /><feImage href=" + m + "crt-mask /><feComposite operator=over in2=e /><feComposite operator=in in2=c />", file_types = {}, "+Tape:tap+Z80 Snapshot:z80:z80,slt+SNA Snapshot:sna+Screen Dump:scr+Interface 2 Cartridge:rom:rom,if2+Microdrive tape:mdr-PNG Image:image/png:png".split(/(?=[+-])/).map(e => {
      var t,
        [e, r, n] = e.split(/:/);
      n ??= r, r = (r = r[3] ? r : "application/x.zx." + r + ",application/x-spectrum-" + r).split(/,/), t = (n = n.split(/,/))[0], file_types[t] = {
        A: t,
        m: e.slice(1),
        U: n,
        I: r,
        D: "+" == e[0]
      };
    });
  }
})(globalThis.__qaop = globalThis.__qaop || {}, globalThis, document, setTimeout, undefined);
