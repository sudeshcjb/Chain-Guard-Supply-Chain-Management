import { Block, Transaction } from '../types';
import { hashData } from './crypto';

// --- Merkle Tree Implementation ---

export interface MerkleProofStep {
  hash: string;
  position: 'left' | 'right';
}

export const getMerkleRoot = (transactions: Transaction[]): string => {
  if (transactions.length === 0) return hashData("");
  
  let hashes = transactions.map(tx => tx.id);
  
  while (hashes.length > 1) {
    const nextLevel: string[] = [];
    
    for (let i = 0; i < hashes.length; i += 2) {
      if (i + 1 < hashes.length) {
        // Concatenate and hash
        nextLevel.push(hashData(hashes[i] + hashes[i + 1]));
      } else {
        // If odd number, duplicate the last hash and hash it with itself
        nextLevel.push(hashData(hashes[i] + hashes[i]));
      }
    }
    hashes = nextLevel;
  }
  
  return hashes[0];
};

export const getMerkleProof = (transactions: Transaction[], targetTxId: string): MerkleProofStep[] => {
  let hashes = transactions.map(tx => tx.id);
  const proof: MerkleProofStep[] = [];
  
  let index = hashes.findIndex(h => h === targetTxId);
  if (index === -1) return [];

  while (hashes.length > 1) {
    const nextLevel: string[] = [];
    
    // Determine sibling and position for the current level
    if (index % 2 === 0) {
      // Even index: we are on the Left, sibling is on the Right
      if (index + 1 < hashes.length) {
        proof.push({ hash: hashes[index + 1], position: 'right' });
      } else {
        // Last element in an odd-length list is duplicated with itself
        proof.push({ hash: hashes[index], position: 'right' }); 
      }
    } else {
      // Odd index: we are on the Right, sibling is on the Left
      proof.push({ hash: hashes[index - 1], position: 'left' });
    }

    // Build the next level of the tree to continue traversal
    for (let i = 0; i < hashes.length; i += 2) {
      if (i + 1 < hashes.length) {
        nextLevel.push(hashData(hashes[i] + hashes[i + 1]));
      } else {
        nextLevel.push(hashData(hashes[i] + hashes[i]));
      }
    }
    
    hashes = nextLevel;
    index = Math.floor(index / 2);
  }
  
  return proof;
};

export const verifyMerkleProof = (leafHash: string, proof: MerkleProofStep[], root: string): boolean => {
  let currentHash = leafHash;
  
  for (const step of proof) {
    if (step.position === 'right') {
      currentHash = hashData(currentHash + step.hash);
    } else {
      currentHash = hashData(step.hash + currentHash);
    }
  }
  
  return currentHash === root;
};

// Helper to build the full tree structure for visualization
export const buildMerkleTreeData = (transactions: Transaction[]) => {
  if (transactions.length === 0) return null;
  
  let levels: string[][] = [];
  let currentLevel = transactions.map(tx => tx.id);
  levels.push(currentLevel);

  while (currentLevel.length > 1) {
    const nextLevel: string[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
       if (i + 1 < currentLevel.length) {
        nextLevel.push(hashData(currentLevel[i] + currentLevel[i+1]));
      } else {
        nextLevel.push(hashData(currentLevel[i] + currentLevel[i]));
      }
    }
    currentLevel = nextLevel;
    levels.push(currentLevel);
  }

  // Convert to D3 hierarchy format
  // We need to reverse levels to build from root down
  const rootHash = levels[levels.length - 1][0];
  
  const buildNode = (hash: string, depth: number): any => {
    if (depth === 0) {
      return { name: hash.substring(0, 8) + '...', fullHash: hash, children: [] };
    }
    return { name: hash, value: hash };
  };

  return levels;
};

// --- Blockchain Logic ---

export class Blockchain {
  chain: Block[];
  pendingTransactions: Transaction[];
  revokedKeys: Set<string>;

  constructor() {
    this.chain = [this.createGenesisBlock()];
    this.pendingTransactions = [];
    this.revokedKeys = new Set();
  }

  createGenesisBlock(): Block {
    const timestamp = Date.now();
    return {
      header: {
        index: 0,
        previousHash: "0",
        timestamp,
        merkleRoot: hashData("Genesis Block"),
        nonce: 0
      },
      transactions: [],
      hash: hashData(`00${timestamp}${hashData("Genesis Block")}0`)
    };
  }

  getLatestBlock(): Block {
    return this.chain[this.chain.length - 1];
  }

  // Add transaction to pending pool
  addTransaction(tx: Transaction): boolean {
    if (this.revokedKeys.has(tx.signerPublicKey)) {
      console.warn("Transaction rejected: Signer key is revoked.");
      return false;
    }
    this.pendingTransactions.push(tx);
    return true;
  }

  minePendingTransactions() {
    // In a real blockchain, there's a difficulty target (PoW) or PoS logic.
    // Here we use a simple 'mine' that bundles all pending into a block.
    
    const previousBlock = this.getLatestBlock();
    const transactions = [...this.pendingTransactions];
    const merkleRoot = getMerkleRoot(transactions);
    const timestamp = Date.now();
    
    const block: Block = {
      header: {
        index: this.chain.length,
        previousHash: previousBlock.hash,
        timestamp,
        merkleRoot,
        nonce: Math.floor(Math.random() * 100000) // Simulated nonce
      },
      transactions: transactions,
      hash: ""
    };

    block.hash = this.calculateBlockHash(block);
    
    this.chain.push(block);
    this.pendingTransactions = []; // Clear mempool
    return block;
  }

  calculateBlockHash(block: Block): string {
    const { index, previousHash, timestamp, merkleRoot, nonce } = block.header;
    return hashData(`${index}${previousHash}${timestamp}${merkleRoot}${nonce}`);
  }

  isChainValid(): boolean {
    for (let i = 1; i < this.chain.length; i++) {
      const current = this.chain[i];
      const previous = this.chain[i - 1];

      // 1. Validate Block Hash integrity
      if (current.hash !== this.calculateBlockHash(current)) return false;

      // 2. Validate Linkage
      if (current.header.previousHash !== previous.hash) return false;

      // 3. Validate Merkle Root
      if (current.header.merkleRoot !== getMerkleRoot(current.transactions)) return false;
    }
    return true;
  }

  revokeKey(publicKey: string) {
    this.revokedKeys.add(publicKey);
  }
}