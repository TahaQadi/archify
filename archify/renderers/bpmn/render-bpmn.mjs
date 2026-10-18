#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateAuthoredOutputPath} from '../shared/output-path.mjs';
import {resolveOutputPath} from '../shared/output-path.mjs';
import {writeDiagram} from '../shared/cli.mjs';
import {renderBpmnSvg} from './bpmn-shapes.mjs';
const base=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(base,'../..');
const [input,output,...flags]=process.argv.slice(2);
if(!input||flags.some(x=>x!=='--layout-json')){
 console.error('Usage: node archify/renderers/bpmn/render-bpmn.mjs model.bpmn.json [result.html] [--layout-json]');
 process.exitCode=2;
}else{
 try{
  const source=JSON.parse(fs.readFileSync(input,'utf8'));
  validateAuthoredOutputPath(source.meta.output);
  const {svg,receipt}=renderBpmnSvg(source);
  if(flags.includes('--layout-json')||output==='--layout-json')console.log(JSON.stringify(receipt,null,2));
  else {
   const template=fs.readFileSync(path.join(root,'assets/template.html'),'utf8');
   const outPath=resolveOutputPath({requestedOutput:output,authoredOutput:source.meta.output,defaultOutput:'bpmn.html',inputPaths:[path.resolve(input)],cwd:process.cwd()}).outputPath;
   // Uses upstream atomic writer, template, keyboard controls, Focus/Route/Lens/Export.
   writeDiagram({outPath,template,diagramType:'bpmn',meta:source.meta,svg,cards:[{
    dot:'cyan',title:'BPMN source & model coverage',items:[
     `Process: ${source.process||'not specified'}`,
     `${receipt.nodes} nodes / ${receipt.flows} flows / ${receipt.unmapped} unmapped nested elements`,
     `Document status: ${source.source?.reviewStatus||'unreviewed'}`
    ]
   }]});
  }
 }catch(e){console.error(`${e.code||'bpmn/render'}: ${e.message}`);process.exitCode=1}
}