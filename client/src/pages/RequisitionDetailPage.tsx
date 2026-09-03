import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { requisitionApi, userApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import StatusDot from '../components/StatusDot';

export default function RequisitionDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [requisition, setRequisition] = useState<any>(null);
  const [auditEvents, setAuditEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Line item form state
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [lineDesc, setLineDesc] = useState('');
  const [lineQty, setLineQty] = useState('');
  const [linePrice, setLinePrice] = useState('');
  const [isSubmittingLine, setIsSubmittingLine] = useState(false);

  // Receive form state
  const [receiveLineId, setReceiveLineId] = useState<string | null>(null);
  const [receiveQty, setReceiveQty] = useState('');

  // Comment form state
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Reject modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Extend date state
  const [showExtendDate, setShowExtendDate] = useState(false);
  const [newNeededBy, setNewNeededBy] = useState('');

  // Approver management state
  const [allApprovers, setAllApprovers] = useState<any[]>([]);
  const [showAddApprover, setShowAddApprover] = useState(false);
  const [selectedApproverId, setSelectedApproverId] = useState('');

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [reqRes, auditRes] = await Promise.all([
      requisitionApi.getRequisition(id),
      requisitionApi.getAuditEvents(id),
    ]);
    if (reqRes.ok && reqRes.data) {
      setRequisition(reqRes.data);
    } else {
      setError(reqRes.error || 'Failed to fetch requisition');
    }
    if (auditRes.ok && auditRes.data) {
      setAuditEvents(auditRes.data as any[]);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch all approver users for the assignment dropdown
  useEffect(() => {
    if (user?.role === 'approver') {
      userApi.listApprovers().then(res => {
        if (res.ok && res.data) setAllApprovers(res.data as any[]);
      });
    }
  }, [user]);

  const isDraft = requisition?.status === 'draft';
  const isSubmitted = requisition?.status === 'submitted';
  const isApproved = requisition?.status === 'approved';
  const isOrdered = requisition?.status === 'ordered';
  const isOwner = requisition?.owner_id === user?.id;
  const isApprover = user?.role === 'approver';

  const resetLineForm = () => {
    setEditingLineId(null);
    setLineDesc('');
    setLineQty('');
    setLinePrice('');
  };

  const startEditLine = (line: any) => {
    setEditingLineId(line.id);
    setLineDesc(line.description);
    setLineQty(line.ordered_qty);
    setLinePrice(line.unit_price);
  };

  const handleSaveLine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setIsSubmittingLine(true);
    const payload = { description: lineDesc, ordered_qty: lineQty, unit_price: linePrice };
    let res;
    if (editingLineId === 'new') {
      res = await requisitionApi.addLineItem(id, payload);
    } else if (editingLineId) {
      res = await requisitionApi.updateLineItem(id, editingLineId, payload);
    }
    if (res?.ok && res.data) {
      setRequisition(res.data);
      resetLineForm();
    } else {
      alert(res?.error || 'Failed to save line item');
    }
    setIsSubmittingLine(false);
  };

  const handleDeleteLine = async (lineId: string) => {
    if (!id || !confirm('Are you sure you want to remove this line item?')) return;
    const res = await requisitionApi.removeLineItem(id, lineId);
    if (res.ok && res.data) setRequisition(res.data);
    else alert(res.error || 'Failed to remove line item');
  };

  // --- Lifecycle Actions ---
  const handleAction = async (action: () => Promise<any>, successMsg?: string) => {
    setActionLoading(true);
    setActionError(null);
    const res = await action();
    if (res.ok && res.data) {
      setRequisition(res.data);
      await fetchData(); // Refresh audit events
      if (successMsg) setActionError(null);
    } else {
      setActionError(res.error || 'Action failed');
    }
    setActionLoading(false);
  };

  const handleSubmit = () => handleAction(() => requisitionApi.submit(id!));
  const handleApprove = () => handleAction(() => requisitionApi.approve(id!));
  const handleOrder = () => handleAction(() => requisitionApi.order(id!));
  const handleArchive = () => handleAction(() => requisitionApi.archive(id!));
  const handleRestore = () => handleAction(() => requisitionApi.restore(id!));

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setActionLoading(true);
    setActionError(null);
    const res = await requisitionApi.reject(id!, rejectReason);
    if (res.ok && res.data) {
      setRequisition(res.data);
      setShowRejectModal(false);
      setRejectReason('');
      await fetchData();
    } else {
      setActionError(res.error || 'Failed to reject');
    }
    setActionLoading(false);
  };

  const handleExtendDate = async () => {
    if (!newNeededBy) return;
    setActionLoading(true);
    setActionError(null);
    const res = await requisitionApi.extendNeededBy(id!, newNeededBy);
    if (res.ok && res.data) {
      setRequisition(res.data);
      setShowExtendDate(false);
      setNewNeededBy('');
      await fetchData();
    } else {
      setActionError(res.error || 'Failed to extend date');
    }
    setActionLoading(false);
  };

  const handleReceive = async (lineItemId: string) => {
    const qty = Number(receiveQty);
    if (!qty || qty <= 0) return;
    setActionLoading(true);
    setActionError(null);
    const res = await requisitionApi.receive(id!, lineItemId, qty);
    if (res.ok && res.data) {
      setRequisition(res.data);
      setReceiveLineId(null);
      setReceiveQty('');
      await fetchData();
    } else {
      setActionError(res.error || 'Failed to record receipt');
    }
    setActionLoading(false);
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !id) return;
    setIsSubmittingComment(true);
    const res = await requisitionApi.addComment(id, commentText);
    if (res.ok) {
      setCommentText('');
      await fetchData();
    } else {
      alert(res.error || 'Failed to add comment');
    }
    setIsSubmittingComment(false);
  };

  // Approver management
  const handleAddApprover = async () => {
    if (!selectedApproverId || !id) return;
    const res = await requisitionApi.addApprover(id, selectedApproverId);
    if (res.ok) {
      setShowAddApprover(false);
      setSelectedApproverId('');
      await fetchData();
    } else {
      alert(res.error || 'Failed to add approver');
    }
  };

  const handleRemoveApprover = async (approverId: string) => {
    if (!id) return;
    const res = await requisitionApi.removeApprover(id, approverId);
    if (res.ok) {
      await fetchData();
    } else {
      alert(res.error || 'Failed to remove approver');
    }
  };

  if (loading) return <p className="text-surface-500">Loading...</p>;
  if (error || !requisition) return <p className="text-red-500">{error || 'Not found'}</p>;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 ledger-section pb-6 border-b-0">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="text-brand-600 hover:text-brand-700 text-sm font-medium mb-2 inline-block"
          >
            &larr; Back
          </button>
          <div className="flex items-center gap-4 mt-2">
            <h1 className="text-3xl font-serif text-surface-900">{requisition.title}</h1>
            <StatusDot status={requisition.status} />
            {requisition.archived_at && (
              <span className="text-[10px] font-medium text-surface-500 uppercase tracking-widest">
                (Archived)
              </span>
            )}
          </div>
          <p className="text-surface-500 mt-2 text-sm">
            By {requisition.owner?.name || 'Unknown'} &middot; Created {new Date(requisition.created_at).toLocaleDateString()}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {isDraft && isOwner && (
            <>
              <Link to={`/requisitions/${id}/edit`} className="btn-secondary text-sm">Edit Details</Link>
              <button onClick={handleSubmit} disabled={actionLoading} className="btn-primary text-sm">
                Submit for Approval
              </button>
            </>
          )}
          {isSubmitted && isApprover && (
            <>
              <button onClick={handleApprove} disabled={actionLoading} className="btn-primary text-sm">
                Approve
              </button>
              <button onClick={() => setShowRejectModal(true)} disabled={actionLoading} className="bg-[#8C3B3B] hover:bg-[#7a3232] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                Reject
              </button>
            </>
          )}
          {isApproved && isApprover && (
            <button onClick={handleOrder} disabled={actionLoading} className="btn-primary text-sm">
              Mark as Ordered
            </button>
          )}
          {isOrdered && isApprover && (
            <button onClick={() => setShowExtendDate(true)} disabled={actionLoading} className="btn-secondary text-sm">
              Extend Needed-By Date
            </button>
          )}
          
          {/* Archive / Restore Buttons (Owner or Approver) */}
          {(isOwner || isApprover) && (
            requisition.archived_at ? (
              <button onClick={handleRestore} disabled={actionLoading} className="btn-secondary text-sm">
                Restore
              </button>
            ) : (
              <button onClick={handleArchive} disabled={actionLoading} className="btn-ghost text-surface-500 hover:text-surface-900 text-sm">
                Archive
              </button>
            )
          )}
        </div>
      </div>

      {/* Action Error */}
      {actionError && (
        <div className="flex items-start gap-3 p-3.5 rounded-lg bg-red-50 border border-red-200">
          <svg className="w-5 h-5 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <p className="text-sm text-red-700">{actionError}</p>
          <button onClick={() => setActionError(null)} className="ml-auto text-red-400 hover:text-red-600">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="card p-6 border-red-200 bg-red-50/30">
          <h3 className="text-lg font-semibold text-surface-900 mb-3">Reject Requisition</h3>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Provide a reason for rejection..."
            className="input min-h-[80px]"
            required
          />
          <div className="flex gap-2 mt-3">
            <button onClick={handleReject} disabled={actionLoading || !rejectReason.trim()} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
              Confirm Rejection
            </button>
            <button onClick={() => { setShowRejectModal(false); setRejectReason(''); }} className="btn-ghost text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Extend Date UI */}
      {showExtendDate && (
        <div className="card p-6 border-blue-200 bg-blue-50/30">
          <h3 className="text-lg font-semibold text-surface-900 mb-3">Extend Needed-By Date</h3>
          <p className="text-sm text-surface-600 mb-2">Current: {new Date(requisition.needed_by_date).toLocaleDateString()}</p>
          <input type="date" value={newNeededBy} onChange={(e) => setNewNeededBy(e.target.value)} className="input w-48" />
          <div className="flex gap-2 mt-3">
            <button onClick={handleExtendDate} disabled={actionLoading || !newNeededBy} className="btn-primary text-sm disabled:opacity-50">
              Extend Date
            </button>
            <button onClick={() => { setShowExtendDate(false); setNewNeededBy(''); }} className="btn-ghost text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Info Cards */}
      <div className="flex flex-col sm:flex-row border-y border-surface-200">
        <div className="flex-1 py-5 sm:border-r border-surface-200 sm:pr-5">
          <p className="text-xs font-medium text-surface-500 mb-1">Vendor</p>
          <p className="font-serif text-lg text-surface-900">{requisition.vendor_name}</p>
        </div>
        <div className="flex-1 py-5 sm:border-r border-surface-200 sm:px-5">
          <p className="text-xs font-medium text-surface-500 mb-1">Department</p>
          <p className="font-serif text-lg text-surface-900">{requisition.department}</p>
        </div>
        <div className="flex-1 py-5 sm:pl-5">
          <p className="text-xs font-medium text-surface-500 mb-1">Needed By</p>
          <p className="font-serif text-lg text-surface-900 tabular-nums">
            {new Date(requisition.needed_by_date).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Assigned Approvers */}
      <div className="ledger-section pt-0">
        <div className="py-4 flex items-center justify-between">
          <h2 className="text-lg font-serif text-surface-900">Assigned Approvers</h2>
          {isApprover && (
            <button onClick={() => setShowAddApprover(!showAddApprover)} className="btn-primary py-1.5 px-3 text-xs">
              {showAddApprover ? 'Cancel' : '+ Assign Approver'}
            </button>
          )}
        </div>
        <div>
          {showAddApprover && isApprover && (
            <div className="flex gap-2 mb-4 items-end">
              <div className="flex-1">
                <label className="label text-xs">Select Approver</label>
                <select
                  value={selectedApproverId}
                  onChange={(e) => setSelectedApproverId(e.target.value)}
                  className="input py-1.5 text-sm"
                >
                  <option value="">— choose an approver —</option>
                  {allApprovers
                    .filter((a: any) => !requisition.approvers?.some((ra: any) => ra.approver.id === a.id))
                    .map((a: any) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.email})
                        {a.approval_limit ? ` · limit $${Number(a.approval_limit).toLocaleString()}` : ''}
                      </option>
                    ))
                  }
                </select>
              </div>
              <button onClick={handleAddApprover} disabled={!selectedApproverId} className="btn-primary py-1.5 px-3 text-sm disabled:opacity-50">Add</button>
            </div>
          )}
          {requisition.approvers && requisition.approvers.length > 0 ? (
            <div className="space-y-2">
              {requisition.approvers.map((a: any) => (
                <div key={a.approver.id} className="flex items-center justify-between px-3 py-2 rounded-md border border-surface-200 bg-surface-50">
                  <div>
                    <span className="text-sm font-medium text-surface-900">{a.approver.name}</span>
                    <span className="text-xs text-surface-500 ml-2">{a.approver.email}</span>
                  </div>
                  {isApprover && (
                    <button onClick={() => handleRemoveApprover(a.approver.id)} className="text-[#8C3B3B] hover:text-[#7a3232] text-xs font-medium">Remove</button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-surface-500">No approvers assigned yet.</p>
          )}
        </div>
      </div>

      {/* Line Items */}
      <div className="ledger-section pt-0">
        <div className="py-4 flex items-center justify-between">
          <h2 className="text-lg font-serif text-surface-900">Line Items</h2>
          {isDraft && isOwner && editingLineId === null && (
            <button onClick={() => setEditingLineId('new')} className="btn-primary py-1.5 px-3 text-xs">
              + Add Item
            </button>
          )}
        </div>

        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-surface-200 text-surface-600">
              <th className="py-3 pr-4 text-sm font-medium">Description</th>
              <th className="px-4 py-3 text-sm font-medium text-right">Qty</th>
              <th className="px-4 py-3 text-sm font-medium text-right">Unit Price</th>
              <th className="px-4 py-3 text-sm font-medium text-right">Line Total</th>
              {isOrdered && <th className="px-4 py-3 text-sm font-medium text-right">Received</th>}
              <th className="py-3 pl-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {requisition.line_items.map((line: any) => {
              const isEditing = editingLineId === line.id;

              if (isEditing) {
                return (
                  <tr key={line.id} className="bg-surface-50/50">
                    <td colSpan={isOrdered ? 6 : 5} className="p-4">
                      <form onSubmit={handleSaveLine} className="flex gap-4 items-end">
                        <div className="flex-1">
                          <label className="label text-xs">Description</label>
                          <input type="text" required value={lineDesc} onChange={(e) => setLineDesc(e.target.value)} className="input py-1.5 text-sm" />
                        </div>
                        <div className="w-24">
                          <label className="label text-xs">Qty</label>
                          <input type="number" required min="0.01" step="0.01" value={lineQty} onChange={(e) => setLineQty(e.target.value)} className="input py-1.5 text-sm" />
                        </div>
                        <div className="w-32">
                          <label className="label text-xs">Price ($)</label>
                          <input type="number" required min="0.01" step="0.01" value={linePrice} onChange={(e) => setLinePrice(e.target.value)} className="input py-1.5 text-sm" />
                        </div>
                        <div className="flex gap-2 mb-[2px]">
                          <button type="submit" disabled={isSubmittingLine} className="btn-primary py-1.5 px-3 text-sm">Save</button>
                          <button type="button" onClick={resetLineForm} className="btn-ghost py-1.5 px-3 text-sm">Cancel</button>
                        </div>
                      </form>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={line.id}>
                  <td className="py-4 pr-4 text-sm text-surface-900">{line.description}</td>
                  <td className="px-4 py-4 text-sm text-surface-600 text-right tabular-nums">{Number(line.ordered_qty).toFixed(2)}</td>
                  <td className="px-4 py-4 text-sm text-surface-600 text-right tabular-nums">${Number(line.unit_price).toFixed(2)}</td>
                  <td className="px-4 py-4 text-sm text-surface-900 font-medium text-right tabular-nums">
                    ${(Number(line.ordered_qty) * Number(line.unit_price)).toFixed(2)}
                  </td>
                  {isOrdered && (
                    <td className="px-4 py-4 text-sm text-right tabular-nums">
                      <span className={`font-medium ${Number(line.received_qty) >= Number(line.ordered_qty) ? 'text-[#4A6B53]' : 'text-[#9B761E]'}`}>
                        {Number(line.received_qty).toFixed(2)} / {Number(line.ordered_qty).toFixed(2)}
                      </span>
                    </td>
                  )}
                  <td className="py-4 pl-4 text-right">
                    <div className="flex justify-end gap-3">
                      {isDraft && isOwner && (
                        <>
                          <button onClick={() => startEditLine(line)} className="text-brand-600 hover:text-brand-700 text-sm font-medium">Edit</button>
                          <button onClick={() => handleDeleteLine(line.id)} className="text-red-600 hover:text-red-700 text-sm font-medium">Remove</button>
                        </>
                      )}
                      {isOrdered && isApprover && Number(line.received_qty) < Number(line.ordered_qty) && (
                        receiveLineId === line.id ? (
                          <div className="flex items-center gap-2">
                            <input type="number" min="0.01" step="0.01" max={(Number(line.ordered_qty) - Number(line.received_qty)).toFixed(2)} value={receiveQty} onChange={(e) => setReceiveQty(e.target.value)} placeholder="Qty" className="input py-1 px-2 text-sm w-20" />
                            <button onClick={() => handleReceive(line.id)} disabled={actionLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded text-xs font-medium">Receive</button>
                            <button onClick={() => { setReceiveLineId(null); setReceiveQty(''); }} className="text-surface-500 hover:text-surface-700 text-xs">Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => setReceiveLineId(line.id)} className="text-emerald-600 hover:text-emerald-700 text-sm font-medium">
                            Receive
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

            {/* New Line Form */}
            {editingLineId === 'new' && (
              <tr className="bg-brand-50/30">
                <td colSpan={isOrdered ? 6 : 5} className="p-4">
                  <form onSubmit={handleSaveLine} className="flex gap-4 items-end">
                    <div className="flex-1">
                      <label className="label text-xs">Description</label>
                      <input type="text" required autoFocus placeholder="e.g. Dell Monitor" value={lineDesc} onChange={(e) => setLineDesc(e.target.value)} className="input py-1.5 text-sm" />
                    </div>
                    <div className="w-24">
                      <label className="label text-xs">Qty</label>
                      <input type="number" required min="0.01" step="0.01" placeholder="1" value={lineQty} onChange={(e) => setLineQty(e.target.value)} className="input py-1.5 text-sm" />
                    </div>
                    <div className="w-32">
                      <label className="label text-xs">Price ($)</label>
                      <input type="number" required min="0.01" step="0.01" placeholder="199.99" value={linePrice} onChange={(e) => setLinePrice(e.target.value)} className="input py-1.5 text-sm" />
                    </div>
                    <div className="flex gap-2 mb-[2px]">
                      <button type="submit" disabled={isSubmittingLine} className="btn-primary py-1.5 px-3 text-sm">Save</button>
                      <button type="button" onClick={resetLineForm} className="btn-ghost py-1.5 px-3 text-sm">Cancel</button>
                    </div>
                  </form>
                </td>
              </tr>
            )}

            {requisition.line_items.length === 0 && editingLineId !== 'new' && (
              <tr>
                <td colSpan={isOrdered ? 6 : 5} className="px-6 py-8 text-center text-surface-500 text-sm">
                  No line items yet.
                </td>
              </tr>
            )}

            {/* Total Row */}
            <tr className="border-t-2 border-surface-200">
              <td colSpan={3} className="py-4 pr-4 text-right text-surface-700 font-medium">Requisition Total:</td>
              <td className="px-4 py-4 text-right font-serif text-lg text-surface-900 tabular-nums">${Number(requisition.total).toFixed(2)}</td>
              {isOrdered && <td></td>}
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Timeline / Audit Log */}
      <div className="ledger-section pt-0 border-b-0 pb-0">
        <div className="py-4">
          <h2 className="text-lg font-serif text-surface-900">Timeline</h2>
        </div>
        <div>
          {auditEvents.length === 0 ? (
            <p className="text-sm text-surface-500">No events yet.</p>
          ) : (
            <div className="space-y-4">
              {auditEvents.map((event: any) => (
                <div key={event.id} className="flex gap-4">
                  {/* Icon */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                    event.type === 'comment' ? 'bg-brand-100 text-brand-700' :
                    event.type === 'receipt' ? 'bg-emerald-100 text-emerald-700' :
                    (event.metadata as any)?.action === 'rejected' ? 'bg-red-100 text-red-700' :
                    'bg-surface-100 text-surface-700'
                  }`}>
                    {event.type === 'comment' ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" /></svg>
                    ) : event.type === 'receipt' ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0-3-3m3 3 3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" /></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                    )}
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-surface-900">{event.actor?.name || 'System'}</span>
                      <span className="text-xs text-surface-400">{new Date(event.created_at).toLocaleString()}</span>
                    </div>
                    <div className="text-sm text-surface-600 mt-0.5">
                      {event.type === 'comment' && (
                        <p className="text-surface-800 bg-surface-50 rounded-lg px-3 py-2 mt-1">{event.comment_text}</p>
                      )}
                      {event.type === 'receipt' && (
                        <p>Received <strong>{(event.metadata as any)?.quantity_received}</strong> of <em>{(event.metadata as any)?.line_description}</em> (total now: {(event.metadata as any)?.new_received_total}/{(event.metadata as any)?.ordered_qty})</p>
                      )}
                      {event.type === 'status_change' && (event.metadata as any)?.action === 'rejected' && (
                        <div>
                          <p className="text-red-700">Rejected requisition and returned to draft.</p>
                          {event.reason && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-1"><strong>Reason:</strong> {event.reason}</p>}
                        </div>
                      )}
                      {event.type === 'status_change' && (event.metadata as any)?.action === 'extend_needed_by' && (
                        <p>Extended needed-by date from <strong>{(event.metadata as any)?.old_date}</strong> to <strong>{(event.metadata as any)?.new_date}</strong></p>
                      )}
                      {event.type === 'status_change' && (event.metadata as any)?.action === 'auto_received' && (
                        <p className="text-emerald-700">All line items fully received — requisition automatically marked as <strong>Received</strong>.</p>
                      )}
                      {event.type === 'status_change' && !(event.metadata as any)?.action && event.old_status && event.new_status && (
                        <p>Status changed from <strong>{event.old_status}</strong> to <strong>{event.new_status}</strong></p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Comment Box */}
          {(isOwner || isApprover) && (
            <form onSubmit={handleComment} className="mt-6 pt-4 border-t border-surface-200">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a comment..."
                  className="input flex-1 py-2"
                />
                <button type="submit" disabled={isSubmittingComment || !commentText.trim()} className="btn-primary py-2 px-4 text-sm disabled:opacity-50">
                  Post
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
