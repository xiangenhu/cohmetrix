/**
 * Layer registry — auto-discovers and exports all 12 analysis layers.
 * Each layer module must export: { analyze, LAYER_ID, LAYER_NAME }
 *
 * Discourse Level I  — Surface Code:       L0, L1, L2
 * Discourse Level II — Textbase:           L3, L4, L5
 * Discourse Level III — Situation Model:   L6
 * Discourse Level IV — Genre & Rhetoric:   L7, L8
 * Discourse Level V  — Pragmatic:          L9, L10
 * Meta (Cross-Level):                      L11
 */
const L0 = require('./L0-surface');
const L1 = require('./L1-lexical');
const L2 = require('./L2-syntactic');
const L3 = require('./L3-referential');
const L4 = require('./L4-semantic');
const L5 = require('./L5-connective');
const L6 = require('./L6-situation');
const L7 = require('./L7-rhetorical');
const L8 = require('./L8-argumentation');
const L9 = require('./L9-stance');
const L10 = require('./L10-affective');
const L11 = require('./L11-reader');

const layers = [L0, L1, L2, L3, L4, L5, L6, L7, L8, L9, L10, L11];

const layerMap = {};
layers.forEach(l => { layerMap[l.LAYER_ID] = l; });

module.exports = { layers, layerMap };
