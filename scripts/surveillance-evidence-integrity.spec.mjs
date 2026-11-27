import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,readFile,writeFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createManifest,verifyManifest} from './surveillance-evidence-integrity.mjs';

test('evidence manifest verifies bytes, detects tamper and never overwrites', async()=>{
  const dir=await mkdtemp(join(tmpdir(),'scc380-evidence-'));
  const clip=join(dir,'recording.mp4');
  const manifest=clip+'.integrity.json';
  try{
    await writeFile(clip,Buffer.from('synthetic-test-recording-not-real-media'));
    const created=await createManifest(clip,manifest);
    assert.match(created.sha256,/^[a-f0-9]{64}$/);
    assert.equal((await verifyManifest(clip,manifest)).ok,true);
    await assert.rejects(()=>createManifest(clip,manifest),{code:'EEXIST'});
    await writeFile(clip,Buffer.from('tampered-test-recording-not-real-media'));
    assert.equal((await verifyManifest(clip,manifest)).ok,false);
    await writeFile(clip,Buffer.from('synthetic-test-recording-not-real-media'));
    const bad=JSON.parse(await readFile(manifest,'utf8'));
    bad.sha256='not-a-hash';
    await writeFile(manifest,JSON.stringify(bad));
    await assert.rejects(()=>verifyManifest(clip,manifest),/INVALID_MANIFEST/);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('evidence tool rejects wrong paths, empty files and symlink clips',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'scc380-evidence-'));
  const clip=join(dir,'empty.mp4');
  try{
    await writeFile(clip,'');
    await assert.rejects(()=>createManifest(clip,clip+'.integrity.json'),/UNSAFE_OR_EMPTY_CLIP/);
    await writeFile(join(dir,'actual.mp4'),'clip');
    const link=join(dir,'alias.mp4');
    await symlink(join(dir,'actual.mp4'),link);
    await assert.rejects(()=>createManifest(link,link+'.integrity.json'),/UNSAFE_OR_EMPTY_CLIP/);
  }catch(e){throw e;}
  try{
    await assert.rejects(()=>createManifest(join(dir,'actual.mp4'),join(dir,'other.json')),/MANIFEST_MUST_BE_ADJACENT/);
    await assert.rejects(()=>createManifest(join(dir,'actual.mp4'),join(dir,'actual.mp4.integrity.json')+'-wrong'),/MANIFEST_MUST_BE_ADJACENT/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
