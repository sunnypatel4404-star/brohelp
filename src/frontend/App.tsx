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
    { name: 'Dashboard', href: '/', icon: '🏠', description: 'Overview & stats' },
    { name: 'Create Article', href: '/generate', icon: '✨', description: 'Generate new content' },
    { name: 'Pin Studio', href: '/pins', icon: '📌', description: 'Manage Pinterest pins' },
    { name: 'Content Library', href: '/library', icon: '📚', description: 'All your content' },
    { name: 'Settings', href: '/settings', icon: '⚙️', description: 'Preferences' },
  ]

  return (
    <div className="min-h-screen bg-cream-100">
      {/* Sidebar Navigation */}
      <nav className="fixed left-0 top-0 w-72 h-screen bg-gradient-to-b from-white to-cream-50 border-r border-cream-300 shadow-warm">
        {/* Logo Area */}
        <div className="p-6 border-b border-cream-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-terracotta-400 to-mustard-400 flex items-center justify-center shadow-warm">
              <span className="text-2xl">🏡</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-brand-800" style={{ fontFamily: 'Georgia, serif' }}>
                Parent Village
              </h1>
              <p className="text-xs text-brand-500 font-medium">Content Studio</p>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="mt-6 px-4 space-y-2">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`group flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-300 ${
                  isActive
                    ? 'bg-gradient-to-r from-terracotta-100 to-mustard-100 text-brand-800 shadow-warm border border-terracotta-200'
                    : 'text-brand-600 hover:bg-cream-200 hover:text-brand-800'
                }`}
              >
                <span className={`text-2xl transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                  {item.icon}
                </span>
                <div className="flex-1">
                  <span className={`block font-medium ${isActive ? 'text-brand-800' : ''}`}>
                    {item.name}
                  </span>
                  <span className="text-xs text-brand-400">{item.description}</span>
                </div>
                {isActive && (
                  <div className="w-2 h-2 rounded-full bg-terracotta-500 animate-pulse" />
                )}
              </Link>
            )
          })}
        </div>

        {/* Bottom Card */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-sage-100 to-sage-50 border border-sage-200">
            <div className="flex items-start gap-3">
              <span className="text-2xl animate-float">💡</span>
              <div>
                <p className="text-sm font-semibold text-sage-700">Pro Tip</p>
                <p className="text-xs text-sage-600 mt-1">
                  Generate articles with images for the best Pinterest engagement!
                </p>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="ml-72 min-h-screen">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-10 bg-cream-100/80 backdrop-blur-md border-b border-cream-200 px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-brand-500">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="https://parentvillage.blog"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-brand-600 hover:text-brand-800 transition-colors"
              >
                <span>View Blog</span>
                <span>↗</span>
              </a>
              <a
                href="https://parentvillage.blog/wp-admin"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary text-sm"
              >
                WordPress Admin
              </a>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-8 animate-fade-in">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/generate" element={<GenerateArticle />} />
            <Route path="/pins" element={<PinManager />} />
            <Route path="/library" element={<ContentLibrary />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}

export default App
