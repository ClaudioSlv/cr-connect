import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
function compile(path,mocks={},extra={}){
 const js=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const m={exports:{}};new Function('require','exports','module',...Object.keys(extra),js)(name=>mocks[name],m.exports,m,...Object.values(extra));return m.exports;
}
test('frames stay small, preserve aspect ratio and do not upscale',()=>{
 const {photoFrameSize,mileageCameraConstraints}=compile('../src/lib/mileage-camera.ts');
 assert.deepEqual(photoFrameSize(4000,3000),{width:1280,height:960});
 assert.deepEqual(photoFrameSize(3000,4000),{width:960,height:1280});
 assert.deepEqual(photoFrameSize(640,480),{width:640,height:480});
 assert.throws(()=>photoFrameSize(0,0));assert.equal(mileageCameraConstraints.audio,false);assert.equal(mileageCameraConstraints.video.frameRate.max,15);
});
test('JPEG capture frees canvas backing memory after encoding or failure',async()=>{
 let encoded;const canvas={getContext:()=>({drawImage(){}}),toBlob(cb,type,quality){encoded={width:canvas.width,height:canvas.height,type,quality};cb(new Blob(['jpeg'],{type}));}};
 const api=compile('../src/lib/mileage-camera.ts',{}, {document:{createElement:()=>canvas}});
 const file=await api.captureMileageFrame({videoWidth:4000,videoHeight:3000});
 assert.equal(file.type,'image/jpeg');assert.deepEqual(encoded,{width:1280,height:960,type:'image/jpeg',quality:0.82});assert.equal(canvas.width,0);assert.equal(canvas.height,0);
 canvas.getContext=()=>null;await assert.rejects(api.captureMileageFrame({videoWidth:1280,videoHeight:720}));assert.equal(canvas.width,0);
});
async function cameraLifecycle({cancelBeforePermission=false,hidden=false}={}){
 let resolveMedia;let stopped=0,played=0,closed=0;const effects=[],listeners={};
 const media={getTracks:()=>[{stop(){stopped++;}}]};const video={srcObject:null,play:async()=>{played++;}};const modal={showModal(){},close(){}};
 const doc={visibilityState:'visible',addEventListener:(name,fn)=>listeners[name]=fn,removeEventListener(){}};
 const react={useRef:value=>({current:value}),useState:value=>[value,()=>{}],useEffect:fn=>effects.push(fn)};
 const jsx=(type,props)=>{if(props?.ref)props.ref.current=type==='video'?video:modal;return {type,props};};
 const lib=compile('../src/lib/mileage-camera.ts');
 const {MileageCamera}=compile('../src/components/mileage-camera.tsx',{react,'react/jsx-runtime':{jsx,jsxs:jsx},'@/lib/mileage-camera':lib},{document:doc,navigator:{mediaDevices:{getUserMedia:()=>new Promise(resolve=>{resolveMedia=resolve;})}}});
 MileageCamera({label:'KM inicial',onClose:()=>{closed++;},onCapture(){}});effects[0]();const cleanup=effects[1]();
 if(cancelBeforePermission)cleanup();resolveMedia(media);for(let i=0;i<4;i++)await new Promise(r=>setImmediate(r));
 if(hidden){doc.visibilityState='hidden';listeners.visibilitychange();}
 if(!cancelBeforePermission)cleanup();
 return {stopped,played,closed,video};
}
test('permission arriving after close cannot leave a camera stream running',async()=>{
 const result=await cameraLifecycle({cancelBeforePermission:true});assert.equal(result.stopped,1);assert.equal(result.played,0);
});
test('camera tracks are stopped when the page hides and on unmount',async()=>{
 const result=await cameraLifecycle({hidden:true});assert.equal(result.stopped,1);assert.equal(result.played,1);assert.equal(result.closed,1);assert.equal(result.video.srcObject,null);
});
