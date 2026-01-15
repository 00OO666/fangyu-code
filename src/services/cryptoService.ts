/**
 * 加密服务 - 用于安全存储 API Key
 * 使用 AES-256-GCM 加密，基于设备指纹派生密钥
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
const SALT = 'fangyu-code-v1';
const ITERATIONS = 100000;

// 缓存派生的密钥
let cachedKey: CryptoKey | null = null;

/**
 * 获取设备指纹
 * 在 Tauri 环境中使用机器 ID，浏览器环境使用 localStorage 中的 UUID
 */
async function getDeviceFingerprint(): Promise<string> {
    // 尝试从 Tauri 获取机器 ID
    if (typeof window !== 'undefined' && (window as any).__TAURI__) {
        try {
            const { invoke } = await import('@tauri-apps/api/core');
            const machineId = await invoke<string>('get_machine_id');
            if (machineId) return machineId;
        } catch {
            // 忽略错误，使用备用方案
        }
    }

    // 备用方案：使用 localStorage 中的 UUID
    const FINGERPRINT_KEY = 'fangyu-device-fingerprint';
    let fingerprint = localStorage.getItem(FINGERPRINT_KEY);

    if (!fingerprint) {
        fingerprint = crypto.randomUUID();
        localStorage.setItem(FINGERPRINT_KEY, fingerprint);
    }

    return fingerprint;
}

/**
 * 派生加密密钥
 */
async function deriveKey(): Promise<CryptoKey> {
    if (cachedKey) return cachedKey;

    const deviceId = await getDeviceFingerprint();
    const encoder = new TextEncoder();
    const salt = encoder.encode(SALT);

    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(deviceId),
        'PBKDF2',
        false,
        ['deriveKey']
    );

    cachedKey = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt,
            iterations: ITERATIONS,
            hash: 'SHA-256',
        },
        keyMaterial,
        { name: ALGORITHM, length: KEY_LENGTH },
        false,
        ['encrypt', 'decrypt']
    );

    return cachedKey;
}

/**
 * 加密数据
 */
export async function encrypt(plaintext: string): Promise<{ ciphertext: string; iv: string }> {
    if (!plaintext) {
        return { ciphertext: '', iv: '' };
    }

    const key = await deriveKey();
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);

    // 生成随机 IV
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    const encrypted = await crypto.subtle.encrypt(
        { name: ALGORITHM, iv },
        key,
        data
    );

    return {
        ciphertext: arrayBufferToBase64(encrypted),
        iv: arrayBufferToBase64(iv),
    };
}

/**
 * 解密数据
 */
export async function decrypt(ciphertext: string, iv: string): Promise<string> {
    if (!ciphertext || !iv) {
        return '';
    }

    const key = await deriveKey();
    const encryptedData = base64ToArrayBuffer(ciphertext);
    const ivData = base64ToArrayBuffer(iv);

    const decrypted = await crypto.subtle.decrypt(
        { name: ALGORITHM, iv: ivData },
        key,
        encryptedData
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
}


/**
 * 掩码 API Key
 * 显示前 4 位和后 4 位，中间用 8 个点替代
 */
export function maskApiKey(key: string): string {
    if (!key || key.length < 12) {
        return '••••••••';
    }
    return `${key.slice(0, 4)}••••••••${key.slice(-4)}`;
}

/**
 * 安全清除字符串
 * 注意：JavaScript 中无法真正清除字符串，这只是最佳努力
 */
export function secureWipe(data: string): void {
    // JavaScript 字符串是不可变的，无法真正清除
    // 这里只是将引用置空，依赖垃圾回收
    // 在实际应用中，敏感数据应尽快使用后丢弃
    if (typeof data === 'string') {
        // 触发垃圾回收的提示（不保证立即执行）
        data = '';
    }
}

/**
 * 清除缓存的密钥
 */
export function clearCachedKey(): void {
    cachedKey = null;
}

// 工具函数：ArrayBuffer 转 Base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

// 工具函数：Base64 转 ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

// 导出 CryptoService 类（兼容设计文档中的类接口）
export class CryptoService {
    async encrypt(plaintext: string): Promise<{ ciphertext: string; iv: string }> {
        return encrypt(plaintext);
    }

    async decrypt(ciphertext: string, iv: string): Promise<string> {
        return decrypt(ciphertext, iv);
    }

    async deriveKey(): Promise<CryptoKey> {
        return deriveKey();
    }

    secureWipe(data: string): void {
        secureWipe(data);
    }

    maskApiKey(key: string): string {
        return maskApiKey(key);
    }
}

export default new CryptoService();
