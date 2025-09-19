import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="shadow-lg border-b" style={{ backgroundColor: 'white', borderColor: '#e2e8f0', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-3xl font-bold flex items-center" style={{ color: '#374151', fontFamily: 'Inter, sans-serif' }}>
                <img src="/rr-logo.png" alt="Riveting Reads" className="w-8 h-8 mr-3" />
                Riveting Reads
              </h1>
            </div>
            <nav className="flex items-center space-x-4">
              <Link
                href="/login"
                className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                Sign In
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="text-center max-w-6xl mx-auto">
          <div className="mb-12">
            <h2 className="text-6xl font-bold mb-6" style={{ color: '#374151', fontFamily: 'Inter, sans-serif' }}>
              Learn Spanish Through Stories
            </h2>
            <p className="text-2xl text-gray-700 max-w-3xl mx-auto leading-relaxed">
              Master Spanish with interactive audio stories, tap-to-learn vocabulary, and smart spaced repetition
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-6 justify-center mb-16">
            <Link
              href="/signup"
              className="px-12 py-4 text-white font-bold rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-lg text-lg"
              style={{ backgroundColor: '#3b82f6', boxShadow: '0 8px 25px rgba(59, 130, 246, 0.4)' }}
            >
              Get Started
            </Link>
            <Link
              href="/login"
              className="px-12 py-4 bg-white text-gray-700 font-bold rounded-2xl border-2 border-gray-200 transition-all duration-300 transform hover:scale-105 hover:shadow-lg text-lg"
            >
              Sign In
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-12 max-w-5xl mx-auto">
            <div className="bg-white rounded-3xl p-8 shadow-lg border border-gray-100" style={{ boxShadow: '0 12px 40px rgba(0, 0, 0, 0.1)' }}>
              <div className="text-5xl mb-6">🎧</div>
              <h3 className="text-2xl font-bold mb-4" style={{ color: '#374151', fontFamily: 'Inter, sans-serif' }}>Audio Stories</h3>
              <p className="text-gray-600 text-lg leading-relaxed">Listen to engaging Spanish stories with native pronunciation and perfect timing</p>
            </div>
            <div className="bg-white rounded-3xl p-8 shadow-lg border border-gray-100" style={{ boxShadow: '0 12px 40px rgba(0, 0, 0, 0.1)' }}>
              <div className="text-5xl mb-6">👆</div>
              <h3 className="text-2xl font-bold mb-4" style={{ color: '#374151', fontFamily: 'Inter, sans-serif' }}>Tap to Learn</h3>
              <p className="text-gray-600 text-lg leading-relaxed">Click any word to learn its meaning and save it to your personal vocabulary</p>
            </div>
            <div className="bg-white rounded-3xl p-8 shadow-lg border border-gray-100" style={{ boxShadow: '0 12px 40px rgba(0, 0, 0, 0.1)' }}>
              <div className="text-5xl mb-6">🧠</div>
              <h3 className="text-2xl font-bold mb-4" style={{ color: '#374151', fontFamily: 'Inter, sans-serif' }}>Smart Reviews</h3>
              <p className="text-gray-600 text-lg leading-relaxed">Spaced repetition system helps you remember new words effectively</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}