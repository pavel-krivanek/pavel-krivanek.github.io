'use strict';

(function attachAdoptedPatchPanelConnectors(globalScope) {
  const ADOPTED_PANEL_CONNECTORS = Object.freeze(
[
    {
        "id": "coeff_01",
        "section": "COEFF",
        "x": 26.73155,
        "y": 38.44876,
        "radius": 4.48
    },
    {
        "id": "coeff_02",
        "section": "COEFF",
        "x": 61.51393,
        "y": 38.63166,
        "radius": 4
    },
    {
        "id": "coeff_03",
        "section": "COEFF",
        "x": 26.73155,
        "y": 76.24511,
        "radius": 4.48
    },
    {
        "id": "coeff_04",
        "section": "COEFF",
        "x": 61.51393,
        "y": 76.42815,
        "radius": 4
    },
    {
        "id": "coeff_05",
        "section": "COEFF",
        "x": 26.73155,
        "y": 114.14066,
        "radius": 4.48
    },
    {
        "id": "coeff_06",
        "section": "COEFF",
        "x": 61.51393,
        "y": 114.32357,
        "radius": 4
    },
    {
        "id": "coeff_07",
        "section": "COEFF",
        "x": 26.73155,
        "y": 151.93967,
        "radius": 4.48
    },
    {
        "id": "coeff_08",
        "section": "COEFF",
        "x": 61.51393,
        "y": 152.1227,
        "radius": 4
    },
    {
        "id": "coeff_09",
        "section": "COEFF",
        "x": 26.73155,
        "y": 212.96463,
        "radius": 4.48
    },
    {
        "id": "coeff_10",
        "section": "COEFF",
        "x": 61.41222,
        "y": 213.12726,
        "radius": 4
    },
    {
        "id": "coeff_11",
        "section": "COEFF",
        "x": 26.73155,
        "y": 250.89991,
        "radius": 4.48
    },
    {
        "id": "coeff_12",
        "section": "COEFF",
        "x": 61.41222,
        "y": 251.06255,
        "radius": 4
    },
    {
        "id": "coeff_13",
        "section": "COEFF",
        "x": 26.73155,
        "y": 288.56647,
        "radius": 4.48
    },
    {
        "id": "coeff_14",
        "section": "COEFF",
        "x": 61.41222,
        "y": 288.72911,
        "radius": 4
    },
    {
        "id": "coeff_15",
        "section": "COEFF",
        "x": 26.73155,
        "y": 326.52189,
        "radius": 4.48
    },
    {
        "id": "coeff_16",
        "section": "COEFF",
        "x": 61.41222,
        "y": 326.68452,
        "radius": 4
    },
    {
        "id": "integrator_01",
        "section": "INTEGRATORS",
        "x": 109.53171,
        "y": 38.24612,
        "radius": 4.48
    },
    {
        "id": "integrator_02",
        "section": "INTEGRATORS",
        "x": 147.44156,
        "y": 38.24612,
        "radius": 4.48
    },
    {
        "id": "integrator_03",
        "section": "INTEGRATORS",
        "x": 184.8439,
        "y": 38.3681,
        "radius": 4
    },
    {
        "id": "integrator_04",
        "section": "INTEGRATORS",
        "x": 109.53171,
        "y": 76.15638,
        "radius": 4.48
    },
    {
        "id": "integrator_05",
        "section": "INTEGRATORS",
        "x": 147.44156,
        "y": 76.15638,
        "radius": 4.48
    },
    {
        "id": "integrator_06",
        "section": "INTEGRATORS",
        "x": 184.8439,
        "y": 76.27836,
        "radius": 4
    },
    {
        "id": "integrator_07",
        "section": "INTEGRATORS",
        "x": 109.53171,
        "y": 113.93922,
        "radius": 4.48
    },
    {
        "id": "integrator_08",
        "section": "INTEGRATORS",
        "x": 147.44156,
        "y": 113.93922,
        "radius": 4.48
    },
    {
        "id": "integrator_09",
        "section": "INTEGRATORS",
        "x": 185.23209,
        "y": 113.93922,
        "radius": 4
    },
    {
        "id": "integrator_10",
        "section": "INTEGRATORS",
        "x": 109.53171,
        "y": 151.7561,
        "radius": 4.48
    },
    {
        "id": "integrator_11",
        "section": "INTEGRATORS",
        "x": 147.44156,
        "y": 151.7561,
        "radius": 4.48
    },
    {
        "id": "integrator_12",
        "section": "INTEGRATORS",
        "x": 185.23209,
        "y": 151.7561,
        "radius": 4
    },
    {
        "id": "integrator_13",
        "section": "INTEGRATORS",
        "x": 232.48316,
        "y": 38.38678,
        "radius": 4.48
    },
    {
        "id": "integrator_14",
        "section": "INTEGRATORS",
        "x": 270.39023,
        "y": 38.38678,
        "radius": 4.48
    },
    {
        "id": "integrator_15",
        "section": "INTEGRATORS",
        "x": 307.73959,
        "y": 38.54955,
        "radius": 4
    },
    {
        "id": "integrator_16",
        "section": "INTEGRATORS",
        "x": 232.48316,
        "y": 76.18061,
        "radius": 4.48
    },
    {
        "id": "integrator_17",
        "section": "INTEGRATORS",
        "x": 270.39023,
        "y": 76.18061,
        "radius": 4.48
    },
    {
        "id": "integrator_18",
        "section": "INTEGRATORS",
        "x": 307.73959,
        "y": 76.34325,
        "radius": 4
    },
    {
        "id": "integrator_19",
        "section": "INTEGRATORS",
        "x": 232.48316,
        "y": 114.07842,
        "radius": 4.48
    },
    {
        "id": "integrator_20",
        "section": "INTEGRATORS",
        "x": 270.39023,
        "y": 114.07842,
        "radius": 4.48
    },
    {
        "id": "integrator_21",
        "section": "INTEGRATORS",
        "x": 308.18287,
        "y": 114.07842,
        "radius": 4
    },
    {
        "id": "integrator_22",
        "section": "INTEGRATORS",
        "x": 232.48316,
        "y": 151.87768,
        "radius": 4.48
    },
    {
        "id": "integrator_23",
        "section": "INTEGRATORS",
        "x": 270.39023,
        "y": 151.87768,
        "radius": 4.48
    },
    {
        "id": "integrator_24",
        "section": "INTEGRATORS",
        "x": 308.18287,
        "y": 151.87768,
        "radius": 4
    },
    {
        "id": "integrator_25",
        "section": "INTEGRATORS",
        "x": 355.42189,
        "y": 38.44412,
        "radius": 4.48
    },
    {
        "id": "integrator_26",
        "section": "INTEGRATORS",
        "x": 393.32857,
        "y": 38.44412,
        "radius": 4.48
    },
    {
        "id": "integrator_27",
        "section": "INTEGRATORS",
        "x": 431.00135,
        "y": 38.44412,
        "radius": 4
    },
    {
        "id": "integrator_28",
        "section": "INTEGRATORS",
        "x": 355.42189,
        "y": 76.26048,
        "radius": 4.48
    },
    {
        "id": "integrator_29",
        "section": "INTEGRATORS",
        "x": 393.32857,
        "y": 76.26048,
        "radius": 4.48
    },
    {
        "id": "integrator_30",
        "section": "INTEGRATORS",
        "x": 430.7574,
        "y": 76.42311,
        "radius": 4
    },
    {
        "id": "integrator_31",
        "section": "INTEGRATORS",
        "x": 355.42189,
        "y": 114.09775,
        "radius": 4.48
    },
    {
        "id": "integrator_32",
        "section": "INTEGRATORS",
        "x": 393.32857,
        "y": 114.09775,
        "radius": 4
    },
    {
        "id": "integrator_33",
        "section": "INTEGRATORS",
        "x": 431.32663,
        "y": 114.09775,
        "radius": 4
    },
    {
        "id": "integrator_34",
        "section": "INTEGRATORS",
        "x": 355.42189,
        "y": 151.94947,
        "radius": 4.48
    },
    {
        "id": "integrator_35",
        "section": "INTEGRATORS",
        "x": 393.32857,
        "y": 151.94947,
        "radius": 4
    },
    {
        "id": "integrator_36",
        "section": "INTEGRATORS",
        "x": 431.32663,
        "y": 151.94947,
        "radius": 4
    },
    {
        "id": "integrator_37",
        "section": "INTEGRATORS",
        "x": 478.37957,
        "y": 38.44717,
        "radius": 4.48
    },
    {
        "id": "integrator_38",
        "section": "INTEGRATORS",
        "x": 516.2824,
        "y": 38.44717,
        "radius": 4
    },
    {
        "id": "integrator_39",
        "section": "INTEGRATORS",
        "x": 553.69375,
        "y": 38.60981,
        "radius": 4
    },
    {
        "id": "integrator_40",
        "section": "INTEGRATORS",
        "x": 478.37957,
        "y": 76.2569,
        "radius": 4.48
    },
    {
        "id": "integrator_41",
        "section": "INTEGRATORS",
        "x": 516.2824,
        "y": 76.2569,
        "radius": 4
    },
    {
        "id": "integrator_42",
        "section": "INTEGRATORS",
        "x": 553.69361,
        "y": 76.41954,
        "radius": 4
    },
    {
        "id": "integrator_43",
        "section": "INTEGRATORS",
        "x": 478.37957,
        "y": 114.13921,
        "radius": 4.48
    },
    {
        "id": "integrator_44",
        "section": "INTEGRATORS",
        "x": 516.2824,
        "y": 114.13921,
        "radius": 4
    },
    {
        "id": "integrator_45",
        "section": "INTEGRATORS",
        "x": 554.07902,
        "y": 114.13921,
        "radius": 4
    },
    {
        "id": "integrator_46",
        "section": "INTEGRATORS",
        "x": 478.37957,
        "y": 151.96218,
        "radius": 4
    },
    {
        "id": "integrator_47",
        "section": "INTEGRATORS",
        "x": 516.2824,
        "y": 151.96218,
        "radius": 2.6
    },
    {
        "id": "integrator_48",
        "section": "INTEGRATORS",
        "x": 554.07902,
        "y": 151.96218,
        "radius": 4
    },
    {
        "id": "integrator_49",
        "section": "INTEGRATORS",
        "x": 601.36783,
        "y": 38.45604,
        "radius": 4
    },
    {
        "id": "integrator_50",
        "section": "INTEGRATORS",
        "x": 639.26113,
        "y": 38.45604,
        "radius": 2.6
    },
    {
        "id": "integrator_51",
        "section": "INTEGRATORS",
        "x": 676.79287,
        "y": 38.61868,
        "radius": 4
    },
    {
        "id": "integrator_52",
        "section": "INTEGRATORS",
        "x": 601.36783,
        "y": 76.29849,
        "radius": 4
    },
    {
        "id": "integrator_53",
        "section": "INTEGRATORS",
        "x": 639.26113,
        "y": 76.29849,
        "radius": 2.6
    },
    {
        "id": "integrator_54",
        "section": "INTEGRATORS",
        "x": 676.79287,
        "y": 76.46112,
        "radius": 4
    },
    {
        "id": "integrator_55",
        "section": "INTEGRATORS",
        "x": 601.36783,
        "y": 114.14808,
        "radius": 4
    },
    {
        "id": "integrator_56",
        "section": "INTEGRATORS",
        "x": 639.26113,
        "y": 114.14808,
        "radius": 2.6
    },
    {
        "id": "integrator_57",
        "section": "INTEGRATORS",
        "x": 677.06755,
        "y": 114.14808,
        "radius": 4
    },
    {
        "id": "integrator_58",
        "section": "INTEGRATORS",
        "x": 601.36783,
        "y": 152.01489,
        "radius": 4
    },
    {
        "id": "integrator_59",
        "section": "INTEGRATORS",
        "x": 639.26113,
        "y": 152.01489,
        "radius": 2.6
    },
    {
        "id": "integrator_60",
        "section": "INTEGRATORS",
        "x": 677.06755,
        "y": 152.01489,
        "radius": 4
    },
    {
        "id": "summers_01",
        "section": "SUMMERS",
        "x": 109.49078,
        "y": 212.98198,
        "radius": 4.48
    },
    {
        "id": "summers_02",
        "section": "SUMMERS",
        "x": 147.32038,
        "y": 212.98198,
        "radius": 4.48
    },
    {
        "id": "summers_03",
        "section": "SUMMERS",
        "x": 184.88456,
        "y": 213.14461,
        "radius": 4
    },
    {
        "id": "summers_04",
        "section": "SUMMERS",
        "x": 109.49078,
        "y": 250.78734,
        "radius": 4.48
    },
    {
        "id": "summers_05",
        "section": "SUMMERS",
        "x": 147.32038,
        "y": 250.78734,
        "radius": 4.48
    },
    {
        "id": "summers_06",
        "section": "SUMMERS",
        "x": 184.88456,
        "y": 250.94997,
        "radius": 4
    },
    {
        "id": "summers_07",
        "section": "SUMMERS",
        "x": 109.49078,
        "y": 288.80116,
        "radius": 4.48
    },
    {
        "id": "summers_08",
        "section": "SUMMERS",
        "x": 147.32038,
        "y": 288.80116,
        "radius": 4.48
    },
    {
        "id": "summers_09",
        "section": "SUMMERS",
        "x": 185.28904,
        "y": 288.80116,
        "radius": 4
    },
    {
        "id": "summers_10",
        "section": "SUMMERS",
        "x": 109.49078,
        "y": 326.53765,
        "radius": 4.48
    },
    {
        "id": "summers_11",
        "section": "SUMMERS",
        "x": 147.32038,
        "y": 326.53765,
        "radius": 4.48
    },
    {
        "id": "summers_12",
        "section": "SUMMERS",
        "x": 185.28904,
        "y": 326.53765,
        "radius": 4
    },
    {
        "id": "summers_13",
        "section": "SUMMERS",
        "x": 232.46832,
        "y": 212.87947,
        "radius": 4.48
    },
    {
        "id": "summers_14",
        "section": "SUMMERS",
        "x": 270.29779,
        "y": 212.87947,
        "radius": 4.48
    },
    {
        "id": "summers_15",
        "section": "SUMMERS",
        "x": 307.73959,
        "y": 213.04224,
        "radius": 4
    },
    {
        "id": "summers_16",
        "section": "SUMMERS",
        "x": 232.46832,
        "y": 250.67834,
        "radius": 4.48
    },
    {
        "id": "summers_17",
        "section": "SUMMERS",
        "x": 270.29779,
        "y": 250.67834,
        "radius": 4.48
    },
    {
        "id": "summers_18",
        "section": "SUMMERS",
        "x": 307.73959,
        "y": 250.84097,
        "radius": 4
    },
    {
        "id": "summers_19",
        "section": "SUMMERS",
        "x": 232.46832,
        "y": 288.72037,
        "radius": 4.48
    },
    {
        "id": "summers_20",
        "section": "SUMMERS",
        "x": 270.29779,
        "y": 288.72037,
        "radius": 4.48
    },
    {
        "id": "summers_21",
        "section": "SUMMERS",
        "x": 308.24962,
        "y": 288.72037,
        "radius": 4
    },
    {
        "id": "summers_22",
        "section": "SUMMERS",
        "x": 232.46832,
        "y": 326.44745,
        "radius": 4.48
    },
    {
        "id": "summers_23",
        "section": "SUMMERS",
        "x": 270.29779,
        "y": 326.44745,
        "radius": 4.48
    },
    {
        "id": "summers_24",
        "section": "SUMMERS",
        "x": 308.24962,
        "y": 326.44745,
        "radius": 4
    },
    {
        "id": "summers_25",
        "section": "SUMMERS",
        "x": 355.4452,
        "y": 213.02621,
        "radius": 4.48
    },
    {
        "id": "summers_26",
        "section": "SUMMERS",
        "x": 393.2748,
        "y": 213.02621,
        "radius": 4.48
    },
    {
        "id": "summers_27",
        "section": "SUMMERS",
        "x": 430.83871,
        "y": 213.18885,
        "radius": 4
    },
    {
        "id": "summers_28",
        "section": "SUMMERS",
        "x": 355.4452,
        "y": 250.82257,
        "radius": 4.48
    },
    {
        "id": "summers_29",
        "section": "SUMMERS",
        "x": 393.2748,
        "y": 250.82257,
        "radius": 4.48
    },
    {
        "id": "summers_30",
        "section": "SUMMERS",
        "x": 430.83871,
        "y": 250.9852,
        "radius": 4
    },
    {
        "id": "summers_31",
        "section": "SUMMERS",
        "x": 355.4452,
        "y": 288.57945,
        "radius": 4.48
    },
    {
        "id": "summers_32",
        "section": "SUMMERS",
        "x": 393.2748,
        "y": 288.57945,
        "radius": 4.48
    },
    {
        "id": "summers_33",
        "section": "SUMMERS",
        "x": 431.21048,
        "y": 288.57945,
        "radius": 4
    },
    {
        "id": "summers_34",
        "section": "SUMMERS",
        "x": 355.4452,
        "y": 326.50613,
        "radius": 4.48
    },
    {
        "id": "summers_35",
        "section": "SUMMERS",
        "x": 393.2748,
        "y": 326.50613,
        "radius": 4.48
    },
    {
        "id": "summers_36",
        "section": "SUMMERS",
        "x": 431.21048,
        "y": 326.50613,
        "radius": 4
    },
    {
        "id": "summers_37",
        "section": "SUMMERS",
        "x": 478.42221,
        "y": 212.96754,
        "radius": 4.48
    },
    {
        "id": "summers_38",
        "section": "SUMMERS",
        "x": 516.25168,
        "y": 212.96754,
        "radius": 4
    },
    {
        "id": "summers_39",
        "section": "SUMMERS",
        "x": 553.77507,
        "y": 213.08952,
        "radius": 2.6
    },
    {
        "id": "summers_40",
        "section": "SUMMERS",
        "x": 478.42221,
        "y": 250.75807,
        "radius": 4.48
    },
    {
        "id": "summers_41",
        "section": "SUMMERS",
        "x": 516.25168,
        "y": 250.75807,
        "radius": 4
    },
    {
        "id": "summers_42",
        "section": "SUMMERS",
        "x": 553.77507,
        "y": 250.88004,
        "radius": 2.6
    },
    {
        "id": "summers_43",
        "section": "SUMMERS",
        "x": 478.42221,
        "y": 288.51455,
        "radius": 4.48
    },
    {
        "id": "summers_44",
        "section": "SUMMERS",
        "x": 516.25168,
        "y": 288.51455,
        "radius": 4
    },
    {
        "id": "summers_45",
        "section": "SUMMERS",
        "x": 554.17093,
        "y": 288.51455,
        "radius": 2.6
    },
    {
        "id": "summers_46",
        "section": "SUMMERS",
        "x": 478.42221,
        "y": 326.39951,
        "radius": 4.48
    },
    {
        "id": "summers_47",
        "section": "SUMMERS",
        "x": 516.25168,
        "y": 326.39951,
        "radius": 4
    },
    {
        "id": "summers_48",
        "section": "SUMMERS",
        "x": 554.17093,
        "y": 326.39951,
        "radius": 2.6
    },
    {
        "id": "inverters_01",
        "section": "INVERTERS",
        "x": 601.37168,
        "y": 214.08323,
        "radius": 4
    },
    {
        "id": "inverters_02",
        "section": "INVERTERS",
        "x": 639.22339,
        "y": 214.08323,
        "radius": 4.48
    },
    {
        "id": "inverters_03",
        "section": "INVERTERS",
        "x": 676.71155,
        "y": 214.24586,
        "radius": 4
    },
    {
        "id": "inverters_04",
        "section": "INVERTERS",
        "x": 601.37168,
        "y": 251.86753,
        "radius": 4
    },
    {
        "id": "inverters_05",
        "section": "INVERTERS",
        "x": 639.22339,
        "y": 251.86753,
        "radius": 4.48
    },
    {
        "id": "inverters_06",
        "section": "INVERTERS",
        "x": 676.71155,
        "y": 252.03016,
        "radius": 4
    },
    {
        "id": "inverters_07",
        "section": "INVERTERS",
        "x": 601.37168,
        "y": 289.97697,
        "radius": 4
    },
    {
        "id": "inverters_08",
        "section": "INVERTERS",
        "x": 639.22339,
        "y": 289.97697,
        "radius": 4.48
    },
    {
        "id": "inverters_09",
        "section": "INVERTERS",
        "x": 676.71155,
        "y": 290.13961,
        "radius": 4
    },
    {
        "id": "inverters_10",
        "section": "INVERTERS",
        "x": 601.37168,
        "y": 327.71465,
        "radius": 4
    },
    {
        "id": "inverters_11",
        "section": "INVERTERS",
        "x": 639.22339,
        "y": 327.71465,
        "radius": 4.48
    },
    {
        "id": "inverters_12",
        "section": "INVERTERS",
        "x": 676.71155,
        "y": 327.87729,
        "radius": 4
    },
    {
        "id": "minuspluso_01",
        "section": "MINUS_PLUS_ONE",
        "x": 25.65401,
        "y": 390.48598,
        "radius": 4
    },
    {
        "id": "minuspluso_02",
        "section": "MINUS_PLUS_ONE",
        "x": 61.92185,
        "y": 390.48598,
        "radius": 4
    },
    {
        "id": "minuspluso_03",
        "section": "MINUS_PLUS_ONE",
        "x": 25.65401,
        "y": 428.30816,
        "radius": 4
    },
    {
        "id": "minuspluso_04",
        "section": "MINUS_PLUS_ONE",
        "x": 61.92185,
        "y": 428.30816,
        "radius": 4
    },
    {
        "id": "multiplier_01",
        "section": "MULTIPLIERS",
        "x": 109.5272,
        "y": 390.41235,
        "radius": 4.48
    },
    {
        "id": "multiplier_02",
        "section": "MULTIPLIERS",
        "x": 147.39521,
        "y": 390.41235,
        "radius": 4.48
    },
    {
        "id": "multiplier_03",
        "section": "MULTIPLIERS",
        "x": 184.72192,
        "y": 390.57512,
        "radius": 4
    },
    {
        "id": "multiplier_04",
        "section": "MULTIPLIERS",
        "x": 109.5272,
        "y": 428.27823,
        "radius": 4.48
    },
    {
        "id": "multiplier_05",
        "section": "MULTIPLIERS",
        "x": 147.39521,
        "y": 428.27823,
        "radius": 4.48
    },
    {
        "id": "multiplier_06",
        "section": "MULTIPLIERS",
        "x": 184.72192,
        "y": 428.44087,
        "radius": 4
    },
    {
        "id": "comparator_01",
        "section": "COMPARATORS",
        "x": 232.51786,
        "y": 390.35791,
        "radius": 4.48
    },
    {
        "id": "comparator_02",
        "section": "COMPARATORS",
        "x": 270.33765,
        "y": 390.35791,
        "radius": 4.48
    },
    {
        "id": "comparator_03",
        "section": "COMPARATORS",
        "x": 307.78025,
        "y": 390.602,
        "radius": 4
    },
    {
        "id": "comparator_04",
        "section": "COMPARATORS",
        "x": 232.51786,
        "y": 428.2238,
        "radius": 4.48
    },
    {
        "id": "comparator_05",
        "section": "COMPARATORS",
        "x": 270.33765,
        "y": 428.2238,
        "radius": 4.48
    },
    {
        "id": "comparator_06",
        "section": "COMPARATORS",
        "x": 307.78025,
        "y": 428.46789,
        "radius": 4
    },
    {
        "id": "comparator_07",
        "section": "COMPARATORS",
        "x": 355.62029,
        "y": 390.28891,
        "radius": 4.48
    },
    {
        "id": "comparator_08",
        "section": "COMPARATORS",
        "x": 393.29983,
        "y": 390.28891,
        "radius": 4.48
    },
    {
        "id": "comparator_09",
        "section": "COMPARATORS",
        "x": 430.83871,
        "y": 390.45155,
        "radius": 4
    },
    {
        "id": "comparator_10",
        "section": "COMPARATORS",
        "x": 355.62029,
        "y": 428.15639,
        "radius": 4.48
    },
    {
        "id": "comparator_11",
        "section": "COMPARATORS",
        "x": 393.29983,
        "y": 428.15639,
        "radius": 4.48
    },
    {
        "id": "comparator_12",
        "section": "COMPARATORS",
        "x": 430.83871,
        "y": 428.31902,
        "radius": 4
    },
    {
        "id": "xir_01",
        "section": "XIR",
        "x": 478.46843,
        "y": 390.38851,
        "radius": 4
    },
    {
        "id": "xir_02",
        "section": "XIR",
        "x": 516.27088,
        "y": 390.38851,
        "radius": 4.48
    },
    {
        "id": "xir_03",
        "section": "XIR",
        "x": 554.11438,
        "y": 390.38851,
        "radius": 4.48
    },
    {
        "id": "xir_04",
        "section": "XIR",
        "x": 478.46843,
        "y": 428.16566,
        "radius": 4
    },
    {
        "id": "xir_05",
        "section": "XIR",
        "x": 516.27088,
        "y": 428.16566,
        "radius": 4.48
    },
    {
        "id": "xir_06",
        "section": "XIR",
        "x": 554.11438,
        "y": 428.16566,
        "radius": 4.48
    },
    {
        "id": "xir_07",
        "section": "XIR",
        "x": 601.42028,
        "y": 390.39818,
        "radius": 4.48
    },
    {
        "id": "xir_08",
        "section": "XIR",
        "x": 639.24272,
        "y": 390.39818,
        "radius": 4.48
    },
    {
        "id": "xir_09",
        "section": "XIR",
        "x": 677.07656,
        "y": 390.39818,
        "radius": 4.48
    },
    {
        "id": "xir_10",
        "section": "XIR",
        "x": 601.42028,
        "y": 428.17652,
        "radius": 4.48
    },
    {
        "id": "xir_11",
        "section": "XIR",
        "x": 639.24272,
        "y": 428.17652,
        "radius": 4.48
    },
    {
        "id": "xir_12",
        "section": "XIR",
        "x": 677.07656,
        "y": 428.17652,
        "radius": 4.48
    },
    {
        "id": "capacitors_01",
        "section": "CAPACITORS",
        "x": 9.90793,
        "y": 477.29051,
        "radius": 2.6
    },
    {
        "id": "capacitors_02",
        "section": "CAPACITORS",
        "x": 34.86728,
        "y": 504.85789,
        "radius": 2.6
    },
    {
        "id": "capacitors_03",
        "section": "CAPACITORS",
        "x": 64.67027,
        "y": 477.29051,
        "radius": 2.6
    },
    {
        "id": "capacitors_04",
        "section": "CAPACITORS",
        "x": 89.63029,
        "y": 504.85789,
        "radius": 2.6
    },
    {
        "id": "capacitors_05",
        "section": "CAPACITORS",
        "x": 119.43315,
        "y": 477.29051,
        "radius": 2.6
    },
    {
        "id": "capacitors_06",
        "section": "CAPACITORS",
        "x": 144.3925,
        "y": 504.85789,
        "radius": 2.6
    },
    {
        "id": "capacitors_07",
        "section": "CAPACITORS",
        "x": 174.19549,
        "y": 477.29051,
        "radius": 2.6
    },
    {
        "id": "capacitors_08",
        "section": "CAPACITORS",
        "x": 199.1555,
        "y": 504.85789,
        "radius": 2.6
    },
    {
        "id": "capacitors_09",
        "section": "CAPACITORS",
        "x": 228.95836,
        "y": 477.29051,
        "radius": 2.6
    },
    {
        "id": "capacitors_10",
        "section": "CAPACITORS",
        "x": 253.91772,
        "y": 504.85789,
        "radius": 2.6
    },
    {
        "id": "diodes_01",
        "section": "DIODES",
        "x": 283.72058,
        "y": 477.29051,
        "radius": 2.6
    },
    {
        "id": "diodes_02",
        "section": "DIODES",
        "x": 308.68072,
        "y": 504.85789,
        "radius": 2.6
    },
    {
        "id": "diodes_03",
        "section": "DIODES",
        "x": 338.48358,
        "y": 477.29051,
        "radius": 2.6
    },
    {
        "id": "diodes_04",
        "section": "DIODES",
        "x": 363.44293,
        "y": 504.85789,
        "radius": 2.6
    },
    {
        "id": "diodes_05",
        "section": "DIODES",
        "x": 393.24579,
        "y": 477.29051,
        "radius": 2.6
    },
    {
        "id": "diodes_06",
        "section": "DIODES",
        "x": 418.2058,
        "y": 504.85789,
        "radius": 2.6
    },
    {
        "id": "diodes_07",
        "section": "DIODES",
        "x": 448.0088,
        "y": 477.29051,
        "radius": 2.6
    },
    {
        "id": "diodes_08",
        "section": "DIODES",
        "x": 472.96881,
        "y": 504.85789,
        "radius": 2.6
    },
    {
        "id": "zdiodes_01",
        "section": "Z_DIODES",
        "x": 502.77101,
        "y": 477.29051,
        "radius": 2.6
    },
    {
        "id": "zdiodes_02",
        "section": "Z_DIODES",
        "x": 527.73102,
        "y": 504.85789,
        "radius": 2.6
    },
    {
        "id": "zdiodes_03",
        "section": "Z_DIODES",
        "x": 557.53401,
        "y": 477.29051,
        "radius": 2.6
    },
    {
        "id": "zdiodes_04",
        "section": "Z_DIODES",
        "x": 582.49403,
        "y": 504.85789,
        "radius": 2.6
    },
    {
        "id": "outputs_01",
        "section": "OUTPUTS",
        "x": 612.29623,
        "y": 477.29051,
        "radius": 4
    },
    {
        "id": "outputs_02",
        "section": "OUTPUTS",
        "x": 637.25624,
        "y": 504.85789,
        "radius": 4
    },
    {
        "id": "outputs_03",
        "section": "OUTPUTS",
        "x": 667.0591,
        "y": 477.29051,
        "radius": 4
    },
    {
        "id": "outputs_04",
        "section": "OUTPUTS",
        "x": 692.01924,
        "y": 504.85789,
        "radius": 4
    }
]
  );

  const api = { ADOPTED_PANEL_CONNECTORS, listAdoptedPanelConnectors: () => ADOPTED_PANEL_CONNECTORS.map((connector) => Object.assign({}, connector)) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.AnalogThingAdoptedPatchPanelConnectors = api;
}(typeof window !== 'undefined' ? window : global));
