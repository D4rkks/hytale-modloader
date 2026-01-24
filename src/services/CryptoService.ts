export interface KeyPair {
    publicKey: string;
    privateKey: string;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

export class CryptoService {
    static async generateIdentityKeyPair(): Promise<KeyPair> {
        const keyPair = await crypto.subtle.generateKey(
            {
                name: 'ECDSA',
                namedCurve: 'P-256'
            },
            true,
            ['sign', 'verify']
        );

        const publicKeyRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
        const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

        return {
            publicKey: arrayBufferToBase64(publicKeyRaw),
            privateKey: JSON.stringify(privateKeyJwk)
        };
    }

    static async generatePreKey(): Promise<KeyPair> {
        const keyPair = await crypto.subtle.generateKey(
            {
                name: 'ECDH',
                namedCurve: 'P-256'
            },
            true,
            ['deriveKey', 'deriveBits']
        );

        const publicKeyRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
        const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

        return {
            publicKey: arrayBufferToBase64(publicKeyRaw),
            privateKey: JSON.stringify(privateKeyJwk)
        };
    }

    static async deriveSharedKey(
        privateKeyJwk: string,
        recipientPublicKeyB64: string
    ): Promise<CryptoKey> {
        const privateKey = await crypto.subtle.importKey(
            'jwk',
            JSON.parse(privateKeyJwk),
            { name: 'ECDH', namedCurve: 'P-256' },
            false,
            ['deriveKey']
        );

        const publicKey = await crypto.subtle.importKey(
            'raw',
            base64ToArrayBuffer(recipientPublicKeyB64),
            { name: 'ECDH', namedCurve: 'P-256' },
            false,
            []
        );

        return crypto.subtle.deriveKey(
            { name: 'ECDH', public: publicKey },
            privateKey,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }

    static async encryptMessage(
        message: string,
        recipientPublicKeyB64: string,
        senderPrivateKeyJwk: string
    ): Promise<{ ciphertext: string; nonce: string }> {
        const sharedKey = await this.deriveSharedKey(senderPrivateKeyJwk, recipientPublicKeyB64);

        const nonce = crypto.getRandomValues(new Uint8Array(12));
        const encoder = new TextEncoder();
        const plaintext = encoder.encode(message);

        const ciphertext = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: nonce },
            sharedKey,
            plaintext
        );

        return {
            ciphertext: arrayBufferToBase64(ciphertext),
            nonce: arrayBufferToBase64(nonce.buffer)
        };
    }

    static async decryptMessage(
        ciphertextB64: string,
        nonceB64: string,
        senderPublicKeyB64: string,
        recipientPrivateKeyJwk: string
    ): Promise<string> {
        const sharedKey = await this.deriveSharedKey(recipientPrivateKeyJwk, senderPublicKeyB64);

        const ciphertext = base64ToArrayBuffer(ciphertextB64);
        const nonce = base64ToArrayBuffer(nonceB64);

        const plaintext = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: nonce },
            sharedKey,
            ciphertext
        );

        const decoder = new TextDecoder();
        return decoder.decode(plaintext);
    }

    static async saveKeys(keys: KeyPair) {
        if ((window as any).electronAPI?.secureSet) {
            await (window as any).electronAPI.secureSet('orbis_identity_priv', keys.privateKey);
            await (window as any).electronAPI.secureSet('orbis_identity_pub', keys.publicKey);
            console.log('🔐 Keys saved to secure storage');
        } else {
            console.warn('⚠️ Secure Storage not available, using localStorage (less secure)');
            localStorage.setItem('orbis_identity_priv', keys.privateKey);
            localStorage.setItem('orbis_identity_pub', keys.publicKey);
        }
    }

    static async savePreKeys(keys: KeyPair) {
        if ((window as any).electronAPI?.secureSet) {
            await (window as any).electronAPI.secureSet('orbis_prekey_priv', keys.privateKey);
            await (window as any).electronAPI.secureSet('orbis_prekey_pub', keys.publicKey);
        } else {
            localStorage.setItem('orbis_prekey_priv', keys.privateKey);
            localStorage.setItem('orbis_prekey_pub', keys.publicKey);
        }
    }

    static async getKeys(): Promise<KeyPair | null> {
        let priv: string | null = null;
        let pub: string | null = null;

        if ((window as any).electronAPI?.secureGet) {
            priv = await (window as any).electronAPI.secureGet('orbis_identity_priv');
            pub = await (window as any).electronAPI.secureGet('orbis_identity_pub');
        }

        if (!priv || !pub) {
            priv = localStorage.getItem('orbis_identity_priv');
            pub = localStorage.getItem('orbis_identity_pub');
        }

        if (priv && pub) {
            return { privateKey: priv, publicKey: pub };
        }
        return null;
    }

    static async getPreKeys(): Promise<KeyPair | null> {
        let priv: string | null = null;
        let pub: string | null = null;

        if ((window as any).electronAPI?.secureGet) {
            priv = await (window as any).electronAPI.secureGet('orbis_prekey_priv');
            pub = await (window as any).electronAPI.secureGet('orbis_prekey_pub');
        }

        if (!priv || !pub) {
            priv = localStorage.getItem('orbis_prekey_priv');
            pub = localStorage.getItem('orbis_prekey_pub');
        }

        if (priv && pub) {
            return { privateKey: priv, publicKey: pub };
        }
        return null;
    }

    static async generateSymmetricKey(): Promise<string> {
        const key = await crypto.subtle.generateKey(
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt", "decrypt"]
        );
        const exported = await crypto.subtle.exportKey("raw", key);
        return arrayBufferToBase64(exported);
    }

    static async encryptWithSymmetricKey(plaintext: string, keyB64: string): Promise<{ ciphertext: string, nonce: string }> {
        const key = await crypto.subtle.importKey(
            "raw",
            base64ToArrayBuffer(keyB64),
            { name: "AES-GCM" },
            false,
            ["encrypt"]
        );

        const nonce = crypto.getRandomValues(new Uint8Array(12));
        const encoder = new TextEncoder();
        const encoded = encoder.encode(plaintext);

        const ciphertext = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: nonce },
            key,
            encoded
        );

        return {
            ciphertext: arrayBufferToBase64(ciphertext),
            nonce: arrayBufferToBase64(nonce.buffer)
        };
    }

    static async decryptWithSymmetricKey(ciphertextB64: string, nonceB64: string, keyB64: string): Promise<string> {
        const key = await crypto.subtle.importKey(
            "raw",
            base64ToArrayBuffer(keyB64),
            { name: "AES-GCM" },
            false,
            ["decrypt"]
        );

        const ciphertext = base64ToArrayBuffer(ciphertextB64);
        const nonce = base64ToArrayBuffer(nonceB64);

        const decrypted = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: nonce },
            key,
            ciphertext
        );

        const decoder = new TextDecoder();
        return decoder.decode(decrypted);
    }

    static generateNonce(): string {
        const nonce = crypto.getRandomValues(new Uint8Array(12));
        return arrayBufferToBase64(nonce.buffer);
    }
}
