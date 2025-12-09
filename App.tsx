import React, { useState, useEffect } from 'react';
import { ShieldCheck, Truck, Lock, AlertTriangle, FileText, Search, UserX, Check, X, Link, ArrowDown, ArrowRight, Key, User } from 'lucide-react';
import { Blockchain, getMerkleProof, verifyMerkleProof, MerkleProofStep } from './services/blockchain';
import { generateKeyPair, signData, createTransactionId, hashData } from './services/crypto';
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
  const [autoAudit, setAutoAudit] = useState(false);
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

  const runAIAudit = async () => {
    setIsAuditing(true);
    const result = await analyzeChain(chain.chain);
    setAuditResult(result);
    setIsAuditing(false);
  };

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

  const handleMine = async () => {
    chain.minePendingTransactions();
    setSubmitStatus('Block Mined successfully!');
    setRefreshTrigger(prev => prev + 1);

    if (autoAudit) {
      await runAIAudit();
    }
  };

  const handleRevoke = () => {
    if (revokeKeyInput) {
      chain.revokeKey(revokeKeyInput);
      setRevokeKeyInput('');
      setRefreshTrigger(prev => prev + 1);
      alert("Key revoked. Future transactions from this key will be rejected.");
    }
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
        
        {/* Identity Display Block */}
        <div className="bg-blue-50 p-4 rounded-md mb-6 border border-blue-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
             <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-blue-200 rounded-full text-blue-700">
                  <User size={16} />
                </div>
                <span className="font-bold text-blue-900 text-sm">Identity: {userKeys?.label}</span>
             </div>
             <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider">Active Session</span>
          </div>
          
          <div>
            <div className="flex items-center text-xs text-blue-700 mb-1 font-semibold">
               <Key size={12} className="mr-1" />
               Public Key (ECDSA / secp256k1)
            </div>
            <div className="font-mono text-xs break-all bg-white p-2.5 rounded border border-blue-200 text-slate-600 select-all shadow-inner">
              {userKeys?.publicKey || 'Initializing Identity...'}
            </div>
            <div className="text-[10px] text-blue-400 mt-1 text-right">
              This unique key signs all your product updates
            </div>
          </div>
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
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors shadow-sm"
          >
            Sign & Submit to Blockchain
          </button>
        </form>
        {submitStatus && (
          <div className={`mt-4 p-3 rounded-md text-sm border ${submitStatus.includes('Error') ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
            <span className="font-medium">{submitStatus}</span>
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
              <div key={tx.id} className="bg-white p-3 rounded border border-slate-200 text-sm flex justify-between items-center shadow-sm">
                <span className="font-medium text-slate-700">{tx.productName}</span>
                <span className="text-xs text-slate-400 font-mono bg-slate-50 px-2 py-1 rounded">{tx.id.substring(0,8)}...</span>
              </div>
            ))}
            <button 
              onClick={handleMine}
              className="mt-4 w-full bg-emerald-600 text-white py-2 rounded hover:bg-emerald-700 transition-colors flex items-center justify-center shadow-sm font-medium"
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
        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2 text-sm text-slate-600 cursor-pointer select-none bg-white px-3 py-1.5 rounded-md border border-slate-200 hover:border-slate-300 transition-colors">
            <input 
              type="checkbox" 
              checked={autoAudit} 
              onChange={e => setAutoAudit(e.target.checked)} 
              className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
            />
            <span>Auto-Audit New Blocks</span>
          </label>
          <button 
            onClick={runAIAudit}
            disabled={isAuditing}
            className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:opacity-50 flex items-center shadow-sm font-medium"
          >
            {isAuditing ? 'Analyzing...' : 'Run AI Audit'}
          </button>
        </div>
      </div>

      {auditResult && (
        <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg prose max-w-none text-sm shadow-sm">
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
              className={`p-4 rounded-lg border cursor-pointer transition-all shadow-sm ${selectedBlockIndex === idx ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200' : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-md'}`}
            >
              <div className="flex justify-between mb-1">
                <span className="font-bold text-slate-700">Block #{block.header.index}</span>
                <span className="text-xs text-slate-400">{new Date(block.header.timestamp).toLocaleTimeString()}</span>
              </div>
              <div className="text-xs font-mono text-slate-500 truncate mb-1 bg-slate-50 p-1 rounded">Hash: {block.hash}</div>
              <div className="text-xs text-slate-600 font-medium">{block.transactions.length} Transactions</div>
            </div>
          ))}
        </div>

        <div className="col-span-1 md:col-span-2 space-y-6">
          {selectedBlockIndex !== null ? (
            <>
              <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold mb-4 flex items-center">
                  <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-sm mr-2">#{selectedBlockIndex}</span> 
                  Block Details
                </h3>
                <div className="grid grid-cols-1 gap-3 text-sm mb-6 bg-slate-50 p-4 rounded border border-slate-100">
                  <div>
                    <span className="block text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Previous Hash</span>
                    <span className="font-mono break-all text-xs text-slate-700">{chain.chain[selectedBlockIndex].header.previousHash}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Merkle Root</span>
                    <span className="font-mono break-all text-xs text-slate-700">{chain.chain[selectedBlockIndex].header.merkleRoot}</span>
                  </div>
                </div>
                
                <h4 className="font-semibold text-slate-700 mb-3 border-b pb-2">Transactions in Block</h4>
                <div className="space-y-3 max-h-[800px] overflow-y-auto mb-6 pr-1">
                  {chain.chain[selectedBlockIndex].transactions.length === 0 ? (
                    <p className="text-sm text-slate-400 py-4 text-center bg-slate-50 rounded">No transactions (Genesis or Empty)</p>
                  ) : (
                    chain.chain[selectedBlockIndex].transactions.map(tx => (
                      <div key={tx.id} className="p-4 bg-white rounded border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-bold text-slate-800">{tx.productName}</div>
                            <div className="text-sm text-slate-600 mt-0.5">{tx.details}</div>
                          </div>
                          <button 
                            onClick={() => handleVerifyTransaction(tx, chain.chain[selectedBlockIndex].transactions, chain.chain[selectedBlockIndex].header.merkleRoot)}
                            className="flex items-center text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-full transition-colors"
                          >
                            <Link size={12} className="mr-1" />
                            Verify Proof
                          </button>
                        </div>
                        
                        <div className="mt-2 text-[10px] text-slate-400 font-mono bg-slate-50 p-1.5 rounded border border-slate-100 truncate">
                          Sig: {tx.signature}
                        </div>
                        
                        {verificationData?.txId === tx.id && (
                          <div className={`mt-4 p-4 rounded-md text-sm border animation-fade-in ${verificationData.valid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                            
                            {/* Header Status */}
                            <div className="flex items-center font-bold mb-4 border-b border-black/5 pb-3">
                              {verificationData.valid ? (
                                <Check size={20} className="text-green-600 mr-2" />
                              ) : (
                                <X size={20} className="text-red-600 mr-2" />
                              )}
                              <span className={verificationData.valid ? 'text-green-800' : 'text-red-800'}>
                                Merkle Proof Verification: {verificationData.valid ? 'VALID' : 'INVALID'}
                              </span>
                            </div>

                            <div className="space-y-4">
                              {/* 1. Start Leaf */}
                              <div className="flex items-center">
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs shrink-0 z-10 border-2 border-white ring-1 ring-blue-200 shadow-sm">
                                  Tx
                                </div>
                                <div className="ml-3 min-w-0 flex-1">
                                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Leaf Transaction Hash</div>
                                  <div className="text-xs font-mono bg-white border border-slate-200 rounded p-2 text-slate-600 truncate shadow-sm">
                                    {tx.id}
                                  </div>
                                </div>
                              </div>

                              {/* 2. Steps */}
                              {(() => {
                                // Pre-calculate steps for rendering
                                let curr = tx.id;
                                return verificationData.proof.map((step, i) => {
                                  const isRight = step.position === 'right';
                                  const next = isRight ? hashData(curr + step.hash) : hashData(step.hash + curr);
                                  const prev = curr;
                                  curr = next;

                                  return (
                                    <div key={i} className="relative pl-4 ml-4 border-l-2 border-slate-300/50">
                                       <div className="mb-4 pt-1">
                                          <div className="flex items-center gap-2 mb-2">
                                            <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">Step {i + 1}</span>
                                            <span className="text-slate-400 text-xs">Combine with {step.position === 'left' ? 'Left' : 'Right'} Neighbor</span>
                                          </div>
                                          
                                          {/* Visual Equation */}
                                          <div className="bg-slate-100/50 p-3 rounded-lg border border-slate-200">
                                            <div className="flex flex-col gap-2">
                                              
                                              {/* Row 1: The two inputs */}
                                              <div className="flex items-center gap-2">
                                                <div className={`flex-1 min-w-0 flex flex-col ${!isRight ? 'order-2' : 'order-1'}`}>
                                                  <span className="text-[10px] text-slate-400 mb-0.5 font-medium">Current Hash</span>
                                                  <div className="text-[10px] font-mono p-1.5 rounded truncate bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                    {prev}
                                                  </div>
                                                </div>
                                                
                                                <div className={`shrink-0 text-slate-400 flex flex-col justify-end pb-2 ${!isRight ? 'order-1' : 'order-2'}`}>
                                                  +
                                                </div>

                                                <div className={`flex-1 min-w-0 flex flex-col ${!isRight ? 'order-1' : 'order-2'}`}>
                                                  <span className="text-[10px] text-slate-400 mb-0.5 font-medium">Partner ({step.position})</span>
                                                  <div className="text-[10px] font-mono p-1.5 rounded truncate bg-orange-50 text-orange-700 border border-orange-200">
                                                    {step.hash}
                                                  </div>
                                                </div>
                                              </div>

                                              {/* Arrow Down */}
                                              <div className="flex justify-center -my-1">
                                                <ArrowDown size={14} className="text-slate-300" />
                                              </div>

                                              {/* Row 2: Result */}
                                              <div>
                                                <div className="text-[10px] font-mono p-2 rounded truncate bg-white text-slate-700 border border-slate-300 shadow-sm">
                                                  {next}
                                                </div>
                                              </div>

                                            </div>
                                          </div>
                                       </div>
                                    </div>
                                  );
                                });
                              })()}

                              {/* 3. Final Root */}
                              <div className="flex items-center pt-2">
                                 <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 z-10 border-2 border-white ring-1 shadow-sm ${verificationData.valid ? 'bg-green-100 text-green-600 ring-green-200' : 'bg-red-100 text-red-600 ring-red-200'}`}>
                                   Root
                                 </div>
                                 <div className="ml-3 min-w-0 flex-1">
                                   <div className="flex justify-between items-baseline mb-1">
                                      <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Calculated Root</div>
                                      <div className="text-[10px] text-slate-400">Matches Block Header?</div>
                                   </div>
                                   <div className={`text-xs font-mono border rounded p-2 truncate font-bold ${verificationData.valid ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                                     {chain.chain[selectedBlockIndex].header.merkleRoot}
                                   </div>
                                 </div>
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
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300">
              <Search size={48} className="mb-4 text-slate-300" />
              <p>Select a block from the list to inspect details</p>
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
        <p className="text-sm text-slate-600 mb-6 max-w-2xl">
          Revoke compromised public keys to prevent them from signing new blocks or transactions.
          This does not invalidate past blocks but ensures future security for the supply chain.
        </p>

        <div className="flex gap-4 max-w-lg">
          <input 
            type="text" 
            value={revokeKeyInput}
            onChange={e => setRevokeKeyInput(e.target.value)}
            placeholder="Enter Public Key to Revoke"
            className="flex-1 rounded-md border-slate-300 border p-2 text-sm focus:ring-red-500 focus:border-red-500"
          />
          <button 
            onClick={handleRevoke}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 flex items-center shadow-sm"
          >
            <UserX className="mr-2" size={16} /> Revoke Key
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center">
          <Lock size={18} className="mr-2 text-slate-500" />
          Certificate Revocation List (CRL)
        </h3>
        {chain.revokedKeys.size === 0 ? (
          <div className="text-center py-8 bg-slate-50 rounded border border-dashed border-slate-200">
             <Check className="mx-auto text-green-500 mb-2" size={24} />
             <p className="text-slate-500 text-sm">System Secure. No active revocations.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {Array.from(chain.revokedKeys).map(key => (
              <li key={key} className="flex items-center text-xs font-mono bg-red-50 p-3 rounded border border-red-100 text-red-800 break-all">
                <Lock size={14} className="mr-3 flex-shrink-0" />
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
              <span className="text-xs text-slate-500 hidden md:block bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
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