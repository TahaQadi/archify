import { validateBusinessModel } from './model.mjs';
const slug=(s)=>String(s).replace(/[^a-zA-Z0-9-_]/g,'-').replace(/-+/g,'-').slice(0,80);
const arr=(a)=>Array.isArray(a)?a:[];

/** Convert one process into Archify 3.1 workflow IR without changing its renderer. */
export function compileWorkflow(model, processId, output=`${slug(processId)}.html`) {
  const results=validateBusinessModel(model);
  if(!results.valid){const e=new Error(`Business model invalid: ${results.errors.map(e=>`${e.path}: ${e.message}`).join('; ')}`);e.diagnostics=results;throw e;}
  const process=model.processes.find(p=>p.id===processId);
  if(!process) throw new Error(`No process ${processId}`);
  const roles=new Map(arr(model.entities.roles).map(r=>[r.id,r]));
  const locations=new Map(arr(model.entities.locations).map(r=>[r.id,r]));
  const system=new Map(arr(model.entities.systems).map(r=>[r.id,r]));
  const lanes=[...new Set(process.steps.map(s=>s.role))];
  const phases=process.phases;
  const occupancy=new Map();
  const nodes=process.steps.map(step=>{
    const col=phases.findIndex(ph=>ph.id===step.phase);
    const key=`${step.role}:${col}`;
    const position=occupancy.get(key)||0;
    occupancy.set(key,position+1);
    const sub=[locations.get(step.location)?.name,system.get(step.system)?.name].filter(Boolean).join(' · ');
    return {
      id:step.id,lane:step.role,col,
      type:step.kind==='decision'?'security':step.kind==='record'?'database':step.kind==='message'?'messagebus':step.kind==='external'?'external':'backend',
      label:step.name,
      ...(sub?{sublabel:sub}:{}),
      ...(step.status && step.status!=='confirmed'?{tag:step.status}:{}),
      ...((step.kind==='decision')?{icon:'decision'}:{}),
    };
  });
  // Center repeated step nodes within each role/phase slot; avoid silently hiding them.
  for(const n of nodes){
    const matching=nodes.filter(x=>x.lane===n.lane && x.col===n.col);
    if(matching.length>1){
      const k=matching.indexOf(n);
      n.yOffset=(k-(matching.length-1)/2)*102;
    }
  }
  const edges=arr(process.flows).map((f,i)=>({
    id:`flow_${i+1}`,from:f.from,to:f.to,
    ...(f.condition?{label:f.condition}:{}),
    ...(f.kind==='exception'?{role:'error',variant:'security'}:f.kind==='branch'?{role:'branch',variant:'dashed'}:{}),
  }));
  const cards=[
    {dot:'cyan',title:'Process accountability',items:[`Owner: ${roles.get(process.ownerRole)?.name||process.ownerRole}`,`Status: ${process.status||'unspecified'}`,`Source: ${model.title}`]},
    {dot:'emerald',title:'Control and handoffs',items:[`${process.steps.length} steps across ${lanes.length} roles`,`RACI assigned for ${arr(process.raci).length} steps`,`Linked controls: ${new Set(process.steps.flatMap(s=>arr(s.controls))).size}`]},
    {dot:'slate',title:'Use with Business Model Studio',items:['RACI, permissions, locations and governance remain in the semantic model','See the companion operating-model report for detailed responsibilities']},
  ];
  return {
    schema_version:2,diagram_type:'workflow',
    meta:{title:process.name,output,quality_profile:'standard',legend:{mode:'auto'}},
    lanes:lanes.map(role=>({id:role,label:roles.get(role)?.name||role})),
    mainPath:process.mainPath,
    nodes,edges,cards,
  };
}

export function compileAllWorkflows(model, directory='business-out'){
  const out={};
  for(const p of model.processes)out[p.id]=compileWorkflow(model,p.id,`${directory}/${slug(p.id)}.html`);
  return out;
}
