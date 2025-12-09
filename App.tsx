import React, { useState, useEffect } from 'react';
import { ShieldCheck, Truck, Lock, AlertTriangle, FileText, Search, UserX, Check, X, Link } from 'lucide-react';
import { Blockchain, getMerkleProof, verifyMerkleProof, MerkleProofStep } from './services/blockchain';
import { generateKeyPair, signData, createTransactionId } from './services/crypto';
import { Transaction, KeyPair, UserRole } from './types';
import MerkleTreeViz from './components/MerkleTreeViz';
import { analyzeChain } from './services/geminiService';

// Initialize a global singleton-ish blockchain for the session
const chain = new Blockchain();

export default function App() {
  const [activeTab, setActiveTab] = useState<UserRole>(UserRole.USER);
  const [blockchain, setBlockchain] = useState<Blockchain>(chain);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Force re-render when chain updates

  // User State
  const [userKeys, setUserKeys] = useState<KeyPair | null>(null);
  const [productName, setProductName] = useState('');
  const [productDetails, setProductDetails] = useState('');
  const [submitStatus, setSubmitStatus] = useState<string>('');

  // Auditor State
  const [auditResult, setAuditResult] = useState<string>('');
  const [isAuditing, setIsAuditing] = useState(false);
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<number | null>(null);
  const [verificationData, setVerificationData] = useState<{txId: string, proof: MerkleProofStep[], valid: boolean} | null>(null);

  // Admin State
  const [revokeKeyInput, setRevokeKeyInput] = useState('');

  // Init a user key on load
  useEffect(() => {
    const generatedKeys = generateKeyPair();
    const keys: KeyPair = {
      ...generatedKeys,
      label: "Farm Operator #1"
    };
    setUserKeys(keys);
  }, []);

  const handleCreateTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userKeys) return;

    const timestamp = Date.now();
    const id = createTransactionId(productName, productDetails, timestamp);
    // Sign the transaction ID (which contains the data hash)
    const signature = signData(userKeys.privateKey, `${productName}:${productDetails}:${timestamp}`);

    const newTx: Transaction = {
      id,
      productName,
      details: productDetails,
      timestamp,
      signerPublicKey: userKeys.publicKey,
      signature
    };

    const added = chain.addTransaction(newTx);
    if (added) {
      setSubmitStatus('Transaction added to Mempool. Waiting to be mined...');
      setProductName('');
      setProductDetails('');
      setRefreshTrigger(prev => prev + 1);
    } else {
      setSubmitStatus('Error: Transaction rejected (Revoked Key or Invalid).');
    }
  };

  const handleMine = () => {
    chain.minePendingTransactions();
    setSubmitStatus('Block Mined successfully!');
    setRefreshTrigger(prev => prev + 1);
  };

  const handleRevoke = () => {
    if (revokeKeyInput) {
      chain.revokeKey(revokeKeyInput);
      setRevokeKeyInput('');
      setRefreshTrigger(prev => prev + 1);
      alert("Key revoked. Future transactions from this key will be rejected.");
    }
  };

  const runAIAudit = async () => {
    setIsAuditing(true);
    const result = await analyzeChain(chain.chain);
    setAuditResult(result);
    setIsAuditing(false);
  };

  const handleVerifyTransaction = (tx: Transaction, blockTxs: Transaction[], blockRoot: string) => {
    const proof = getMerkleProof(blockTxs, tx.id);
    const isValid = verifyMerkleProof(tx.id, proof, blockRoot);
    setVerificationData({
      txId: tx.id,
      proof,
      valid: isValid
    });
  };

  const renderUserView = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold mb-4 flex items-center text-slate-800">
          <Truck className="mr-2" size={24} /> Submit Product Data
        </h2>
        <div className="bg-blue-50 p-4 rounded-md mb-4 text-sm text-blue-800">
          <strong>Identity Active:</strong> {userKeys?.label} <br/>
          <span className="font-mono text-xs opacity-75 truncate block w-full">Public Key: {userKeys?.publicKey}</span>
        </div>
        
        <form onSubmit={handleCreateTransaction} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Product Name</label>
            <input 
              type="text" 
              required
              value={productName}
              onChange={e => setProductName(e.target.value)}
              className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
              placeholder="e.g. Arabica Coffee Batch #402"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Details (JSON/Text)</label>
            <textarea 
              required
              value={productDetails}
              onChange={e => setProductDetails(e.target.value)}
              className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
              placeholder="e.g. Origin: Ethiopia, Carbon Footprint: 12kg"
              rows={3}
            />
          </div>
          <button 
            type="submit"
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
          >
            Sign & Submit to Blockchain
          </button>
        </form>
        {submitStatus && (
          <div className={`mt-4 p-2 rounded text-sm ${submitStatus.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {submitStatus}
          </div>
        )}
      </div>

      <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
        <h3 className="text-lg font-bold mb-2 text-slate-700">Mempool (Pending Transactions)</h3>
        {chain.pendingTransactions.length === 0 ? (
          <p className="text-slate-400 italic">No pending transactions.</p>
        ) : (
          <div className="space-y-2">
            {chain.pendingTransactions.map(tx => (
              <div key={tx.id} className="bg-white p-3 rounded border border-slate-200 text-sm flex justify-between items-center">
                <span>{tx.productName}</span>
                <span className="text-xs text-slate-400 font-mono">{tx.id.substring(0,8)}...</span>
              </div>
            ))}
            <button 
              onClick={handleMine}
              className="mt-4 w-full bg-emerald-600 text-white py-2 rounded hover:bg-emerald-700 transition-colors flex items-center justify-center"
            >
              <Lock size={16} className="mr-2" /> Mine Block
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderAuditorView = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
         <h2 className="text-2xl font-bold text-slate-800 flex items-center">
          <Search className="mr-2" /> Blockchain Explorer
        </h2>
        <button 
          onClick={runAIAudit}
          disabled={isAuditing}
          className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:opacity-50 flex items-center"
        >
          {isAuditing ? 'Analyzing...' : 'Run AI Audit'}
        </button>
      </div>

      {auditResult && (
        <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg prose max-w-none text-sm">
          <h3 className="text-purple-800 font-bold mb-2">AI Audit Report</h3>
          <div className="whitespace-pre-wrap text-purple-900 font-sans">{auditResult}</div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-1 space-y-4">
          <h3 className="font-semibold text-slate-600">Blocks</h3>
          {chain.chain.map((block, idx) => (
            <div 
              key={block.hash} 
              onClick={() => {
                setSelectedBlockIndex(idx);
                setVerificationData(null); // Clear verification when switching blocks
              }}
              className={`p-4 rounded-lg border cursor-pointer transition-all ${selectedBlockIndex === idx ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-slate-200 bg-white hover:border-blue-300'}`}
            >
              <div className="flex justify-between mb-1">
                <span className="font-bold text-slate-700">Block #{block.header.index}</span>
                <span className="text-xs text-slate-400">{new Date(block.header.timestamp).toLocaleTimeString()}</span>
              </div>
              <div className="text-xs font-mono text-slate-500 truncate mb-1">Hash: {block.hash}</div>
              <div className="text-xs text-slate-600">{block.transactions.length} Transactions</div>
            </div>
          ))}
        </div>

        <div className="col-span-1 md:col-span-2 space-y-6">
          {selectedBlockIndex !== null ? (
            <>
              <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold mb-4">Block #{selectedBlockIndex} Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm mb-6">
                  <div>
                    <span className="block text-slate-500 text-xs">Previous Hash</span>
                    <span className="font-mono break-all">{chain.chain[selectedBlockIndex].header.previousHash}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500 text-xs">Merkle Root</span>
                    <span className="font-mono break-all">{chain.chain[selectedBlockIndex].header.merkleRoot}</span>
                  </div>
                </div>
                
                <h4 className="font-semibold text-slate-700 mb-2">Transactions</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto mb-6">
                  {chain.chain[selectedBlockIndex].transactions.length === 0 ? (
                    <p className="text-sm text-slate-400">No transactions (Genesis or Empty)</p>
                  ) : (
                    chain.chain[selectedBlockIndex].transactions.map(tx => (
                      <div key={tx.id} className="p-3 bg-slate-50 rounded border border-slate-100">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium text-slate-800">{tx.productName}</div>
                            <div className="text-xs text-slate-600">{tx.details}</div>
                            <div className="mt-1 text-[10px] text-slate-400 font-mono">Sig: {tx.signature.substring(0, 32)}...</div>
                          </div>
                          <button 
                            onClick={() => handleVerifyTransaction(tx, chain.chain[selectedBlockIndex].transactions, chain.chain[selectedBlockIndex].header.merkleRoot)}
                            className="flex items-center text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                          >
                            <Link size={12} className="mr-1" />
                            Verify Proof
                          </button>
                        </div>
                        
                        {verificationData?.txId === tx.id && (
                          <div className={`mt-3 p-3 rounded-md text-sm border ${verificationData.valid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                            <div className="flex items-center font-bold mb-2">
                              {verificationData.valid ? (
                                <Check size={16} className="text-green-600 mr-2" />
                              ) : (
                                <X size={16} className="text-red-600 mr-2" />
                              )}
                              <span className={verificationData.valid ? 'text-green-800' : 'text-red-800'}>
                                Merkle Verification {verificationData.valid ? 'Passed' : 'Failed'}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 font-mono bg-white/50 p-2 rounded overflow-x-auto">
                              <div className="mb-1 text-slate-400">Proof Path (from Leaf to Root):</div>
                              {verificationData.proof.map((step, i) => (
                                <div key={i} className="flex items-center py-0.5">
                                  <span className="w-8 text-slate-400">{step.position === 'left' ? 'L' : 'R'}</span>
                                  <span className="truncate">{step.hash.substring(0, 40)}...</span>
                                </div>
                              ))}
                              <div className="mt-2 pt-2 border-t border-slate-200">
                                <span className="text-slate-400">Root: </span>
                                <span className="font-bold">{chain.chain[selectedBlockIndex].header.merkleRoot.substring(0, 20)}...</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <MerkleTreeViz transactions={chain.chain[selectedBlockIndex].transactions} />
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-300">
              Select a block to view details and Merkle Tree
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderGovernance = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 border-l-4 border-l-red-500">
        <h2 className="text-xl font-bold mb-4 flex items-center text-slate-800">
          <AlertTriangle className="mr-2 text-red-500" /> Security Governance
        </h2>
        <p className="text-sm text-slate-600 mb-6">
          Revoke compromised public keys to prevent them from signing new blocks or transactions.
          This does not invalidate past blocks but ensures future security.
        </p>

        <div className="flex gap-4">
          <input 
            type="text" 
            value={revokeKeyInput}
            onChange={e => setRevokeKeyInput(e.target.value)}
            placeholder="Enter Public Key to Revoke"
            className="flex-1 rounded-md border-slate-300 border p-2 text-sm"
          />
          <button 
            onClick={handleRevoke}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 flex items-center"
          >
            <UserX className="mr-2" size={16} /> Revoke Key
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg border border-slate-200">
        <h3 className="font-bold text-slate-800 mb-4">Revocation List (CRL)</h3>
        {chain.revokedKeys.size === 0 ? (
          <p className="text-slate-400 italic text-sm">No keys currently revoked.</p>
        ) : (
          <ul className="space-y-2">
            {Array.from(chain.revokedKeys).map(key => (
              <li key={key} className="flex items-center text-xs font-mono bg-red-50 p-2 rounded text-red-800">
                <Lock size={12} className="mr-2" />
                {key}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <ShieldCheck className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-xl font-bold text-slate-900 tracking-tight">ChainGuard</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-xs text-slate-500 hidden md:block">
                Secure Supply Chain Verification • ECDSA/SHA-256
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Role Toggles */}
        <div className="flex space-x-1 bg-white p-1 rounded-lg border border-slate-200 shadow-sm mb-8 w-fit mx-auto">
          <button
            onClick={() => setActiveTab(UserRole.USER)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === UserRole.USER ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            User View
          </button>
          <button
            onClick={() => setActiveTab(UserRole.AUDITOR)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === UserRole.AUDITOR ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Auditor View
          </button>
          <button
            onClick={() => setActiveTab(UserRole.ADMIN)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === UserRole.ADMIN ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Governance
          </button>
        </div>

        {/* View Content */}
        <div className="transition-opacity duration-300">
          {activeTab === UserRole.USER && renderUserView()}
          {activeTab === UserRole.AUDITOR && renderAuditorView()}
          {activeTab === UserRole.ADMIN && renderGovernance()}
        </div>

      </main>

      <footer className="bg-white border-t border-slate-200 mt-12 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-400 text-sm">
          <p>© 2024 ChainGuard Systems. Demo Prototype.</p>
          <p className="mt-1 text-xs">
            Cryptography: secp256k1 (ECDSA) • Hash: SHA-256 • Consensus: Simulated (Single Node)
          </p>
        </div>
      </footer>
    </div>
  );
}