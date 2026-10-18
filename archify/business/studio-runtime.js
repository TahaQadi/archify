/* Archify business Studio: an opt-in inspector layered on the existing Archify viewer.
 * No network, external dependencies, or writes to ERP/host filesystem. The source
 * model remains an exported JSON document; the rendered SVG is a compiled snapshot.
 */
(function () {
  'use strict';
  var source = document.getElementById('business-studio-source');
  var container = document.querySelector('.diagram-container');
  var svg = container && container.querySelector('svg');
  if (!source || !svg || typeof window.ArchifyBusinessValidate !== 'function') return;
  var initial;
  try { initial = JSON.parse(source.textContent); } catch (_) { return; }
  var model = initial.model;
  var processId = initial.processId;
  var baseline = JSON.stringify(model);
  var undoStack = [], redoStack = [];
  var selection = { type: 'process', id: processId };
  var tab = 'inspect';
  var isDirty = false;
  var errorMessage = '';
  var MAX_HISTORY = 60;
  var TYPES = ['people', 'roles', 'units', 'locations', 'systems', 'suppliers', 'information', 'managementSystems', 'capabilities'];
  var COLLECTIONS = ['permissions', 'assignments', 'controls', 'decisions', 'metrics', 'risks', 'requirements'];
  var STATUSES = ['confirmed', 'proposed', 'client-decision', 'assumed-for-workshop', 'new'];
  function arr(value) { return Array.isArray(value) ? value : []; }
  function html(value) { return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function idFormat(value) { return /^[A-Za-z][A-Za-z0-9_-]*$/.test(value); }
  function process() { return model.processes.find(function (p) { return p.id === processId; }); }
  function nameOf(type, id) { return (arr(model.entities[type]).find(function (e) { return e.id === id; }) || {}).name || id || '—'; }
  function processStep(id) { return process().steps.find(function (s) { return s.id === id; }); }
  function key(type, id) { return type + ':' + id; }
  function display(type, id) {
    if (type === 'step') return (processStep(id.split('.')[1]) || {}).name || id;
    if (type === 'process') return (model.processes.find(function (p) { return p.id === id; }) || {}).name || id;
    if (type.indexOf('entities.') === 0) return nameOf(type.slice(9), id);
    if (type === 'flow') { var f = process().flows[Number(id)]; return f ? f.from + ' → ' + f.to : id; }
    if (type === 'raci') return id;
    var collection = model[type];
    var record = type === 'assignments' ? arr(collection)[Number(id)] : arr(collection).find(function (x) { return x.id === id; });
    return record && (record.name || record.resource || record.description || record.id) || id;
  }
  function targetRecord(type, id, draft) {
    var p = draft.processes.find(function (x) { return x.id === processId; });
    if (type === 'process') return draft.processes.find(function (x) { return x.id === id; });
    if (type === 'step') return p.steps.find(function (x) { return key('step', p.id + '.' + x.id) === key(type, id); });
    if (type === 'raci') return p.raci.find(function (x) { return x.step === id; });
    if (type === 'flow') return p.flows[Number(id)];
    if (type.startsWith('entities.')) return arr(draft.entities[type.slice(9)]).find(function (x) { return x.id === id; });
    if (type === 'assignments') return arr(draft.assignments)[Number(id)];
    return arr(draft[type]).find(function (x) { return x.id === id; });
  }
  function updateDirty() { isDirty = JSON.stringify(model) !== baseline; }
  function runEdit(action) {
    var draft = clone(model);
    try {
      action(draft);
      var result = window.ArchifyBusinessValidate(draft);
      if (!result.valid) throw new Error(result.errors.slice(0,5).map(function (x) { return x.path + ': ' + x.message; }).join('\n'));
    } catch (ex) { errorMessage = ex.message || String(ex); render(); return false; }
    undoStack.push(model);
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack = []; model = draft; errorMessage = ''; updateDirty(); render(); return true;
  }
  function undo() { if (!undoStack.length) return; redoStack.push(model); model = undoStack.pop(); errorMessage = ''; updateDirty(); render(); }
  function redo() { if (!redoStack.length) return; undoStack.push(model); model = redoStack.pop(); errorMessage = ''; updateDirty(); render(); }
  function select(type, id, syncViewer) {
    selection = { type: type, id: id };
    errorMessage = ''; tab = 'inspect'; render();
    if (syncViewer && type === 'step' && id.startsWith(processId + '.') && window.Archify && window.Archify.focus) {
      Archify.focus.set(id.slice(processId.length + 1), { toggle: false });
      if (Archify.view && typeof Archify.view.reveal === 'function') {
        Archify.view.reveal([id.slice(processId.length + 1)], { includeNeighbors: true, reason: 'business-studio' });
      }
    }
  }
  function objectForSelection() { return targetRecord(selection.type, selection.id, model); }
  function field(name, label, value, kind, type, attrs) {
    var v = value == null ? '' : value;
    var attr = ' data-field="' + html(name) + '"';
    if (attrs) attr += ' ' + attrs;
    if (kind === 'select') {
      var options = [{ id: '', name: '— none —' }].concat(type === 'status' ? STATUSES.map(function (s) { return { id: s, name: s }; }) : type === 'phase' ? process().phases : type === 'kind' ? ['activity','decision','record','message','external'].map(function(s){return{id:s,name:s};}) : type === 'flow-kind' ? ['standard','branch','exception'].map(function(s){return{id:s,name:s};}) : arr(model.entities[type]));
      return '<label>' + html(label) + '<select' + attr + '>' + options.map(function (o) { return '<option value="' + html(o.id) + '"' + (o.id === v ? ' selected' : '') + '>' + html(o.name) + '</option>'; }).join('') + '</select></label>';
    }
    if (kind === 'checkbox') return '<label><input type="checkbox"' + attr + (v ? ' checked' : '') + '> ' + html(label) + '</label>';
    if (kind === 'textarea') return '<label>' + html(label) + '<textarea' + attr + '>' + html(v) + '</textarea></label>';
    return '<label>' + html(label) + '<input type="text" value="' + html(v) + '"' + attr + '></label>';
  }
  function refField(name, label, id, type) { return field(name, label, id, 'select', type); }
  function arrayField(name, label, ids, type) {
    return field(name, label + ' · comma-separated ' + type + ' IDs', arr(ids).join(', '), 'text');
  }
  function statusField(value) { return field('status', 'Requirement state (explicit approval required for confirmed)', value, 'select', 'status'); }
  function renderDetails() {
    var item = objectForSelection();
    if (!item) return '<p>No active selection. Select a node in the diagram or choose a register record.</p>';
    var type = selection.type;
    var blocks = '<div class="bs-muted">Stable ID: <code>' + html(selection.id) + '</code> · ' + html(type) + '</div>';
    if (type === 'flow') {
      blocks += refStep('from', 'From step', item.from) + refStep('to', 'To step', item.to) + field('kind', 'Transition type', item.kind || 'standard', 'select', 'flow-kind') + field('condition', 'Condition / exception rule', item.condition || '');
      return blocks + '<p class="bs-warning">A transition on the approved main path cannot be removed until that path is amended.</p>';
    }
    if (type === 'raci') {
      return blocks + refField('accountable', 'Accountable · one role', item.accountable, 'roles') + arrayField('responsible', 'Responsible', item.responsible, 'roles') + arrayField('consulted', 'Consulted', item.consulted, 'roles') + arrayField('informed', 'Informed', item.informed, 'roles');
    }
    if (type === 'process') return blocks + field('name', 'Process name', item.name) + refField('ownerRole', 'Process owner', item.ownerRole, 'roles') + refField('capability', 'Capability', item.capability, 'capabilities') + statusField(item.status);
    if (type === 'step') {
      var r = process().raci.find(function (x) { return x.step === item.id; });
      blocks += field('name', 'Activity name', item.name) + statusField(item.status) + field('phase', 'Phase', item.phase, 'select', 'phase') + refField('role', 'Executing role', item.role, 'roles') + refField('location', 'Location', item.location, 'locations') + refField('system', 'System', item.system, 'systems') + field('kind', 'Node kind', item.kind || 'activity', 'select', 'kind') + arrayField('inputs', 'Input information', item.inputs, 'information') + arrayField('outputs', 'Output information', item.outputs, 'information') + arrayField('permissions', 'Required grants', item.permissions, 'permissions') + arrayField('controls', 'Controls', item.controls, 'controls');
      blocks += '<hr><h3>Responsibility for this activity</h3>' + '<button type="button" data-nav="raci:' + html(item.id) + '">Edit RACI · A/R/C/I</button>';
      if (r) blocks += '<p class="bs-muted">A: ' + html(nameOf('roles', r.accountable)) + ' · R: ' + html(arr(r.responsible).map(function (id) { return nameOf('roles', id); }).join(', ')) + '</p>';
      blocks += '<h3>Activity flows</h3>' + arr(process().flows).map(function (f, i) { return f.from === item.id || f.to === item.id ? '<button type="button" class="bs-link" data-nav="flow:' + i + '">' + html(f.from + ' → ' + f.to) + ' ' + html(f.condition || '') + '</button>' : ''; }).join('');
      return blocks;
    }
    if (type.startsWith('entities.')) return blocks + field('name', 'Canonical name', item.name) + field('description', 'Description', item.description || '', 'textarea') + statusField(item.status);
    if (type === 'assignments') return blocks + refField('person', 'Person', item.person, 'people') + refField('role', 'Role', item.role, 'roles') + refField('unit', 'Unit', item.unit, 'units') + refField('location', 'Location', item.location, 'locations') + statusField(item.status);
    if (type === 'permissions') return blocks + field('resource', 'ERP resource / document', item.resource) + refField('role', 'Grantee role', item.role, 'roles') + refField('system', 'System', item.system, 'systems') + arrayField('actions', 'Actions', item.actions, 'actions') + field('scope', 'Access scope', item.scope || '') + field('requiresApproval', 'Requires separate approval', item.requiresApproval, 'checkbox') + refField('approverRole', 'Approving role', item.approverRole, 'roles') + statusField(item.status);
    if (type === 'controls') return blocks + field('name', 'Control', item.name) + refField('ownerRole', 'Owner', item.ownerRole, 'roles') + field('evidence', 'Evidence', item.evidence || '', 'textarea') + arrayField('appliesTo', 'Related process.step', item.appliesTo, 'process.step') + statusField(item.status);
    if (type === 'decisions') return blocks + field('name', 'Decision', item.name) + refField('proposerRole', 'Proposer', item.proposerRole, 'roles') + refField('approverRole', 'Approver', item.approverRole, 'roles') + refField('backupRole', 'Backup approver', item.backupRole, 'roles') + field('rule', 'Decision rule', item.rule || '', 'textarea') + statusField(item.status);
    if (type === 'metrics' || type === 'risks' || type === 'requirements') {
      blocks += field(type === 'requirements' ? 'description' : 'name', 'Name / requirement', item.name || item.description || '', 'textarea') + refField('ownerRole', 'Owner', item.ownerRole, 'roles') + statusField(item.status);
      if(type==='metrics')blocks+=field('definition','Definition',item.definition||'','textarea')+field('target','Target',item.target||'');
      if(type==='risks')blocks+=field('likelihood','Likelihood',item.likelihood||'')+field('impact','Impact',item.impact||'')+field('treatment','Mitigation',item.treatment||'','textarea');
      if(type==='requirements')blocks+=field('acceptanceCriteria','Acceptance criteria',item.acceptanceCriteria||'','textarea');
      return blocks;
    }
    return blocks;
  }
  function refStep(name, label, id) {
    return '<label>' + html(label) + '<select data-field="' + html(name) + '">' + process().steps.map(function (s) { return '<option value="' + html(s.id) + '"' + (s.id === id ? ' selected' : '') + '>' + html(s.name) + '</option>'; }).join('') + '</select></label>';
  }
  // Build an explicit reference graph. All edges target canonical model IDs.
  function graph() {
    var nodes = Object.create(null), edges = [];
    function add(t, id, label) { if (!id) return; var k = key(t, id); nodes[k] = { key: k, type: t, id: id, name: label || display(t, id) }; return k; }
    function link(from, to, relation) { if (from && to) edges.push({ from: from, to: to, relation: relation }); }
    arr(model.processes).forEach(function (p) {
      var pk = add('process', p.id, p.name);
      link(pk, add('entities.roles', p.ownerRole), 'owned by');
      link(pk, add('entities.capabilities', p.capability), 'capability');
      p.steps.forEach(function (s) {
        var sk = add('step', p.id + '.' + s.id, s.name);
        link(pk, sk, 'has step');
        link(sk, add('entities.roles', s.role), 'executed by');
        link(sk, add('entities.locations', s.location), 'at');
        link(sk, add('entities.systems', s.system), 'using');
        arr(s.inputs).forEach(function (x) { link(add('entities.information', x), sk, 'input'); });
        arr(s.outputs).forEach(function (x) { link(sk, add('entities.information', x), 'output'); });
        arr(s.controls).forEach(function (x) { link(sk, add('controls', x), 'controlled by'); });
        arr(s.permissions).forEach(function (x) { link(sk, add('permissions', x), 'requires'); });
      });
      p.flows.forEach(function (f) { link(add('step', p.id + '.' + f.from), add('step', p.id + '.' + f.to), f.condition || 'flows to'); });
      p.raci.forEach(function (r) {
        var sk = key('step', p.id + '.' + r.step);
        link(sk, add('entities.roles', r.accountable), 'A');
        arr(r.responsible).forEach(function (x) { link(sk, add('entities.roles', x), 'R'); });
        arr(r.consulted).forEach(function (x) { link(sk, add('entities.roles', x), 'C'); });
        arr(r.informed).forEach(function (x) { link(sk, add('entities.roles', x), 'I'); });
      });
    });
    TYPES.forEach(function (type) { arr(model.entities[type]).forEach(function (x) { add('entities.' + type, x.id, x.name); }); });
    arr(model.assignments).forEach(function (x, i) {
      var ak = add('assignments', String(i), 'Assignment ' + (i + 1));
      link(ak, add('entities.people', x.person), 'person');link(ak, add('entities.roles', x.role), 'role');
      link(ak, add('entities.locations', x.location), 'at');link(ak, add('entities.units', x.unit), 'unit');
    });
    COLLECTIONS.filter(function (x) { return x !== 'assignments'; }).forEach(function (type) {
      arr(model[type]).forEach(function (x) {
        var k = add(type, x.id, x.name || x.description || x.resource || x.id);
        link(k, add('entities.roles', x.ownerRole || x.approverRole || x.role), 'role');
        link(k, add('process', x.process), 'process');
        link(k, add('entities.systems', x.system), 'system');
      });
    });
    return { nodes: nodes, edges: edges };
  }
  function neighbors(graphData, centerKey) {
    return graphData.edges.filter(function (x) { return x.from === centerKey || x.to === centerKey; }).map(function (x) {
      return { key: x.from === centerKey ? x.to : x.from, relation: x.relation, outward: x.from === centerKey };
    }).filter(function (x, i, a) { return a.findIndex(function (y) { return y.key === x.key && y.relation === x.relation; }) === i; });
  }
  function graphCanvas(g, current, near) {
    var visible = near.slice(0, 12);
    if (!g.nodes[current]) return '';
    var pos = [{ x: 220, y: 155 }].concat(visible.map(function (_, i) { var a = (i / visible.length) * Math.PI * 2 - Math.PI / 2; return { x: 220 + 150 * Math.cos(a), y: 155 + 112 * Math.sin(a) }; }));
    var content = visible.map(function (item, i) {
      return '<line x1="220" y1="155" x2="' + pos[i + 1].x.toFixed(1) + '" y2="' + pos[i + 1].y.toFixed(1) + '" stroke="#63899f" stroke-width="1.4"/>';
    }).join('');
    [current].concat(visible.map(function (x) { return x.key; })).forEach(function (k, i) {
      var node = g.nodes[k] || { name: k }; var n = pos[i];
      var title = String(node.name || k).slice(0, 24);
      content += '<g class="bs-node ' + (i === 0 ? 'center' : '') + '" tabindex="0" role="button" data-goto="' + html(k) + '" aria-label="Inspect ' + html(node.name) + '">' +
        '<rect x="' + (n.x - 60).toFixed(1) + '" y="' + (n.y - 20).toFixed(1) + '" width="120" height="40" rx="8"/>' +
        '<text x="' + n.x.toFixed(1) + '" y="' + (n.y + 4).toFixed(1) + '" text-anchor="middle">' + html(title) + '</text></g>';
    });
    return '<svg class="bs-canvas" width="440" viewBox="0 0 440 310" role="img" aria-label="Editable relationship navigation map">' + content + '</svg>';
  }
  function renderExplore() {
    var g = graph(); var current = key(selection.type, selection.id), near = neighbors(g, current);
    var list = '<div class="bs-row between"><span>' + html(near.length) + ' direct relationships</span><span class="bs-muted">' + html(current) + '</span></div>';
    list += graphCanvas(g, current, near);
    list += '<div class="bs-group">' + near.map(function (r) {
      return '<button type="button" class="bs-link" data-nav="' + html(r.key) + '"><span class="bs-chip">' + html(r.relation) + '</span> ' + html((g.nodes[r.key] || {}).name || r.key) + '</button>';
    }).join('') + (near.length ? '' : '<p class="bs-muted">No linked relationships yet.</p>') + '</div>';
    list += '<h3>Browse entity registers</h3>' + TYPES.map(function (t) {
      return '<details><summary>' + html(t) + ' (' + arr(model.entities[t]).length + ')</summary>' + arr(model.entities[t]).map(function (e) { return '<button type="button" class="bs-link" data-nav="entities.' + t + ':' + html(e.id) + '">' + html(e.name) + '</button>'; }).join('') + '</details>';
    }).join('');
    list += '<h3>Other relationships</h3>' + COLLECTIONS.map(function (t) {
      return '<details><summary>' + html(t) + ' (' + arr(model[t]).length + ')</summary>' + arr(model[t]).map(function (e, i) { return '<button type="button" class="bs-link" data-nav="' + t + ':' + html(t === 'assignments' ? i : e.id) + '">' + html(e.name || e.resource || e.description || e.id || 'Assignment ' + (i + 1)) + '</button>'; }).join('') + '</details>';
    }).join('');
    return list;
  }
  function renderChecks() {
    var result = window.ArchifyBusinessValidate(model);
    var findings = result.errors.concat(result.warnings);
    return '<h3>Live semantic validation</h3><p>' + (result.valid ? 'Valid model' : 'Invalid model') + ' · ' + result.errors.length + ' errors · ' + result.warnings.length + ' warnings</p>' +
      findings.map(function (f) { return '<div class="bs-warning"><strong>' + html(f.code) + '</strong><br>' + html(f.path) + '<br>' + html(f.message) + '</div>'; }).join('') +
      (findings.length ? '' : '<p>No semantic findings.</p>') + '<p class="bs-muted">An approved status must reflect documented approval; it is not proof of authorization. Design permissions do not provision ERPNext.</p>';
  }
  var toggle = document.createElement('button');
  toggle.id = 'business-studio-toggle';toggle.type = 'button';toggle.textContent = 'Business Studio · Edit';toggle.setAttribute('aria-controls', 'business-studio');
  document.body.appendChild(toggle);
  var root = document.createElement('aside');root.id = 'business-studio';root.hidden = true;
  root.setAttribute('role', 'complementary');root.setAttribute('aria-label', 'Business model editor');
  document.body.appendChild(root);
  function render() {
    var current = display(selection.type, selection.id);
    var tabs = [['inspect', 'Edit'], ['explore', 'Relationships'], ['checks', 'Checks']];
    root.innerHTML = '<div class="bs-top"><div class="bs-row between"><div><div class="bs-title">Business Model Studio</div><div class="bs-muted">' + html(model.title) + '</div></div><button type="button" id="bs-close" aria-label="Close editor">✕</button></div>' +
      '<div class="bs-row bs-toolbar" style="margin-top:10px"><button data-act="undo"' + (!undoStack.length ? ' disabled' : '') + '>Undo</button><button data-act="redo"' + (!redoStack.length ? ' disabled' : '') + '>Redo</button><button data-act="download">Export JSON</button><button data-act="import">Import JSON</button></div>' +
      '<div class="bs-status">' + (isDirty ? 'Draft changed · export JSON to keep changes' : 'Unchanged source') + ' · Native Archify SVG: compiled snapshot</div></div>' +
      '<div class="bs-tabs" role="tablist">' + tabs.map(function (t) { return '<button type="button" role="tab" data-tab="' + t[0] + '" aria-selected="' + (tab === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div>' +
      '<div class="bs-body" id="bs-body"><label>Find a person, role, step, location, grant...</label><input id="bs-find" type="search" placeholder="Search canonical IDs and names" autocomplete="off">' +
      '<div id="bs-results"></div>' + (errorMessage ? '<div role="alert" class="bs-error">' + html(errorMessage) + '</div>' : '') +
      (tab === 'inspect' ? '<h3>' + html(current) + '</h3>' + renderDetails() : tab === 'explore' ? renderExplore() : renderChecks()) + '</div>' +
      '<div class="bs-footer"><div class="bs-row"><button data-act="add">Add record / relation</button><button data-act="delete" class="bs-danger">Delete selected</button></div><p class="bs-muted">Edits affect the embedded model only. Re-run the business build after exporting to rebuild diagram geometry.</p></div>';
    root.querySelector('[data-act="delete"]').disabled = selection.type === 'process' || selection.type === 'raci';
  }
  function changeField(name, raw, el) {
    var type = selection.type, id = selection.id;
    var previous = objectForSelection();
    if (!previous) return;
    var value = raw;
    if (el && el.type === 'checkbox') value = Boolean(el.checked);
    else if (['responsible','consulted','informed','actions','inputs','outputs','controls','permissions','appliesTo'].includes(name)) value = raw.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    if (name === 'status' && value === 'confirmed' && previous.status !== 'confirmed' && !window.confirm('Mark as CONFIRMED only after formal owner approval. Continue?')) { render(); return; }
    runEdit(function (draft) {
      var obj = targetRecord(type, id, draft);
      if (!obj) throw new Error('Selection has become unavailable');
      if (value === '' && ['system','location','description','capability','backupRole','approverRole','condition'].includes(name)) delete obj[name];
      else obj[name] = value;
    });
  }
  function add() {
    var menu = 'Add: role, person, unit, location, system, supplier, information, managementSystems, capability, step, flow, assignment, permission, control';
    var type = window.prompt(menu, selection.type === 'step' ? 'flow' : 'step');
    if (!type) return;
    type = type.trim();
    var entityAliases = { person: 'people', role: 'roles', unit: 'units', location: 'locations', system: 'systems', supplier: 'suppliers', capability: 'capabilities' };
    if (entityAliases[type]) type = entityAliases[type];
    if (TYPES.includes(type)) {
      var id = window.prompt('Stable ID (letters, digits, _ or -)', 'new_' + type.replace(/s$/, ''));
      if (!id) return;
      var name = window.prompt('Display name', id);
      if (!name) return;
      var success = runEdit(function (draft) {
        if (!idFormat(id)) throw new Error('Invalid stable ID');
        draft.entities[type].push({ id: id, name: name, status: 'new' });
      });
      if (success) select('entities.' + type, id);return;
    }
    if (type === 'step') {
      var id = window.prompt('New step ID', 'new_activity');if (!id) return;
      var name = window.prompt('Activity name', id);if (!name) return;
      var parent = process();var role = parent.steps[0].role, phase = parent.phases[0].id;
      var success = runEdit(function (draft) {
        if (!idFormat(id)) throw new Error('Invalid step ID');
        var p = draft.processes.find(function (x) { return x.id === processId; });
        p.steps.push({ id: id, name: name, role: role, phase: phase, status: 'new' });
        p.raci.push({ step: id, accountable: role, responsible: [role], consulted: [], informed: [] });
      });if (success) select('step', processId + '.' + id, false);return;
    }
    if (type === 'flow') {
      var from = window.prompt('From step ID', selection.type === 'step' ? selection.id.split('.')[1] : process().steps[0].id);
      if (!from) return;var to = window.prompt('To step ID', process().steps[1].id);if (!to) return;
      var success = runEdit(function (draft) { draft.processes.find(function (x) { return x.id === processId; }).flows.push({ from: from, to: to }); });
      if (success) select('flow', String(process().flows.length - 1));return;
    }
    if (type === 'assignment') {
      var first = model.entities;
      var success = runEdit(function (draft) {
        if (!first.people.length || !first.roles.length) throw new Error('Add a person and a role first');
        (draft.assignments || (draft.assignments = [])).push({ person: first.people[0].id, role: first.roles[0].id, status: 'new' });
      });if (success) select('assignments', String(model.assignments.length - 1));return;
    }
    if (type === 'permission') {
      var id = window.prompt('Permission ID', 'new_grant'); if (!id) return;
      var success = runEdit(function (draft) { draft.permissions.push({ id: id, role: draft.entities.roles[0].id, resource: 'Document', actions: ['read'], status: 'new' }); });
      if (success) select('permissions', id);return;
    }
    if (type === 'control') {
      var id = window.prompt('Control ID', 'new_control');if (!id) return;
      var success = runEdit(function (draft) { draft.controls.push({ id: id, name: id, ownerRole: draft.entities.roles[0].id, evidence: 'Define evidence', appliesTo: [], status: 'new' }); });
      if (success) select('controls', id);return;
    }
    errorMessage = 'Unknown record type: ' + type;render();
  }
  function removeSelected() {
    var type = selection.type, id = selection.id;
    if (type === 'process' || type === 'raci') { errorMessage = 'Deleting a process or mandatory RACI requires a separate governed change';render();return; }
    if (!window.confirm('Remove ' + id + '? References will not be automatically deleted. Validation will reject dangling references.')) return;
    var success = runEdit(function (draft) {
      if (type === 'flow') draft.processes.find(function (p) { return p.id === processId; }).flows.splice(Number(id), 1);
      else if (type === 'step') {
        var stepId = id.slice(processId.length + 1), p = draft.processes.find(function (x) { return x.id === processId; });
        p.steps = p.steps.filter(function (x) { return x.id !== stepId; });
        p.raci = p.raci.filter(function (x) { return x.step !== stepId; });
        // Deliberately don't silently rewrite flows, mainPath, or control scopes.
      } else if (type.startsWith('entities.')) {
        var collection = draft.entities[type.slice(9)];
        draft.entities[type.slice(9)] = collection.filter(function (x) { return x.id !== id; });
      } else if (type === 'assignments') draft.assignments.splice(Number(id), 1);
      else draft[type] = draft[type].filter(function (x) { return x.id !== id; });
    });
    if (success) select('process', processId);
  }
  function exportJson() {
    var data = JSON.stringify(model, null, 2) + '\n';
    var url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    var anchor = document.createElement('a');anchor.href = url; anchor.download = model.id + '.business.json';
    document.body.appendChild(anchor);anchor.click();anchor.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }
  function importJson() {
    var input = document.createElement('input');input.type = 'file';input.accept = '.json,application/json';
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];if (!file) return;
      if (file.size > 4 * 1024 * 1024) { errorMessage = 'The model must be under 4 MB';render();return; }
      file.text().then(function (data) {
        var candidate = JSON.parse(data);var diagnosis = window.ArchifyBusinessValidate(candidate);
        if (!diagnosis.valid) throw new Error(diagnosis.errors.slice(0,8).map(function (x) { return x.message; }).join('\n'));
        if (!candidate.processes.some(function (x) { return x.id === processId; })) throw new Error('Imported model does not contain this diagram process');
        if (!window.confirm('Replace the current draft with this model? The diagram remains the original compiled snapshot.')) return;
        undoStack.push(model);redoStack=[];model=candidate;errorMessage='';selection={type:'process',id:processId};updateDirty();render();
      }).catch(function (error) { errorMessage = error.message;render(); });
    });input.click();
  }
  function search(value) {
    var resultRoot = root.querySelector('#bs-results');if (!resultRoot) return;
    var q = value.trim().toLowerCase();if (q.length < 2) { resultRoot.innerHTML = '';return; }
    var data = graph(), hits = Object.keys(data.nodes).map(function (x) { return data.nodes[x]; }).filter(function (x) { return (x.name + ' ' + x.key).toLowerCase().includes(q); }).slice(0, 30);
    resultRoot.innerHTML = '<div class="bs-group">' + hits.map(function (n) { return '<button type="button" class="bs-link" data-nav="' + html(n.key) + '">' + html(n.name) + ' <span class="bs-chip">' + html(n.type) + '</span></button>'; }).join('') + '</div>';
  }
  root.addEventListener('click', function (event) {
    var button = event.target.closest('button, g[data-goto]');if (!button) return;
    if (button.id === 'bs-close') { root.hidden = true;toggle.hidden = false;toggle.focus();return; }
    if (button.hasAttribute('data-nav') || button.hasAttribute('data-goto')) {
      var token = button.getAttribute('data-nav') || button.getAttribute('data-goto');
      var i = token.indexOf(':');if (i > 0) select(token.slice(0, i), token.slice(i + 1), true);return;
    }
    if (button.hasAttribute('data-tab')) { tab = button.getAttribute('data-tab');render();return; }
    var act = button.getAttribute('data-act');if (act === 'undo')undo();if (act === 'redo')redo();if (act === 'add')add();if (act === 'delete')removeSelected();if (act === 'download')exportJson();if (act === 'import')importJson();
  });
  root.addEventListener('keydown', function (event) {
    if (event.target.matches('g[data-goto]') && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault();event.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
    if ((event.ctrlKey || event.metaKey) && event.key === 'z') { event.preventDefault();if (event.shiftKey)redo();else undo(); }
  });
  root.addEventListener('change', function (event) {
    if (event.target.hasAttribute('data-field')) changeField(event.target.getAttribute('data-field'), event.target.value, event.target);
  });
  root.addEventListener('input', function (event) { if (event.target.id === 'bs-find')search(event.target.value); });
  toggle.addEventListener('click', function () { root.hidden = false;toggle.hidden = true;render();root.querySelector('#bs-find').focus(); });
  svg.addEventListener('click', function (event) {
    var node = event.target.closest('[data-node-id]');if (!node) return;
    var stepId = node.getAttribute('data-node-id');
    if (processStep(stepId)) { root.hidden = false;toggle.hidden = true;select('step', processId + '.' + stepId, false); }
  }, true);
  svg.addEventListener('keydown', function (event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    var node = event.target.closest('[data-node-id]');if (!node) return;
    var stepId = node.getAttribute('data-node-id');if (processStep(stepId)) { root.hidden = false;toggle.hidden = true;select('step', processId + '.' + stepId, false); }
  }, true);
  window.addEventListener('beforeunload', function (event) { if (!isDirty) return;event.preventDefault();event.returnValue = ''; });
  render();
  window.ArchifyBusinessStudio = { open: function () {toggle.click();}, select: select, model: function () { return clone(model); }, validate: function () { return window.ArchifyBusinessValidate(model); } };
})();
