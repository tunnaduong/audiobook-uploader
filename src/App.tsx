import { useEffect } from 'react'
import { Dashboard } from './components/Dashboard'
import './App.css'

function App() {
  useEffect(() => {
    console.log('Audiobook Uploader App initialized')
  }, [])

  return (
    <div className="app-container">
      <Dashboard />
    </div>
  )
}

export default App
