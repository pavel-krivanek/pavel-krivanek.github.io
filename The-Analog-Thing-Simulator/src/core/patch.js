'use strict';

const { createComponent, Integrator, SOCKET_DIRECTIONS } = require('./components');
const { createImperfectionModel } = require('./imperfections');
const { isOverloaded, assertFiniteNumber, clampMachineUnit, toPanelVolts, toRcaVolts } = require('./value');

function normalizeConnection(connection) {
  if (Array.isArray(connection) && connection.length === 2) {
    return { from: connection[0], to: connection[1] };
  }
  if (connection && typeof connection.from === 'string' && typeof connection.to === 'string') {
    const normalized = { from: connection.from, to: connection.to };
    if (typeof connection.label === 'string') normalized.label = connection.label;
    return normalized;
  }
  throw new Error(`invalid connection: ${JSON.stringify(connection)}`);
}

function splitSocketId(socketId) {
  if (typeof socketId !== 'string') throw new Error(`socket id must be a string: ${socketId}`);
  const index = socketId.indexOf('.');
  if (index <= 0 || index === socketId.length - 1 || socketId.indexOf('.', index + 1) !== -1) {
    throw new Error(`socket id must use component.socket form: ${socketId}`);
  }
  return {
    componentId: socketId.slice(0, index),
    socketName: socketId.slice(index + 1),
  };
}

function statefulComponent(component) {
  return typeof component.derivative === 'function' && typeof component.stateFromIc === 'function';
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

class PatchMachine {
  constructor(definition) {
    if (!definition || !Array.isArray(definition.components)) {
      throw new Error('PatchMachine definition requires a components array');
    }
    this.schemaVersion = definition.schemaVersion;
    this.name = definition.name || 'unnamed patch';
    this.description = definition.description || '';
    this.imperfections = createImperfectionModel(definition.imperfections || definition.imperfectionModel);
    this.components = definition.components
      .map((componentDefinition) => this.imperfections.transformComponentDefinition(componentDefinition))
      .map(createComponent);
    this.connections = (definition.connections || []).map(normalizeConnection);
    this.outputMap = definition.outputs || {};
    this.parameters = definition.parameters || {};
    this.componentById = new Map();
    for (const component of this.components) {
      if (this.componentById.has(component.id)) {
        throw new Error(`duplicate component id: ${component.id}`);
      }
      this.componentById.set(component.id, component);
    }
    this.socketById = this.buildSocketIndex();
    this.statefulComponents = this.components.filter(statefulComponent);
    this.integrators = this.components.filter((component) => component instanceof Integrator);
    this.integratorIds = this.integrators.map((integrator) => integrator.id);
    this.statefulComponentIds = this.statefulComponents.map((component) => component.id);
    this.configureFeedbackJacks();
    this.validateConnections();
  }

  configureFeedbackJacks() {
    const fbConnections = new Map();
    for (const connection of this.connections) {
      const target = typeof connection.to === 'string' ? connection.to.match(/^(SUM\d+)\.fb$/) : null;
      if (target) fbConnections.set(target[1], connection.from);
    }
    for (const component of this.components) {
      if (typeof component.setFeedbackJackConnection !== 'function') continue;
      const source = fbConnections.get(component.id) || null;
      component.setFeedbackJackConnection(Boolean(source), source === 'ZERO.out');
    }
  }

  buildSocketIndex() {
    const sockets = new Map();
    for (const component of this.components) {
      for (const socket of component.socketMetadata()) {
        if (sockets.has(socket.id)) throw new Error(`duplicate socket id: ${socket.id}`);
        sockets.set(socket.id, socket);
      }
    }
    return sockets;
  }

  socketMetadata() {
    return Array.from(this.socketById.values()).map(clonePlain);
  }

  componentDefinitions() {
    return this.components.map((component) => component.toDefinition());
  }

  toDefinition() {
    return {
      schemaVersion: this.schemaVersion,
      name: this.name,
      description: this.description,
      components: this.componentDefinitions(),
      connections: this.connections.map(clonePlain),
      outputs: clonePlain(this.outputMap),
      parameters: clonePlain(this.parameters),
      imperfections: this.imperfections.toJSON(),
    };
  }

  requireSocket(socketId, expectedDirection, role) {
    splitSocketId(socketId);
    const socket = this.socketById.get(socketId);
    if (!socket) throw new Error(`${role} references unknown socket: ${socketId}`);
    if (expectedDirection && socket.direction !== expectedDirection) {
      throw new Error(`${role} ${socketId} must be a ${expectedDirection} socket, got ${socket.direction}`);
    }
    return socket;
  }

  validateConnections() {
    const ordinaryInputDrivers = new Map();
    const connectedInputs = new Set();
    for (const connection of this.connections) {
      this.requireSocket(connection.from, SOCKET_DIRECTIONS.OUTPUT, 'connection source');
      const target = this.requireSocket(connection.to, SOCKET_DIRECTIONS.INPUT, 'connection target');
      connectedInputs.add(connection.to);
      if (target.ordinary !== false) {
        const count = ordinaryInputDrivers.get(connection.to) || 0;
        ordinaryInputDrivers.set(connection.to, count + 1);
      }
    }
    for (const [to, count] of ordinaryInputDrivers.entries()) {
      if (count > 1) {
        throw new Error(`ordinary input ${to} has ${count} drivers; use a summer or explicit multi-input socket instead`);
      }
    }
    for (const socket of this.socketById.values()) {
      if (socket.direction === SOCKET_DIRECTIONS.INPUT && socket.required && !connectedInputs.has(socket.id)) {
        throw new Error(`required input ${socket.id} is not connected`);
      }
    }
    for (const [label, socketId] of Object.entries(this.outputMap)) {
      this.requireSocket(socketId, SOCKET_DIRECTIONS.OUTPUT, `output ${label}`);
    }
    this.validateNoStatelessCycles();
  }

  validateNoStatelessCycles() {
    const graph = new Map();
    const statelessIds = new Set(this.components.filter((component) => !statefulComponent(component)).map((component) => component.id));
    for (const id of statelessIds) graph.set(id, new Set());
    for (const connection of this.connections) {
      const from = splitSocketId(connection.from).componentId;
      const to = splitSocketId(connection.to).componentId;
      if (statelessIds.has(from) && statelessIds.has(to)) graph.get(from).add(to);
    }
    const visiting = new Set();
    const visited = new Set();
    const stack = [];

    const visit = (id) => {
      if (visiting.has(id)) {
        const cycleStart = stack.indexOf(id);
        const cycle = stack.slice(cycleStart).concat(id).join(' -> ');
        throw new Error(`stateless cycle detected: ${cycle}; insert an integrator/stateful element to break the loop`);
      }
      if (visited.has(id)) return;
      visiting.add(id);
      stack.push(id);
      for (const next of graph.get(id) || []) visit(next);
      stack.pop();
      visiting.delete(id);
      visited.add(id);
    };

    for (const id of graph.keys()) visit(id);
  }

  defaultStateVector() {
    const state = {};
    for (const component of this.statefulComponents) {
      state[component.id] = component.initialState;
    }
    return state;
  }

  propagate(values) {
    const inputValues = new Map();
    for (const connection of this.connections) {
      const value = values.get(connection.from);
      if (value !== undefined) {
        inputValues.set(connection.to, value);
      }
    }
    return inputValues;
  }

  perturbSocketValue(socketId, value, context = {}) {
    return this.imperfections.perturbSocketValue(socketId, value, context);
  }

  evaluate(stateVector = this.defaultStateVector(), context = {}) {
    const values = new Map();
    for (const component of this.statefulComponents) {
      const stateValue = stateVector[component.id];
      assertFiniteNumber(stateValue, `state.${component.id}`);
      values.set(component.outputSocket('out'), this.perturbSocketValue(component.outputSocket('out'), stateValue, context));
    }

    let inputValues = this.propagate(values);
    const statelessComponents = this.components.filter((component) => !statefulComponent(component));
    for (let pass = 0; pass < 32; pass += 1) {
      let changed = false;
      for (const component of statelessComponents) {
        const outputs = component.evaluateStateless(inputValues, context);
        for (const [socket, value] of outputs.entries()) {
          const perturbedValue = this.perturbSocketValue(socket, value, context);
          const previous = values.get(socket);
          if (previous === undefined || Math.abs(previous - perturbedValue) > 1e-15) {
            values.set(socket, perturbedValue);
            changed = true;
          }
        }
      }
      const nextInputValues = this.propagate(values);
      for (const [socket, value] of nextInputValues.entries()) {
        const previous = inputValues.get(socket);
        if (previous === undefined || Math.abs(previous - value) > 1e-15) {
          changed = true;
        }
      }
      inputValues = nextInputValues;
      if (!changed) break;
      if (pass === 31) {
        throw new Error(`stateless patch evaluation did not settle for ${this.name}`);
      }
    }

    const derivatives = {};
    for (const component of this.statefulComponents) {
      derivatives[component.id] = component.derivative(inputValues);
    }

    const outputs = {};
    const outputDetails = {};
    for (const [label, socket] of Object.entries(this.outputMap)) {
      const machineUnit = values.get(socket) ?? inputValues.get(socket) ?? 0;
      const clippedMachineUnit = clampMachineUnit(machineUnit);
      outputs[label] = machineUnit;
      outputDetails[label] = {
        socket,
        machineUnit,
        panelVolts: toPanelVolts(machineUnit),
        rcaVolts: toRcaVolts(machineUnit),
        overloaded: isOverloaded(machineUnit),
        clippedMachineUnit,
        clippedPanelVolts: toPanelVolts(clippedMachineUnit),
        clippedRcaVolts: toRcaVolts(clippedMachineUnit),
      };
    }

    const overloadedSockets = [];
    for (const [socket, value] of values.entries()) {
      if (isOverloaded(value)) overloadedSockets.push({ socket, value });
    }
    for (const [socket, value] of inputValues.entries()) {
      if (isOverloaded(value)) overloadedSockets.push({ socket, value });
    }

    return {
      values,
      inputValues,
      derivatives,
      outputs,
      outputDetails,
      overload: overloadedSockets.length > 0,
      overloadedSockets,
    };
  }

  applyInitialConditions(baseState = this.defaultStateVector(), context = {}) {
    const preliminary = this.evaluate(baseState, context);
    const nextState = { ...baseState };
    for (const component of this.statefulComponents) {
      nextState[component.id] = component.stateFromIc(preliminary.inputValues);
    }
    return nextState;
  }
}

module.exports = {
  PatchMachine,
  normalizeConnection,
  splitSocketId,
};
