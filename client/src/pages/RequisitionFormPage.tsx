import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { requisitionApi } from '../lib/api';

export default function RequisitionFormPage() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [department, setDepartment] = useState('');
  const [neededByDate, setNeededByDate] = useState('');
  
  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isEditing && id) {
      fetchRequisition(id);
    }
  }, [id]);

  const fetchRequisition = async (reqId: string) => {
    setLoading(true);
    const res = await requisitionApi.getRequisition(reqId);
    if (res.ok && res.data) {
      const data = res.data as any;
      if (data.status !== 'draft') {
        setError('Only draft requisitions can be edited.');
      } else {
        setTitle(data.title);
        setVendorName(data.vendor_name);
        setDepartment(data.department);
        setNeededByDate(data.needed_by_date.split('T')[0]); // format for input type="date"
      }
    } else {
      setError(res.error || 'Failed to load requisition');
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const payload = {
      title,
      vendor_name: vendorName,
      department,
      needed_by_date: neededByDate,
    };

    let res;
    if (isEditing && id) {
      res = await requisitionApi.update(id, payload);
    } else {
      res = await requisitionApi.create(payload);
    }

    if (res.ok && res.data) {
      navigate(`/requisitions/${(res.data as any).id}`);
    } else {
      setError(res.error || 'Failed to save requisition');
      setSubmitting(false);
    }
  };

  if (loading) {
    return <p className="text-surface-500">Loading...</p>;
  }

  if (error && isEditing && !title) {
    return (
      <div className="space-y-4">
        <p className="text-red-500">{error}</p>
        <Link to="/requisitions" className="btn-secondary">Back to Requisitions</Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="ledger-section pb-6 border-b-0">
        <Link to={isEditing ? `/requisitions/${id}` : '/requisitions'} className="text-brand-600 hover:text-brand-700 text-sm font-medium mb-4 inline-block">
          &larr; Back
        </Link>
        <h1 className="text-3xl font-serif text-surface-900">{isEditing ? 'Edit Requisition' : 'Create Requisition'}</h1>
        <p className="mt-2 text-surface-500">
          {isEditing ? 'Update the details of your draft requisition.' : 'Start a new purchase request.'}
        </p>
      </div>

      <div className="border-t border-surface-200 pt-8 mt-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {error && (
            <div className="flex items-start gap-3 p-3.5 rounded-lg bg-red-50 border border-red-200">
              <svg className="w-5 h-5 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="title" className="label">Title / Description</label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input"
              placeholder="e.g. New Laptops for Engineering"
              required
            />
          </div>

          <div>
            <label htmlFor="vendor" className="label">Vendor Name</label>
            <input
              id="vendor"
              type="text"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              className="input"
              placeholder="e.g. Apple Inc."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div>
              <label htmlFor="department" className="label">Department</label>
              <input
                id="department"
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="input"
                placeholder="e.g. Engineering"
                required
              />
            </div>

            <div>
              <label htmlFor="needed_by" className="label">Needed By Date</label>
              <input
                id="needed_by"
                type="date"
                value={neededByDate}
                onChange={(e) => setNeededByDate(e.target.value)}
                className="input"
                required
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <Link to={isEditing ? `/requisitions/${id}` : '/requisitions'} className="btn-secondary">
              Cancel
            </Link>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Saving...' : 'Save Requisition'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
