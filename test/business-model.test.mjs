import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {validateBusinessModel} from '../archify/business/model.mjs';
import {compileWorkflow} from '../archify/business/compile.mjs';
import {renderBusinessReport} from '../archify/business/report.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const sample=JSON.parse(readFileSync(resolve(root,'archify/examples/business/distribution-fulfillment.json'),'utf8'));
const copy=()=>structuredClone(sample);

test('sample passes cross-reference and RACI checks',()=>{
 const result=validateBusinessModel(sample);
 assert.deepEqual(result.errors,[]);
 assert.equal(result.valid,true);
 assert.equal(result.counts.steps,8);
});
test('detects RACI missing, unknown location, orphan permissions, and unknown control',()=>{
 const model=copy();
 model.processes[0].raci=model.processes[0].raci.filter(r=>r.step!=='pick');
 model.processes[0].steps[0].location='does-not-exist';
 model.processes[0].steps[0].controls=['no-control'];
 model.processes[0].steps[0].permissions=['pick_execute'];
 const result=validateBusinessModel(model);
 assert.equal(result.valid,false);
 assert.ok(result.errors.some(e=>e.code==='raci/missing'));
 assert.ok(result.errors.some(e=>e.code==='reference/unknown'));
 assert.ok(result.errors.some(e=>e.code==='step/control'));
 assert.ok(result.warnings.some(e=>e.code==='step/permission-role'));
});
test('rejects dangerous process path values',()=>{
 const model=copy();model.processes[0].id='../bad';
 assert.ok(validateBusinessModel(model).errors.some(e=>e.code==='process/id-format'));
 assert.throws(()=>compileWorkflow(model,'../bad'));
});
test('compiled workflow keeps all nodes, paths, evidence labels and known enum values',()=>{
 const p=sample.processes[0],diagram=compileWorkflow(sample,p.id);
 assert.equal(diagram.diagram_type,'workflow');assert.equal(diagram.schema_version,2);
 assert.deepEqual(diagram.mainPath,p.mainPath);
 assert.equal(diagram.nodes.length,p.steps.length);
 assert.equal(diagram.edges.length,p.flows.length);
 assert.ok(diagram.nodes.every(n=>Number.isInteger(n.col)&&n.col>=0&&n.col<=5));
 assert.ok(diagram.edges.some(e=>e.role==='error'));
 assert.ok(diagram.nodes.some(n=>n.tag==='client-decision'));
 assert.deepEqual([...new Set(diagram.nodes.map(n=>n.lane))].sort(),diagram.lanes.map(l=>l.id).sort());
});
test('HTML report is offline, multi-view, and escapes unsafe authored text',()=>{
 const model=copy();model.title='<script>alert("oops")</script>';
 const html=renderBusinessReport(model,validateBusinessModel(model));
 assert.ok(html.includes('&lt;script&gt;'));
 assert.ok(!html.includes('<script>alert("oops")</script>'));
 assert.ok(html.includes('data-tab="raci"'));
 assert.ok(html.includes('data-tab="permissions"'));
 assert.ok(html.includes('data-tab="coverage"'));
 assert.ok(html.includes('POLISM'));
 assert.ok(!html.includes('<script src='));
});
test('fails closed when a main path relationship disappears',()=>{
 const model=copy(); model.processes[0].flows=model.processes[0].flows.filter(f=>!(f.from==='verify'&&f.to==='release'));
 const result=validateBusinessModel(model);
 assert.ok(result.errors.some(e=>e.code==='path/edge'));
});
