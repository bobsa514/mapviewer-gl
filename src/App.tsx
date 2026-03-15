import MapViewerGL from './components/MapViewerGL'
import ErrorBoundary from './components/ErrorBoundary'
import './App.css'

function App() {
  return (
    <div className="w-screen h-screen overflow-hidden">
      <ErrorBoundary>
        <MapViewerGL />
      </ErrorBoundary>
    </div>
  )
}

export default App
