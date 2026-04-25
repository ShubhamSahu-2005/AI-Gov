import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import ProposalDetail from './pages/ProposalDetail';
import { ProposalsProvider } from './context/ProposalsContext';

function App() {
  const [address, setAddress] = useState(null);

  return (
    <ProposalsProvider>
      <div className="min-h-screen bg-[url('https://images.unsplash.com/photo-1639322537228-f710d846310a?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-fixed bg-center">
        <div className="absolute inset-0 bg-background/80 backdrop-blur-[2px] z-0"></div>
      
      <div className="relative z-10 flex flex-col min-h-screen">
        <Toaster position="top-right" toastOptions={{
          style: {
            background: '#151520',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
          }
        }} />
        <Navbar address={address} setAddress={setAddress} />
        <main className="flex-grow container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Dashboard address={address} />} />
            <Route path="/proposals/:id" element={<ProposalDetail address={address} />} />
          </Routes>
          </main>
        </div>
      </div>
    </ProposalsProvider>
  );
}

export default App;
