const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const cli = process.env.GENLAYER_CLI_PATH;
const passwordFile = process.env.ROUTEWINDOW_PASSWORD_FILE;
const account = process.env.ROUTEWINDOW_ACCOUNT;
const address = process.env.ROUTEWINDOW_DEPLOYER_ADDRESS;
if (!cli || !fs.existsSync(cli) || !passwordFile || !fs.existsSync(passwordFile) || !account || !/^0x[0-9a-f]{40}$/i.test(address || '')) throw Error('Set GENLAYER_CLI_PATH, ROUTEWINDOW_PASSWORD_FILE, ROUTEWINDOW_ACCOUNT and ROUTEWINDOW_DEPLOYER_ADDRESS.');
const password = fs.readFileSync(passwordFile, 'utf8').trim();
const hook = path.join(__dirname, 'cli-config.cjs');
const source = fs.readFileSync(path.join(root, 'contracts/route_window.py'));
const sourceHash = crypto.createHash('sha256').update(source).digest('hex');
const revision = '1572d8bb0e69cec849c38ab3980b4f3fe5eca707';
const repo = 'mahdidaawsh-commits/route-window';
const journal = path.join(root, '.proof-journal/studionet');
const proofs = path.join(root, 'proofs');
fs.mkdirSync(journal, { recursive: true });
const cases = [
  { file: '001-blue-suspension.md', action: 'CLOSE', routes: ['Blue'], start: 8, end: 12, expected: { Blue: [[8, 12]], Red: [] } },
  { file: '002-blue-restoration.md', action: 'RESTORE', routes: ['Blue'], start: 10, end: 11, expected: { Blue: [[8, 10], [11, 12]], Red: [] } },
  { file: '003-red-advisory.md', action: 'NONE', routes: [], start: 0, end: 0, expected: { Blue: [[8, 10], [11, 12]], Red: [] } },
  { file: '004-red-suspension.md', action: 'CLOSE', routes: ['Red'], start: 9, end: 11, expected: { Blue: [[8, 10], [11, 12]], Red: [[9, 11]] } },
];

function sanitize(value) {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== 'object') return value;
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === 'node_config') continue;
    result[key] = /private.?key|api.?key|password|secret|authorization/i.test(key) ? 'REDACTED' : sanitize(item);
  }
  return result;
}
function save(name, value) { fs.writeFileSync(path.join(proofs, name + '.json'), JSON.stringify(sanitize(value), null, 2) + '\n'); }
function result(output) {
  const start = output.indexOf('Result:');
  if (start < 0) throw Error('CLI result missing: ' + output.slice(-300));
  return JSON.parse(output.slice(start + 7).trim());
}
function invoke(label, args, overrides = {}) {
  const file = path.join(journal, label + '.json');
  const prior = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  if (prior.complete && (!['receipt', 'call'].includes(args[0]) || prior.stdout.includes('Result:'))) return Promise.resolve(prior.stdout);
  if (prior.hash && args[0] === 'write') return Promise.resolve('Write Transaction Hash: ' + prior.hash);
  if (prior.hash && args[0] === 'deploy') overrides.ROUTEWINDOW_RESUME_HASH = prior.hash;
  console.log('RUN', label);
  return new Promise((resolve, reject) => {
    const child = cp.spawn(process.execPath, ['--require', hook, cli, ...args], {
      cwd: root, windowsHide: true,
      env: { ...process.env, NO_COLOR: '1', ROUTEWINDOW_ACCOUNT: account, ...overrides },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    child.stdin.end(password + '\n');
    let stdout = '', stderr = '', hash = prior.hash;
    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
      const found = stdout.match(/(?:Deployment|Write) Transaction Hash:\s*(0x[0-9a-f]{64})/i)?.[1];
      if (found && found !== hash) {
        hash = found;
        fs.writeFileSync(file, JSON.stringify({ hash, complete: false }));
        console.log('SUBMITTED', label, hash);
      }
    });
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', code => {
      fs.writeFileSync(file, JSON.stringify({ hash, complete: code === 0, stdout, stderr }));
      if (code) reject(Error(label + ': ' + stderr.slice(-1200)));
      else resolve(stdout);
    });
  });
}
async function receipt(label, hash) {
  const data = result(await invoke(label + '-receipt', ['receipt', hash, '--retries', '300', '--interval', '3000']));
  save(label + '-receipt', data);
  const status = data.statusName || data.status_name;
  const execution = data.txExecutionResultName || data.consensus_data?.leader_receipt?.[0]?.execution_result;
  if (status !== 'FINALIZED' || data.result_name !== 'MAJORITY_AGREE' || !['SUCCESS', 'FINISHED_WITH_RETURN'].includes(execution)) throw Error(label + ': ' + status + '/' + data.result_name + '/' + execution);
  console.log('FINALIZED', label, hash, execution);
  return data;
}
async function rpc(method, params) {
  const response = await fetch('https://studio.genlayer.com/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(30000) });
  const data = await response.json();
  if (!response.ok || data.error) throw Error(JSON.stringify(data.error || response.status));
  return data.result;
}

(async () => {
  if (await rpc('eth_chainId', []) !== '0xf22f') throw Error('Unexpected chain ID');
  const accountInfo = await invoke('account', ['account', 'show', '--account', account]);
  if (!accountInfo.toLowerCase().includes(address.toLowerCase())) throw Error('Account mismatch');
  const sources = [];
  for (const item of cases) {
    const url = `https://raw.githubusercontent.com/${repo}/${revision}/bulletins/${item.file}`;
    const body = fs.readFileSync(path.join(root, 'bulletins', item.file));
    const upstream = await fetch(url);
    if (!upstream.ok || !body.equals(Buffer.from(await upstream.arrayBuffer()))) throw Error('Published bulletin differs: ' + item.file);
    sources.push({ file: item.file, url, sha256: crypto.createHash('sha256').update(body).digest('hex') });
  }
  const deployed = result(await invoke('main-deploy', ['deploy'], {
    ROUTEWINDOW_SOURCE_REPO: repo,
    ROUTEWINDOW_ORIGIN_UTC: '2026-10-03T00:00:00Z',
    ROUTEWINDOW_HORIZON_HOURS: '48',
    ROUTEWINDOW_ROUTES_JSON: JSON.stringify(['Blue', 'Red']),
  }));
  const contract = deployed['Contract Address'];
  const deployHash = deployed['Transaction Hash'];
  await receipt('main-deploy', deployHash);
  for (let index = 0; index < cases.length; index++) {
    const item = cases[index], source = sources[index], issue = index + 1;
    const output = await invoke(`issue-${issue}-write`, ['write', contract, 'ingest_bulletin', '--args', source.url, source.sha256]);
    const hash = output.match(/Write Transaction Hash:\s*(0x[0-9a-f]{64})/i)?.[1];
    if (!hash) throw Error('Missing write hash: ' + issue);
    await receipt(`issue-${issue}-write`, hash);
    const schedule = result(await invoke(`issue-${issue}-schedule`, ['call', contract, 'get_schedule']));
    const bulletin = result(await invoke(`issue-${issue}-bulletin`, ['call', contract, 'get_bulletin', '--args', String(issue)]));
    const report = bulletin.report;
    if (schedule.bulletin_count !== issue || JSON.stringify(schedule.closed_intervals) !== JSON.stringify(item.expected) || report.action !== item.action || JSON.stringify(report.routes) !== JSON.stringify(item.routes) || report.start_hour !== item.start || report.end_hour !== item.end || bulletin.sha256 !== source.sha256) throw Error('Unexpected onchain state for issue ' + issue + ': ' + JSON.stringify({ schedule, report }));
    save(`issue-${issue}`, { network: 'studionet', chain_id: 61999, contract_address: contract, source_sha256: sourceHash, source, transactions: [{ action: 'deploy', hash: deployHash }, { action: 'ingest_bulletin', hash }], schedule, bulletin });
    console.log('VERIFIED', issue, report.action, contract);
  }
  const codeOutput = await invoke('main-code', ['code', contract]);
  const start = codeOutput.indexOf('# { "Depends":');
  if (start < 0 || codeOutput.slice(start, start + source.length) !== source.toString()) throw Error('Deployed source mismatch');
  save('deployment', { network: 'studionet', chain_id: 61999, contract_address: contract, source_sha256: sourceHash, exact_source_match: true, source_revision: revision, deployment_transaction: deployHash, bulletin_sources: sources });
  console.log('SOURCE VERIFIED', contract);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
