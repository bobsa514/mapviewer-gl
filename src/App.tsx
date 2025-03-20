import MapViewerGL from './components/MapViewerGL'
import './App.css'

const MONTHLY_LIMIT = 50000;
const WARNING_THRESHOLD = 0.8; // 80%

function trackMapUsage() {
  const today = new Date();
  const monthKey = `${today.getFullYear()}-${today.getMonth()}`;
  const currentMonth = localStorage.getItem(monthKey) || '0';
  const usage = parseInt(currentMonth) + 1;
  
  localStorage.setItem(monthKey, usage.toString());
  
  if (usage >= MONTHLY_LIMIT * WARNING_THRESHOLD) {
    console.warn(`Map loads are at ${usage} of ${MONTHLY_LIMIT} for this month`);
    // You could show a warning UI element here
  }
}

function App() {
  return (
    <div className="w-screen h-screen overflow-hidden">
      <MapViewerGL />
    </div>
  )
}

export default App
