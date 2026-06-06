import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigManager } from '../src/config/config-manager.js';

describe('ConfigManager crypto (createCipheriv migration)', () => {
    let manager;

    beforeEach(() => {
        manager = new ConfigManager();
        // Deterministic key so behavior is independent of the environment.
        manager.encryptionKey = 'test-encryption-key-1234567890';
    });

    it('round-trips encrypt -> decrypt to the original plaintext', () => {
        const plaintext = 'sk-test-1234567890';
        const encrypted = manager.encrypt(plaintext);
        expect(encrypted).not.toBe(plaintext);
        expect(encrypted).toContain(':');
        expect(manager.decrypt(encrypted)).toBe(plaintext);
    });

    it('produces different ciphertext for the same plaintext (random IV)', () => {
        const a = manager.encrypt('sk-test-1234567890');
        const b = manager.encrypt('sk-test-1234567890');
        expect(a).not.toBe(b);
        // Both still decrypt back to the same value.
        expect(manager.decrypt(a)).toBe(manager.decrypt(b));
    });

    it('stores a real 16-byte IV in the iv:ciphertext format', () => {
        const [ivHex] = manager.encrypt('sk-test-1234567890').split(':');
        expect(ivHex).toHaveLength(32); // 16 bytes -> 32 hex chars
    });

    it('returns non-encrypted input unchanged (existing contract)', () => {
        expect(manager.decrypt('plain-no-colon')).toBe('plain-no-colon');
    });

    it('does not throw on the current Node version', () => {
        expect(() => manager.decrypt(manager.encrypt('hello'))).not.toThrow();
    });

    it('setProviderConfig -> getProviderConfig returns the original apiKey', async () => {
        // Avoid touching disk: stub persistence.
        manager.saveConfigurations = async () => {};
        const userId = 'user-1';
        await manager.setProviderConfig(userId, 'deepgram', {
            apiKey: 'sk-roundtrip-apikey-123',
            model: 'nova-2'
        });
        const config = manager.getProviderConfig(userId, 'deepgram');
        expect(config.apiKey).toBe('sk-roundtrip-apikey-123');
        expect(config.model).toBe('nova-2');
    });
});
