#!/usr/bin/env python3
"""Conservative BPMN 2.0 XML -> Archify BPMN IR with source and element ledger.
This is a non-executable documentation importer. Uses Python's safe-by-default
ElementTree; no DTD, external resources, or remote documents are resolved.
"""
import argparse, hashlib, json, re, sys
from collections import defaultdict, deque
from pathlib import Path
from xml.etree import ElementTree as ET

NS = {'b': 'http://www.omg.org/spec/BPMN/20100524/MODEL', 'bpmndi': 'http://www.omg.org/spec/BPMN/20100524/DI', 'di': 'http://www.omg.org/spec/BPMN/20100524/DI', 'dd': 'http://www.omg.org/spec/DD/20100524/DC'}
FLOW_NODES = {'startEvent','endEvent','intermediateCatchEvent','intermediateThrowEvent','boundaryEvent','task','userTask','serviceTask','scriptTask','businessRuleTask','manualTask','sendTask','receiveTask','subProcess','transaction','callActivity','exclusiveGateway','inclusiveGateway','parallelGateway','eventBasedGateway','complexGateway','dataObjectReference','dataStoreReference','textAnnotation'}
FLOW_TYPES = {'sequenceFlow','messageFlow','association','dataInputAssociation','dataOutputAssociation'}
EVENT_TYPES={'messageEventDefinition':'message','timerEventDefinition':'timer','signalEventDefinition':'signal','errorEventDefinition':'error','escalationEventDefinition':'escalation','conditionalEventDefinition':'conditional','linkEventDefinition':'link','terminateEventDefinition':'terminate','compensateEventDefinition':'compensate','cancelEventDefinition':'cancel'}

def tag(el): return el.tag.split('}',1)[-1]
def q(root, name): return root.findall(f'.//b:{name}',NS)
def children(el, names): return [c for c in el if tag(c) in names]
def ident(x): return re.sub(r'[^A-Za-z0-9_-]', '_',x)[:100] or 'item'
def num(value, fallback=0):
 try:
  n=float(value)
  if not (-1e6<n<1e6): return fallback
  return round(n,2)
 except (TypeError, ValueError): return fallback

def documents(root):
 result=[]
 for proc in q(root,'process'):
  nodes=[]; edges=[];lane_by_node={}; lanes=[]
  for lane in proc.findall('.//b:lane',NS):
   lid=lane.get('id'); lanes.append({'id':lid,'label':lane.get('name',lid)})
   for ref in lane.findall('b:flowNodeRef',NS):
    lane_by_node[ref.text]=lid
  for child in proc:
   typ=tag(child)
   if typ in FLOW_NODES:
    nid=child.get('id');
    if not nid: raise ValueError(f'Node without id in {proc.get("id")}')
    defs=[EVENT_TYPES[tag(x)] for x in child if tag(x) in EVENT_TYPES]
    node={'id':nid,'kind':typ,'label':child.get('name',typ).replace('\n',' '),'event':defs[0] if defs else None,'lane':lane_by_node.get(nid),'attachedTo':child.get('attachedToRef'),'cancelActivity':child.get('cancelActivity')!='false','calledElement':child.get('calledElement'),'trigger':child.get('triggeredByEvent')=='true'}
    docs=[' '.join((d.text or '').split()) for d in child.findall('b:documentation',NS)]
    if docs:node['documentation']=' '.join(docs)
    nodes.append(node)
   elif typ in FLOW_TYPES:
    edges.append({'id':child.get('id'),'kind':typ,'from':child.get('sourceRef'),'to':child.get('targetRef'),'label':child.get('name','')})
  # Associations and data references may be nested inside activities. Explicitly inventory these rather than losing them.
  for nested in proc.iter():
   if nested is proc or nested in list(proc): continue
   typ=tag(nested)
   if typ in {'dataInputAssociation','dataOutputAssociation'}:
    refs=[(c.text or '').strip() for c in nested if tag(c) in ('sourceRef','targetRef')]
    edges.append({'id':nested.get('id') or f'auto_assoc_{len(edges)}','kind':typ,'from':refs[0] if refs else None,'to':refs[-1] if len(refs)>1 else None,'label':''})
  yield proc,nodes,edges,lanes

def load(xml_path, outdir, selected=None):
 raw=xml_path.read_bytes()
 if len(raw)>8_000_000:raise ValueError('BPMN input exceeds 8MB safety limit')
 if b'<!DOCTYPE' in raw.upper() or b'<!ENTITY' in raw.upper():raise ValueError('DTDs and entities are not accepted')
 root=ET.fromstring(raw)
 if tag(root)!='definitions':raise ValueError('Expected BPMN definitions')
 process_ids={p.get('id') for p in q(root,'process')}
 shapes={}; waypoints={}
 for shape in root.findall('.//bpmndi:BPMNShape',NS):
  bound=shape.find('dd:Bounds',NS)
  if bound is not None and shape.get('bpmnElement'):
   shapes[shape.get('bpmnElement')]={k:num(bound.get(k)) for k in ('x','y','width','height')}
 for edge in root.findall('.//bpmndi:BPMNEdge',NS):
  if edge.get('bpmnElement'):
   pts=[{'x':num(p.get('x')),'y':num(p.get('y'))} for p in edge.findall('di:waypoint',NS)]
   if len(pts)>1:waypoints[edge.get('bpmnElement')]=pts
 parts=[{'id':p.get('id'),'label':p.get('name',p.get('id')),'process':p.get('processRef'),'bounds':shapes.get(p.get('id'))} for p in q(root,'participant')]
 flow_by_proc=defaultdict(list)
 for process,nodes,edges,lanes in documents(root):
  flow_by_proc[process.get('id')].append((process,nodes,edges,lanes))
 results=[]
 for pid, batches in flow_by_proc.items():
  if selected and pid not in selected:continue
  proc,nodes,edges,lanes=batches[0]
  pids={n['id'] for n in nodes}
  problems=[]
  for n in nodes:
   if n.get('calledElement') and n['calledElement'] not in process_ids:problems.append(f'missing calledElement: {n["id"]} -> {n["calledElement"]}')
   if n.get('attachedTo') and n['attachedTo'] not in pids:problems.append(f'unknown attachment: {n["id"]}')
  for e in edges:
   if e['kind']=='sequenceFlow' and (e['from'] not in pids or e['to'] not in pids):problems.append(f'bad sequenceFlow: {e["id"]}')
  if problems:raise ValueError('; '.join(problems))
  # Preserve DI coordinates if present; otherwise give each process a deterministic graph layout.
  known={n['id']:shapes[n['id']] for n in nodes if n['id'] in shapes}
  steps=defaultdict(list)
  preds=defaultdict(list)
  for e in edges:
   if e['kind']=='sequenceFlow':preds[e['to']].append(e['from'])
  ranks={}
  for n in nodes:
   if n['kind']=='startEvent' or not preds[n['id']]:ranks[n['id']]=0
  # Capped relaxation: cycles must not cause infinite advancement.
  for _ in range(min(10,len(nodes))):
   changed=False
   for n in nodes:
    nid=n['id'];values=[ranks[x]+1 for x in preds[nid] if x in ranks]
    if nid not in ranks and values:ranks[nid]=max(values);changed=True
   if not changed:break
  for i,n in enumerate(nodes):
   nid=n['id']; lane=n.get('lane'); idx=next((i for i,x in enumerate(lanes) if x['id']==lane),len(lanes))
   rank=min(ranks.get(nid,i%6),12)
   if nid in known: n['bounds']=known[nid]
   else:
    same=[x for x in nodes[:i] if x.get('lane')==lane and ranks.get(x['id'],0)==rank]
    n['bounds']={'x':120+rank*200,'y':135+idx*175+len(same)*85,'width':140,'height':64}
  for e in edges:
   if e['id'] in waypoints:e['waypoints']=waypoints[e['id']]
  myparts=[x for x in parts if x['process']==pid]
  for lane in lanes:
   if lane['id'] in shapes:
    lane['bounds']=shapes[lane['id']]
   else:
    occupied=[n['bounds'] for n in nodes if n.get('lane')==lane['id']]
    if occupied:
     lx=min(b['x'] for b in occupied)-25
     ly=min(b['y'] for b in occupied)-31
     lane['bounds']={'x':lx,'y':ly,'width':max(b['x']+b['width'] for b in occupied)-lx+30,'height':max(b['y']+b['height'] for b in occupied)-ly+35}
  for p in myparts:
   if not p.get('bounds'):
    bound=[n['bounds'] for n in nodes]
    p['bounds']={'x':min([x['x'] for x in bound] or [40])-60,'y':min([x['y'] for x in bound] or [60])-60,'width':max([x['x']+x['width'] for x in bound] or [700])+100,'height':max([x['y']+x['height'] for x in bound] or [350])+100}
  doc={'schema_version':1,'diagram_type':'bpmn','meta':{'title':proc.get('name',pid),'output':f'{ident(pid)}.html','quality_profile':'standard','locale':'en'},'process':pid,'source':{'path':xml_path.name,'sha256':hashlib.sha256(raw).hexdigest(),'reviewStatus':'unreviewed'},'nodes':nodes,'flows':edges,'lanes':lanes,'participants':myparts,'callReferences':[{'from':n['id'],'toProcess':n['calledElement']} for n in nodes if n.get('calledElement')],'unmapped':[]}
  # Record nested subprocess contents that aren't represented as top-level flow nodes.
  for parent in proc.iter():
   if parent is proc: continue
   for nested in parent:
    if tag(nested) in FLOW_NODES or tag(nested) in FLOW_TYPES:
     doc['unmapped'].append({'id':nested.get('id'),'reason':'nested flow element requires separate BPMN subprocess/exception view'})
  # Document cross-process message flows, not infer sequence within a process.
  for e in q(root,'messageFlow'):
   if e.get('sourceRef') in pids or e.get('targetRef') in pids:
    if e.get('sourceRef') in pids and e.get('targetRef') in pids:
     doc['flows'].append({'id':e.get('id'),'kind':'messageFlow','from':e.get('sourceRef'),'to':e.get('targetRef'),'label':e.get('name',''),'waypoints':waypoints.get(e.get('id'))})
    else:
     doc['unmapped'].append({'id':e.get('id'),'reason':'message flow crosses diagram boundary; see collaboration view'})
  out=outdir/f'{ident(xml_path.stem)}-{ident(pid)}.bpmn.json'
  out.write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
  results.append({'file':str(out),'process':pid,'nodes':len(nodes),'flows':len(doc['flows']),'lanes':len(lanes),'unmapped':len(doc['unmapped']),'calls':len(doc['callReferences'])})
 return results

if __name__=='__main__':
 a=argparse.ArgumentParser(description=__doc__)
 a.add_argument('input',type=Path);a.add_argument('output_dir',type=Path);a.add_argument('--process',action='append')
 opts=a.parse_args();opts.output_dir.mkdir(parents=True,exist_ok=True)
 try:print(json.dumps(load(opts.input,opts.output_dir,set(opts.process or []) if opts.process else None),indent=2))
 except (ET.ParseError,ValueError) as e:print('BPMN import error:',e,file=sys.stderr);sys.exit(1)