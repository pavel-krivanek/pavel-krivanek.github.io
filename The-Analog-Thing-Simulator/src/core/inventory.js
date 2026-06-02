'use strict';

const { createComponent } = require('./components');

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

class BoardInventory {
  constructor(definition) {
    if (!definition || !Array.isArray(definition.components)) {
      throw new Error('BoardInventory requires a components array');
    }
    this.name = definition.name || 'unnamed inventory';
    this.description = definition.description || '';
    this.componentDefinitions = definition.components.map(clonePlain);
    this.componentById = new Map();
    for (const component of this.componentDefinitions) {
      if (!component.id) throw new Error('inventory component requires id');
      if (this.componentById.has(component.id)) throw new Error(`duplicate inventory component id: ${component.id}`);
      this.componentById.set(component.id, component);
    }
  }

  hasComponent(id) {
    return this.componentById.has(id);
  }

  getComponentDefinition(id, overrides = {}) {
    const component = this.componentById.get(id);
    if (!component) throw new Error(`inventory component not found: ${id}`);
    return { ...clonePlain(component), ...clonePlain(overrides) };
  }

  selectComponentDefinitions(ids, overridesById = {}) {
    return ids.map((id) => this.getComponentDefinition(id, overridesById[id] || {}));
  }

  instantiate(id, overrides = {}) {
    return createComponent(this.getComponentDefinition(id, overrides));
  }

  socketMetadata(componentIds) {
    const ids = componentIds || this.componentDefinitions.map((component) => component.id);
    const sockets = [];
    for (const id of ids) {
      sockets.push(...this.instantiate(id).socketMetadata());
    }
    return sockets;
  }

  toJSON() {
    return {
      name: this.name,
      description: this.description,
      components: clonePlain(this.componentDefinitions),
    };
  }
}

function weightedInputNames(prefix, count, weight) {
  const result = [];
  for (let index = 1; index <= count; index += 1) {
    result.push({ name: `${prefix}${index}`, weight, required: false });
  }
  return result;
}

function createThatPrototypeInventory(options = {}) {
  const coefficient = options.defaultCoefficient === undefined ? 0.5 : options.defaultCoefficient;
  const components = [
    { id: 'PLUS1', type: 'constant', label: '+1 machine unit', value: 1 },
    { id: 'MINUS1', type: 'constant', label: '-1 machine unit', value: -1 },
    { id: 'ZERO', type: 'constant', label: 'ground / zero', value: 0 },
  ];

  for (let index = 1; index <= 5; index += 1) {
    components.push({
      id: `I${index}`,
      type: 'integrator',
      label: `Integrator ${index}`,
      inputs: [
        { name: 'in1', weight: 1, required: true, description: 'THAT integrator x1 input' },
        { name: 'in10', weight: 10, required: false, description: 'THAT integrator x10 input' },
      ],
      initialState: 0,
      rate: 1,
    });
  }

  for (let index = 1; index <= 4; index += 1) {
    components.push({ id: `INV${index}`, type: 'inverter', label: `Inverter ${index}` });
  }

  for (let index = 1; index <= 4; index += 1) {
    components.push({
      id: `SUM${index}`,
      type: 'summer',
      label: `Summer ${index}`,
      inputs: [
        ...weightedInputNames('in', 4, 1),
        ...weightedInputNames('in10_', 3, 10),
      ],
      hasFeedbackJack: true,
    });
  }

  for (let index = 1; index <= 8; index += 1) {
    components.push({ id: `P${index}`, type: 'potentiometer', label: `Coefficient potentiometer ${index}`, coefficient });
  }

  for (let index = 1; index <= 2; index += 1) {
    components.push({ id: `MUL${index}`, type: 'multiplier', label: `Multiplier ${index}` });
  }

  for (let index = 1; index <= 2; index += 1) {
    components.push({ id: `CMP${index}`, type: 'comparator', label: `Comparator ${index}` });
  }

  for (let index = 1; index <= 2; index += 1) {
    components.push({
      id: `XIR${index}`,
      type: 'xir',
      label: `XIR resistor network ${index}`,
      inputs: [
        ...weightedInputNames('in', 4, 1),
        ...weightedInputNames('in10_', 3, 10),
      ],
    });
  }

  for (let index = 1; index <= 4; index += 1) {
    components.push({ id: `D${index}`, type: 'diode', label: `Diode ${index}`, forwardDrop: 0 });
  }

  for (let index = 1; index <= 2; index += 1) {
    components.push({ id: `ZD${index}`, type: 'z-diode', label: `Z-diode ${index}`, zenerVoltage: 0.68, mode: 'positive-overdrive' });
  }

  for (let index = 1; index <= 5; index += 1) {
    components.push({ id: `CAP${index}`, type: 'capacitor', label: `Capacitor ${index}`, initialState: 0, rate: 1 });
  }

  for (const id of ['X', 'Y', 'Z', 'U']) {
    components.push({ id: `OUT_${id}`, type: 'output', label: id });
  }

  return new BoardInventory({
    name: 'THAT prototype board inventory',
    description: 'Block-level component inventory for the implemented educational subset of The Analog Thing, including active blocks and idealized passive accessories.',
    components,
  });
}

module.exports = {
  BoardInventory,
  createThatPrototypeInventory,
};
