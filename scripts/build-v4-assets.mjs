import { readFile, writeFile, mkdir, cp, mkdtemp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';

const pkg = JSON.parse(await readFile('vendor/typeset-v4/package.json','utf8'));
const version = pkg.version, base = `https://typeset.us/releases/${version}`;
const manifestBytes = await readFile('vendor/typeset-v4/dist/manifest.json');
const artifactSHA256 = createHash('sha256').update(manifestBytes).digest('hex');
assert.equal(artifactSHA256,'bb9724ba5951a4b9bc72508ec607a96f72184866b2559751cc1def7d03cef4f2','V4 must be the accepted engine artifact');
const compiled = JSON.parse(manifestBytes);
const immutable = async (path, bytes) => {
  let committed;
  try { committed = execFileSync('git',['show',`HEAD:${path}`],{stdio:['ignore','pipe','ignore']}); } catch {}
  if (committed) assert.ok(committed.equals(Buffer.from(bytes)), `Refusing to alter published release file ${path}`);
  await writeFile(path,bytes);
};
await mkdir(`public/releases/${version}`,{recursive:true});
await mkdir('public/v4',{recursive:true});
for (const [file, details] of Object.entries(compiled.artifacts)) {
  const bytes = await readFile('vendor/typeset-v4/dist/'+file);
  assert.equal('sha384-'+createHash('sha384').update(bytes).digest('base64'),details.integrity,`Corrupt V4 artifact ${file}`);
  await immutable(`public/releases/${version}/${file}`,bytes);
}
const agent = await readFile('docs/v4/for-agents.md','utf8');
await writeFile('vendor/typeset-v4/for-agents.md',agent);
await writeFile('public/for-agents.md',agent);
await writeFile('public/v4/SKILL.md',await readFile('docs/v4/SKILL.md'));
for (const file of ['README.md','MIGRATION.md','SUPPORT.md','LICENSE','THIRD-PARTY-LICENSES.txt','UNICODE-LICENSE.txt','for-agents.md']) await immutable(`public/releases/${version}/${file}`,await readFile('vendor/typeset-v4/'+file));
const temp = await mkdtemp(join(tmpdir(),'typeset-v4-pack-'));
const packed = JSON.parse(execFileSync('npm',['pack','--ignore-scripts','--json','--pack-destination',temp],{cwd:resolve('vendor/typeset-v4'),encoding:'utf8'}))[0];
await immutable(`public/releases/${version}/${packed.filename}`,await readFile(join(temp,packed.filename)));
const distribution = { schemaVersion:1, package:pkg.name, version, channel:'beta', artifactSHA256, npmLatestIsV4:false, packageURL:`${base}/${packed.filename}`, packageIntegrity:packed.integrity, browser:{loader:`${base}/go.js`,global:`${base}/typeset.global.js`,stylesheet:`${base}/styles.css`,loaderIntegrity:compiled.artifacts['go.js'].integrity}, artifacts:compiled.artifacts, installCommand:`npm install ${base}/${packed.filename}`, source:'https://github.com/speedwarnsf/web-typography/tree/codex/typeset-v4-launch/vendor/typeset-v4', legacy:'https://typeset.us/for-agents-v3.md' };
const data=JSON.stringify(distribution,null,2)+'\n';
await immutable(`public/releases/${version}/manifest.json`,data);
await writeFile('public/v4/manifest.json',data);
const capabilities=JSON.parse(await readFile('vendor/typeset-v4/capabilities.json','utf8'));
await writeFile('public/v4/capabilities.json',JSON.stringify({...capabilities,distribution:{manifest:'https://typeset.us/v4/manifest.json',packageURL:distribution.packageURL,npmLatestIsV4:false},documentation:'https://typeset.us/for-agents.md'},null,2)+'\n');
for (const file of ['go.js','typeset.global.js','styles.css']) await cp(`vendor/typeset-v4/dist/${file}`,`public/v4/${file}`);
console.log(`Prepared pinned V4 assets: ${version}; accepted engine ${artifactSHA256}`);
