import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import PrivateRoute from './components/PrivateRoute'
import Navbar from './components/Navbar'
import Login from './components/Login'
import Signup from './components/Signup'
import YourFrameworks from './components/YourFrameworks'
import CreateFramework from './components/CreateFramework'
import FrameworkEditor from './components/FrameworkEditor'
import Library from './components/Library'

function App() {
  return (
    <AuthProvider>
      <Router>
        <Navbar />

        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Protected routes - require authentication */}
          <Route
            path="/frameworks"
            element={
              <PrivateRoute>
                <YourFrameworks />
              </PrivateRoute>
            }
          />

          <Route
            path="/create"
            element={
              <PrivateRoute>
                <CreateFramework />
              </PrivateRoute>
            }
          />

          <Route
            path="/editor/:id"
            element={
              <PrivateRoute>
                <FrameworkEditor />
              </PrivateRoute>
            }
          />

          {/* Library route */}
          <Route
            path="/library"
            element={
              <PrivateRoute>
                <Library />
              </PrivateRoute>
            }
          />

          {/* Legacy route - redirect to /editor/:id */}
          <Route
            path="/frameworks/:id/edit"
            element={
              <PrivateRoute>
                <FrameworkEditor />
              </PrivateRoute>
            }
          />

          {/* Root route - redirect based on auth status */}
          <Route path="/" element={<Navigate to="/frameworks" replace />} />

          {/* 404 - Not Found */}
          <Route
            path="*"
            element={
              <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                  <h2 className="text-2xl font-semibold text-gray-800 mb-3">
                    Page Not Found
                  </h2>
                  <p className="text-gray-600 mb-6">
                    The page you're looking for doesn't exist.
                  </p>
                  <a
                    href="/frameworks"
                    className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Go to Frameworks
                  </a>
                </div>
              </div>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App
