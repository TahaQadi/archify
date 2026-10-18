import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=join(repo,'archify/examples/business/distribution-fulfillment.json');

test('studio build renders with the REAL Archify workflow engine, preserving node focus semantics',()=>{
  const dir=mkdtempSync(join(tmpdir(),'archify-business-native-'));
  try {
    const command=spawnSync(process.execPath,[
      join(repo,'archify/business/cli.mjs'),'build',source,dir,'--studio'
    ],{cwd:repo,encoding:'utf8',maxBuffer:12*1024*1024});
    assert.equal(command.status,0,
      'Native renderer failed:\n'+(command.stderr||'')+'\n'+(command.stdout||'')+'\n'+(command.error||''));
    const generated=join(dir,'order_to_delivery.html');
    assert.ok(existsSync(generated),'Native diagram was not generated');
    const html=readFileSync(generated,'utf8');
    assert.match(html,/data-node-id="capture"/);
    assert.match(html,/data-node-id="allocate"/);
    assert.match(html,/business-studio-runtime/);
    assert.match(html,/Archify\.focus/);
    assert.match(html,/business-studio-source/);
    assert.ok(existsSync(join(dir,'business-operating-model.html')));
    assert.ok(existsSync(join(dir,'order_to_delivery.workflow.json')));
  } finally { rmSync(dir,{recursive:true,force:true}); }
});
