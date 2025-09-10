/**
 * Configuration Manager for Voice API Router
 * Handles secure storage and management of API keys and provider settings
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ConfigManager {
    constructor() {
        this.configFile = path.join(__dirname, 'voice-config.json');
        this.encryptionKey = process.env.CONFIG_ENCRYPTION_KEY || this.generateKey();
        this.configs = new Map();
        this.defaultSettings = {
            timeout: 30000,
            retries: 3,
            fallbackProviders: [],
            logging: true,
            analytics: true
        };
    }

    /**
     * Initialize configuration manager
     */
    async init() {
        try {
            await this.loadConfigurations();
        } catch (error) {
            console.log('📝 Creating new configuration file...');
            await this.saveConfigurations();
        }
    }

    /**
     * Add or update provider configuration
     * @param {string} userId - User identifier (could be IP, session ID, etc.)
     * @param {string} provider - Provider name
     * @param {Object} config - Provider configuration
     */
    async setProviderConfig(userId, provider, config) {
        if (!this.configs.has(userId)) {
            this.configs.set(userId, {
                providers: {},
                settings: { ...this.defaultSettings },
                created: new Date().toISOString(),
                lastUsed: new Date().toISOString()
            });
        }

        const userConfig = this.configs.get(userId);
        
        // Encrypt sensitive data
        const encryptedConfig = {
            ...config,
            apiKey: config.apiKey ? this.encrypt(config.apiKey) : null,
            encrypted: true
        };

        userConfig.providers[provider] = encryptedConfig;
        userConfig.lastUsed = new Date().toISOString();
        
        this.configs.set(userId, userConfig);
        await this.saveConfigurations();

        return { success: true, provider, userId };
    }

    /**
     * Get provider configuration
     * @param {string} userId - User identifier
     * @param {string} provider - Provider name
     */
    getProviderConfig(userId, provider) {
        const userConfig = this.configs.get(userId);
        if (!userConfig || !userConfig.providers[provider]) {
            return null;
        }

        const config = userConfig.providers[provider];
        
        // Decrypt sensitive data
        if (config.encrypted && config.apiKey) {
            return {
                ...config,
                apiKey: this.decrypt(config.apiKey),
                encrypted: undefined
            };
        }

        return config;
    }

    /**
     * Get all providers for a user
     * @param {string} userId - User identifier
     */
    getUserProviders(userId) {
        const userConfig = this.configs.get(userId);
        if (!userConfig) {
            return [];
        }

        return Object.keys(userConfig.providers).map(provider => ({
            provider,
            configured: true,
            lastUsed: userConfig.lastUsed,
            hasApiKey: !!userConfig.providers[provider].apiKey
        }));
    }

    /**
     * Update user settings
     * @param {string} userId - User identifier
     * @param {Object} settings - Settings to update
     */
    async updateUserSettings(userId, settings) {
        if (!this.configs.has(userId)) {
            this.configs.set(userId, {
                providers: {},
                settings: { ...this.defaultSettings },
                created: new Date().toISOString(),
                lastUsed: new Date().toISOString()
            });
        }

        const userConfig = this.configs.get(userId);
        userConfig.settings = { ...userConfig.settings, ...settings };
        userConfig.lastUsed = new Date().toISOString();
        
        this.configs.set(userId, userConfig);
        await this.saveConfigurations();

        return userConfig.settings;
    }

    /**
     * Get user settings
     * @param {string} userId - User identifier
     */
    getUserSettings(userId) {
        const userConfig = this.configs.get(userId);
        return userConfig ? userConfig.settings : { ...this.defaultSettings };
    }

    /**
     * Remove provider configuration
     * @param {string} userId - User identifier
     * @param {string} provider - Provider name
     */
    async removeProviderConfig(userId, provider) {
        const userConfig = this.configs.get(userId);
        if (!userConfig || !userConfig.providers[provider]) {
            return { success: false, error: 'Provider not found' };
        }

        delete userConfig.providers[provider];
        userConfig.lastUsed = new Date().toISOString();
        
        this.configs.set(userId, userConfig);
        await this.saveConfigurations();

        return { success: true, provider, userId };
    }

    /**
     * Clear all configurations for a user
     * @param {string} userId - User identifier
     */
    async clearUserConfig(userId) {
        this.configs.delete(userId);
        await this.saveConfigurations();
        return { success: true, userId };
    }

    /**
     * Get usage statistics
     */
    getUsageStats() {
        const stats = {
            totalUsers: this.configs.size,
            totalProviders: 0,
            providerUsage: {},
            oldestConfig: null,
            newestConfig: null
        };

        for (const [userId, config] of this.configs) {
            const providers = Object.keys(config.providers);
            stats.totalProviders += providers.length;

            providers.forEach(provider => {
                stats.providerUsage[provider] = (stats.providerUsage[provider] || 0) + 1;
            });

            // Track config ages
            const created = new Date(config.created);
            if (!stats.oldestConfig || created < new Date(stats.oldestConfig)) {
                stats.oldestConfig = config.created;
            }
            if (!stats.newestConfig || created > new Date(stats.newestConfig)) {
                stats.newestConfig = config.created;
            }
        }

        return stats;
    }

    /**
     * Load configurations from file
     */
    async loadConfigurations() {
        try {
            const data = await fs.readFile(this.configFile, 'utf8');
            const parsedData = JSON.parse(data);
            
            // Convert plain object back to Map
            this.configs = new Map(Object.entries(parsedData.configs || {}));
            
            console.log(`📂 Loaded ${this.configs.size} user configurations`);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('❌ Failed to load configurations:', error);
            }
            throw error;
        }
    }

    /**
     * Save configurations to file
     */
    async saveConfigurations() {
        try {
            const data = {
                version: '1.0.0',
                created: new Date().toISOString(),
                configs: Object.fromEntries(this.configs)
            };

            await fs.writeFile(this.configFile, JSON.stringify(data, null, 2));
            console.log(`💾 Saved ${this.configs.size} user configurations`);
        } catch (error) {
            console.error('❌ Failed to save configurations:', error);
            throw error;
        }
    }

    /**
     * Encrypt sensitive data
     */
    encrypt(text) {
        if (!text) return null;
        
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
        
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        return iv.toString('hex') + ':' + encrypted;
    }

    /**
     * Decrypt sensitive data
     */
    decrypt(encryptedText) {
        if (!encryptedText) return null;
        
        try {
            const parts = encryptedText.split(':');
            if (parts.length !== 2) return encryptedText; // Not encrypted
            
            const iv = Buffer.from(parts[0], 'hex');
            const encrypted = parts[1];
            
            const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
            
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
        } catch (error) {
            console.error('❌ Decryption failed:', error);
            return null;
        }
    }

    /**
     * Generate encryption key
     */
    generateKey() {
        const key = crypto.randomBytes(32).toString('hex');
        console.log('🔑 Generated new encryption key. Set CONFIG_ENCRYPTION_KEY in .env for persistence.');
        return key;
    }

    /**
     * Validate provider configuration
     */
    validateProviderConfig(provider, config) {
        const requiredFields = ['apiKey'];
        const optionalFields = ['model', 'voice', 'language', 'options'];
        
        const errors = [];
        
        // Check required fields
        requiredFields.forEach(field => {
            if (!config[field]) {
                errors.push(`Missing required field: ${field}`);
            }
        });

        // Validate API key format (basic check)
        if (config.apiKey && config.apiKey.length < 10) {
            errors.push('API key appears to be too short');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Clean up old configurations
     * @param {number} maxAge - Maximum age in days
     */
    async cleanupOldConfigs(maxAge = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - maxAge);

        let removed = 0;
        for (const [userId, config] of this.configs) {
            const lastUsed = new Date(config.lastUsed);
            if (lastUsed < cutoffDate) {
                this.configs.delete(userId);
                removed++;
            }
        }

        if (removed > 0) {
            await this.saveConfigurations();
            console.log(`🧹 Cleaned up ${removed} old configurations (older than ${maxAge} days)`);
        }

        return { removed, remaining: this.configs.size };
    }

    /**
     * Export user configurations (for backup)
     * @param {string} userId - User identifier
     */
    exportUserConfig(userId) {
        const userConfig = this.configs.get(userId);
        if (!userConfig) {
            return null;
        }

        // Create export without sensitive data
        const exportConfig = {
            providers: {},
            settings: userConfig.settings,
            created: userConfig.created,
            lastUsed: userConfig.lastUsed,
            exported: new Date().toISOString()
        };

        // Export provider configs without API keys
        Object.entries(userConfig.providers).forEach(([provider, config]) => {
            exportConfig.providers[provider] = {
                ...config,
                apiKey: config.apiKey ? '[ENCRYPTED]' : null,
                encrypted: undefined
            };
        });

        return exportConfig;
    }
}

export default ConfigManager;