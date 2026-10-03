const fs = require('node:fs');
const path = require('node:path');

module.exports = async function deployRouteWindow(client) {
  const repo = process.env.ROUTEWINDOW_SOURCE_REPO;
  const origin = process.env.ROUTEWINDOW_ORIGIN_UTC;
  const hours = Number(process.env.ROUTEWINDOW_HORIZON_HOURS);
  const routes = process.env.ROUTEWINDOW_ROUTES_JSON;
  if (!repo || !origin || !Number.isInteger(hours) || !routes || !Array.isArray(JSON.parse(routes))) throw Error('Set ROUTEWINDOW_SOURCE_REPO, ROUTEWINDOW_ORIGIN_UTC, ROUTEWINDOW_HORIZON_HOURS, and ROUTEWINDOW_ROUTES_JSON.');
  const code = fs.readFileSync(path.join(__dirname, '../contracts/route_window.py'), 'utf8');
  const hash = process.env.ROUTEWINDOW_RESUME_HASH || await client.deployContract({ code, args: [repo, origin, hours, routes], leaderOnly: false });
  console.log('Deployment Transaction Hash:', hash);
  const receipt = await client.waitForTransactionReceipt({ hash, retries: 300, interval: 3000, status: 'FINALIZED' });
  const execution = receipt.consensus_data?.leader_receipt?.[0]?.execution_result ?? receipt.txExecutionResultName;
  if ((receipt.status_name || receipt.statusName || receipt.status) !== 'FINALIZED' || !['SUCCESS', 'FINISHED_WITH_RETURN'].includes(execution)) throw Error('Deployment failed: ' + execution);
  const address = receipt.data?.contract_address ?? receipt.txDataDecoded?.contractAddress;
  if (!/^0x[0-9a-f]{40}$/i.test(address || '')) throw Error('Deployment address missing.');
  console.log('Result:', { 'Transaction Hash': hash, 'Contract Address': address });
};
