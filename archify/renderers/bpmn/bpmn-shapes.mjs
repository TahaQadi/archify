/** Native BPMN 2.0 geometry for Archify's existing SVG viewer.
 * Geometry is deterministic, IDs stay sourced from imported BPMN, and the
 * diagram remains a static canonical SVG (the viewer adds interaction).
 */
const NODE_TYPES=new Set(['startEvent','endEvent','intermediateCatchEvent','intermediateThrowEvent','boundaryEvent','task','userTask','serviceTask','manualTask','scriptTask','sendTask','receiveTask','businessRuleTask','subProcess','transaction','callActivity','exclusiveGateway','inclusiveGateway','parallelGateway','eventBasedGateway','complexGateway','dataObjectReference','dataStoreReference','textAnnotation']);
const EDGE_TYPES=new Set(['sequenceFlow','messageFlow','association','dataInputAssociation','dataOutputAssociation']);
const EVENT_TYPES=new Set(['message','timer','signal','error','escalation','conditional','link','terminate','compensate','cancel']);
export const supportedBpmnShapes=[...NODE_TYPES];
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const f=n=>Number.isFinite(n)?+n.toFixed(2):0;
function finiteRect(r){return r&&['x','y','width','height'].every(k=>Number.isFinite(+r[k]))&&r.width>0&&r.height>0&&r.width<10000&&r.height<10000&&Math.abs(r.x)<1e6&&Math.abs(r.y)<1e6}
function fail(code,detail){const e=new Error(`${code}: ${detail}`);e.code=code;throw e;}
export function validateBpmnDiagram(d){
 if(d?.diagram_type!=='bpmn'||d.schema_version!==1)fail('bpmn/schema','diagram_type bpmn and schema_version 1 required');
 if(!d.meta||typeof d.meta.title!=='string'||!d.meta.title.trim())fail('bpmn/title','title missing');
 if(!Array.isArray(d.nodes)||!d.nodes.length||!Array.isArray(d.flows))fail('bpmn/collections','nodes and flows required');
 const ids=new Set();
 for(const n of d.nodes){
  if(!/^[a-zA-Z][\w-]*$/.test(n.id||'')||ids.has(n.id))fail('bpmn/id',`duplicate/unsafe node ${n.id}`);
  ids.add(n.id);
  if(!NODE_TYPES.has(n.kind))fail('bpmn/kind',`${n.id}: ${n.kind}`);
  if(n.event&&!EVENT_TYPES.has(n.event))fail('bpmn/event',n.event);
  if(!finiteRect(n.bounds))fail('bpmn/geometry',n.id);
  if(n.kind==='boundaryEvent'&&(!ids.has(n.attachedTo)&&!d.nodes.some(x=>x.id===n.attachedTo)))fail('bpmn/attachment',n.id);
 }
 const flowIds=new Set();
 for(const e of d.flows){
  if(!e.id||flowIds.has(e.id)||!EDGE_TYPES.has(e.kind))fail('bpmn/flow-id',e.id);
  flowIds.add(e.id);
  if(e.kind==='sequenceFlow'&&(!ids.has(e.from)||!ids.has(e.to)))fail('bpmn/endpoint',e.id);
  if(e.waypoints&&(!Array.isArray(e.waypoints)||e.waypoints.length<2||e.waypoints.some(p=>!Number.isFinite(+p.x)||!Number.isFinite(+p.y))))fail('bpmn/waypoints',e.id);
 }
 for(const n of d.nodes.filter(x=>x.calledElement)){
  if(!Array.isArray(d.callReferences)||!d.callReferences.some(r=>r.from===n.id&&r.toProcess===n.calledElement))fail('bpmn/call-reference',n.id);
 }
 if(d.lanes&&!Array.isArray(d.lanes))fail('bpmn/lanes','expected array');
 return {ok:true,nodes:d.nodes.length,flows:d.flows.length,types:Object.fromEntries([...NODE_TYPES].map(t=>[t,d.nodes.filter(n=>n.kind===t).length]).filter(x=>x[1])),unmapped:d.unmapped?.length||0};
}
const cx=b=>b.x+b.width/2,cy=b=>b.y+b.height/2;
function marker(type,x,y,r=13){
 const s='stroke="#17334e" stroke-width="1.8" fill="none" stroke-linejoin="round" stroke-linecap="round"';
 const b=`transform="translate(${f(x)} ${f(y)})"`;
 const paths={
  message:'<rect x="-10" y="-6" width="20" height="12"/><path d="M-10-6L0 1 10-6"/>',
  timer:'<circle r="10"/><path d="M0-8V0L5 4M0-10V-8M-10 0H-8M10 0H8M0 10V8"/>',
  signal:'<path d="M0-10L11 9H-11Z"/>',
  error:'<path d="M-7-9L-2 0 3-4 8 9 1 3-3 7Z"/>',
  escalation:'<path d="M-9 9L0-10 9 9 0 3Z"/>',
  conditional:'<rect x="-8" y="-9" width="16" height="18"/><path d="M-5-4H5M-5 0H5M-5 4H3"/>',
  link:'<path d="M-11-5H2V-10L12 0 2 10V5H-11Z"/>',
  terminate:'<circle r="9" fill="#17334e"/>',
  compensate:'<path d="M1-8L-10 0 1 8ZM11-8L0 0 11 8Z"/>',
  cancel:'<path d="M-7-7L7 7M7-7L-7 7"/>',
 };
 return paths[type]?`<g ${b} ${s} aria-hidden="true">${paths[type]}</g>`:'';
}
function taskIcon(kind,x,y){
 const s='stroke="#17334e" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round"';
 const icons={
  userTask:'<circle cx="10" cy="7" r="4"/><path d="M2 24v-4q0-8 8-8t8 8v4"/>',
  serviceTask:'<circle cx="11" cy="11" r="6"/><path d="M11 0v4M11 18v4M0 11h4M18 11h4M3 3l3 3M16 16l3 3M19 3l-3 3M6 16l-3 3"/>',
  scriptTask:'<path d="M3 0h14v22H3zM6 6h8M6 10h7M6 14h8"/>',
  manualTask:'<path d="M4 22L2 13l3-4 2 3V2q0-3 3-1v9V4q0-3 3-1v7-4q0-3 3-1v6-2q0-3 3-1v10l-4 4z"/>',
  sendTask:'<rect x="0" y="3" width="22" height="15"/><path d="M0 3l11 9L22 3"/>',
  receiveTask:'<rect x="0" y="3" width="22" height="15"/><path d="M0 3l11 9L22 3" stroke-dasharray="2 2"/>',
  businessRuleTask:'<rect x="0" y="0" width="23" height="20"/><path d="M0 5h23M8 5v15M0 12h23"/>',
 };
 return icons[kind]?`<g transform="translate(${f(x)} ${f(y)})" ${s} aria-hidden="true">${icons[kind]}</g>`:'';
}
function wrapLabel(label,max=26,lines=3){
 const words=String(label||'').replace(/\s+/g,' ').trim().split(' ');const result=[];let cur='';
 for(const word of words){if((cur+' '+word).trim().length>max&&cur){result.push(cur);cur=word}else cur=(cur+' '+word).trim()}
 if(cur)result.push(cur);
 if(result.length>lines){result.splice(lines-1,result.length-lines+1,result.slice(lines-1).join(' ').slice(0,max-2)+'…')}
 return result.slice(0,lines);
}
function textLabel(label,x,y,max=26,lines=3){const rows=wrapLabel(label,max,lines);return rows.map((r,i)=>`<text x="${f(x)}" y="${f(y+(i-(rows.length-1)/2)*15)}" text-anchor="middle" dominant-baseline="middle" font-family="Arial,sans-serif" font-size="12" fill="#14283f">${escape(r)}</text>`).join('')}
function drawNode(n){
 const b=n.bounds;const k=n.kind;const x=b.x,y=b.y,w=b.width,h=b.height,mx=cx(b),my=cy(b);
 const stroke='#17334e',fill='#fff';let inner='';
 if(k.endsWith('Event')){
  const r=Math.min(w,h,44)/2;
  let weight=k==='endEvent'?4.5:2;
  inner=`<circle cx="${f(mx)}" cy="${f(my)}" r="${f(r)}" fill="${fill}" stroke="${stroke}" stroke-width="${weight}"/>`;
  if(k==='boundaryEvent'||k.startsWith('intermediate'))inner+=`<circle cx="${f(mx)}" cy="${f(my)}" r="${f(r-4)}" stroke="${stroke}" stroke-width="1.7" fill="none" ${k==='boundaryEvent'&&n.cancelActivity===false?'stroke-dasharray="4 3"':''}/>`;
  if(n.event)inner+=marker(n.event,mx,my,r);
  // Labels for events outside their circles.
  if(n.label)inner+=textLabel(n.label,mx,my+r+15,22,2);
 }else if(k.endsWith('Gateway')){
  const r=Math.min(w,h)/2;
  inner=`<path d="M${f(mx)} ${f(my-r)} L${f(mx+r)} ${f(my)} L${f(mx)} ${f(my+r)} L${f(mx-r)} ${f(my)}Z" fill="${fill}" stroke="${stroke}" stroke-width="2.2"/>`;
  if(k==='exclusiveGateway')inner+=`<path d="M${f(mx-9)} ${f(my-9)}L${f(mx+9)} ${f(my+9)}M${f(mx+9)} ${f(my-9)}L${f(mx-9)} ${f(my+9)}" stroke="${stroke}" stroke-width="3"/>`;
  if(k==='parallelGateway')inner+=`<path d="M${f(mx-11)} ${f(my)}H${f(mx+11)} M${f(mx)} ${f(my-11)}V${f(my+11)}" stroke="${stroke}" stroke-width="3.5"/>`;
  if(k==='inclusiveGateway')inner+=`<circle cx="${f(mx)}" cy="${f(my)}" r="11" stroke="${stroke}" stroke-width="3" fill="none"/>`;
  if(k==='eventBasedGateway')inner+=`<circle cx="${f(mx)}" cy="${f(my)}" r="12" stroke="${stroke}" stroke-width="1.5" fill="none"/><path d="M${f(mx)} ${f(my-11)}L${f(mx+10)} ${f(my+7)}L${f(mx-10)} ${f(my+7)}Z" stroke="${stroke}" stroke-width="1.4" fill="none"/>`;
  if(k==='complexGateway')inner+=`<path d="M${f(mx)} ${f(my-12)}V${f(my+12)}M${f(mx-12)} ${f(my)}H${f(mx+12)}M${f(mx-9)} ${f(my-9)}L${f(mx+9)} ${f(my+9)}M${f(mx+9)} ${f(my-9)}L${f(mx-9)} ${f(my+9)}" stroke="${stroke}" stroke-width="2"/>`;
  if(n.label)inner+=textLabel(n.label,mx,my+r+16,24,2);
 }else if(k==='dataObjectReference'){
  inner=`<path d="M${f(x)} ${f(y)}H${f(x+w-17)}L${f(x+w)} ${f(y+17)}V${f(y+h)}H${f(x)}Z M${f(x+w-17)} ${f(y)}V${f(y+17)}H${f(x+w)}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`+textLabel(n.label,mx,my+4,18,3);
 }else if(k==='dataStoreReference'){
  inner=`<path d="M${f(x)} ${f(y+9)}V${f(y+h-9)}C${f(x)} ${f(y+h+4)} ${f(x+w)} ${f(y+h+4)} ${f(x+w)} ${f(y+h-9)}V${f(y+9)}" fill="${fill}" stroke="${stroke}" stroke-width="2"/><ellipse cx="${f(mx)}" cy="${f(y+9)}" rx="${f(w/2)}" ry="9" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`+textLabel(n.label,mx,my+9,18,2);
 }else if(k==='textAnnotation'){
  inner=`<path d="M${f(x+12)} ${f(y)}H${f(x)}V${f(y+h)}H${f(x+12)}" stroke="${stroke}" stroke-width="2" fill="none"/>`+textLabel(n.label,mx,my,28,3);
 }else{
  const double=k==='callActivity';
  const isSub=['subProcess','transaction','callActivity'].includes(k);
  inner=`<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="${double?3.7:2}"/>`;
  if(k==='transaction')inner+=`<rect x="${f(x+4)}" y="${f(y+4)}" width="${f(w-8)}" height="${f(h-8)}" rx="7" fill="none" stroke="${stroke}" stroke-width="1.6"/>`;
  if(isSub)inner+=`<rect x="${f(mx-7)}" y="${f(y+h-17)}" width="14" height="12" rx="2" fill="${fill}" stroke="${stroke}"/><path d="M${f(mx-4)} ${f(y+h-11)}h8M${f(mx)} ${f(y+h-15)}v8" stroke="${stroke}"/>`;
  inner+=taskIcon(k,x+11,y+11);
  inner+=textLabel(n.label,mx,my+(isSub?-6:0),Math.max(14,Math.floor(w/7.2)),3);
 }
 const detail=[n.kind,n.documentation||'',n.calledElement?`Calls: ${n.calledElement}`:''].filter(Boolean).join(' · ');
 return `<g id="node-${escape(n.id)}" data-node-id="${escape(n.id)}" data-node-label="${escape(n.label||n.id)}" data-node-kind="${escape(k)}" data-node-context="${escape(detail.slice(0,340))}" data-bpmn-kind="${escape(k)}" tabindex="0" role="button" aria-pressed="false" aria-label="Focus ${escape(n.label||n.id)}"><title>${escape((n.label||n.id)+' · '+detail)}</title>${inner}</g>`;
}
function boundsFor(d){const all=[...d.nodes.map(n=>n.bounds),...(d.lanes||[]).map(n=>n.bounds).filter(finiteRect),...(d.participants||[]).map(n=>n.bounds).filter(finiteRect)];const x0=Math.min(0,...all.map(b=>b.x)),y0=Math.min(0,...all.map(b=>b.y));return {x:x0-55,y:y0-50,right:Math.max(960,...all.map(b=>b.x+b.width))+70,bottom:Math.max(580,...all.map(b=>b.y+b.height))+85};}
function anchor(a,b){const dx=cx(b)-cx(a),dy=cy(b)-cy(a);if(Math.abs(dx)>Math.abs(dy))return [{x:dx>0?a.x+a.width:a.x,y:cy(a)},{x:dx>0?b.x:b.x+b.width,y:cy(b)}];return [{x:cx(a),y:dy>0?a.y+a.height:a.y},{x:cx(b),y:dy>0?b.y:b.y+b.height}];}
function pathFor(points){return points.map((p,i)=>`${i?'L':'M'}${f(p.x)} ${f(p.y)}`).join(' ')}
function drawFlow(e,byId){
 const a=byId.get(e.from)?.bounds,b=byId.get(e.to)?.bounds;
 if(!a||!b){ // Cross-pool external message flows may be in a separate view; show in coverage ledger instead of inventing endpoints.
  return '';
 }
 const pts=e.waypoints?.length>=2?e.waypoints:anchor(a,b);
 const dashed=e.kind==='messageFlow'?'stroke-dasharray="8 6"':e.kind==='association'||e.kind.includes('Association')?'stroke-dasharray="2 5"':'';
 const marker=e.kind==='sequenceFlow'?'marker-end="url(#bpmn-sequence-arrow)"':e.kind==='messageFlow'?'marker-start="url(#bpmn-message-start)" marker-end="url(#bpmn-message-arrow)""':'';
 const color=e.kind==='messageFlow'?'#0968a8':'#2d465e';
 const middle=pts[Math.floor(pts.length/2)];
 // Only directed execution/communication semantics participate in native Reach/Route.
 // Non-executable associations are drawn but cannot become fictitious paths.
 const directed=e.kind==='sequenceFlow'||e.kind==='messageFlow';
 const identity=directed?`data-edge-from="${escape(e.from)}" data-edge-to="${escape(e.to)}" data-edge-key="${escape(e.id)}" data-edge-id="${escape(e.id)}"`: `data-bpmn-source="${escape(e.from)}" data-bpmn-target="${escape(e.to)}" data-bpmn-edge-id="${escape(e.id)}"`;
 return `<g data-bpmn-flow-kind="${escape(e.kind)}"><path d="${pathFor(pts)}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" ${dashed} ${marker} ${identity} ${e.label?`data-edge-label="${escape(e.label)}"`:''}><title>${escape(e.kind+': '+(e.label||e.id))}</title></path>${e.label?`<text x="${f(middle.x)}" y="${f(middle.y-10)}" text-anchor="middle" font-size="11" fill="#11456b" paint-order="stroke" stroke="white" stroke-width="4">${escape(e.label)}</text>`:''}</g>`;
}
function drawFrame(b,label,kind){if(!finiteRect(b))return '';return `<g data-bpmn-frame="${escape(kind)}"><rect x="${f(b.x)}" y="${f(b.y)}" width="${f(b.width)}" height="${f(b.height)}" fill="${kind==='pool'?'#eff6fd':'#f7fbff'}" fill-opacity="0.42" stroke="#63839e" stroke-width="${kind==='pool'?2:1}" stroke-dasharray="${kind==='lane'?'4 4':''}"/><text x="${f(b.x+14)}" y="${f(b.y+19)}" fill="#17436c" font-size="13" font-weight="bold">${escape(label)}</text></g>`}
export function renderBpmnSvg(d){
 const receipt=validateBpmnDiagram(d);const byId=new Map(d.nodes.map(n=>[n.id,n]));const box=boundsFor(d);
 const dims=`viewBox="${f(box.x)} ${f(box.y)} ${f(box.right-box.x)} ${f(box.bottom-box.y)}" width="100%" height="100%"`;
 const defs=`<defs><marker id="bpmn-sequence-arrow" markerWidth="12" markerHeight="9" refX="11" refY="4.5" orient="auto"><path d="M0 0L12 4.5 0 9Z" fill="#2d465e"/></marker><marker id="bpmn-message-arrow" markerWidth="12" markerHeight="9" refX="11" refY="4.5" orient="auto"><path d="M1 1L11 4.5 1 8Z" fill="white" stroke="#0968a8"/></marker><marker id="bpmn-message-start" markerWidth="9" markerHeight="9" refX="3" refY="4.5" orient="auto"><circle cx="4.5" cy="4.5" r="3.5" fill="white" stroke="#0968a8"/></marker></defs>`;
 const pools=(d.participants||[]).map(p=>drawFrame(p.bounds,p.label,'pool')).join('');
 const lanes=(d.lanes||[]).map(l=>drawFrame(l.bounds,l.label,'lane')).join('');
 const connections=d.flows.map(e=>drawFlow(e,byId)).join('');
 const shapes=d.nodes.map(drawNode).join('');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" id="archify-diagram" class="diagram" ${dims} role="img" lang="${escape(d.meta.locale||'en')}" aria-labelledby="archify-diagram-title archify-diagram-description" data-animation="trace" data-preset="${escape(d.meta.visual_preset||'classic')}" data-quality-profile="${escape(d.meta.quality_profile||'standard')}"><title id="archify-diagram-title">${escape(d.meta.title)}</title><desc id="archify-diagram-description">BPMN process with ${d.nodes.length} nodes and ${d.flows.length} flows</desc>${defs}<g class="bpmn-pools">${pools}${lanes}</g><g class="bpmn-flows">${connections}</g><g class="bpmn-nodes">${shapes}</g></svg>`;
 return {svg,receipt:{...receipt,viewBox:[box.x,box.y,box.right-box.x,box.bottom-box.y]}};
}