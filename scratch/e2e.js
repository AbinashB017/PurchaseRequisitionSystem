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
  console.log('--- E2E Test Starting ---');

  // 1. Register users
  const reqEmail = `req_${Date.now()}@test.com`;
  const app1Email = `app1_${Date.now()}@test.com`;
  const app2Email = `app2_${Date.now()}@test.com`;

  console.log('Registering Requester...');
  let { cookie: reqCookie } = await request('/api/auth/register', {
    method: 'POST', body: { email: reqEmail, password: 'password', name: 'Requester', role: 'requester' }
  });

  console.log('Registering Approver 1 (Limit $10,000)...');
  let { cookie: app1Cookie } = await request('/api/auth/register', {
    method: 'POST', body: { email: app1Email, password: 'password', name: 'Big Approver', role: 'approver', approval_limit: 10000 }
  });

  console.log('Registering Approver 2 (Limit $500)...');
  let { cookie: app2Cookie } = await request('/api/auth/register', {
    method: 'POST', body: { email: app2Email, password: 'password', name: 'Small Approver', role: 'approver', approval_limit: 500 }
  });

  // 2. Requester creates draft and lines
  console.log('Creating Requisition...');
  let reqRes = await request('/api/requisitions', {
    method: 'POST', body: { title: 'Test E2E', vendor_name: 'Apple', department: 'IT', needed_by_date: '2026-10-01' }
  }, reqCookie);
  const reqId = reqRes.data.id;
  console.log('Requisition ID:', reqId);

  console.log('Adding line item ($1000 total)...');
  let lineRes = await request(`/api/requisitions/${reqId}/lines`, {
    method: 'POST', body: { description: 'Macbook', ordered_qty: 1, unit_price: 1000 }
  }, reqCookie);
  const lineId = lineRes.data.line_items[0].id;

  // 3. Submit
  console.log('Submitting...');
  await request(`/api/requisitions/${reqId}/submit`, { method: 'POST' }, reqCookie);

  // 4. Try to approve with small approver
  console.log('Small approver trying to approve...');
  let failApprove = await request(`/api/requisitions/${reqId}/approve`, { method: 'POST' }, app2Cookie);
  console.log('Small approver result:', failApprove.status, failApprove.data);
  if (failApprove.status !== 403) throw new Error('Expected 403 limit error');

  // 5. Small approver rejects
  console.log('Small approver rejecting...');
  let rejectRes = await request(`/api/requisitions/${reqId}/reject`, {
    method: 'POST', body: { reason: 'Too expensive for me' }
  }, app2Cookie);
  console.log('Reject status:', rejectRes.data.status);

  // 6. Requester submits again
  console.log('Requester submitting again...');
  await request(`/api/requisitions/${reqId}/submit`, { method: 'POST' }, reqCookie);

  // 7. Big approver approves
  console.log('Big approver approving...');
  let approveRes = await request(`/api/requisitions/${reqId}/approve`, { method: 'POST' }, app1Cookie);
  console.log('Approve status:', approveRes.data.status);

  // 8. Order
  console.log('Big approver ordering...');
  let orderRes = await request(`/api/requisitions/${reqId}/order`, { method: 'POST' }, app1Cookie);
  console.log('Order status:', orderRes.data.status);

  // 9. Extend date
  console.log('Big approver extending date...');
  await request(`/api/requisitions/${reqId}/extend-needed-by`, {
    method: 'POST', body: { needed_by_date: '2026-11-01' }
  }, app1Cookie);

  // 10. Receive partial
  console.log('Big approver receiving partial (0.5)...');
  await request(`/api/requisitions/${reqId}/receive`, {
    method: 'POST', body: { line_item_id: lineId, received_quantity: 0.5 }
  }, app1Cookie);

  // 11. Receive rest
  console.log('Big approver receiving rest (0.5)...');
  let finalRes = await request(`/api/requisitions/${reqId}/receive`, {
    method: 'POST', body: { line_item_id: lineId, received_quantity: 0.5 }
  }, app1Cookie);
  console.log('Final Requisition Status:', finalRes.data.status);

  // 12. Audit events
  console.log('Fetching audit events...');
  let auditRes = await request(`/api/requisitions/${reqId}/audit-events`, {}, app1Cookie);
  console.log('Audit Event Count:', auditRes.data.length);
  auditRes.data.forEach(a => console.log(` - [${a.type}] ${a.old_status || ''} -> ${a.new_status || ''} (metadata: ${JSON.stringify(a.metadata)})`));

  console.log('--- E2E Test Completed Successfully ---');
}

run().catch(console.error);
