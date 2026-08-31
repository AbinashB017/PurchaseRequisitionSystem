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
  console.log('--- E2E Additional Checks ---');

  // Register users
  const reqEmail = `req_new_${Date.now()}@test.com`;
  const appAssignedEmail = `app_ass_${Date.now()}@test.com`;
  const appUnassignedEmail = `app_unass_${Date.now()}@test.com`;

  let { cookie: reqCookie } = await request('/api/auth/register', {
    method: 'POST', body: { email: reqEmail, password: 'password', name: 'Requester', role: 'requester' }
  });

  let { cookie: appAssignedCookie, data: assignedUser } = await request('/api/auth/register', {
    method: 'POST', body: { email: appAssignedEmail, password: 'password', name: 'Assigned Approver', role: 'approver', approval_limit: 10000 }
  });

  let { cookie: appUnassignedCookie } = await request('/api/auth/register', {
    method: 'POST', body: { email: appUnassignedEmail, password: 'password', name: 'Unassigned Approver', role: 'approver', approval_limit: 10000 }
  });

  // Create Requisition
  let reqRes = await request('/api/requisitions', {
    method: 'POST', body: { title: 'Illegal Transition Test', vendor_name: 'Microsoft', department: 'IT', needed_by_date: '2026-10-01' }
  }, reqCookie);
  const reqId = reqRes.data.id;

  let lineRes = await request(`/api/requisitions/${reqId}/lines`, {
    method: 'POST', body: { description: 'License', ordered_qty: 1, unit_price: 1000 }
  }, reqCookie);
  const lineId = lineRes.data.line_items[0].id;

  console.log('\\nCHECK 1: Attempt illegal transitions');
  
  // 1a. Approve while Draft
  console.log('1a. Calling /approve on Draft requisition (from unassigned approver):');
  let draftApprove = await request(`/api/requisitions/${reqId}/approve`, { method: 'POST' }, appUnassignedCookie);
  console.log(`STATUS: ${draftApprove.status}`);
  console.log(`RESPONSE:`, draftApprove.data);
  if (draftApprove.status !== 400) throw new Error('Expected 400 for illegal transition');

  // 1b. Receive while Draft
  console.log('\\n1b. Calling /receive on Draft requisition:');
  let draftReceive = await request(`/api/requisitions/${reqId}/receive`, {
    method: 'POST', body: { line_item_id: lineId, received_quantity: 1 }
  }, appUnassignedCookie);
  console.log(`STATUS: ${draftReceive.status}`);
  console.log(`RESPONSE:`, draftReceive.data);

  // Submit it
  await request(`/api/requisitions/${reqId}/submit`, { method: 'POST' }, reqCookie);

  // 1c. Receive while Submitted
  console.log('\\n1c. Calling /receive on Submitted requisition:');
  let subReceive = await request(`/api/requisitions/${reqId}/receive`, {
    method: 'POST', body: { line_item_id: lineId, received_quantity: 1 }
  }, appUnassignedCookie);
  console.log(`STATUS: ${subReceive.status}`);
  console.log(`RESPONSE:`, subReceive.data);

  // Assign the assigned user explicitly
  await request(`/api/requisitions/${reqId}/approvers`, {
    method: 'POST', body: { approver_id: assignedUser.user.id }
  }, appAssignedCookie);


  console.log('\\nCHECK 2: Unassigned Approver can approve/reject');
  
  console.log('2a. Unassigned approver rejecting:');
  let unassignedReject = await request(`/api/requisitions/${reqId}/reject`, {
    method: 'POST', body: { reason: 'Test unassigned rejection' }
  }, appUnassignedCookie);
  console.log(`STATUS: ${unassignedReject.status} (New Status: ${unassignedReject.data.status})`);
  
  // Re-submit
  await request(`/api/requisitions/${reqId}/submit`, { method: 'POST' }, reqCookie);

  console.log('2b. Unassigned approver approving:');
  let unassignedApprove = await request(`/api/requisitions/${reqId}/approve`, { method: 'POST' }, appUnassignedCookie);
  console.log(`STATUS: ${unassignedApprove.status} (New Status: ${unassignedApprove.data.status})`);

  console.log('\\n--- Additional Checks Completed ---');
}

run().catch(console.error);
