import axios from 'axios';
import { ethers } from 'ethers';

async function test() {
  const wallet = ethers.Wallet.createRandom();
  console.log("Wallet:", wallet.address);
  
  const nonceRes = await axios.get(`http://localhost:3000/api/v1/auth/nonce/${wallet.address}`);
  const { nonce, message } = nonceRes.data.data;
  
  const signature = await wallet.signMessage(message);
  
  const verifyRes = await axios.post(`http://localhost:3000/api/v1/auth/verify`, {
    address: wallet.address,
    signature
  });
  
  const token = verifyRes.data.data.accessToken;
  console.log("Token:", token.substring(0, 20) + "...");
  
  try {
    const propRes = await axios.post(`http://localhost:3000/api/v1/proposals`, {
      title: "Test Proposal for Auth",
      description: "This is a test description with more than 20 characters.",
      requestedAmount: 1000
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log("Proposal Success:", propRes.data.success);
  } catch (err) {
    console.log("Proposal Failed:", err.response?.status, err.response?.data);
  }
}

test();
