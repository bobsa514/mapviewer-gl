import MapViewerGL from './components/MapViewerGL'
import ErrorBoundary from './components/ErrorBoundary'
import './App.css'
import './styles/design.css'

function App() {
  return (
    <ErrorBoundary>
      <MapViewerGL />
    </ErrorBoundary>
  )
}

export default App
