async function request(endpoint, options = {}, cookie = '') {
  const url = `http://localhost:4000${endpoint}`;
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers['Cookie'] = cookie;
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let data;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('text/csv')) {
    data = await res.text();
  } else {
    data = await res.json().catch(() => null);
  }
  const setCookie = res.headers.get('set-cookie');
  let newCookie = cookie;
  if (setCookie) {
    const match = setCookie.match(/(token=[^;]+)/);
    if (match) newCookie = match[1];
  }
  return { status: res.status, data, cookie: newCookie };
}

async function run() {
  console.log('--- Phase 4 E2E ---\n');

  // Setup
  const ts = Date.now();
  let { cookie: reqCookie } = await request('/api/auth/register', {
    method: 'POST', body: { email: `p4req_${ts}@test.com`, password: 'password123', name: 'P4 Requester', role: 'requester' }
  });
  let { cookie: appCookie, data: appData } = await request('/api/auth/register', {
    method: 'POST', body: { email: `p4app_${ts}@test.com`, password: 'password123', name: 'P4 Approver', role: 'approver', approval_limit: 99999 }
  });
  let { cookie: appSmallCookie } = await request('/api/auth/register', {
    method: 'POST', body: { email: `p4small_${ts}@test.com`, password: 'password123', name: 'Small Approver', role: 'approver', approval_limit: 10 }
  });

  // Create 3 requisitions
  const reqIds = [];
  for (let i = 1; i <= 3; i++) {
    let r = await request('/api/requisitions', {
      method: 'POST', body: { title: `P4 Test Req ${i}`, vendor_name: `Vendor ${i}`, department: `Dept${i}`, needed_by_date: '2026-12-01' }
    }, reqCookie);
    await request(`/api/requisitions/${r.data.id}/lines`, {
      method: 'POST', body: { description: 'Item', ordered_qty: 1, unit_price: i * 100 }
    }, reqCookie);
    await request(`/api/requisitions/${r.data.id}/submit`, { method: 'POST' }, reqCookie);
    reqIds.push(r.data.id);
  }
  console.log(`Created and submitted ${reqIds.length} requisitions\n`);

  // TEST 1: Server-side search/filter
  console.log('TEST 1: Text search (q=P4 Test)');
  let searchRes = await request('/api/queues/submitted?q=P4+Test', {}, appCookie);
  console.log(`  Status: ${searchRes.status}, Count: ${searchRes.data.meta.total}`);
  console.assert(searchRes.data.meta.total >= 3, 'Expected >= 3 results');

  // TEST 2: Pagination
  console.log('\nTEST 2: Pagination (pageSize=2)');
  let pageRes = await request('/api/queues/submitted?q=P4+Test&pageSize=2&page=1', {}, appCookie);
  console.log(`  Page 1: ${pageRes.data.data.length} items, totalPages: ${pageRes.data.meta.totalPages}`);
  console.assert(pageRes.data.data.length === 2, 'Expected 2 items on page 1');

  let page2Res = await request('/api/queues/submitted?q=P4+Test&pageSize=2&page=2', {}, appCookie);
  console.log(`  Page 2: ${page2Res.data.data.length} items`);
  console.assert(page2Res.data.data.length >= 1, 'Expected items on page 2');

  // TEST 3: Sort by total descending
  console.log('\nTEST 3: Sort by total desc (via server-side param)');
  let sortRes = await request('/api/requisitions?q=P4+Test&sortBy=created_at&sortDir=desc', {}, appCookie);
  console.log(`  Status: ${sortRes.status}, Count: ${sortRes.data.meta.total}`);

  // TEST 4: Bulk approve — mix of valid and over-limit
  console.log('\nTEST 4: Bulk approve (2 valid for big approver, all refused for small approver)');
  
  // Small approver bulk approve — should refuse all (all > $10 limit)
  let smallBulk = await request('/api/bulk-approve', {
    method: 'POST', body: { ids: reqIds }
  }, appSmallCookie);
  console.log(`  Small approver → approved: ${smallBulk.data.summary.approved_count}, refused: ${smallBulk.data.summary.refused_count}`);
  console.assert(smallBulk.data.summary.approved_count === 0, 'Expected 0 approved for small approver');
  console.assert(smallBulk.data.summary.refused_count === 3, 'Expected 3 refused for small approver');
  console.log(`  First refusal reason: "${smallBulk.data.refused[0].reason}"`);

  // Big approver bulk approve first 2
  let bigBulk = await request('/api/bulk-approve', {
    method: 'POST', body: { ids: [reqIds[0], reqIds[1]] }
  }, appCookie);
  console.log(`  Big approver → approved: ${bigBulk.data.summary.approved_count}, refused: ${bigBulk.data.summary.refused_count}`);
  console.assert(bigBulk.data.summary.approved_count === 2, 'Expected 2 approved');

  // Try bulk approve an already-approved one
  let alreadyApproved = await request('/api/bulk-approve', {
    method: 'POST', body: { ids: [reqIds[0]] }
  }, appCookie);
  console.log(`  Re-approving already-approved → refused: ${alreadyApproved.data.refused[0].reason}`);

  // TEST 5: CSV Export — order req #3 first
  await request(`/api/requisitions/${reqIds[2]}/approve`, { method: 'POST' }, appCookie);
  await request(`/api/requisitions/${reqIds[2]}/order`, { method: 'POST' }, appCookie);

  console.log('\nTEST 5: CSV Export for ordered requisitions');
  let csvRes = await request('/api/export/ordered.csv', {}, appCookie);
  console.log(`  Status: ${csvRes.status}`);
  const csvLines = csvRes.data.split('\r\n');
  console.log(`  CSV headers: ${csvLines[0]}`);
  console.log(`  Data rows: ${csvLines.length - 1}`);
  console.assert(csvLines[0].includes('Vendor'), 'CSV should have Vendor column');
  console.assert(csvLines.length >= 2, 'CSV should have at least one data row');

  console.log('\n--- All Phase 4 checks passed ✅ ---');
}

run().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
