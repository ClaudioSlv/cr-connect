import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
function setup({uploadError=null,metadataError=null}={}){
 const removed=[],uploads=[];let payload;
 const storage={upload:async(path,file)=>{uploads.push({path,file});return {error:uploadError};},remove:async paths=>{removed.push(...paths);return {error:null};}};
 const query={select(){return query;},eq(){return query;},maybeSingle:async()=>({data:{id:'previous',storage_path:'previous-photo'},error:null}),single:async()=>({data:metadataError?null:{id:'new'},error:metadataError})};
 const db={storage:{from:()=>storage},from:()=>({...query,update(data){payload=data;return query;},insert(data){payload=data;return query;}})};
 const code=ts.transpileModule(readFileSync(new URL('../src/lib/mileage-photos.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const m={exports:{}};new Function('require','exports','module',code)(()=>({createClient:()=>db}),m.exports,m);
 return {...m.exports,removed,uploads,getPayload:()=>payload};
}
const file={name:'painel.jpg',type:'image/jpeg',size:1200};
test('accept photos but reject PDF, empty and oversized files',()=>{
 const api=setup();assert.equal(api.validateMileagePhoto(file),null);
 for(const invalid of [{...file,type:'application/pdf'},{...file,size:0},{...file,size:26*1024*1024}])assert(api.validateMileagePhoto(invalid));
});
test('replacing a photo stores the right O.S. and removes the previous object after saving',async()=>{
 const api=setup();await api.uploadMileagePhoto('workshop','order','mileage_initial',file);
 assert.match(api.uploads[0].path,/^workshop\/orders\/order\/mileage_initial\//);
 assert.equal(api.getPayload().attachment_kind,'mileage_initial');assert.equal(api.getPayload().service_order_id,'order');
 assert.deepEqual(api.removed,['previous-photo']);
});
test('failed metadata save cleans up the new upload and preserves the previous photo',async()=>{
 const api=setup({metadataError:{message:'database failed'}});
 await assert.rejects(api.uploadMileagePhoto('workshop','order','mileage_final',file),/database failed/);
 assert.deepEqual(api.removed,[api.uploads[0].path]);assert(!api.removed.includes('previous-photo'));
});
test('failed upload never changes or deletes previous metadata/photo',async()=>{
 const api=setup({uploadError:{message:'offline'}});
 await assert.rejects(api.uploadMileagePhoto('workshop','order','mileage_final',file),/offline/);
 assert.equal(api.getPayload(),undefined);assert.deepEqual(api.removed,[]);
});
