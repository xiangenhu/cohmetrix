/**
 * Layer registry — auto-discovers and exports all analysis layers.
 * Each layer module must export: { analyze, LAYER_ID, LAYER_NAME }
 */
const L0 = require('./L0-surface');
const L1 = require('./L1-lexical');
const L2 = require('./L2-syntactic');
const L3 = require('./L3-referential');
const L4 = require('./L4-semantic');
const L5 = require('./L5-situation');
const L6 = require('./L6-rhetorical');
const L7 = require('./L7-argumentation');
const L8 = require('./L8-stance');
const L9 = require('./L9-affective');
const L10 = require('./L10-reader');

const layers = [L0, L1, L2, L3, L4, L5, L6, L7, L8, L9, L10];

const layerMap = {};
layers.forEach(l => { layerMap[l.LAYER_ID] = l; });

module.exports = { layers, layerMap };
