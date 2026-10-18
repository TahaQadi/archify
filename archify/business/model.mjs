/** Business Operating Model semantic validation: deliberately dependency-free. */
export const STATUSES = Object.freeze(['confirmed', 'proposed', 'client-decision', 'assumed-for-workshop', 'new']);
export const POLISM = Object.freeze({
  P: 'Processes', O: 'Organisation', L: 'Locations', I: 'Information',
  S: 'Suppliers', M: 'Management systems',
});

const list = (value) => Array.isArray(value) ? value : [];
const has = (v) => typeof v === 'string' && v.trim().length > 0;

export function validateBusinessModel(model) {
  const errors = [], warnings = [];
  const error = (code, path, message) => errors.push({ code, path, message });
  const warn = (code, path, message) => warnings.push({ code, path, message });
  const checkStatus=(item,path)=>{if(!item?.status)warn('status/missing',path,'Declare confirmed, proposed, client-decision, assumed-for-workshop or new');else if(!STATUSES.includes(item.status))error('status/invalid',path,`Unsupported status ${item.status}`);};
  if (!model || typeof model !== 'object' || Array.isArray(model)) {
    return { valid:false, errors:[{code:'model/type',path:'$',message:'Expected object'}], warnings:[] };
  }
  if (model.version !== 1) error('model/version', 'version', 'Supported version is 1');
  for (const f of ['id','title','valueProposition']) if (!has(model[f])) error('model/required', f, `${f} is required`);
  if (!model.entities || typeof model.entities !== 'object') error('model/entities','entities','Expected entities object');
  if (!list(model.processes).length) error('model/processes','processes','At least one process is required');
  checkStatus(model,'$');
  const e = model.entities || {};
  const types = ['people','roles','units','locations','systems','suppliers','information','managementSystems','capabilities'];
  const index = {};
  for (const type of types) {
    index[type] = new Set();
    list(e[type]).forEach((entry, i) => {
      const p = `entities.${type}[${i}]`;
      if (!entry || !has(entry.id) || !has(entry.name)) { error('entity/identity',p,'Every entity needs id and name');return; }
      if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(entry.id)) error('entity/id-format',p,'ID must match Archify identifier format');
      if (index[type].has(entry.id)) error('entity/duplicate',p,`Duplicate ${type} ID ${entry.id}`);
      index[type].add(entry.id);
      checkStatus(entry,p);
    });
  }
  const exists=(type,id,p)=>{
    if (!has(id) || !index[type]?.has(id)) { error('reference/unknown',p,`${type} ID '${id}' is undefined`);return false; }
    return true;
  };
  list(model.assignments).forEach((a,i)=>{
    const p=`assignments[${i}]`;
    exists('people',a.person,`${p}.person`); exists('roles',a.role,`${p}.role`);
    if (a.unit) exists('units',a.unit,`${p}.unit`);
    if (a.location) exists('locations',a.location,`${p}.location`);
    checkStatus(a,p);
  });
  const permissionIds = new Set(), controls = new Set(), processIds = new Set();
  list(model.permissions).forEach((p,i)=>{
    const path=`permissions[${i}]`;
    if (!has(p.id)) error('permission/identity',path,'Permission ID required');
    else if(permissionIds.has(p.id)) error('permission/duplicate',path,p.id);
    permissionIds.add(p.id); exists('roles',p.role,`${path}.role`);
    if(!has(p.resource) || !list(p.actions).length || !list(p.actions).every(has)) error('permission/action',path,'resource and nonempty actions required');
    if (p.system) exists('systems',p.system,`${path}.system`);
    if (p.requiresApproval && !p.approverRole) error('permission/approval',path,'Approver role needed');
    if (p.approverRole) exists('roles',p.approverRole,`${path}.approverRole`);
    checkStatus(p,path);
  });
  list(model.controls).forEach((c,i)=>{
    const path=`controls[${i}]`;
    if (!has(c.id)||!has(c.name)) error('control/identity',path,'Control needs id and name');
    if(controls.has(c.id)) error('control/duplicate',path,c.id);
    controls.add(c.id); exists('roles',c.ownerRole,`${path}.ownerRole`);
    if (!has(c.evidence)) warn('control/evidence',path,'Control lacks evidence definition');
    checkStatus(c,path);
  });
  const stepRefs = new Set();
  list(model.processes).forEach((p,i)=>{
    const path=`processes[${i}]`;
    if (!has(p.id)||!has(p.name)) error('process/identity',path,'Process needs id and name');
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(p.id||'')) error('process/id-format',path,'ID must match Archify identifier format');
    if(processIds.has(p.id)) error('process/duplicate',path,p.id);
    processIds.add(p.id); exists('roles',p.ownerRole,`${path}.ownerRole`);
    if(p.capability) exists('capabilities',p.capability,`${path}.capability`);
    checkStatus(p,path);
    const phaseSet=new Set(), stepSet=new Set(), stepMap=new Map();
    if(!list(p.phases).length||p.phases.length>6) error('process/phases',path,'1–6 phases required by Archify workflow layout');
    list(p.phases).forEach((ph,j)=>{
      if(!has(ph.id)||!has(ph.name))error('phase/identity',`${path}.phases[${j}]`,'Phase needs id and name');
      if(!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(ph.id||''))error('phase/id-format',path,'ID must match Archify identifier format');
      if(phaseSet.has(ph.id))error('phase/duplicate',path,ph.id);
      phaseSet.add(ph.id);
    });
    if(list(p.steps).length<2) error('process/steps',path,'Process must have at least two steps');+    list(p.steps).forEach((s,j)=>{
      const sp=`${path}.steps[${j}]`;
      if(!has(s.id)||!has(s.name)) error('step/identity',sp,'Step needs id and name');
      if(!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(s.id||'')) error('step/id-format',sp,'ID must match Archify identifier format');
      if(stepSet.has(s.id)) error('step/duplicate',sp,s.id);
      stepSet.add(s.id); stepMap.set(s.id,s);stepRefs.add(`${p.id}.${s.id}`);
      if(!phaseSet.has(s.phase)) error('step/phase',sp,`Unknown phase ${s.phase}`);
      exists('roles',s.role,`${sp}.role`);
      if(s.location) exists('locations',s.location,`${sp}.location`);
      if(s.system) exists('systems',s.system,`${sp}.system`);
      for(const d of list(s.inputs)) exists('information',d,`${sp}.inputs`);
      for(const d of list(s.outputs)) exists('information',d,`${sp}.outputs`);
      for(const c of list(s.controls)) if(!controls.has(c))error('step/control',sp,`Unknown control ${c}`);
      for(const q of list(s.permissions)){
        if(!permissionIds.has(q)) error('step/permission',sp,`Unknown permission ${q}`);
        else if(!list(model.permissions).some(z=>z.id===q && z.role===s.role))warn('step/permission-role',sp,`Permission ${q} is not granted to executing role ${s.role}`);
      }
      checkStatus(s,sp);
    });
    const edges=new Set();
    list(p.flows).forEach((f,j)=>{
      const fp=`${path}.flows[${j}]`;
      if(!stepSet.has(f.from)||!stepSet.has(f.to))error('flow/reference',fp,`Unknown endpoint ${f.from} -> ${f.to}`);
      if(f.from===f.to)warn('flow/self',fp,'Self-loop: verify intended behaviour');
      const key=`${f.from}:${f.to}:${f.condition||''}`;
      if(edges.has(key))warn('flow/duplicate',fp,'Duplicate flow');
      edges.add(key);
      if(f.kind==='exception'&&!has(f.condition)) warn('flow/exception-condition',fp,'Exception lacks trigger');
    });
    const mainPath=list(p.mainPath);
    if(mainPath.length<2)error('path/required',path,'Explicit mainPath must have >=2 steps');
    for(const id of mainPath) if(!stepSet.has(id))error('path/reference',path,`Unknown mainPath step ${id}`);
    for(let j=0;j<mainPath.length-1;j++) if(!list(p.flows).some(f=>f.from===mainPath[j]&&f.to===mainPath[j+1]))error('path/edge',path,`Main path edge missing: ${mainPath[j]} -> ${mainPath[j+1]}`);
    const raciMap = new Map();
    list(p.raci).forEach((r,j)=>{
      const rp=`${path}.raci[${j}]`;
      if(!stepSet.has(r.step))error('raci/step',rp,`Unknown step ${r.step}`);
      if(raciMap.has(r.step))error('raci/duplicate',rp,`Multiple RACI definitions for ${r.step}`);
      raciMap.set(r.step,r);
      exists('roles',r.accountable,`${rp}.accountable`);
      if(!list(r.responsible).length)error('raci/responsible',rp,'At least one responsible role required');
      for (const field of ['responsible','consulted','informed']) for(const role of list(r[field]))exists('roles',role,`${rp}.${field}`);
      if(stepMap.get(r.step)&&!list(r.responsible).includes(stepMap.get(r.step).role))warn('raci/executor',rp,'Executing role is not Responsible in RACI');
      const buckets=['responsible','consulted','informed'].map(k=>list(r[k]));
      const intersection=new Set(buckets[0].filter(x=>buckets[1].includes(x)||buckets[2].includes(x)));
      if(intersection.size)warn('raci/overlap',rp,`Role(s) assigned overlapping R/C/I: ${[...intersection]}`);
    });
    for(const step of stepSet)if(!raciMap.has(step))error('raci/missing',path,`RACI missing for ${step}`);
    if(!list(p.flows).length)error('flow/missing',path,'No process flow connections');
    const inbound=new Set(list(p.flows).map(f=>f.to));
    const outbound=new Set(list(p.flows).map(f=>f.from));
    if(!list(p.steps).some(s=>!inbound.has(s.id)))warn('process/no-start',path,'No identifiable start step');
    if(!list(p.steps).some(s=>!outbound.has(s.id)))warn('process/no-end',path,'No identifiable terminal step');
  });
  list(model.decisions).forEach((d,i)=>{
    const dp=`decisions[${i}]`;
    if(!processIds.has(d.process))error('decision/process',dp,`Unknown process ${d.process}`);
    for(const k of ['proposerRole','approverRole'])exists('roles',d[k],`${dp}.${k}`);
    if(d.backupRole)exists('roles',d.backupRole,`${dp}.backupRole`);
    if(d.proposerRole===d.approverRole)warn('decision/separation-of-duties',dp,'Proposer also approves: review segregation of duties');
    checkStatus(d,dp);
  });
  list(model.risks).forEach((risk,i)=>{
    const path=`risks[${i}]`;
    if(!has(risk.id)||!has(risk.name))error('risk/identity',path,'Risk ID and name required');
    if(!processIds.has(risk.process))error('risk/process',path,`Unknown process ${risk.process}`);
    exists('roles',risk.ownerRole,`${path}.ownerRole`);
    if(!has(risk.treatment))warn('risk/treatment',path,'Missing mitigation or treatment');
    checkStatus(risk,path);
  });
  list(model.requirements).forEach((req,i)=>{
    const path=`requirements[${i}]`;
    if(!has(req.id)||!has(req.description))error('requirement/identity',path,'Requirement ID and description required');
    if(req.process&&!processIds.has(req.process))error('requirement/process',path,`Unknown process ${req.process}`);
    if(req.ownerRole)exists('roles',req.ownerRole,`${path}.ownerRole`);
    checkStatus(req,path);
    if(!has(req.acceptanceCriteria))warn('requirement/acceptance',path,'No testable acceptance criteria');
  });
  list(model.metrics).forEach((m,i)=>{
    if(!processIds.has(m.process))error('metric/process',`metrics[${i}]`,m.process);
    exists('roles',m.ownerRole,`metrics[${i}].ownerRole`);
    checkStatus(m,`metrics[${i}]`);
  });
  list(model.controls).forEach((c,i)=>{
    for(const ref of list(c.appliesTo))if(!stepRefs.has(ref))error('control/step',`controls[${i}]`,ref);
  });
  return {valid:errors.length===0,errors,warnings,counts:{processes:processIds.size,roles:index.roles.size,steps:stepRefs.size,permissions:permissionIds.size,controls:controls.size}};
}
