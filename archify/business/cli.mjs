#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { embedBusinessStudio } from './studio.mjs';
import { join, resolve } from 'node:path';
import { validateBusinessModel } from './model.mjs';
import { compileAllWorkflows } from './compile.mjs';
import { renderBusinessReport } from './report.mjs';

function csvCell(value){
  let s=String(value??'');
  // Prevent spreadsheet formula injection in external CSV viewers.
  if(/^[=+@\-\t\r]/u.test(s))s=`'${s}`;
  return `"${s.replaceAll('\"','\"\"')}"`;
}
function csv(rows){return rows.map(row=>row.map(csvCell).join(',')).join('\n')+'\n';}
function main(args){
  const studio=args.includes('--studio');
  const [command,input,dir='business-out']=args.filter(arg=>arg!=='--studio');
  if(!['validate','build'].includes(command)||!input){
    console.error('Usage: node archify/business/cli.mjs validate|build <business-model.json> [output-dir] [--studio]');
    process.exitCode=2;return;
  }
  const model=JSON.parse(readFileSync(resolve(input),'utf8'));
  const diagnostics=validateBusinessModel(model);
  if(command==='validate'){
    console.log(JSON.stringify(diagnostics,null,2));
    if(!diagnostics.valid)process.exitCode=1;
    return;
  }
  if(!diagnostics.valid){
    console.error(JSON.stringify(diagnostics,null,2));process.exitCode=1;return;
  }
  const outputDir=resolve(dir);
  mkdirSync(outputDir,{recursive:true});
  const workflows=compileAllWorkflows(model,'.');
  for(const [id,diagram] of Object.entries(workflows)){
    const file=join(outputDir,`${id}.workflow.json`);
    // JSON IR is portable and compatible with the original Archify workflow renderer.
    // Metadata path deliberately equals the basename of the companion HTML.
    diagram.meta.output=`${id}.html`;
    writeFileSync(file,JSON.stringify(diagram,null,2)+'\n');
  }
  if(studio){
    const businessDir=dirname(fileURLToPath(import.meta.url));
    const renderer=resolve(businessDir,'../renderers/workflow/render-workflow.mjs');
    for(const [id] of Object.entries(workflows)){
      const inputFile=join(outputDir,`${id}.workflow.json`);
      const outputFile=join(outputDir,`${id}.html`);
      const rendered=spawnSync(process.execPath,[renderer,inputFile,outputFile],{encoding:'utf8',maxBuffer:8*1024*1024});
      if(rendered.error || rendered.status!==0){
        console.error(`Archify failed to render process ${id}:`,rendered.stderr||rendered.error?.message);
        process.exitCode=1;return;
      }
      writeFileSync(outputFile,embedBusinessStudio(readFileSync(outputFile,'utf8'),model,id));
    }
  }
  writeFileSync(join(outputDir,'business-operating-model.html'),renderBusinessReport(model,diagnostics));
  writeFileSync(join(outputDir,'validation.json'),JSON.stringify(diagnostics,null,2)+'\n');
  const roles=new Map(model.entities.roles.map(r=>[r.id,r.name]));
  const role=id=>roles.get(id)||id||'';
  const raci=[['Process','Step','A','R','C','I']];
  const steps=[['Process','Step','Role','Phase','Location','System','Status']];
  for(const process of model.processes){
    for(const row of process.raci)raci.push([process.id,row.step,role(row.accountable),(row.responsible||[]).map(role).join('; '),(row.consulted||[]).map(role).join('; '),(row.informed||[]).map(role).join('; ')]);
    for(const row of process.steps)steps.push([process.id,row.id,role(row.role),row.phase,row.location||'',row.system||'',row.status||'']);
  }
  const permissions=[['Permission ID','Role','System','Resource','Actions','Scope','Requires approval','Approver role','Status']];
  for(const p of model.permissions||[]) permissions.push([p.id,role(p.role),p.system||'',p.resource,(p.actions||[]).join('; '),p.scope||'',p.requiresApproval?'yes':'no',role(p.approverRole),p.status||'']);
  writeFileSync(join(outputDir,'raci.csv'),csv(raci));
  writeFileSync(join(outputDir,'steps.csv'),csv(steps));
  writeFileSync(join(outputDir,'permissions.csv'),csv(permissions));

  console.log(JSON.stringify({output:outputDir,report:'business-operating-model.html',workflows:Object.keys(workflows),nativeEditor:studio,warnings:diagnostics.warnings.length},null,2));
}
main(process.argv.slice(2));
