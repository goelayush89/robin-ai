
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { MainLayout } from './components/layout/main-layout';
import { Dashboard } from './pages/dashboard';
import { ChatPage } from './pages/chat';
import Settings from './pages/settings';

function App() {
  return (
    <Router>
      <MainLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/local" element={<ChatPage />} />
          <Route path="/browser" element={<ChatPage />} />
          <Route path="/hybrid" element={<ChatPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/history" element={<div className="p-6">History page coming soon...</div>} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </MainLayout>
    </Router>
  );
}

export default App;
