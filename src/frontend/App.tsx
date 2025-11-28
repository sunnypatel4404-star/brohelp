import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import GenerateArticle from './pages/GenerateArticle'
import PinManager from './pages/PinManager'
import ContentLibrary from './pages/ContentLibrary'
import Settings from './pages/Settings'

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  )
}

function AppContent() {
  const location = useLocation()

  const navigation = [
    { name: 'Dashboard', href: '/', icon: '📊' },
    { name: 'Generate Article', href: '/generate', icon: '✍️' },
    { name: 'Pin Manager', href: '/pins', icon: '📌' },
    { name: 'Content Library', href: '/library', icon: '📚' },
    { name: 'Settings', href: '/settings', icon: '⚙️' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar Navigation */}
      <nav className="fixed left-0 top-0 w-64 h-screen bg-white border-r border-gray-200 shadow-sm">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-brand-700">Parent Village</h1>
          <p className="text-sm text-gray-500 mt-1">Content Automation Hub</p>
        </div>

        <div className="mt-8 space-y-2 px-4">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`block w-full text-left px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-brand-100 text-brand-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="mr-3">{item.icon}</span>
                {item.name}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Main Content */}
      <main className="ml-64 p-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/generate" element={<GenerateArticle />} />
          <Route path="/pins" element={<PinManager />} />
          <Route path="/library" element={<ContentLibrary />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
