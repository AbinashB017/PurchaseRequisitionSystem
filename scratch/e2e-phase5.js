const fs = require('fs');

async function request(endpoint, options = {}, cookie = '') {
  const url = `http://localhost:4000${endpoint}`;
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers['Cookie'] = cookie;
  
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => null);
  const setCookie = res.headers.get('set-cookie');
  let newCookie = cookie;
  if (setCookie) {
    const match = setCookie.match(/(token=[^;]+)/);
    if (match) newCookie = match[1];
  }

  return { status: res.status, data, cookie: newCookie };
}

async function run() {
  console.log('--- Phase 5 E2E (Dashboard & Alerts) ---');
  const ts = Date.now();

  console.log('1. Register Users...');
  const { cookie: reqCookie } = await request('/api/auth/register', {
    method: 'POST', body: { email: `req5_${ts}@test.com`, password: 'password123', name: 'Requester', role: 'requester' }
  });
  const { cookie: appCookie, data: appData } = await request('/api/auth/register', {
    method: 'POST', body: { email: `app5_${ts}@test.com`, password: 'password123', name: 'Approver', role: 'approver', approval_limit: 99999 }
  });
  const approverId = appData.user.id;

  console.log('2. Create an overdue ordered requisition...');
  const reqRes = await request('/api/requisitions', {
    method: 'POST', body: { title: 'Overdue Item', vendor_name: 'Apple', department: 'IT', needed_by_date: '2020-01-01' }
  }, reqCookie);
  const reqId = reqRes.data.id;
  await request(`/api/requisitions/${reqId}/lines`, {
    method: 'POST', body: { description: 'Mac', ordered_qty: 1, unit_price: 1500 }
  }, reqCookie);
  await request(`/api/requisitions/${reqId}/submit`, { method: 'POST' }, reqCookie);

  console.log('3. Assign approver, approve, and order...');
  await request(`/api/requisitions/${reqId}/approvers`, {
    method: 'POST', body: { approver_id: approverId }
  }, appCookie);
  await request(`/api/requisitions/${reqId}/approve`, { method: 'POST' }, appCookie);
  await request(`/api/requisitions/${reqId}/order`, { method: 'POST' }, appCookie);

  console.log('4. Check Dashboard metrics...');
  const dashRes = await request('/api/dashboard', {}, appCookie);
  console.log('  Ordered Total:', dashRes.data.ordered_total);
  console.log('  Overdue Count:', dashRes.data.overdue_count);
  if (dashRes.data.ordered_total < 1500 || dashRes.data.overdue_count < 1) {
    throw new Error('Dashboard metrics incorrect');
  }

  console.log('5. Check Alerts...');
  let alertsRes = await request('/api/alerts', {}, appCookie);
  console.log('  Active Alerts:', alertsRes.data.length);
  if (alertsRes.data.length !== 1 || alertsRes.data[0].id !== reqId) {
    throw new Error('Alert not found');
  }

  let countRes = await request('/api/alerts/count', {}, appCookie);
  console.log('  Alert Count Endpoint:', countRes.data.count);
  if (countRes.data.count !== 1) throw new Error('Alert count mismatch');

  console.log('6. Dismiss Alert...');
  await request(`/api/alerts/${reqId}/dismiss`, { method: 'POST' }, appCookie);

  console.log('7. Re-check Alerts (should be dismissed)...');
  alertsRes = await request('/api/alerts', {}, appCookie);
  console.log('  Active Alerts after dismiss:', alertsRes.data.length);
  if (alertsRes.data.length !== 0) throw new Error('Alert was not dismissed');

  console.log('8. Extend needed-by date to re-trigger alert...');
  // Extend to a date still in the past (e.g. 2021) to immediately trigger it again
  await request(`/api/requisitions/${reqId}/extend-needed-by`, {
    method: 'POST', body: { needed_by_date: '2021-01-01' }
  }, appCookie);

  console.log('9. Re-check Alerts (should be re-triggered)...');
  alertsRes = await request('/api/alerts', {}, appCookie);
  console.log('  Active Alerts after extend:', alertsRes.data.length);
  if (alertsRes.data.length !== 1) throw new Error('Alert did not re-trigger');

  console.log('--- Phase 5 E2E Completed Successfully ---');
}

run().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
