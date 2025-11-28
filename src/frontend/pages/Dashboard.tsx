export default function Dashboard() {
  const stats = [
    { label: 'Total Articles', value: 12, color: 'bg-blue-100 text-blue-700' },
    { label: 'Total Pins', value: 60, color: 'bg-purple-100 text-purple-700' },
    { label: 'Draft Articles', value: 3, color: 'bg-yellow-100 text-yellow-700' },
    { label: 'Published', value: 9, color: 'bg-green-100 text-green-700' },
  ]

  const recentActivity = [
    { id: 1, type: 'article', title: 'Teaching Children Emotional Intelligence', time: '2 hours ago' },
    { id: 2, type: 'pins', title: 'Generated 5 pins for Emotional Intelligence', time: '2 hours ago' },
    { id: 3, type: 'article', title: 'Screen Time Guidelines for Toddlers', time: '1 day ago' },
  ]

  return (
    <div>
      <h1 className="section-title">Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, idx) => (
          <div key={idx} className="card">
            <div className={`text-4xl font-bold mb-2 ${stat.color} inline-block px-3 py-1 rounded-lg`}>
              {stat.value}
            </div>
            <p className="text-gray-600">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="card">
            <h2 className="text-xl font-bold mb-4">Recent Activity</h2>
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-4 pb-4 border-b border-gray-100 last:border-b-0">
                  <div className="text-2xl">{activity.type === 'article' ? '📝' : '📌'}</div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{activity.title}</p>
                    <p className="text-sm text-gray-500">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card h-fit">
          <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
          <div className="space-y-2">
            <a href="/generate" className="btn-primary w-full text-center block">✍️ Generate Article</a>
            <a href="/pins" className="btn-secondary w-full text-center block">📌 Manage Pins</a>
            <a href="/library" className="btn-secondary w-full text-center block">📚 View Library</a>
          </div>
        </div>
      </div>
    </div>
  )
}
