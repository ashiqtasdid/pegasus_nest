import { Injectable, Logger } from '@nestjs/common';
import * as validator from 'validator';
import * as sanitizeHtml from 'sanitize-html';
import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * 🛡️ VALIDATION SERVICE
 * Comprehensive input validation and sanitization service
 *
 * Features:
 * - Input sanitization and validation
 * - Security pattern detection
 * - File path validation
 * - Content filtering
 * - Rate limiting validation
 * - Data integrity checks
 */

interface ValidationRule {
  field: string;
  type:
    | 'string'
    | 'number'
    | 'email'
    | 'url'
    | 'path'
    | 'filename'
    | 'json'
    | 'custom';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  customValidator?: (value: any) => boolean;
  sanitizer?: (value: any) => any;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedData: any;
  warnings: string[];
}

interface SecurityContext {
  userAgent?: string;
  ip?: string;
  userId?: string;
  sessionId?: string;
}

@Injectable()
export class ValidationService {
  private readonly logger = new Logger(ValidationService.name);

  // Security patterns to detect and block
  private readonly SECURITY_PATTERNS = [
    // SQL Injection patterns
    /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/gi,
    /(--|\/\*|\*\/|;|'|"|`)/g,

    // XSS patterns
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe\b[^>]*>/gi,

    // Path traversal patterns
    /\.\.\/|\.\.\\|\.\.\%2f|\.\.\%5c/gi,
    /\%2e\%2e\%2f|\%2e\%2e\%5c/gi,

    // Command injection patterns
    /[;&|`$(){}[\]]/g,
    /\b(eval|exec|system|shell_exec|passthru|popen|proc_open)\b/gi,

    // LDAP injection patterns
    /[()&|!*<>=]/g,

    // NoSQL injection patterns
    /\$where|\$ne|\$gt|\$lt|\$gte|\$lte|\$in|\$nin|\$regex|\$exists/gi,
  ];

  // Dangerous file extensions
  private readonly DANGEROUS_EXTENSIONS = [
    '.exe',
    '.bat',
    '.cmd',
    '.com',
    '.pif',
    '.scr',
    '.vbs',
    '.js',
    '.jar',
    '.php',
    '.asp',
    '.aspx',
    '.jsp',
    '.py',
    '.rb',
    '.pl',
    '.sh',
    '.ps1',
  ];

  // Safe file extensions for plugins
  private readonly SAFE_PLUGIN_EXTENSIONS = [
    '.java',
    '.yml',
    '.yaml',
    '.properties',
    '.txt',
    '.md',
    '.json',
    '.xml',
  ];

  constructor() {
    this.logger.log('🛡️ Validation service initialized');
  }

  /**
   * Validate data against a set of rules
   */
  validateData(data: any, rules: ValidationRule[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const sanitizedData: any = {};

    try {
      for (const rule of rules) {
        const fieldValue = data[rule.field];
        const fieldResult = this.validateField(fieldValue, rule);

        if (!fieldResult.isValid) {
          errors.push(...fieldResult.errors);
        }

        if (fieldResult.warnings) {
          warnings.push(...fieldResult.warnings);
        }

        // Store sanitized value
        sanitizedData[rule.field] = fieldResult.sanitizedValue;
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        sanitizedData,
      };
    } catch (error) {
      this.logger.error('Validation error:', error);
      return {
        isValid: false,
        errors: ['Validation failed due to internal error'],
        warnings,
        sanitizedData: {},
      };
    }
  }

  /**
   * Validate individual field
   */
  private validateField(
    value: any,
    rule: ValidationRule,
  ): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    sanitizedValue: any;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    let sanitizedValue = value;

    // Check if field is required
    if (
      rule.required &&
      (value === undefined || value === null || value === '')
    ) {
      errors.push(`Field '${rule.field}' is required`);
      return { isValid: false, errors, warnings, sanitizedValue: null };
    }

    // Skip validation if field is empty and not required
    if (
      !rule.required &&
      (value === undefined || value === null || value === '')
    ) {
      return { isValid: true, errors, warnings, sanitizedValue: null };
    }

    // Apply sanitizer first if provided (only for non-null/undefined values)
    if (rule.sanitizer && value !== null && value !== undefined) {
      try {
        sanitizedValue = rule.sanitizer(value);
      } catch (error) {
        errors.push(`Failed to sanitize field '${rule.field}'`);
        return { isValid: false, errors, warnings, sanitizedValue: value };
      }
    }

    // Type-specific validation
    switch (rule.type) {
      case 'string':
        const stringResult = this.validateString(sanitizedValue, rule);
        errors.push(...stringResult.errors);
        warnings.push(...stringResult.warnings);
        sanitizedValue = stringResult.sanitizedValue;
        break;

      case 'number':
        const numberResult = this.validateNumber(sanitizedValue, rule);
        errors.push(...numberResult.errors);
        sanitizedValue = numberResult.sanitizedValue;
        break;

      case 'email':
        const emailResult = this.validateEmail(sanitizedValue);
        errors.push(...emailResult.errors);
        sanitizedValue = emailResult.sanitizedValue;
        break;

      case 'url':
        const urlResult = this.validateUrl(sanitizedValue);
        errors.push(...urlResult.errors);
        sanitizedValue = urlResult.sanitizedValue;
        break;

      case 'path':
        const pathResult = this.validatePath(sanitizedValue);
        errors.push(...pathResult.errors);
        warnings.push(...pathResult.warnings);
        sanitizedValue = pathResult.sanitizedValue;
        break;

      case 'filename':
        const filenameResult = this.validateFilename(sanitizedValue);
        errors.push(...filenameResult.errors);
        warnings.push(...filenameResult.warnings);
        sanitizedValue = filenameResult.sanitizedValue;
        break;

      case 'json':
        const jsonResult = this.validateJson(sanitizedValue);
        errors.push(...jsonResult.errors);
        sanitizedValue = jsonResult.sanitizedValue;
        break;

      case 'custom':
        if (rule.customValidator) {
          try {
            if (!rule.customValidator(sanitizedValue)) {
              errors.push(`Field '${rule.field}' failed custom validation`);
            }
          } catch (error) {
            errors.push(`Custom validation failed for field '${rule.field}'`);
          }
        }
        break;
    }

    // Pattern validation if provided
    if (rule.pattern && sanitizedValue) {
      if (!rule.pattern.test(sanitizedValue.toString())) {
        errors.push(`Field '${rule.field}' does not match required pattern`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitizedValue,
    };
  }

  /**
   * Validate and sanitize string
   */
  private validateString(
    value: any,
    rule: ValidationRule,
  ): {
    errors: string[];
    warnings: string[];
    sanitizedValue: string;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof value !== 'string') {
      if (value !== null && value !== undefined) {
        value = String(value);
        warnings.push(`Field '${rule.field}' was converted to string`);
      } else {
        errors.push(`Field '${rule.field}' must be a string`);
        return { errors, warnings, sanitizedValue: '' };
      }
    }

    // Sanitize the string
    let sanitizedValue = this.sanitizeString(value);

    // Length validation
    if (rule.minLength && sanitizedValue.length < rule.minLength) {
      errors.push(
        `Field '${rule.field}' must be at least ${rule.minLength} characters long`,
      );
    }

    if (rule.maxLength && sanitizedValue.length > rule.maxLength) {
      errors.push(
        `Field '${rule.field}' must be no more than ${rule.maxLength} characters long`,
      );
    }

    // Security checks
    const securityResult = this.checkSecurityPatterns(
      sanitizedValue,
      rule.field,
    );
    if (!securityResult.isSafe) {
      errors.push(
        ...securityResult.threats.map(
          (threat) => `Security threat detected in '${rule.field}': ${threat}`,
        ),
      );
    }

    return { errors, warnings, sanitizedValue };
  }

  /**
   * Validate number
   */
  private validateNumber(
    value: any,
    rule: ValidationRule,
  ): {
    errors: string[];
    sanitizedValue: number;
  } {
    const errors: string[] = [];

    if (typeof value === 'string') {
      value = parseFloat(value);
    }

    if (typeof value !== 'number' || isNaN(value)) {
      errors.push(`Field '${rule.field}' must be a valid number`);
      return { errors, sanitizedValue: 0 };
    }

    return { errors, sanitizedValue: value };
  }

  /**
   * Validate email
   */
  private validateEmail(value: any): {
    errors: string[];
    sanitizedValue: string;
  } {
    const errors: string[] = [];

    if (typeof value !== 'string') {
      errors.push('Email must be a string');
      return { errors, sanitizedValue: '' };
    }

    const sanitizedValue = validator.normalizeEmail(value) || '';

    if (!validator.isEmail(sanitizedValue)) {
      errors.push('Invalid email format');
    }

    return { errors, sanitizedValue };
  }

  /**
   * Validate URL
   */
  private validateUrl(value: any): {
    errors: string[];
    sanitizedValue: string;
  } {
    const errors: string[] = [];

    if (typeof value !== 'string') {
      errors.push('URL must be a string');
      return { errors, sanitizedValue: '' };
    }

    const sanitizedValue = value.trim();

    if (
      !validator.isURL(sanitizedValue, {
        protocols: ['http', 'https'],
        require_protocol: true,
        require_valid_protocol: true,
      })
    ) {
      errors.push('Invalid URL format');
    }

    return { errors, sanitizedValue };
  }

  /**
   * Validate file path
   */
  private validatePath(value: any): {
    errors: string[];
    warnings: string[];
    sanitizedValue: string;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof value !== 'string') {
      errors.push('Path must be a string');
      return { errors, warnings, sanitizedValue: '' };
    }

    // Normalize path
    let sanitizedValue = path.normalize(value).replace(/\\/g, '/');

    // Security checks for path traversal
    if (sanitizedValue.includes('..') || sanitizedValue.includes('~')) {
      errors.push('Path traversal detected');
    }

    // Check for absolute paths in user input
    if (path.isAbsolute(sanitizedValue)) {
      warnings.push('Absolute path provided - converted to relative');
      sanitizedValue = path.relative(process.cwd(), sanitizedValue);
    }

    // Check for dangerous directories
    const dangerousPaths = [
      '/etc',
      '/var',
      '/usr',
      '/bin',
      '/boot',
      '/dev',
      '/lib',
      '/proc',
      '/sys',
    ];
    if (
      dangerousPaths.some((dangPath) => sanitizedValue.startsWith(dangPath))
    ) {
      errors.push('Access to system directories not allowed');
    }

    return { errors, warnings, sanitizedValue };
  }

  /**
   * Validate filename
   */
  private validateFilename(value: any): {
    errors: string[];
    warnings: string[];
    sanitizedValue: string;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof value !== 'string') {
      errors.push('Filename must be a string');
      return { errors, warnings, sanitizedValue: '' };
    }

    // Sanitize filename
    let sanitizedValue = value.replace(/[<>:"/\\|?*\x00-\x1f]/g, '');

    // Check for reserved names (Windows)
    const reservedNames = [
      'CON',
      'PRN',
      'AUX',
      'NUL',
      'COM1',
      'COM2',
      'COM3',
      'COM4',
      'COM5',
      'COM6',
      'COM7',
      'COM8',
      'COM9',
      'LPT1',
      'LPT2',
      'LPT3',
      'LPT4',
      'LPT5',
      'LPT6',
      'LPT7',
      'LPT8',
      'LPT9',
    ];
    if (reservedNames.includes(sanitizedValue.toUpperCase())) {
      errors.push('Reserved filename not allowed');
    }

    // Check file extension
    const ext = path.extname(sanitizedValue).toLowerCase();
    if (ext && this.DANGEROUS_EXTENSIONS.includes(ext)) {
      errors.push('Dangerous file extension not allowed');
    }

    // Length check
    if (sanitizedValue.length > 255) {
      errors.push('Filename too long (max 255 characters)');
    }

    return { errors, warnings, sanitizedValue };
  }

  /**
   * Validate JSON
   */
  private validateJson(value: any): {
    errors: string[];
    sanitizedValue: any;
  } {
    const errors: string[] = [];

    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return { errors, sanitizedValue: parsed };
      } catch (error) {
        errors.push('Invalid JSON format');
        return { errors, sanitizedValue: null };
      }
    }

    // If it's already an object, just return it
    return { errors, sanitizedValue: value };
  }

  /**
   * Sanitize string content
   */
  private sanitizeString(value: string): string {
    // Remove null bytes
    value = value.replace(/\0/g, '');

    // Sanitize HTML
    value = sanitizeHtml(value, {
      allowedTags: [],
      allowedAttributes: {},
    });

    // Trim whitespace
    value = value.trim();

    return value;
  }

  /**
   * Check for security patterns
   */
  private checkSecurityPatterns(
    value: string,
    fieldName: string,
  ): {
    isSafe: boolean;
    threats: string[];
  } {
    const threats: string[] = [];

    for (const pattern of this.SECURITY_PATTERNS) {
      if (pattern.test(value)) {
        threats.push(`Suspicious pattern detected in ${fieldName}`);
        this.logger.warn(
          `🚨 Security pattern detected in ${fieldName}: ${pattern.source}`,
        );
      }
    }

    return {
      isSafe: threats.length === 0,
      threats,
    };
  }

  /**
   * Validate plugin name specifically
   */
  validatePluginName(name: string): ValidationResult {
    const rules: ValidationRule[] = [
      {
        field: 'name',
        type: 'string',
        required: true,
        minLength: 2,
        maxLength: 50,
        pattern: /^[a-zA-Z0-9_-]+$/,
        sanitizer: (value: string) => value.trim().toLowerCase(),
      },
    ];

    return this.validateData({ name }, rules);
  }

  /**
   * Validate plugin prompt
   */
  validatePluginPrompt(prompt: string): ValidationResult {
    const rules: ValidationRule[] = [
      {
        field: 'prompt',
        type: 'string',
        required: true,
        minLength: 10,
        maxLength: 10000,
        sanitizer: (value: string) => this.sanitizeString(value),
      },
    ];

    return this.validateData({ prompt }, rules);
  }

  /**
   * Validate chat message
   */
  validateChatMessage(message: string, pluginName?: string): ValidationResult {
    const data: any = { message };
    const rules: ValidationRule[] = [
      {
        field: 'message',
        type: 'string',
        required: true,
        minLength: 1,
        maxLength: 2000,
        sanitizer: (value: string) => this.sanitizeString(value),
      },
    ];

    if (pluginName) {
      data.pluginName = pluginName;
      rules.push({
        field: 'pluginName',
        type: 'string',
        required: true,
        pattern: /^[a-zA-Z0-9_-]+$/,
        sanitizer: (value: string) => value.trim().toLowerCase(),
      });
    }

    return this.validateData(data, rules);
  }

  /**
   * Validate file upload
   */
  async validateFileUpload(
    filePath: string,
    allowedExtensions?: string[],
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check file existence
      await fs.access(filePath);

      // Get file stats
      const stats = await fs.stat(filePath);

      // Check file size (max 10MB for now)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (stats.size > maxSize) {
        errors.push('File too large (max 10MB)');
      }

      // Check file extension
      const ext = path.extname(filePath).toLowerCase();
      const allowedExts = allowedExtensions || this.SAFE_PLUGIN_EXTENSIONS;

      if (ext && !allowedExts.includes(ext)) {
        errors.push(`File extension '${ext}' not allowed`);
      }

      // Check for dangerous extensions
      if (this.DANGEROUS_EXTENSIONS.includes(ext)) {
        errors.push('Dangerous file type detected');
      }

      // Validate filename
      const filename = path.basename(filePath);
      const filenameResult = this.validateFilename(filename);
      errors.push(...filenameResult.errors);
      warnings.push(...filenameResult.warnings);

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        sanitizedData: {
          filePath,
          filename: filenameResult.sanitizedValue,
          size: stats.size,
          extension: ext,
        },
      };
    } catch (error) {
      return {
        isValid: false,
        errors: ['File access failed'],
        warnings,
        sanitizedData: {},
      };
    }
  }

  /**
   * Validate security context
   */
  validateSecurityContext(context: SecurityContext): ValidationResult {
    const rules: ValidationRule[] = [
      {
        field: 'userAgent',
        type: 'string',
        required: false,
        maxLength: 500,
        sanitizer: (value: string) => this.sanitizeString(value),
      },
      {
        field: 'ip',
        type: 'custom',
        required: false,
        customValidator: (value: string) => validator.isIP(value),
      },
      {
        field: 'userId',
        type: 'string',
        required: false,
        pattern: /^[a-zA-Z0-9_-]+$/,
      },
      {
        field: 'sessionId',
        type: 'string',
        required: false,
        pattern: /^[a-zA-Z0-9_-]+$/,
      },
    ];

    return this.validateData(context, rules);
  }

  /**
   * Validate plugin creation request
   */
  async validatePluginCreation(data: {
    pluginName: string;
    prompt: string;
  }): Promise<ValidationResult> {
    const rules: ValidationRule[] = [
      {
        field: 'pluginName',
        type: 'string',
        required: true,
        minLength: 2,
        maxLength: 50,
        pattern: /^[a-zA-Z][a-zA-Z0-9_-]*$/,
        sanitizer: (value: string) => value.trim(),
      },
      {
        field: 'prompt',
        type: 'string',
        required: true,
        minLength: 10,
        maxLength: 10000,
        sanitizer: (value: string) => this.sanitizeString(value),
      },
    ];

    const result = this.validateData(data, rules);

    // Additional plugin-specific validation
    if (result.isValid && result.sanitizedData) {
      const { pluginName, prompt } = result.sanitizedData;

      // Check for reserved plugin names
      const reservedNames = [
        'plugin',
        'bukkit',
        'spigot',
        'minecraft',
        'craftbukkit',
        'server',
      ];
      if (reservedNames.includes(pluginName.toLowerCase())) {
        result.isValid = false;
        result.errors.push('Plugin name conflicts with reserved words');
      }

      // Check prompt for potentially dangerous content
      const securityCheck = this.checkSecurityPatterns(prompt, 'prompt');
      if (!securityCheck.isSafe) {
        result.warnings.push(...securityCheck.threats);
      }

      // Validate plugin name doesn't contain Java keywords
      const javaKeywords = [
        'class',
        'public',
        'private',
        'protected',
        'static',
        'final',
        'abstract',
        'interface',
        'extends',
        'implements',
      ];
      if (javaKeywords.includes(pluginName.toLowerCase())) {
        result.isValid = false;
        result.errors.push('Plugin name cannot be a Java keyword');
      }
    }

    return result;
  }

  /**
   * Create common validation rules
   */
  static createValidationRules(): {
    pluginName: ValidationRule[];
    pluginPrompt: ValidationRule[];
    chatMessage: ValidationRule[];
    filePath: ValidationRule[];
  } {
    return {
      pluginName: [
        {
          field: 'name',
          type: 'string',
          required: true,
          minLength: 2,
          maxLength: 50,
          pattern: /^[a-zA-Z0-9_-]+$/,
        },
      ],
      pluginPrompt: [
        {
          field: 'prompt',
          type: 'string',
          required: true,
          minLength: 10,
          maxLength: 10000,
        },
      ],
      chatMessage: [
        {
          field: 'message',
          type: 'string',
          required: true,
          minLength: 1,
          maxLength: 2000,
        },
      ],
      filePath: [
        {
          field: 'path',
          type: 'path',
          required: true,
        },
      ],
    };
  }
}
