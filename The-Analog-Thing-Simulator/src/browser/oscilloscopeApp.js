/* global window, document, Blob, URL */
'use strict';

(function attachOscilloscopeApp(globalScope) {
  const DEFAULTS = Object.freeze({
    k: 0.5,
    d: 0.5,
    invMass: 0.5,
    mode: 'REPF',
    duration: 40,
    opTime: 8,
    cycles: 3,
    dt: 0.01,
    sampleEvery: 10,
    output: 'both',
    clip: false,
  });

  const MODES = Object.freeze({
    IC: 'IC',
    OP: 'OP',
    HALT: 'HALT',
    REPF: 'REPF',
  });

  function finiteNumber(value, fallback) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function positiveNumber(value, fallback, minimum) {
    const numeric = finiteNumber(value, fallback);
    const floor = minimum === undefined ? 1e-12 : minimum;
    return numeric >= floor ? numeric : fallback;
  }

  function integerNumber(value, fallback, minimum) {
    const numeric = Math.round(finiteNumber(value, fallback));
    return numeric >= minimum ? numeric : fallback;
  }

  function clamp(value, min, max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
  }

  function isOverloaded(value) {
    return value < -1 || value > 1;
  }

  function clipMachineUnit(value) {
    return clamp(value, -1, 1);
  }

  function clipState(state) {
    return {
      minusVelocity: clipMachineUnit(state.minusVelocity),
      position: clipMachineUnit(state.position),
    };
  }

  function normalizeOptions(options) {
    const merged = Object.assign({}, DEFAULTS, options || {});
    return {
      k: clamp(finiteNumber(merged.k, DEFAULTS.k), 0, 1),
      d: clamp(finiteNumber(merged.d, DEFAULTS.d), 0, 1),
      invMass: clamp(finiteNumber(merged.invMass, DEFAULTS.invMass), 0, 1),
      mode: Object.prototype.hasOwnProperty.call(MODES, merged.mode) ? merged.mode : DEFAULTS.mode,
      duration: positiveNumber(merged.duration, DEFAULTS.duration, 0),
      opTime: positiveNumber(merged.opTime, DEFAULTS.opTime, 0.001),
      cycles: integerNumber(merged.cycles, DEFAULTS.cycles, 1),
      dt: positiveNumber(merged.dt, DEFAULTS.dt, 0.0001),
      sampleEvery: integerNumber(merged.sampleEvery, DEFAULTS.sampleEvery, 1),
      output: ['position', 'velocity', 'both'].includes(merged.output) ? merged.output : DEFAULTS.output,
      clip: Boolean(merged.clip),
    };
  }

  function initialStateFromIc() {
    return {
      minusVelocity: -1,
      position: 0,
    };
  }

  function evaluateDampedState(state, options) {
    const velocity = -state.minusVelocity;
    const springTerm = options.k * state.position;
    const dampingTerm = options.d * velocity;
    const summerOut = -(springTerm + dampingTerm);
    const accelerationInput = options.invMass * summerOut;
    const derivatives = {
      minusVelocity: -accelerationInput,
      position: velocity,
    };
    const outputs = {
      position: state.position,
      velocity,
      minusVelocity: state.minusVelocity,
      accelerationInput,
      springTerm,
      dampingTerm,
    };
    const checked = [
      state.minusVelocity,
      state.position,
      velocity,
      springTerm,
      dampingTerm,
      summerOut,
      accelerationInput,
    ];
    return {
      outputs,
      derivatives,
      overload: checked.some(isOverloaded),
    };
  }

  function addScaledState(state, derivative, scale) {
    return {
      minusVelocity: state.minusVelocity + derivative.minusVelocity * scale,
      position: state.position + derivative.position * scale,
    };
  }

  function rk4Step(state, dt, options) {
    const k1 = evaluateDampedState(state, options).derivatives;
    const k2 = evaluateDampedState(addScaledState(state, k1, dt / 2), options).derivatives;
    const k3 = evaluateDampedState(addScaledState(state, k2, dt / 2), options).derivatives;
    const k4 = evaluateDampedState(addScaledState(state, k3, dt), options).derivatives;
    const next = {
      minusVelocity: state.minusVelocity + (dt / 6) * (k1.minusVelocity + 2 * k2.minusVelocity + 2 * k3.minusVelocity + k4.minusVelocity),
      position: state.position + (dt / 6) * (k1.position + 2 * k2.position + 2 * k3.position + k4.position),
    };
    return options.clip ? clipState(next) : next;
  }

  function makeSample(state, t, cycle, trigger, mode, options) {
    const evaluation = evaluateDampedState(state, options);
    return {
      t,
      cycle,
      trigger,
      mode,
      state: {
        minusVelocity: state.minusVelocity,
        position: state.position,
      },
      outputs: evaluation.outputs,
      overload: evaluation.overload,
    };
  }

  function runIc(options) {
    const state = initialStateFromIc();
    return {
      mode: MODES.IC,
      parameters: parameterSummary(options),
      finalState: state,
      trace: [makeSample(state, 0, 0, true, MODES.IC, options)],
    };
  }

  function runHalt(options) {
    const state = initialStateFromIc();
    const steps = Math.round(options.duration / options.dt);
    const trace = [];
    for (let step = 0; step <= steps; step += 1) {
      if (step === 0 || step % options.sampleEvery === 0 || step === steps) {
        trace.push(makeSample(state, step * options.dt, 0, step === 0, MODES.HALT, options));
      }
    }
    return {
      mode: MODES.HALT,
      parameters: parameterSummary(options),
      finalState: state,
      trace,
    };
  }

  function runOp(options) {
    let state = initialStateFromIc();
    const steps = Math.round(options.duration / options.dt);
    const trace = [makeSample(state, 0, 0, true, MODES.OP, options)];
    for (let step = 1; step <= steps; step += 1) {
      state = rk4Step(state, options.dt, options);
      if (step % options.sampleEvery === 0 || step === steps) {
        trace.push(makeSample(state, step * options.dt, 0, false, MODES.OP, options));
      }
    }
    return {
      mode: MODES.OP,
      parameters: parameterSummary(options),
      finalState: state,
      trace,
    };
  }

  function runRepf(options) {
    let finalState = initialStateFromIc();
    const trace = [];
    const steps = Math.round(options.opTime / options.dt);
    for (let cycle = 0; cycle < options.cycles; cycle += 1) {
      let state = initialStateFromIc();
      for (let step = 0; step <= steps; step += 1) {
        const t = cycle * options.opTime + step * options.dt;
        if (step === 0 || step % options.sampleEvery === 0 || step === steps) {
          trace.push(makeSample(state, t, cycle, step === 0, MODES.REPF, options));
        }
        if (step < steps) state = rk4Step(state, options.dt, options);
      }
      finalState = state;
    }
    return {
      mode: MODES.REPF,
      parameters: parameterSummary(options),
      finalState,
      trace,
    };
  }

  function parameterSummary(options) {
    return {
      k: options.k,
      d: options.d,
      invMass: options.invMass,
      duration: options.duration,
      opTime: options.opTime,
      cycles: options.cycles,
      dt: options.dt,
      sampleEvery: options.sampleEvery,
      clip: options.clip,
    };
  }

  function simulateDampedOscillation(options) {
    const normalized = normalizeOptions(options);
    if (normalized.mode === MODES.IC) return runIc(normalized);
    if (normalized.mode === MODES.HALT) return runHalt(normalized);
    if (normalized.mode === MODES.OP) return runOp(normalized);
    return runRepf(normalized);
  }

  function detectZeroCrossing(trace, outputName) {
    if (!Array.isArray(trace) || trace.length < 2) return false;
    for (let i = 1; i < trace.length; i += 1) {
      const previous = trace[i - 1].outputs[outputName];
      const current = trace[i].outputs[outputName];
      if (previous === 0 || current === 0 || previous * current < 0) return true;
    }
    return false;
  }

  function peakMagnitude(trace, outputName) {
    let peak = 0;
    for (const point of trace) {
      const value = Math.abs(point.outputs[outputName] || 0);
      if (value > peak) peak = value;
    }
    return peak;
  }

  function selectedSignalNames(output) {
    if (output === 'position') return ['position'];
    if (output === 'velocity') return ['velocity'];
    return ['position', 'velocity'];
  }

  function traceBounds(trace, signals) {
    let minT = 0;
    let maxT = 1;
    let minY = -1;
    let maxY = 1;
    if (trace.length > 0) {
      minT = trace[0].t;
      maxT = trace[trace.length - 1].t;
      minY = Infinity;
      maxY = -Infinity;
      for (const point of trace) {
        for (const signal of signals) {
          const value = point.outputs[signal];
          if (Number.isFinite(value)) {
            if (value < minY) minY = value;
            if (value > maxY) maxY = value;
          }
        }
      }
      if (!Number.isFinite(minY) || !Number.isFinite(maxY)) {
        minY = -1;
        maxY = 1;
      }
    }
    const yPad = Math.max(0.05, (maxY - minY) * 0.12);
    return {
      minT,
      maxT: maxT <= minT ? minT + 1 : maxT,
      minY: minY - yPad,
      maxY: maxY + yPad,
    };
  }

  function drawOscilloscope(canvas, trace, output) {
    if (!canvas || typeof canvas.getContext !== 'function') return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const padding = { left: 54, right: 18, top: 18, bottom: 36 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const signals = selectedSignalNames(output);
    const bounds = traceBounds(trace, signals);
    const signalStyles = {
      position: '#1565c0',
      velocity: '#c62828',
    };

    function xPixel(t) {
      return padding.left + ((t - bounds.minT) / (bounds.maxT - bounds.minT)) * plotWidth;
    }

    function yPixel(value) {
      return padding.top + (1 - (value - bounds.minY) / (bounds.maxY - bounds.minY)) * plotHeight;
    }

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#d7d7d7';
    ctx.lineWidth = 1;
    ctx.strokeRect(padding.left, padding.top, plotWidth, plotHeight);

    ctx.fillStyle = '#444444';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(`${bounds.minT.toFixed(2)} s`, padding.left, height - 12);
    ctx.fillText(`${bounds.maxT.toFixed(2)} s`, width - padding.right - 54, height - 12);
    ctx.fillText(bounds.maxY.toFixed(2), 8, padding.top + 4);
    ctx.fillText(bounds.minY.toFixed(2), 8, padding.top + plotHeight);

    if (bounds.minY < 0 && bounds.maxY > 0) {
      const zeroY = yPixel(0);
      ctx.strokeStyle = '#efefef';
      ctx.beginPath();
      ctx.moveTo(padding.left, zeroY);
      ctx.lineTo(width - padding.right, zeroY);
      ctx.stroke();
    }

    for (const point of trace) {
      if (point.trigger) {
        const x = xPixel(point.t);
        ctx.strokeStyle = '#bbbbbb';
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, padding.top + plotHeight);
        ctx.stroke();
      }
    }

    for (const signal of signals) {
      ctx.strokeStyle = signalStyles[signal];
      ctx.lineWidth = 2;
      ctx.beginPath();
      let started = false;
      for (const point of trace) {
        const value = point.outputs[signal];
        if (!Number.isFinite(value)) continue;
        const x = xPixel(point.t);
        const y = yPixel(value);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }
  }

  function readForm(form) {
    return normalizeOptions({
      k: form.k.value,
      d: form.d.value,
      invMass: form.invMass.value,
      mode: form.mode.value,
      output: form.output.value,
      duration: form.duration.value,
      opTime: form.opTime.value,
      cycles: form.cycles.value,
      dt: form.dt.value,
      sampleEvery: form.sampleEvery.value,
      clip: Boolean(form.clip && form.clip.checked),
    });
  }

  function updateRangeLabels(form, root) {
    const labels = {
      k: root.querySelector('[data-value-for="k"]'),
      d: root.querySelector('[data-value-for="d"]'),
      invMass: root.querySelector('[data-value-for="invMass"]'),
    };
    for (const [name, label] of Object.entries(labels)) {
      if (label && form[name]) label.textContent = Number(form[name].value).toFixed(2);
    }
  }

  function summarizeResult(result) {
    const trace = result.trace;
    const overloaded = trace.some((point) => point.overload);
    const triggers = trace.filter((point) => point.trigger).length;
    return {
      sampleCount: trace.length,
      triggerCount: triggers,
      overloaded,
      positionCrossesZero: detectZeroCrossing(trace, 'position'),
      velocityCrossesZero: detectZeroCrossing(trace, 'velocity'),
      peakPosition: peakMagnitude(trace, 'position'),
      peakVelocity: peakMagnitude(trace, 'velocity'),
      clipped: Boolean(result.parameters && result.parameters.clip),
    };
  }

  function formatSummary(summary) {
    return [
      `${summary.sampleCount} samples`,
      `${summary.triggerCount} trigger${summary.triggerCount === 1 ? '' : 's'}`,
      `overload: ${summary.overloaded ? 'yes' : 'no'}`,
      `position zero-crossing: ${summary.positionCrossesZero ? 'yes' : 'no'}`,
      `velocity zero-crossing: ${summary.velocityCrossesZero ? 'yes' : 'no'}`,
      `peak |x|=${summary.peakPosition.toFixed(3)}`,
      `peak |v|=${summary.peakVelocity.toFixed(3)}`,
      `clipping: ${summary.clipped ? 'on' : 'off'}`,
    ].join(' · ');
  }

  function downloadJson(payload, filename) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function initOscilloscopeApp(rootDocument) {
    const doc = rootDocument || document;
    const form = doc.querySelector('#controls');
    const canvas = doc.querySelector('#traceCanvas');
    const status = doc.querySelector('#statusText');
    const exportButton = doc.querySelector('#exportJson');
    const summaryPre = doc.querySelector('#traceSummary');
    if (!form || !canvas || !status || !exportButton) return null;

    let lastPayload = null;

    function run() {
      const options = readForm(form);
      updateRangeLabels(form, doc);
      const result = simulateDampedOscillation(options);
      const summary = summarizeResult(result);
      lastPayload = {
        name: 'THAT quickstart damped oscillation browser prototype',
        generatedAt: new Date().toISOString(),
        parameters: result.parameters,
        result,
        summary,
      };
      drawOscilloscope(canvas, result.trace, options.output);
      status.textContent = formatSummary(summary);
      status.dataset.overload = summary.overloaded ? 'true' : 'false';
      if (summaryPre) summaryPre.textContent = JSON.stringify({ mode: result.mode, finalState: result.finalState, summary }, null, 2);
      return lastPayload;
    }

    form.addEventListener('input', run);
    form.addEventListener('change', run);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      run();
    });
    exportButton.addEventListener('click', () => {
      if (!lastPayload) run();
      downloadJson(lastPayload, 'damped_oscillation_browser_trace.json');
    });

    run();
    return {
      run,
      getLastPayload: () => lastPayload,
    };
  }

  const api = {
    DEFAULTS,
    MODES,
    normalizeOptions,
    initialStateFromIc,
    clipMachineUnit,
    clipState,
    evaluateDampedState,
    rk4Step,
    simulateDampedOscillation,
    detectZeroCrossing,
    peakMagnitude,
    summarizeResult,
    traceBounds,
    drawOscilloscope,
    initOscilloscopeApp,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  globalScope.AnalogThingOscilloscopeApp = api;
}(typeof window !== 'undefined' ? window : global));
