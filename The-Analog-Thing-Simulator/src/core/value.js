'use strict';

const MACHINE_MIN = -1;
const MACHINE_MAX = 1;

function assertFiniteNumber(value, label = 'value') {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number, got ${value}`);
  }
}

function clampMachineUnit(value) {
  assertFiniteNumber(value);
  if (value < MACHINE_MIN) return MACHINE_MIN;
  if (value > MACHINE_MAX) return MACHINE_MAX;
  return value;
}

function isOverloaded(value) {
  return typeof value === 'number' && Number.isFinite(value) && (value < MACHINE_MIN || value > MACHINE_MAX);
}

function toPanelVolts(machineUnit) {
  assertFiniteNumber(machineUnit, 'machineUnit');
  return machineUnit * 10;
}

function toRcaVolts(machineUnit) {
  assertFiniteNumber(machineUnit, 'machineUnit');
  return machineUnit;
}

function fromPanelVolts(volts) {
  assertFiniteNumber(volts, 'volts');
  return volts / 10;
}

function almostEqual(a, b, tolerance = 1e-12) {
  assertFiniteNumber(a, 'a');
  assertFiniteNumber(b, 'b');
  assertFiniteNumber(tolerance, 'tolerance');
  return Math.abs(a - b) <= tolerance;
}

module.exports = {
  MACHINE_MIN,
  MACHINE_MAX,
  assertFiniteNumber,
  clampMachineUnit,
  isOverloaded,
  toPanelVolts,
  toRcaVolts,
  fromPanelVolts,
  almostEqual,
};
