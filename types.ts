export interface Transaction {
  id: string;
  productName: string;
  details: string; // e.g., "Carbon Footprint: 5kg"
  timestamp: number;
  signerPublicKey: string;
  signature: string;
  valid?: boolean; // For UI state
}

export interface BlockHeader {
  index: number;
  previousHash: string;
  timestamp: number;
  merkleRoot: string;
  nonce: number;
}

export interface Block {
  header: BlockHeader;
  transactions: Transaction[];
  hash: string;
}

export interface KeyPair {
  privateKey: string;
  publicKey: string;
  label: string; // e.g. "Farmer", "Shipper"
}

export enum UserRole {
  USER = 'USER',
  AUDITOR = 'AUDITOR',
  ADMIN = 'ADMIN'
}