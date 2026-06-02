'use strict';

(function attachPhysicalSockets(globalScope) {
  const PHYSICAL_SOCKET_SCHEMA_VERSION = 'analog-thing-physical-sockets/v1';
  const DEFAULT_PANEL_REFERENCE_SVG = 'THAT_panel.svg';
  const DEFAULT_INVENTORY_NAME = 'that-prototype-board/v006';

  function clonePlain(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function makeSocket(def) {
    if (!def || typeof def.id !== 'string' || !def.id.trim()) throw new Error('physical socket requires id');
    if (!def.group) throw new Error(`physical socket ${def.id} requires group`);
    if (!Number.isFinite(Number(def.x)) || !Number.isFinite(Number(def.y))) throw new Error(`physical socket ${def.id} requires finite x/y`);
    const logicalSocketId = def.logicalSocketId || null;
    const direction = def.direction || null;
    const displayOnly = Boolean(def.displayOnly || !logicalSocketId || !direction);
    return {
      id: def.id,
      group: def.group,
      label: def.label || '',
      shape: def.shape || 'round-jack',
      x: Number(def.x),
      y: Number(def.y),
      position: { x: Number(def.x), y: Number(def.y) },
      direction,
      logicalSocketId,
      componentId: def.componentId || (logicalSocketId ? logicalSocketId.split('.')[0] : null),
      socketName: def.socketName || (logicalSocketId ? logicalSocketId.split('.')[1] : null),
      role: def.role || '',
      active: !displayOnly,
      displayOnly,
      unsupported: Boolean(def.unsupported),
      accessoryId: def.accessoryId || null,
      accessoryType: def.accessoryType || null,
      terminal: def.terminal || null,
      value: def.value || null,
      valueFarads: def.valueFarads === undefined ? null : def.valueFarads,
      polarity: def.polarity || null,
      runtimeSupport: def.runtimeSupport || null,
      multiplicity: def.multiplicity || null,
      notes: def.notes || '',
    };
  }

  function withMultiplicity(sockets) {
    const groups = new Map();
    for (const socket of sockets) {
      if (!socket.logicalSocketId) continue;
      const key = `${socket.logicalSocketId}|${socket.direction}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(socket);
    }
    for (const entries of groups.values()) {
      entries.forEach((socket, index) => {
        socket.multiplicity = {
          logicalSocketId: socket.logicalSocketId,
          index: index + 1,
          count: entries.length,
        };
      });
    }
    return sockets;
  }

  function active(id, group, label, x, y, direction, logicalSocketId, options = {}) {
    return makeSocket(Object.assign({}, options, { id, group, label, x, y, direction, logicalSocketId }));
  }

  function display(id, group, label, x, y, options = {}) {
    return makeSocket(Object.assign({ unsupported: true, displayOnly: true }, options, { id, group, label, x, y }));
  }

  const PANEL_WIDTH = 702.65399;
  const PANEL_HEIGHT = 514.23199;
  const PANEL_VIEW_BOX = Object.freeze({ x: 0, y: 0, width: PANEL_WIDTH, height: PANEL_HEIGHT });
  const SVG_SOCKET_ROWS = Object.freeze([
  [
    {
      "x": 26.73155,
      "y": 38.44876
    },
    {
      "x": 61.51393,
      "y": 38.63166
    },
    {
      "x": 109.53171,
      "y": 38.24612
    },
    {
      "x": 147.44156,
      "y": 38.24612
    },
    {
      "x": 184.8439,
      "y": 38.3681
    },
    {
      "x": 232.48316,
      "y": 38.38678
    },
    {
      "x": 270.39023,
      "y": 38.38678
    },
    {
      "x": 307.73959,
      "y": 38.54955
    },
    {
      "x": 355.42189,
      "y": 38.44412
    },
    {
      "x": 393.32857,
      "y": 38.44412
    },
    {
      "x": 431.00135,
      "y": 38.44412
    },
    {
      "x": 478.37957,
      "y": 38.44717
    },
    {
      "x": 516.2824,
      "y": 38.44717
    },
    {
      "x": 553.69375,
      "y": 38.60981
    },
    {
      "x": 601.36783,
      "y": 38.45604
    },
    {
      "x": 639.26113,
      "y": 38.45604
    },
    {
      "x": 676.79287,
      "y": 38.61868
    }
  ],
  [
    {
      "x": 26.73155,
      "y": 76.24511
    },
    {
      "x": 61.51393,
      "y": 76.42815
    },
    {
      "x": 109.53171,
      "y": 76.15638
    },
    {
      "x": 147.44156,
      "y": 76.15638
    },
    {
      "x": 184.8439,
      "y": 76.27836
    },
    {
      "x": 232.48316,
      "y": 76.18061
    },
    {
      "x": 270.39023,
      "y": 76.18061
    },
    {
      "x": 307.73959,
      "y": 76.34325
    },
    {
      "x": 355.42189,
      "y": 76.26048
    },
    {
      "x": 393.32857,
      "y": 76.26048
    },
    {
      "x": 430.7574,
      "y": 76.42311
    },
    {
      "x": 478.37957,
      "y": 76.2569
    },
    {
      "x": 516.2824,
      "y": 76.2569
    },
    {
      "x": 553.69361,
      "y": 76.41954
    },
    {
      "x": 601.36783,
      "y": 76.29849
    },
    {
      "x": 639.26113,
      "y": 76.29849
    },
    {
      "x": 676.79287,
      "y": 76.46112
    }
  ],
  [
    {
      "x": 26.73155,
      "y": 114.14066
    },
    {
      "x": 61.51393,
      "y": 114.32357
    },
    {
      "x": 109.53171,
      "y": 113.93922
    },
    {
      "x": 147.44156,
      "y": 113.93922
    },
    {
      "x": 185.23209,
      "y": 113.93922
    },
    {
      "x": 232.48316,
      "y": 114.07842
    },
    {
      "x": 270.39023,
      "y": 114.07842
    },
    {
      "x": 308.18287,
      "y": 114.07842
    },
    {
      "x": 355.42189,
      "y": 114.09775
    },
    {
      "x": 393.32857,
      "y": 114.09775
    },
    {
      "x": 431.32663,
      "y": 114.09775
    },
    {
      "x": 478.37957,
      "y": 114.13921
    },
    {
      "x": 516.2824,
      "y": 114.13921
    },
    {
      "x": 554.07902,
      "y": 114.13921
    },
    {
      "x": 601.36783,
      "y": 114.14808
    },
    {
      "x": 639.26113,
      "y": 114.14808
    },
    {
      "x": 677.06755,
      "y": 114.14808
    }
  ],
  [
    {
      "x": 26.73155,
      "y": 151.93967
    },
    {
      "x": 61.51393,
      "y": 152.1227
    },
    {
      "x": 109.53171,
      "y": 151.7561
    },
    {
      "x": 147.44156,
      "y": 151.7561
    },
    {
      "x": 185.23209,
      "y": 151.7561
    },
    {
      "x": 232.48316,
      "y": 151.87768
    },
    {
      "x": 270.39023,
      "y": 151.87768
    },
    {
      "x": 308.18287,
      "y": 151.87768
    },
    {
      "x": 355.42189,
      "y": 151.94947
    },
    {
      "x": 393.32857,
      "y": 151.94947
    },
    {
      "x": 431.32663,
      "y": 151.94947
    },
    {
      "x": 478.37957,
      "y": 151.96218
    },
    {
      "x": 516.2824,
      "y": 151.96218
    },
    {
      "x": 554.07902,
      "y": 151.96218
    },
    {
      "x": 601.36783,
      "y": 152.01489
    },
    {
      "x": 639.26113,
      "y": 152.01489
    },
    {
      "x": 677.06755,
      "y": 152.01489
    }
  ],
  [
    {
      "x": 26.73155,
      "y": 212.96463
    },
    {
      "x": 61.41222,
      "y": 213.12726
    },
    {
      "x": 109.49078,
      "y": 212.98198
    },
    {
      "x": 147.32038,
      "y": 212.98198
    },
    {
      "x": 184.88456,
      "y": 213.14461
    },
    {
      "x": 232.46832,
      "y": 212.87947
    },
    {
      "x": 270.29779,
      "y": 212.87947
    },
    {
      "x": 307.73959,
      "y": 213.04224
    },
    {
      "x": 355.4452,
      "y": 213.02621
    },
    {
      "x": 393.2748,
      "y": 213.02621
    },
    {
      "x": 430.83871,
      "y": 213.18885
    },
    {
      "x": 478.42221,
      "y": 212.96754
    },
    {
      "x": 516.25168,
      "y": 212.96754
    },
    {
      "x": 553.77507,
      "y": 213.08952
    },
    {
      "x": 601.37168,
      "y": 214.08323
    },
    {
      "x": 639.22339,
      "y": 214.08323
    },
    {
      "x": 676.71155,
      "y": 214.24586
    }
  ],
  [
    {
      "x": 26.73155,
      "y": 250.89991
    },
    {
      "x": 61.41222,
      "y": 251.06255
    },
    {
      "x": 109.49078,
      "y": 250.78734
    },
    {
      "x": 147.32038,
      "y": 250.78734
    },
    {
      "x": 184.88456,
      "y": 250.94997
    },
    {
      "x": 232.46832,
      "y": 250.67834
    },
    {
      "x": 270.29779,
      "y": 250.67834
    },
    {
      "x": 307.73959,
      "y": 250.84097
    },
    {
      "x": 355.4452,
      "y": 250.82257
    },
    {
      "x": 393.2748,
      "y": 250.82257
    },
    {
      "x": 430.83871,
      "y": 250.9852
    },
    {
      "x": 478.42221,
      "y": 250.75807
    },
    {
      "x": 516.25168,
      "y": 250.75807
    },
    {
      "x": 553.77507,
      "y": 250.88004
    },
    {
      "x": 601.37168,
      "y": 251.86753
    },
    {
      "x": 639.22339,
      "y": 251.86753
    },
    {
      "x": 676.71155,
      "y": 252.03016
    }
  ],
  [
    {
      "x": 26.73155,
      "y": 288.56647
    },
    {
      "x": 61.41222,
      "y": 288.72911
    },
    {
      "x": 109.49078,
      "y": 288.80116
    },
    {
      "x": 147.32038,
      "y": 288.80116
    },
    {
      "x": 185.28904,
      "y": 288.80116
    },
    {
      "x": 232.46832,
      "y": 288.72037
    },
    {
      "x": 270.29779,
      "y": 288.72037
    },
    {
      "x": 308.24962,
      "y": 288.72037
    },
    {
      "x": 355.4452,
      "y": 288.57945
    },
    {
      "x": 393.2748,
      "y": 288.57945
    },
    {
      "x": 431.21048,
      "y": 288.57945
    },
    {
      "x": 478.42221,
      "y": 288.51455
    },
    {
      "x": 516.25168,
      "y": 288.51455
    },
    {
      "x": 554.17093,
      "y": 288.51455
    },
    {
      "x": 601.37168,
      "y": 289.97697
    },
    {
      "x": 639.22339,
      "y": 289.97697
    },
    {
      "x": 676.71155,
      "y": 290.13961
    }
  ],
  [
    {
      "x": 26.73155,
      "y": 326.52189
    },
    {
      "x": 61.41222,
      "y": 326.68452
    },
    {
      "x": 109.49078,
      "y": 326.53765
    },
    {
      "x": 147.32038,
      "y": 326.53765
    },
    {
      "x": 185.28904,
      "y": 326.53765
    },
    {
      "x": 232.46832,
      "y": 326.44745
    },
    {
      "x": 270.29779,
      "y": 326.44745
    },
    {
      "x": 308.24962,
      "y": 326.44745
    },
    {
      "x": 355.4452,
      "y": 326.50613
    },
    {
      "x": 393.2748,
      "y": 326.50613
    },
    {
      "x": 431.21048,
      "y": 326.50613
    },
    {
      "x": 478.42221,
      "y": 326.39951
    },
    {
      "x": 516.25168,
      "y": 326.39951
    },
    {
      "x": 554.17093,
      "y": 326.39951
    },
    {
      "x": 601.37168,
      "y": 327.71465
    },
    {
      "x": 639.22339,
      "y": 327.71465
    },
    {
      "x": 676.71155,
      "y": 327.87729
    }
  ],
  [
    {
      "x": 25.65401,
      "y": 390.48598
    },
    {
      "x": 61.92185,
      "y": 390.48598
    },
    {
      "x": 109.5272,
      "y": 390.41235
    },
    {
      "x": 147.39521,
      "y": 390.41235
    },
    {
      "x": 184.72192,
      "y": 390.57512
    },
    {
      "x": 232.51786,
      "y": 390.35791
    },
    {
      "x": 270.33765,
      "y": 390.35791
    },
    {
      "x": 307.78025,
      "y": 390.602
    },
    {
      "x": 355.62029,
      "y": 390.28891
    },
    {
      "x": 393.29983,
      "y": 390.28891
    },
    {
      "x": 430.83871,
      "y": 390.45155
    },
    {
      "x": 478.46843,
      "y": 390.38851
    },
    {
      "x": 516.27088,
      "y": 390.38851
    },
    {
      "x": 554.11438,
      "y": 390.38851
    },
    {
      "x": 601.42028,
      "y": 390.39818
    },
    {
      "x": 639.24272,
      "y": 390.39818
    },
    {
      "x": 677.07656,
      "y": 390.39818
    }
  ],
  [
    {
      "x": 25.65401,
      "y": 428.30816
    },
    {
      "x": 61.92185,
      "y": 428.30816
    },
    {
      "x": 109.5272,
      "y": 428.27823
    },
    {
      "x": 147.39521,
      "y": 428.27823
    },
    {
      "x": 184.72192,
      "y": 428.44087
    },
    {
      "x": 232.51786,
      "y": 428.2238
    },
    {
      "x": 270.33765,
      "y": 428.2238
    },
    {
      "x": 307.78025,
      "y": 428.46789
    },
    {
      "x": 355.62029,
      "y": 428.15639
    },
    {
      "x": 393.29983,
      "y": 428.15639
    },
    {
      "x": 430.83871,
      "y": 428.31902
    },
    {
      "x": 478.46843,
      "y": 428.16566
    },
    {
      "x": 516.27088,
      "y": 428.16566
    },
    {
      "x": 554.11438,
      "y": 428.16566
    },
    {
      "x": 601.42028,
      "y": 428.17652
    },
    {
      "x": 639.24272,
      "y": 428.17652
    },
    {
      "x": 677.07656,
      "y": 428.17652
    }
  ],
  [
    {
      "x": 9.90793,
      "y": 477.29051
    },
    {
      "x": 64.67027,
      "y": 477.29051
    },
    {
      "x": 119.43315,
      "y": 477.29051
    },
    {
      "x": 174.19549,
      "y": 477.29051
    },
    {
      "x": 228.95836,
      "y": 477.29051
    },
    {
      "x": 283.72058,
      "y": 477.29051
    },
    {
      "x": 338.48358,
      "y": 477.29051
    },
    {
      "x": 393.24579,
      "y": 477.29051
    },
    {
      "x": 448.0088,
      "y": 477.29051
    },
    {
      "x": 502.77101,
      "y": 477.29051
    },
    {
      "x": 557.53401,
      "y": 477.29051
    },
    {
      "x": 612.29623,
      "y": 477.29051
    },
    {
      "x": 667.0591,
      "y": 477.29051
    }
  ],
  [
    {
      "x": 34.86728,
      "y": 504.85789
    },
    {
      "x": 89.63029,
      "y": 504.85789
    },
    {
      "x": 144.3925,
      "y": 504.85789
    },
    {
      "x": 199.1555,
      "y": 504.85789
    },
    {
      "x": 253.91772,
      "y": 504.85789
    },
    {
      "x": 308.68072,
      "y": 504.85789
    },
    {
      "x": 363.44293,
      "y": 504.85789
    },
    {
      "x": 418.2058,
      "y": 504.85789
    },
    {
      "x": 472.96881,
      "y": 504.85789
    },
    {
      "x": 527.73102,
      "y": 504.85789
    },
    {
      "x": 582.49403,
      "y": 504.85789
    },
    {
      "x": 637.25624,
      "y": 504.85789
    },
    {
      "x": 692.01924,
      "y": 504.85789
    }
  ]
]);

  function panelPoint(rowIndex, columnIndex) {
    const row = SVG_SOCKET_ROWS[rowIndex];
    if (!row || !row[columnIndex]) throw new Error(`missing SVG panel coordinate row ${rowIndex} column ${columnIndex}`);
    return row[columnIndex];
  }

  function pushActiveAt(sockets, row, column, id, group, label, direction, logicalSocketId, options = {}) {
    const point = panelPoint(row, column);
    sockets.push(active(id, group, label, point.x, point.y, direction, logicalSocketId, options));
  }

  function pushDisplayAt(sockets, row, column, id, group, label, options = {}) {
    const point = panelPoint(row, column);
    sockets.push(display(id, group, label, point.x, point.y, options));
  }

  function coefficientSockets(sockets) {
    const rows = [0, 1, 2, 3, 4, 5, 6, 7];
    rows.forEach((row, index) => {
      const n = index + 1;
      pushActiveAt(sockets, row, 0, `phys.p${n}.in`, 'COEFF', `${n} input`, 'input', `P${n}.in`, { role: 'coefficient-input' });
      pushActiveAt(sockets, row, 1, `phys.p${n}.out`, 'COEFF', `${n} output`, 'output', `P${n}.out`, { role: 'coefficient-output' });
    });
  }

  function integratorSockets(sockets) {
    for (let index = 0; index < 5; index += 1) {
      const id = `I${index + 1}`;
      const prefix = `phys.${id.toLowerCase()}`;
      const base = 2 + index * 3;
      pushActiveAt(sockets, 0, base, `${prefix}.in1.top`, 'INTEGRATORS', '1', 'input', `${id}.in1`, { role: 'integrator-x1' });
      pushActiveAt(sockets, 0, base + 1, `${prefix}.in10.top`, 'INTEGRATORS', '10', 'input', `${id}.in10`, { role: 'integrator-x10' });
      pushActiveAt(sockets, 0, base + 2, `${prefix}.out.top`, 'INTEGRATORS', 'OUT', 'output', `${id}.out`, { role: 'integrator-output' });
      pushActiveAt(sockets, 1, base, `${prefix}.in1.mid`, 'INTEGRATORS', '1', 'input', `${id}.in1`, { role: 'integrator-x1' });
      pushActiveAt(sockets, 1, base + 1, `${prefix}.in10.mid`, 'INTEGRATORS', '10', 'input', `${id}.in10`, { role: 'integrator-x10' });
      pushActiveAt(sockets, 1, base + 2, `${prefix}.out.mid`, 'INTEGRATORS', 'OUT', 'output', `${id}.out`, { role: 'integrator-output' });
      pushActiveAt(sockets, 2, base, `${prefix}.in1.sjrow`, 'INTEGRATORS', '1', 'input', `${id}.in1`, { role: 'integrator-x1' });
      pushActiveAt(sockets, 2, base + 1, `${prefix}.sj`, 'INTEGRATORS', 'SJ', 'input', `${id}.sj`, { role: 'summing-junction' });
      pushActiveAt(sockets, 2, base + 2, `${prefix}.ic`, 'INTEGRATORS', 'IC', 'input', `${id}.ic`, { role: 'initial-condition' });
      pushActiveAt(sockets, 3, base, `${prefix}.minus1`, 'INTEGRATORS', '-1', 'output', 'MINUS1.out', { role: 'machine-unit-source' });
      pushActiveAt(sockets, 3, base + 1, `${prefix}.slow`, 'INTEGRATORS', 'SLOW', 'input', `${id}.slow`, { role: 'slow-control' });
      pushActiveAt(sockets, 3, base + 2, `${prefix}.plus1`, 'INTEGRATORS', '+1', 'output', 'PLUS1.out', { role: 'machine-unit-source' });
    }
  }

  function summerSockets(sockets) {
    for (let index = 0; index < 4; index += 1) {
      const id = `SUM${index + 1}`;
      const prefix = `phys.${id.toLowerCase()}`;
      const base = 2 + index * 3;
      pushActiveAt(sockets, 4, base, `${prefix}.in1`, 'SUMMERS', '1', 'input', `${id}.in1`, { role: 'summer-x1' });
      pushActiveAt(sockets, 4, base + 1, `${prefix}.in10.1`, 'SUMMERS', '10', 'input', `${id}.in10_1`, { role: 'summer-x10' });
      pushActiveAt(sockets, 4, base + 2, `${prefix}.out.top`, 'SUMMERS', 'OUT', 'output', `${id}.out`, { role: 'summer-output' });
      pushActiveAt(sockets, 5, base, `${prefix}.in2`, 'SUMMERS', '1', 'input', `${id}.in2`, { role: 'summer-x1' });
      pushActiveAt(sockets, 5, base + 1, `${prefix}.in10.2`, 'SUMMERS', '10', 'input', `${id}.in10_2`, { role: 'summer-x10' });
      pushActiveAt(sockets, 5, base + 2, `${prefix}.out.mid`, 'SUMMERS', 'OUT', 'output', `${id}.out`, { role: 'summer-output' });
      pushActiveAt(sockets, 6, base, `${prefix}.in3`, 'SUMMERS', '1', 'input', `${id}.in3`, { role: 'summer-x1' });
      pushActiveAt(sockets, 6, base + 1, `${prefix}.in10.3`, 'SUMMERS', '10', 'input', `${id}.in10_3`, { role: 'summer-x10' });
      pushActiveAt(sockets, 6, base + 2, `${prefix}.fb`, 'SUMMERS', 'FB', 'input', `${id}.fb`, { role: 'feedback-control', accessoryId: `${id}.feedback`, accessoryType: 'feedback', terminal: 'fb', runtimeSupport: 'direct-runtime-socket', notes: 'active panel FB jack; connect to the neighboring ground jack to approximate open-amplifier operation' });
      pushActiveAt(sockets, 7, base, `${prefix}.in4`, 'SUMMERS', '1', 'input', `${id}.in4`, { role: 'summer-x1' });
      pushActiveAt(sockets, 7, base + 1, `${prefix}.sj`, 'SUMMERS', 'SJ', 'input', `${id}.sj`, { role: 'summing-junction' });
      pushActiveAt(sockets, 7, base + 2, `${prefix}.t`, 'SUMMERS', 'T', 'output', 'ZERO.out', { role: 'ground-source', accessoryId: `${id}.groundTie`, accessoryType: 'ground-tie', terminal: 't', runtimeSupport: 'direct-runtime-socket', notes: 'active panel ground jack for FB-to-ground and other zero-reference patching' });
    }
  }

  function inverterSockets(sockets) {
    [4, 5, 6, 7].forEach((row, index) => {
      const id = `INV${index + 1}`;
      const prefix = `phys.${id.toLowerCase()}`;
      pushActiveAt(sockets, row, 14, `${prefix}.sj`, 'INVERTERS', 'SJ', 'input', `${id}.sj`, { role: 'summing-junction' });
      pushActiveAt(sockets, row, 15, `${prefix}.in`, 'INVERTERS', '1', 'input', `${id}.in`, { role: 'inverter-input' });
      pushActiveAt(sockets, row, 16, `${prefix}.out`, 'INVERTERS', 'OUT', 'output', `${id}.out`, { role: 'inverter-output' });
    });
  }

  function machineUnitSockets(sockets) {
    pushActiveAt(sockets, 8, 0, 'phys.minus1.out.a', '-1/+1', '-1', 'output', 'MINUS1.out', { role: 'machine-unit-source' });
    pushActiveAt(sockets, 8, 1, 'phys.plus1.out.a', '-1/+1', '+1', 'output', 'PLUS1.out', { role: 'machine-unit-source' });
    pushActiveAt(sockets, 9, 0, 'phys.minus1.out.b', '-1/+1', '-1', 'output', 'MINUS1.out', { role: 'machine-unit-source' });
    const lowerMinus = panelPoint(9, 0);
    const lowerPlus = panelPoint(9, 1);
    sockets.push(active('phys.zero.out.hidden', '-1/+1', '0', (lowerMinus.x + lowerPlus.x) / 2, lowerMinus.y, 'output', 'ZERO.out', { role: 'hidden-zero-source', notes: 'hidden compatibility source used by saved quickstart designs for an explicit zero initial condition' }));
    pushActiveAt(sockets, 9, 1, 'phys.plus1.out.b', '-1/+1', '+1', 'output', 'PLUS1.out', { role: 'machine-unit-source' });
  }

  function multiplierSockets(sockets) {
    [8, 9].forEach((row, index) => {
      const id = `MUL${index + 1}`;
      const prefix = `phys.${id.toLowerCase()}`;
      pushActiveAt(sockets, row, 2, `${prefix}.x`, 'MULTIPLIERS', 'X', 'input', `${id}.x`, { role: 'multiplier-x' });
      pushActiveAt(sockets, row, 3, `${prefix}.y`, 'MULTIPLIERS', 'Y', 'input', `${id}.y`, { role: 'multiplier-y' });
      pushActiveAt(sockets, row, 4, `${prefix}.out`, 'MULTIPLIERS', 'OUT', 'output', `${id}.out`, { role: 'multiplier-output' });
    });
  }

  function comparatorSockets(sockets) {
    [
      { id: 'CMP1', base: 5 },
      { id: 'CMP2', base: 8 },
    ].forEach((cmp) => {
      const prefix = `phys.${cmp.id.toLowerCase()}`;
      pushActiveAt(sockets, 8, cmp.base, `${prefix}.a`, 'COMPARATORS', 'A', 'input', `${cmp.id}.a`, { role: 'comparator-sign-input' });
      pushActiveAt(sockets, 8, cmp.base + 1, `${prefix}.gt`, 'COMPARATORS', '>0', 'input', `${cmp.id}.positive`, { role: 'comparator-positive-input' });
      pushActiveAt(sockets, 8, cmp.base + 2, `${prefix}.out.gt`, 'COMPARATORS', 'OUT', 'output', `${cmp.id}.out`, { role: 'comparator-output' });
      pushActiveAt(sockets, 9, cmp.base, `${prefix}.b`, 'COMPARATORS', 'B', 'input', `${cmp.id}.b`, { role: 'comparator-sign-input' });
      pushActiveAt(sockets, 9, cmp.base + 1, `${prefix}.lt`, 'COMPARATORS', '<0', 'input', `${cmp.id}.nonPositive`, { role: 'comparator-nonpositive-input' });
      pushActiveAt(sockets, 9, cmp.base + 2, `${prefix}.out.lt`, 'COMPARATORS', 'OUT', 'output', `${cmp.id}.out`, { role: 'comparator-output' });
    });
  }

  function xirSockets(sockets) {
    [
      { id: 'XIR1', base: 11 },
      { id: 'XIR2', base: 14 },
    ].forEach((row) => {
      const prefix = `phys.${row.id.toLowerCase()}`;
      pushActiveAt(sockets, 8, row.base, `${prefix}.sj`, 'XIR', 'SJ', 'output', `${row.id}.out`, { role: 'xir-summing-junction-output' });
      pushActiveAt(sockets, 8, row.base + 1, `${prefix}.in1.top`, 'XIR', '1', 'input', `${row.id}.in1`, { role: 'xir-x1' });
      pushActiveAt(sockets, 8, row.base + 2, `${prefix}.in10.top`, 'XIR', '10', 'input', `${row.id}.in10_1`, { role: 'xir-x10' });
      pushActiveAt(sockets, 9, row.base, `${prefix}.in0.1`, 'XIR', '0.1', 'input', `${row.id}.in2`, { role: 'xir-approx-x0.1' });
      pushActiveAt(sockets, 9, row.base + 1, `${prefix}.in1.bottom`, 'XIR', '1', 'input', `${row.id}.in3`, { role: 'xir-x1' });
      pushActiveAt(sockets, 9, row.base + 2, `${prefix}.in10.bottom`, 'XIR', '10', 'input', `${row.id}.in10_2`, { role: 'xir-x10' });
    });
  }

  function accessorySockets(sockets) {
    ['100p', '100p', '100p', '100n', '100n'].forEach((value, index) => {
      const n = index + 1;
      pushDisplayAt(sockets, 10, index, `phys.cap${n}.a`, 'CAPACITORS', `${value} A`, { role: 'capacitor-terminal', accessoryId: `CAP${n}`, accessoryType: 'capacitor', terminal: 'a', value, runtimeSupport: 'unsupported-two-terminal-panel-accessory' });
      pushDisplayAt(sockets, 11, index, `phys.cap${n}.b`, 'CAPACITORS', `${value} B`, { role: 'capacitor-terminal', accessoryId: `CAP${n}`, accessoryType: 'capacitor', terminal: 'b', value, runtimeSupport: 'unsupported-two-terminal-panel-accessory' });
    });
    [0, 1, 2, 3].forEach((_, index) => {
      const n = index + 1;
      pushDisplayAt(sockets, 10, 5 + index, `phys.diode${n}.a`, 'DIODES', `diode ${n} A`, { role: 'diode-terminal', accessoryId: `DIODE${n}`, accessoryType: 'diode', terminal: 'a', polarity: 'anode', runtimeSupport: 'unsupported-two-terminal-panel-accessory' });
      pushDisplayAt(sockets, 11, 5 + index, `phys.diode${n}.b`, 'DIODES', `diode ${n} B`, { role: 'diode-terminal', accessoryId: `DIODE${n}`, accessoryType: 'diode', terminal: 'b', polarity: 'cathode', runtimeSupport: 'unsupported-two-terminal-panel-accessory' });
    });
    [0, 1].forEach((_, index) => {
      const n = index + 1;
      pushDisplayAt(sockets, 10, 9 + index, `phys.zdiode${n}.a`, 'Z-DIODES', `Z-diode ${n} A`, { role: 'z-diode-terminal', accessoryId: `ZDIODE${n}`, accessoryType: 'z-diode', terminal: 'a', polarity: 'anode', runtimeSupport: 'unsupported-two-terminal-panel-accessory' });
      pushDisplayAt(sockets, 11, 9 + index, `phys.zdiode${n}.b`, 'Z-DIODES', `Z-diode ${n} B`, { role: 'z-diode-terminal', accessoryId: `ZDIODE${n}`, accessoryType: 'z-diode', terminal: 'b', polarity: 'cathode', runtimeSupport: 'unsupported-two-terminal-panel-accessory' });
    });
  }

  function outputSockets(sockets) {
    [
      { channel: 'X', row: 10, column: 11 },
      { channel: 'Y', row: 11, column: 11 },
      { channel: 'Z', row: 10, column: 12 },
      { channel: 'U', row: 11, column: 12 },
    ].forEach((out) => {
      pushActiveAt(sockets, out.row, out.column, `phys.out.${out.channel.toLowerCase()}`, 'OUT', out.channel, 'input', `OUT_${out.channel}.in`, { role: 'scope-output-input', notes: `visible ${out.channel} panel output jack; runtime samples OUT_${out.channel}.out after the output component` });
    });
  }

  function createThatPhysicalSocketMap(options = {}) {
    const sockets = [];
    coefficientSockets(sockets);
    integratorSockets(sockets);
    summerSockets(sockets);
    inverterSockets(sockets);
    machineUnitSockets(sockets);
    multiplierSockets(sockets);
    comparatorSockets(sockets);
    xirSockets(sockets);
    accessorySockets(sockets);
    outputSockets(sockets);
    return {
      schemaVersion: PHYSICAL_SOCKET_SCHEMA_VERSION,
      inventory: options.inventory || DEFAULT_INVENTORY_NAME,
      panel: {
        name: 'The Analog Thing uploaded SVG reference panel',
        referenceSvg: options.referenceSvg || DEFAULT_PANEL_REFERENCE_SVG,
        width: PANEL_WIDTH,
        height: PANEL_HEIGHT,
        viewBox: clonePlain(PANEL_VIEW_BOX),
      },
      sockets: withMultiplicity(sockets),
    };
  }

  function normalizePhysicalSocketMap(socketMap) {
    const map = socketMap || createThatPhysicalSocketMap();
    if (!map || typeof map !== 'object') throw new Error('physical socket map must be an object');
    if (map.schemaVersion && map.schemaVersion !== PHYSICAL_SOCKET_SCHEMA_VERSION) throw new Error(`unsupported physical socket schemaVersion: ${map.schemaVersion}`);
    const sockets = (map.sockets || []).map(makeSocket);
    return Object.assign({}, clonePlain(map), { schemaVersion: PHYSICAL_SOCKET_SCHEMA_VERSION, sockets: withMultiplicity(sockets) });
  }

  function listPhysicalSockets(socketMap) {
    return normalizePhysicalSocketMap(socketMap).sockets.map(clonePlain);
  }

  function physicalSocketById(socketMap, physicalSocketId) {
    const id = String(physicalSocketId || '').trim();
    return listPhysicalSockets(socketMap).find((socket) => socket.id === id) || null;
  }

  function physicalSocketsByLogicalSocketId(socketMap, logicalSocketId) {
    const id = String(logicalSocketId || '').trim();
    return listPhysicalSockets(socketMap).filter((socket) => socket.logicalSocketId === id);
  }

  function logicalSocketIdFromPhysical(physicalSocketId, options = {}) {
    const socket = physicalSocketById(options.socketMap || options.physicalSocketMap, physicalSocketId);
    if (!socket) throw new Error(`unknown physical socket ${physicalSocketId}`);
    if (socket.displayOnly || socket.unsupported || !socket.logicalSocketId) {
      throw new Error(`physical socket ${physicalSocketId} is display-only or unsupported and has no executable logical socket`);
    }
    return socket.logicalSocketId;
  }

  function machineUnitSocketPreferenceRank(socket) {
    if (!socket) return 1000;
    const id = String(socket.id || '');
    const group = String(socket.group || '');
    if (group === '-1/+1') {
      if (/\.out\.a$/.test(id)) return 0;
      if (/\.out\.b$/.test(id)) return 1;
      return 2;
    }
    if (group === 'INTEGRATORS') return 10;
    return 20;
  }

  function preferredPhysicalSocketsForLogical(socketMap, logicalSocketId, direction) {
    const id = String(logicalSocketId || '').trim();
    const candidates = physicalSocketsByLogicalSocketId(socketMap, id).filter((socket) => !direction || socket.direction === direction);
    if (!/^(PLUS1|MINUS1)\.out$/.test(id)) return candidates;
    return candidates.slice().sort((a, b) => (machineUnitSocketPreferenceRank(a) - machineUnitSocketPreferenceRank(b)) || String(a.id).localeCompare(String(b.id)));
  }

  function physicalSocketForLogical(socketMap, logicalSocketId, direction) {
    const candidates = preferredPhysicalSocketsForLogical(socketMap, logicalSocketId, direction);
    return candidates.length ? clonePlain(candidates[0]) : null;
  }

  function physicalEndpointForLogical(socketMap, logicalSocketId, direction) {
    const socket = physicalSocketForLogical(socketMap, logicalSocketId, direction);
    return socket ? { logicalSocketId, physicalSocketId: socket.id } : { logicalSocketId, physicalSocketId: null };
  }

  function physicalizeDesignCables(design, options = {}) {
    const socketMap = options.socketMap || options.physicalSocketMap || createThatPhysicalSocketMap();
    const next = clonePlain(design);
    next.cables = (next.cables || []).map((cable, index) => {
      const copy = clonePlain(cable);
      if (copy.from && copy.from.logicalSocketId && !copy.from.physicalSocketId) copy.from = physicalEndpointForLogical(socketMap, copy.from.logicalSocketId, 'output');
      if (copy.to && copy.to.logicalSocketId && !copy.to.physicalSocketId) copy.to = physicalEndpointForLogical(socketMap, copy.to.logicalSocketId, 'input');
      if (!copy.id) copy.id = `cable-${index + 1}`;
      return copy;
    });
    return next;
  }

  function validatePhysicalSocketMap(socketMap, options = {}) {
    const normalized = normalizePhysicalSocketMap(socketMap);
    const errors = [];
    const warnings = [];
    const ids = new Set();
    for (const socket of normalized.sockets) {
      if (ids.has(socket.id)) errors.push(`duplicate physical socket id ${socket.id}`);
      ids.add(socket.id);
      if (!socket.group) errors.push(`${socket.id}: missing group`);
      if (!socket.shape) errors.push(`${socket.id}: missing shape`);
      if (!Number.isFinite(socket.x) || !Number.isFinite(socket.y)) errors.push(`${socket.id}: missing finite coordinates`);
      if (socket.active && (!socket.logicalSocketId || !socket.direction)) errors.push(`${socket.id}: active socket needs logicalSocketId and direction`);
      if (!socket.active && socket.logicalSocketId) warnings.push(`${socket.id}: display-only socket carries a logicalSocketId`);
    }

    const logicalSockets = new Map();
    const metadata = options.logicalSockets || (options.inventory && typeof options.inventory.socketMetadata === 'function' ? options.inventory.socketMetadata() : []);
    for (const logical of metadata || []) logicalSockets.set(logical.id, logical);
    if (logicalSockets.size > 0) {
      for (const socket of normalized.sockets.filter((entry) => entry.active)) {
        const logical = logicalSockets.get(socket.logicalSocketId);
        if (!logical) {
          errors.push(`${socket.id}: logical socket ${socket.logicalSocketId} is not in inventory`);
        } else if (socket.direction !== logical.direction) {
          errors.push(`${socket.id}: physical direction ${socket.direction} does not match logical ${socket.logicalSocketId} direction ${logical.direction}`);
        }
      }
    }
    return {
      ok: errors.length === 0,
      errors,
      warnings,
      socketCount: normalized.sockets.length,
      activeSocketCount: normalized.sockets.filter((socket) => socket.active).length,
      displayOnlySocketCount: normalized.sockets.filter((socket) => socket.displayOnly || socket.unsupported).length,
    };
  }

  function summarizePhysicalSocketMap(socketMap, options = {}) {
    const normalized = normalizePhysicalSocketMap(socketMap);
    const validation = validatePhysicalSocketMap(normalized, options);
    const byGroup = {};
    const byDirection = {};
    for (const socket of normalized.sockets) {
      byGroup[socket.group] = (byGroup[socket.group] || 0) + 1;
      byDirection[socket.direction || 'display-only'] = (byDirection[socket.direction || 'display-only'] || 0) + 1;
    }
    const duplicates = Object.entries(normalized.sockets.reduce((acc, socket) => {
      if (socket.logicalSocketId) acc[socket.logicalSocketId] = (acc[socket.logicalSocketId] || 0) + 1;
      return acc;
    }, {})).filter((entry) => entry[1] > 1).length;
    return {
      schemaVersion: normalized.schemaVersion,
      inventory: normalized.inventory,
      referenceSvg: normalized.panel.referenceSvg,
      socketCount: normalized.sockets.length,
      activeSocketCount: validation.activeSocketCount,
      displayOnlySocketCount: validation.displayOnlySocketCount,
      duplicateLogicalSocketCount: duplicates,
      groups: byGroup,
      directions: byDirection,
      valid: validation.ok,
      validationErrors: validation.errors,
    };
  }

  const api = {
    PHYSICAL_SOCKET_SCHEMA_VERSION,
    createThatPhysicalSocketMap,
    normalizePhysicalSocketMap,
    listPhysicalSockets,
    physicalSocketById,
    physicalSocketsByLogicalSocketId,
    logicalSocketIdFromPhysical,
    preferredPhysicalSocketsForLogical,
    physicalSocketForLogical,
    physicalEndpointForLogical,
    physicalizeDesignCables,
    validatePhysicalSocketMap,
    summarizePhysicalSocketMap,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.AnalogThingPhysicalSockets = api;
}(typeof window !== 'undefined' ? window : global));
