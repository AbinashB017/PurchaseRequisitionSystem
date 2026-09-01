export default function StatusDot({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    draft: 'bg-status-draft',
    submitted: 'bg-status-submitted',
    approved: 'bg-status-approved',
    ordered: 'bg-status-ordered',
    received: 'bg-status-received',
    rejected: 'bg-status-rejected',
  };

  const labelMap: Record<string, string> = {
    draft: 'Draft',
    submitted: 'Submitted',
    approved: 'Approved',
    ordered: 'Ordered',
    received: 'Received',
    rejected: 'Rejected',
  };

  const bgColor = colorMap[status] || 'bg-surface-500';
  const label = labelMap[status] || status;

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${bgColor}`} />
      <span className="text-sm text-surface-900">{label}</span>
    </div>
  );
}
