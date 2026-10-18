/** Embed an opt-in business inspector in an HTML artifact produced by Archify's native renderer. */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateBusinessModel } from './model.mjs';
const dir=dirname(fileURLToPath(import.meta.url));
const safeJson=value=>JSON.stringify(value).replace(/&/g,'\\u0026').replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
const esc=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

export function embedBusinessStudio(html,model,processId){
 const result=validateBusinessModel(model);
 if(!result.valid) throw new Error('Studio requires a semantically valid business model');
 if(!model.processes.some(p=>p.id===processId))throw new Error('Unknown process: '+processId);
 if(!html.includes('</body>') || !html.includes('data-node-id'))throw new Error('Studio requires a rendered Archify HTML diagram');
 const validator=readFileSync(join(dir,'model.mjs'),'utf8').replace(/\bexport\s+(?=(?:const|function)\b)/g,'');
 const client=readFileSync(join(dir,'studio-runtime.js'),'utf8');
 const css=readFileSync(join(dir,'studio.css'),'utf8');
 const injected=`\n<style id="business-studio-styles">${css.replace(/<\/style/gi,'<\\/style')}</style>\n`+
  `<script type="application/json" id="business-studio-source">${safeJson({model,processId})}</script>\n`+
  `<script id="business-studio-validator">(function(){${validator}\nwindow.ArchifyBusinessValidate=validateBusinessModel;})();</script>\n`+
  `<script id="business-studio-runtime">${client.replace(/<\/script/gi,'<\\/script')}</script>\n`;
 return html.replace('</body>',()=>injected+'</body>');
}
