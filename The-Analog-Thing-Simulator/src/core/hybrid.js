'use strict';

const { assertFiniteNumber, isOverloaded, clampMachineUnit, toPanelVolts, toRcaVolts } = require('./value');
const { MODES } = require('./modes');

const HYBRID_SIGNAL_NAMES = Object.freeze(['x', 'y', 'z', 'u']);
const HYBRID_SHIFT_CENTER_VOLTS = 1.64;
const HYBRID_SHIFT_SPAN_VOLTS = 1;

function normalizeSignalName(name) {
  const normalized = String(name || '').trim().toLowerCase();
  if (!HYBRID_SIGNAL_NAMES.includes(normalized)) {
    throw new Error(`hybrid signal must be one of ${HYBRID_SIGNAL_NAMES.join(', ')}, got ${name}`);
  }
  return normalized;
}

function machineUnitToShiftedHybridVolts(machineUnit) {
  assertFiniteNumber(machineUnit, 'machineUnit');
  return HYBRID_SHIFT_CENTER_VOLTS + HYBRID_SHIFT_SPAN_VOLTS * machineUnit;
}

function shiftedHybridVoltsToMachineUnit(volts) {
  assertFiniteNumber(volts, 'shifted hybrid volts');
  return (volts - HYBRID_SHIFT_CENTER_VOLTS) / HYBRID_SHIFT_SPAN_VOLTS;
}

function detailFromMachineUnit(machineUnit, socket = null) {
  assertFiniteNumber(machineUnit, 'machineUnit');
  const clippedMachineUnit = clampMachineUnit(machineUnit);
  return {
    socket,
    machineUnit,
    panelVolts: toPanelVolts(machineUnit),
    rcaVolts: toRcaVolts(machineUnit),
    shiftedVolts: machineUnitToShiftedHybridVolts(machineUnit),
    overloaded: isOverloaded(machineUnit),
    clippedMachineUnit,
    clippedPanelVolts: toPanelVolts(clippedMachineUnit),
    clippedRcaVolts: toRcaVolts(clippedMachineUnit),
    clippedShiftedVolts: machineUnitToShiftedHybridVolts(clippedMachineUnit),
  };
}

function outputDetailsToHybridFrame(outputDetails, signalMap = {}) {
  const frame = {};
  for (const signal of HYBRID_SIGNAL_NAMES) {
    const outputLabel = signalMap[signal] || signal;
    const detail = outputDetails && outputDetails[outputLabel];
    if (!detail) continue;
    frame[signal] = detailFromMachineUnit(detail.machineUnit, detail.socket || null);
  }
  return frame;
}

function outputsToHybridFrame(outputs, signalMap = {}) {
  const frame = {};
  for (const signal of HYBRID_SIGNAL_NAMES) {
    const outputLabel = signalMap[signal] || signal;
    if (!outputs || outputs[outputLabel] === undefined) continue;
    frame[signal] = detailFromMachineUnit(outputs[outputLabel], null);
  }
  return frame;
}

function hybridFrameToAnalogInputs(frame) {
  const values = {};
  for (const [name, detail] of Object.entries(frame || {})) {
    const signal = normalizeSignalName(name);
    if (typeof detail === 'number') values[signal] = detail;
    else if (detail && detail.machineUnit !== undefined) values[signal] = detail.machineUnit;
    else if (detail && detail.shiftedVolts !== undefined) values[signal] = shiftedHybridVoltsToMachineUnit(detail.shiftedVolts);
    else throw new Error(`hybrid analog input ${name} must be a number or { machineUnit } or { shiftedVolts }`);
    assertFiniteNumber(values[signal], `hybrid analog input ${name}`);
  }
  return values;
}

function normalizePin(value) {
  return value === true || value === 1 || value === '1' || value === 'high' || value === 'HIGH';
}

function modeFromHybridPins(pins = {}) {
  const halt = normalizePin(pins.halt || pins.HALT);
  const ic = normalizePin(pins.ic || pins.IC);
  const op = normalizePin(pins.op || pins.OP);
  if (halt) return MODES.HALT;
  if (ic) return MODES.IC;
  if (op) return MODES.OP;
  return MODES.HALT;
}

class HybridPortAdapter {
  constructor(options = {}) {
    this.signalMap = { ...(options.signalMap || {}) };
    this.analogInputs = hybridFrameToAnalogInputs(options.analogInputs || {});
    this.controlPins = { ...(options.controlPins || {}) };
  }

  setAnalogInput(name, value) {
    const signal = normalizeSignalName(name);
    if (typeof value === 'number') this.analogInputs[signal] = value;
    else this.analogInputs[signal] = hybridFrameToAnalogInputs({ [signal]: value })[signal];
    return this;
  }

  setControlPins(pins) {
    this.controlPins = { ...(pins || {}) };
    return this;
  }

  getControlMode() {
    return modeFromHybridPins(this.controlPins);
  }

  captureEvaluation(evaluation) {
    return outputDetailsToHybridFrame(evaluation.outputDetails, this.signalMap);
  }

  captureTracePoint(point) {
    return {
      t: point.t,
      cycle: point.cycle,
      trigger: point.trigger,
      mode: point.mode,
      frame: outputDetailsToHybridFrame(point.outputDetails, this.signalMap),
    };
  }

  toJSON() {
    return {
      signalMap: { ...this.signalMap },
      analogInputs: { ...this.analogInputs },
      controlPins: { ...this.controlPins },
      controlMode: this.getControlMode(),
    };
  }
}

module.exports = {
  HYBRID_SIGNAL_NAMES,
  HYBRID_SHIFT_CENTER_VOLTS,
  HYBRID_SHIFT_SPAN_VOLTS,
  HybridPortAdapter,
  normalizeSignalName,
  machineUnitToShiftedHybridVolts,
  shiftedHybridVoltsToMachineUnit,
  detailFromMachineUnit,
  outputDetailsToHybridFrame,
  outputsToHybridFrame,
  hybridFrameToAnalogInputs,
  modeFromHybridPins,
};
