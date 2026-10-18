import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { embedBusinessStudio } from '../archify/business/studio.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const sample=JSON.parse(readFileSync(resolve(root,'archify/examples/business/distribution-fulfillment.json'),'utf8'));
const mock='<!doctype html><html><head></head><body><div class="diagram-container"><svg><g data-node-id="capture" tabindex="0" role="button"><rect/><text>Record customer request</text></g><g data-node-id="allocate" tabindex="0" role="button"><rect/><text>Check stock</text></g></svg></div><script>window.Archify={focus:{set:function(id){window.lastFocus=id;}}};</script></body></html>';
test('native diagram remains intact while editor code is embedded',()=>{
 const output=embedBusinessStudio(mock,sample,'order_to_delivery');
 assert.ok(output.includes('data-node-id="capture"'));
 assert.ok(output.includes('business-studio-runtime'));
 assert.ok(output.includes('business-studio-source'));
 assert.ok(output.includes('ArchifyBusinessValidate=validateBusinessModel'));
 assert.ok(output.indexOf('data-node-id="capture"')<output.indexOf('business-studio-runtime'));
});
test('model embedding escapes scripts, ampersands and dangerous tags',()=>{
 const malicious=structuredClone(sample);
 malicious.entities.roles[0].name='</script><svg onload=alert(1)>&';
 const output=embedBusinessStudio(mock,malicious,'order_to_delivery');
 assert.ok(!output.includes('</script><svg onload=alert(1)>'));
 assert.ok(output.includes('\\u003c/script\\u003e'));
});
test('studio refuses invalid documents and non-native renderer output',()=>{
 assert.throws(()=>embedBusinessStudio('<body></body>',sample,'order_to_delivery'),/rendered Archify/);
 assert.throws(()=>embedBusinessStudio(mock,sample,'wrong_id'),/Unknown process/);
 const modified=structuredClone(sample);modified.processes[0].raci=[];
 assert.throws(()=>embedBusinessStudio(mock,modified,'order_to_delivery'),/semantically valid/);
});
