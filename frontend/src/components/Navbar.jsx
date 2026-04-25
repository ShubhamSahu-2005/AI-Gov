import { useState, useRef, useEffect } from 'react';
import { Wallet, ChevronDown, Check, LogOut, WifiOff } from 'lucide-react';
import { ethers } from 'ethers';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import logo from '../assets/logo.png';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export default function Navbar({ address, setAddress }) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const disconnectWallet = () => {
    setAddress(null);
    delete axios.defaults.headers.common['Authorization'];
    setIsDropdownOpen(false);
    toast.success('Wallet disconnected');
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      toast.error('MetaMask or Brave Wallet is not installed! Falling back to offline mode.');
      axios.defaults.headers.common['Authorization'] = `Bearer offline_mock_token`;
      setAddress("0xGuestWalletAddress1234567890abcdef123456");
      toast.success('Simulated: Logged in as Guest (Offline Mode)');
      return;
    }

    try {
      setIsConnecting(true);
      // 1. Request account from MetaMask
      let providerEthereum = window.ethereum;
      if (window.ethereum?.providers) {
        providerEthereum = window.ethereum.providers.find(p => p.isMetaMask) || window.ethereum;
      }
      const provider = new ethers.BrowserProvider(providerEthereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      const userAddress = accounts[0];

      try {
        // 2. Fetch Nonce from backend
        const nonceRes = await axios.get(`${API_URL}/auth/nonce/${userAddress}`);
        if (!nonceRes.data.success) {
          throw new Error('Failed to fetch nonce');
        }
        const { nonce, message } = nonceRes.data.data;

        // 3. Sign the message
        const signer = await provider.getSigner();
        const signature = await signer.signMessage(message);

        // 4. Verify signature with backend
        const verifyRes = await axios.post(`${API_URL}/auth/verify`, {
          address: userAddress,
          signature,
        }, { withCredentials: true });

        if (verifyRes.data.success) {
          axios.defaults.headers.common['Authorization'] = `Bearer ${verifyRes.data.data.accessToken}`;
          setAddress(userAddress);
          toast.success('Wallet connected successfully!');
        } else {
          throw new Error(verifyRes.data.message || 'Verification failed');
        }
      } catch (backendErr) {
        console.error('Backend Auth Failed', backendErr);
        toast.error(backendErr.response?.data?.message || backendErr.message || 'DB Connection Failed');
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const formatAddress = (addr) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <nav className="glass-panel mx-4 mt-4 px-6 py-4 flex items-center justify-between sticky top-4 z-50">
      <div className="flex items-center gap-3">
        <Link to="/" className="w-10 h-10 flex items-center justify-center cursor-pointer">
          <img src={logo} alt="AI-Gov Logo" className="w-10 h-10 object-contain rounded-xl shadow-lg shadow-primary/20 hover:scale-105 transition-transform" />
        </Link>
        <Link to="/" className="cursor-pointer group">
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70 group-hover:from-primary group-hover:to-primary-hover transition-all">AI-Gov</h1>
          <p className="text-xs text-muted font-medium">Decentralized Intelligence</p>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        {address ? (
          <div className="relative" ref={dropdownRef}>
            <button 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-3 bg-surface/80 border border-white/5 rounded-xl p-2 pr-4 backdrop-blur-md hover:bg-white/5 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-secondary to-teal-500 flex items-center justify-center">
                <Check className="w-4 h-4 text-white" />
              </div>
              <span className="font-mono text-sm text-white/90">{formatAddress(address)}</span>
              <ChevronDown className={`w-4 h-4 text-muted ml-2 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isDropdownOpen && (
              <div className="absolute top-full mt-2 right-0 w-64 bg-surface border border-white/10 rounded-xl shadow-xl overflow-hidden z-50 animate-fade-in">
                <div className="p-4 border-b border-white/5">
                  <p className="text-xs text-muted mb-1">Connected Wallet</p>
                  <p className="font-mono text-sm text-white">{formatAddress(address)}</p>
                </div>
                <button 
                  onClick={disconnectWallet}
                  className="w-full p-4 flex items-center gap-3 text-sm text-red-400 hover:bg-white/5 transition-colors text-left"
                >
                  <LogOut className="w-4 h-4" />
                  Disconnect
                </button>
              </div>
            )}
          </div>
        ) : (
          <button 
            onClick={connectWallet}
            disabled={isConnecting}
            className="btn-primary flex items-center gap-2"
          >
            {isConnecting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Connecting...
              </>
            ) : (
              <>
                <Wallet className="w-5 h-5" />
                Connect Wallet / Guest
              </>
            )}
          </button>
        )}
      </div>
    </nav>
  );
}
