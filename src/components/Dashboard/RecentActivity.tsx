const ACTIVITIES = [
  { action: 'Beam calculation completed — PASS', time: '2 hours ago' },
  { action: 'IFC model loaded: sample-building.ifc', time: '3 hours ago' },
  { action: 'Foundation design exported to PDF', time: 'Yesterday' },
];

export function RecentActivity() {
  return (
    <section>
      <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
      <div className="space-y-2">
        {ACTIVITIES.map((item, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-3 rounded-lg bg-infra-accent/10 border border-infra-accent/20"
          >
            <span className="text-sm text-gray-300">{item.action}</span>
            <span className="text-xs text-gray-600">{item.time}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
