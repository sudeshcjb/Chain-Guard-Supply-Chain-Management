import { ec as EC } from 'elliptic';
import SHA256 from 'crypto-js/sha256';

// Initialize elliptic curve secp256k1
// Documentation Note:
// We chose ECDSA (Elliptic Curve Digital Signature Algorithm) with secp256k1 over RSA for this supply chain context.
// Reason 1: Key Size & Efficiency. A 256-bit ECC key provides comparable security to a 3072-bit RSA key.
// Reason 2: IoT Constraints. Supply chain devices (sensors, tags) often have limited processing power and storage.
// Smaller keys mean faster computations for signing and smaller payloads to transmit over low-bandwidth networks (e.g., LoRaWAN).
const ec = new EC('secp256k1');

export const generateKeyPair = (): { privateKey: string; publicKey: string } => {
  const key = ec.genKeyPair();
  return {
    privateKey: key.getPrivate('hex'),
    publicKey: key.getPublic('hex')
  };
};

export const hashData = (data: string): string => {
  return SHA256(data).toString();
};

export const signData = (privateKeyHex: string, data: string): string => {
  try {
    const key = ec.keyFromPrivate(privateKeyHex);
    const msgHash = hashData(data);
    const signature = key.sign(msgHash);
    return signature.toDER('hex');
  } catch (e) {
    console.error("Signing error", e);
    return "";
  }
};

export const verifySignature = (publicKeyHex: string, data: string, signatureHex: string): boolean => {
  try {
    const key = ec.keyFromPublic(publicKeyHex, 'hex');
    const msgHash = hashData(data);
    return key.verify(msgHash, signatureHex);
  } catch (e) {
    console.error("Verification error", e);
    return false;
  }
};

export const createTransactionId = (productName: string, details: string, timestamp: number): string => {
  return hashData(`${productName}:${details}:${timestamp}`);
};
