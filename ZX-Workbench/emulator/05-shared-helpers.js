// Shared helpers, URL/state parsing, and global bootstrap state. Original top-level statements 1-10.
(function (Q, T, d, g, g1) {
  with (Q) {
    Q.m = "/qaop/";
    Q.h = e => d.querySelector(e);
    Q._ = e => [...d.querySelectorAll(e)];
    Q.w = e => d.createElement(e);
    Q.t1 = e => e?.children[0];
    Q.v = (e, t) => e?.matches?.(t);
    Q.x = (e, t) => e?.closest?.(t);
    Q.z = (e, t) => t == g1 ? e.textContent : e.textContent = t;
    Q.S = e => e.preventDefault();
    Q.r1 = URL.createObjectURL;
    Q.$1 = (...e) => new Uint8Array(...e);
    Q.n1 = e => Uint8Array.from(e, i1(e) ? e => e.charCodeAt(0) : g1);
    Q.X1 = (...e) => new Uint32Array(...e);
    Q.Z1 = (...e) => new Int32Array(...e);
    Q.i1 = e => e === e + "";
    Q.f1 = e => String.fromCharCode(...e);
    Q.o1 = e => JSON.stringify(e);
    Q.a1 = e => JSON.parse(e);
    ({
      min: Q.H1,
      max: Q.K1,
      random: Q.l1,
      clz32: Q.Q1
    } = Math);
    Q.Y1 = Object.assign;
    Q.showMessage = function showMessage(e) {
      var i;
      if (e?.stack, e = e?.message || e, !(1 < toastQueue.push(e + ""))) {
        i = function* () {
          var e,
            t = h("#m"),
            r = t.style;
          for (t.hidden = !1, yield 1; e = toastQueue[0]; toastQueue.shift()) z(t, e), r.opacity = 1, r.top = "1vh", yield 3e3 + 9 * e.length, r.opacity = 0, r.top = 0, yield 100;
          t.hidden = !0;
        }();
        let n = e => {
          var {
            value: t,
            done: r
          } = i.next();
          r || g(n, t);
        };
        n();
      }
    };
    Q.updateProgressBar = function updateProgressBar(e) {
      var t,
        r,
        n,
        i,
        f = h("#b"),
        o = f.style;
      i1(e) ? o.color = "#" + e : e && !progressEntries.includes(e) && progressEntries.push(e), i = n = r = t = 0;
      for ({
        t: _count,
        o: _total,
        u: _end
      } of progressEntries) n |= !_end, t += 0 | _count, r += 0 | _total, i |= _total != g1;
      !n && progressEntries[0] && (progressEntries = [], o.color = "", r = i = 0), r || (t = 0, r = 1), o.borderLeftWidth = 100 * t / r + "vw", F(f, "t", i), f.hidden = !n;
    };
    Q.loadBinaryResource = function loadBinaryResource(s, v, d) {
      var p,
        e = s.v;
      if (e) {
        s.p || (s.p = e.type), s.m || (s.m = e.name);
        let t = new FileReader();
        t.readAsArrayBuffer(e), t.onloadend = e => {
          s._ = $1(t.result), s.g = 1, d(s);
        };
      } else e = {}, v.S && (e.headers = {
        Accept: v.S
      }), fetch(s.F, e).then(async function (e) {
        var t,
          r,
          n,
          i,
          f,
          o,
          a,
          l = e.headers;
        if (s.p ||= l.get("Content-Type"), !e.ok) return y(e.statusText || "Error");
        if (s.F = e.url, (t = l.get("Content-Length")) != g1 && (p.o = t), p.t = 0, v.$) s._ = await e.text();else if (r = e.body?.getReader()) for (;;) {
          var {
            value: u,
            done: c
          } = await r.read();
          if (u && (p.t += u.length, u = u, o = f = i = n = void 0, o = s._, a = s.C, o && (i = (n = o.length) - a) && ((f = $1(i + u.length)).set(o.slice(a, a + n)), f.set(u, i), u = f), s._ = u, s.C = 0, t == g1 && (p.o = p.t + 9999), updateProgressBar()), c) break;
          d(s);
        } else l = await e.arrayBuffer(), l = $1(l), s._ = l;
        y();
      }).catch(e => y(e.message || e)), updateProgressBar(p = {});
      return {};
      function y(e) {
        p.u = s.g = 1, p.o = p.t, updateProgressBar(), e && (s._ = null, showMessage(e)), d(s);
      }
    };
    Q.F = function F(e, t, r) {
      e.classList[r ? "add" : "remove"](...t);
    };
    Q.applyUrlState = function applyUrlState(r) {
      var n, e, t, i, f, o, a;
      if (queueUiRefresh(), n = (() => {
        var e, t, r, n;
        if ((e = getLocationPart(2)) != g1) {
          t = {};
          for (r of e.split(/#/)) r && ((n = r.match(/^(!|~|)([^=./]+)(?:=(.*))?$/)) ? t[n[2]] = !n[1] && (null == n[3] || decodeURIComponent(n[3])) : t.l = t.l || r);
          return t;
        }
      })()) for (i of "ltu") (f = n[i]) && !i1(f) || f != pendingUrlState[i] && (pendingUrlState[i] = f) && ("l" == i && (history.pushState(captureState(), "", m), loadGameSource(f), e = 1), "t" == i) && beginLoad(2, f, queueUiRefresh);
      if (e || (r ? applySerializedState(r) : t = 1), n) {
        (r = diffKnownState(getUiSettings(), n)) && applyUiSettings(r);
        let e, t;
        for (o in n) if (~(a = ["48", "128", "tc2048"].indexOf(o))) {
          if (n[o]) {
            e = a;
            break;
          }
          t = +!a;
        }
        e ??= t, delete n.model, e != g1 && (n.model = I1[e]), (r = diffKnownState(captureState(), n)) && applySerializedState(r);
      }
      t && ejectMedia();
    };
    Q.getLocationPart = function getLocationPart(e) {
      return location.href.match(/([^#]+)(?:#(.*))?$/)[e];
    };
    Q.diffKnownState = function diffKnownState(e, t) {
      var r, n, i, f, o;
      for (n in t) n in e && (i = e[n], (f = (f = t[n]) == g1 ? !i : (o = f, i === !!i ? o = !!(0 | o) : i === +i && (o |= 0), o)) !== g1) && (delete t[n], (r ??= {})[n] = f);
      return r;
    };
    Q.clearSelectedGameIfIdDiffers = function clearSelectedGameIfIdDiffers(e) {
      currentGame && currentGame.id != e && (currentGame = g1, queueUiRefresh());
    };
    onerror = (...e) => {
      [...e], showMessage(e[4]);
    }, toastQueue = [], progressEntries = [], pendingUrlState = {};
  }
})(globalThis.__qaop = globalThis.__qaop || {}, globalThis, document, setTimeout, undefined);
