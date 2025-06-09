/**
 * VS Code-like Agent Feedback Client
 * Real-time plugin creation monitoring system
 */

class AgentFeedbackClient {
  constructor() {
    this.socket = null;
    this.currentSessionId = null;
    this.isConnected = false;
    this.userId = null;

    // Initialize the application
    this.init();
  }

  /**
   * Initialize the application
   */
  init() {
    this.setupEventListeners();
    this.testBackendConnection();
    this.setupWebSocket();
    this.updateConnectionStatus('connecting');
  }

  /**
   * Test backend connection before setting up WebSocket
   */
  async testBackendConnection() {
    try {
      const backendUrl =
        window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';
      const response = await fetch(`${backendUrl}/health`, {
        method: 'GET',
        timeout: 5000,
      });

      if (response.ok) {
        this.addLogEntry('success', 'Backend server is reachable');
        console.log('✅ Backend health check passed');
      } else {
        throw new Error(`Backend returned ${response.status}`);
      }
    } catch (error) {
      this.addLogEntry(
        'warning',
        `Backend health check failed: ${error.message}`,
      );
      console.warn('⚠️ Backend health check failed:', error);
      this.showErrorToast('Backend server may not be running on port 3000');
    }
  }

  /**
   * Setup DOM event listeners
   */
  setupEventListeners() {
    // Plugin creation form
    const form = document.getElementById('plugin-form');
    form.addEventListener('submit', (e) => this.handlePluginCreation(e));

    // Generation mode change handler
    const generationModeSelect = document.getElementById('generation-mode');
    generationModeSelect.addEventListener('change', (e) =>
      this.handleGenerationModeChange(e),
    );

    // Example button
    const exampleBtn = document.getElementById('example-btn');
    exampleBtn.addEventListener('click', () => this.loadExamplePlugin());

    // Clear log button
    const clearLogBtn = document.getElementById('clear-log-btn');
    clearLogBtn.addEventListener('click', () => this.clearActivityLog());

    // Results panel buttons
    const downloadBtn = document.getElementById('download-btn');
    downloadBtn.addEventListener('click', () => this.downloadPlugin());

    const newPluginBtn = document.getElementById('new-plugin-btn');
    newPluginBtn.addEventListener('click', () => this.resetForNewPlugin());
  }

  /**
   * Handle generation mode change
   */
  handleGenerationModeChange(event) {
    const mode = event.target.value;
    const createBtn = document.getElementById('create-btn');
    const btnIcon = createBtn.querySelector('i');

    if (mode === 'multi-agent') {
      createBtn.innerHTML =
        '<i class="fas fa-robot"></i> Create Plugin with AI Agents';
      btnIcon.className = 'fas fa-robot';
    } else {
      createBtn.innerHTML =
        '<i class="fas fa-cog"></i> Create Plugin (Standard)';
      btnIcon.className = 'fas fa-cog';
    }
  }

  /**
   * Load example plugin data
   */
  loadExamplePlugin() {
    const examples = [
      {
        name: 'TeleportHome',
        prompt:
          'Create a teleportation plugin where players can set and teleport to home locations. Include commands like /sethome, /home, and /delhome. Add cooldowns and limit the number of homes per player.',
      },
      {
        name: 'CustomEnchants',
        prompt:
          'Build a custom enchantment plugin with fire damage enchantments that set enemies on fire when hit. Include enchantments like Flame Strike, Inferno Blade, and Phoenix Touch with different fire durations.',
      },
      {
        name: 'PlayerEconomy',
        prompt:
          'Create a player economy system with virtual currency, shops, and trading. Players should be able to earn money, buy/sell items, and create their own shops. Include admin commands for managing the economy.',
      },
      {
        name: 'ParkourChallenge',
        prompt:
          'Make a mini-game plugin with parkour challenges. Include timed races, checkpoints, leaderboards, and rewards for completing courses. Add commands to create and manage parkour courses.',
      },
    ];

    const randomExample = examples[Math.floor(Math.random() * examples.length)];

    document.getElementById('plugin-name').value = randomExample.name;
    document.getElementById('plugin-prompt').value = randomExample.prompt;

    this.showSuccessToast(`Loaded example: ${randomExample.name}`);
  }

  /**
   * Setup WebSocket connection to agent feedback system
   */
  setupWebSocket() {
    try {
      // Check if Socket.IO is available
      if (typeof io === 'undefined') {
        throw new Error(
          'Socket.IO library not loaded. Please check your internet connection.',
        );
      }

      // Connect to the agent feedback namespace
      // Always connect to localhost:3000 for development, or use environment-specific URL
      const backendUrl = 'http://localhost:3000';

      console.log(`🔌 Attempting to connect to: ${backendUrl}/agent-feedback`);
      console.log(`📍 Current window location: ${window.location.href}`);

      this.socket = io(`${backendUrl}/agent-feedback`, {
        transports: ['websocket', 'polling'], // Allow fallback to polling
        timeout: 10000,
        forceNew: true,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
      });

      // Connection events
      this.socket.on('connect', () => {
        this.isConnected = true;
        this.updateConnectionStatus('connected');
        this.addLogEntry('success', 'Connected to agent feedback system');
        console.log('🟢 WebSocket connected successfully');
      });

      this.socket.on('disconnect', (reason) => {
        this.isConnected = false;
        this.updateConnectionStatus('disconnected');
        this.addLogEntry(
          'warning',
          `Disconnected from agent feedback system: ${reason}`,
        );
        console.log('🔴 WebSocket disconnected:', reason);
      });

      this.socket.on('connect_error', (error) => {
        this.isConnected = false;
        this.updateConnectionStatus('disconnected');
        this.addLogEntry('error', `Connection failed: ${error.message}`);
        this.showErrorToast('Failed to connect to server');
        console.error('❌ WebSocket connection error:', error);
      });

      this.socket.on('reconnect', (attemptNumber) => {
        this.addLogEntry(
          'success',
          `Reconnected after ${attemptNumber} attempts`,
        );
        console.log(
          '🔄 WebSocket reconnected after',
          attemptNumber,
          'attempts',
        );
      });

      this.socket.on('reconnect_error', (error) => {
        this.addLogEntry('error', `Reconnection failed: ${error.message}`);
        console.error('🔄❌ WebSocket reconnection error:', error);
      });

      // Agent feedback events
      this.socket.on('agent-progress', (data) =>
        this.handleProgressUpdate(data),
      );
      this.socket.on('agent-task', (data) => this.handleTaskUpdate(data));
      this.socket.on('agent-error', (data) => this.handleAgentError(data));
      this.socket.on('agent-complete', (data) => this.handleCompletion(data));

      // Session events
      this.socket.on('session-initialized', (data) => {
        this.addLogEntry('info', `Session initialized: ${data.sessionId}`);
      });
    } catch (error) {
      this.updateConnectionStatus('disconnected');
      this.addLogEntry('error', `WebSocket setup failed: ${error.message}`);
      this.showErrorToast('Failed to initialize WebSocket connection');
      console.error('🚨 Critical WebSocket setup error:', error);

      // Additional debugging information
      console.log('🔍 Debug info:');
      console.log('- Socket.IO available:', typeof io !== 'undefined');
      console.log('- Current URL:', window.location.href);
      console.log(
        '- Backend URL attempt:',
        window.location.hostname === 'localhost' ? 'http://localhost:3000' : '',
      );
    }
  }

  /**
   * Handle plugin creation form submission
   */
  async handlePluginCreation(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const userId = formData.get('userId');
    const pluginName = formData.get('pluginName');
    const prompt = formData.get('prompt');
    const accuracyLevel = formData.get('accuracyLevel');
    const generationMode = formData.get('generationMode');

    // 🔍 DEBUG: Log form data extraction
    console.log('🔍 FRONTEND DEBUG - Form data extraction:');
    console.log('  - userId:', userId);
    console.log('  - pluginName:', pluginName);
    console.log('  - prompt:', prompt);
    console.log('  - accuracyLevel:', accuracyLevel);
    console.log('  - generationMode:', generationMode);
    console.log('  - formData entries:', [...formData.entries()]);

    if (!userId || !pluginName || !prompt) {
      this.showErrorToast('Please fill in all required fields');
      return;
    }

    if (!this.isConnected) {
      this.showErrorToast(
        'Not connected to server. Please wait for connection.',
      );
      return;
    }

    this.userId = userId;

    try {
      // Disable form
      this.setFormLoading(true);

      // Show progress panel
      this.showProgressPanel();

      // Clear previous logs
      this.clearActivityLog();

      const useMultiAgent = generationMode === 'multi-agent';

      this.addLogEntry('info', `Starting plugin creation: "${pluginName}"`);
      this.addLogEntry('info', `User: ${userId}, Accuracy: ${accuracyLevel}`);
      this.addLogEntry(
        'info',
        `Generation Mode: ${useMultiAgent ? '🤖 Multi-Agent System' : '⚡ Standard Creation'}`,
      );
      this.addLogEntry('info', `Description: ${prompt}`);

      // Make API call to create plugin
      const backendUrl = 'http://localhost:3000';

      const requestBody = {
        name: pluginName,
        prompt,
        userId,
        useAgents: useMultiAgent, // Use the selected generation mode
      };

      // 🔍 DEBUG: Log request body
      console.log(
        '🔍 FRONTEND DEBUG - Request body:',
        JSON.stringify(requestBody, null, 2),
      );

      const response = await fetch(`${backendUrl}/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        this.currentSessionId = result.sessionId || this.generateSessionId();

        // Subscribe to session updates
        this.subscribeToSession(this.currentSessionId);

        this.addLogEntry('success', 'Plugin creation initiated successfully');
        if (useMultiAgent) {
          this.addLogEntry(
            'info',
            '🤖 Multi-agent system activated with specialized AI agents',
          );
        }
        this.updateSessionInfo(this.currentSessionId, pluginName);
      } else {
        throw new Error(result.message || 'Plugin creation failed');
      }
    } catch (error) {
      this.addLogEntry('error', `Plugin creation failed: ${error.message}`);
      this.showErrorToast(`Failed to create plugin: ${error.message}`);
      this.setFormLoading(false);
      this.hideProgressPanel();
    }
  }

  /**
   * Subscribe to session updates via WebSocket
   */
  subscribeToSession(sessionId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('subscribe-session', {
        sessionId: sessionId,
        userId: this.userId,
      });
      this.addLogEntry('info', `Subscribed to session updates: ${sessionId}`);
    }
  }

  /**
   * Handle progress updates from agents
   */
  handleProgressUpdate(data) {
    const {
      sessionId,
      phase,
      step,
      progress,
      message,
      estimatedTimeRemaining,
    } = data;

    if (sessionId !== this.currentSessionId) return;

    // Update overall progress
    this.updateOverallProgress(progress, estimatedTimeRemaining);

    // Update phase progress
    this.updatePhaseProgress(phase, progress, 'active');

    // Update current activity
    this.updateCurrentActivity(message || step);

    // Add to log
    this.addLogEntry(
      'info',
      `[${phase.toUpperCase()}] ${message || step} (${progress}%)`,
    );
  }

  /**
   * Handle task updates from agents
   */
  handleTaskUpdate(data) {
    const {
      sessionId,
      taskId,
      type,
      action,
      status,
      agentId,
      message,
      result,
    } = data;

    if (sessionId !== this.currentSessionId) return;

    const phaseElement = document.querySelector(`[data-phase="${type}"]`);
    if (phaseElement) {
      const tasksContainer = phaseElement.querySelector('.phase-tasks');

      // Add or update task
      let taskElement = tasksContainer.querySelector(
        `[data-task-id="${taskId}"]`,
      );
      if (!taskElement) {
        taskElement = document.createElement('div');
        taskElement.className = 'task-item';
        taskElement.setAttribute('data-task-id', taskId);
        tasksContainer.appendChild(taskElement);
      }

      const statusIcon = this.getStatusIcon(status);
      const statusClass =
        status === 'completed'
          ? 'completed'
          : status === 'active'
            ? 'active'
            : '';

      taskElement.className = `task-item ${statusClass}`;
      taskElement.innerHTML = `
                <i class="${statusIcon}"></i>
                <span>${action}: ${message || 'Processing...'}</span>
            `;
    }

    // Add to log
    const logLevel =
      status === 'failed'
        ? 'error'
        : status === 'completed'
          ? 'success'
          : 'info';
    this.addLogEntry(logLevel, `[TASK] ${action} - ${status.toUpperCase()}`);
  }

  /**
   * Handle agent errors
   */
  handleAgentError(data) {
    const { sessionId, phase, error, details } = data;

    if (sessionId !== this.currentSessionId) return;

    this.addLogEntry('error', `[ERROR] ${phase}: ${error}`);
    if (details) {
      this.addLogEntry('error', `Details: ${JSON.stringify(details)}`);
    }

    this.showErrorToast(`Agent error in ${phase}: ${error}`);

    // Mark phase as error
    this.updatePhaseProgress(phase, 0, 'error');
  }

  /**
   * Handle completion
   */
  handleCompletion(data) {
    const { sessionId, result, metrics } = data;

    if (sessionId !== this.currentSessionId) return;

    this.addLogEntry('success', 'Plugin creation completed successfully!');

    // Update all phases to completed
    this.markAllPhasesCompleted();

    // Update overall progress to 100%
    this.updateOverallProgress(100, 0);

    // Show results
    this.showResults(result, metrics);

    // Enable form
    this.setFormLoading(false);

    this.showSuccessToast('Plugin created successfully!');
  }

  /**
   * Update connection status indicator
   */
  updateConnectionStatus(status) {
    const statusElement = document.getElementById('connection-status');
    const statusText = {
      connected: 'Connected',
      connecting: 'Connecting...',
      disconnected: 'Disconnected',
    };

    statusElement.textContent = statusText[status] || 'Unknown';
    statusElement.className = `status-${status}`;
  }

  /**
   * Update overall progress bar
   */
  updateOverallProgress(progress, estimatedTime) {
    const progressBar = document.getElementById('overall-progress');
    const progressText = document.getElementById('progress-percentage');
    const timeText = document.getElementById('estimated-time');

    progressBar.style.width = `${progress}%`;
    progressText.textContent = `${Math.round(progress)}%`;

    if (estimatedTime > 0) {
      const minutes = Math.ceil(estimatedTime / 60000);
      timeText.textContent = `Estimated: ${minutes}m`;
    }
  }

  /**
   * Update phase progress
   */
  updatePhaseProgress(phaseName, progress, status) {
    const phaseElement = document.querySelector(`[data-phase="${phaseName}"]`);
    if (!phaseElement) return;

    const progressBar = phaseElement.querySelector('.progress-fill');
    const statusElement = phaseElement.querySelector('.phase-status');

    if (progressBar) {
      progressBar.style.width = `${progress}%`;
    }

    if (statusElement) {
      statusElement.textContent = status;
      statusElement.className = `phase-status ${status}`;
    }

    // Update phase item class
    phaseElement.className = `phase-item ${status}`;
  }

  /**
   * Update current activity message
   */
  updateCurrentActivity(message) {
    const activityElement = document.getElementById('current-message');
    activityElement.textContent = message;
  }

  /**
   * Update session info display
   */
  updateSessionInfo(sessionId, pluginName) {
    document.getElementById('session-id').innerHTML =
      `Session: <code>${sessionId}</code>`;
    document.getElementById('plugin-name').innerHTML =
      `Plugin: <code>${pluginName}</code>`;
  }

  /**
   * Show/hide progress panel
   */
  showProgressPanel() {
    document.getElementById('progress-panel').style.display = 'block';
    document.getElementById('progress-panel').classList.add('fade-in');
  }

  hideProgressPanel() {
    document.getElementById('progress-panel').style.display = 'none';
  }

  /**
   * Show results panel
   */
  showResults(result, metrics) {
    const resultsPanel = document.getElementById('results-panel');
    const resultsContent = document.getElementById('results-content');

    let html = '<div class="result-metrics">';

    if (metrics) {
      Object.entries(metrics).forEach(([key, value]) => {
        const valueClass = this.getMetricClass(key, value);
        html += `
                    <div class="result-metric">
                        <span class="metric-label">${this.formatMetricLabel(key)}:</span>
                        <span class="metric-value ${valueClass}">${this.formatMetricValue(value)}</span>
                    </div>
                `;
      });
    }

    html += '</div>';

    if (result && result.files) {
      html += `
                <div class="result-files">
                    <h4>Generated Files:</h4>
                    <ul>
                        ${result.files.map((file) => `<li><code>${file}</code></li>`).join('')}
                    </ul>
                </div>
            `;
    }

    resultsContent.innerHTML = html;
    resultsPanel.style.display = 'block';
    resultsPanel.classList.add('fade-in');
  }

  /**
   * Add entry to activity log
   */
  addLogEntry(level, message) {
    const logContainer = document.getElementById('activity-log');
    const timestamp = new Date().toLocaleTimeString();

    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    logEntry.innerHTML = `
            <span class="log-timestamp">${timestamp}</span>
            <span class="log-level ${level}">${level}</span>
            <span class="log-message">${message}</span>
        `;

    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
  }

  /**
   * Clear activity log
   */
  clearActivityLog() {
    const logContainer = document.getElementById('activity-log');
    logContainer.innerHTML = '';
  }

  /**
   * Set form loading state
   */
  setFormLoading(isLoading) {
    const form = document.getElementById('plugin-form');
    const submitBtn = document.getElementById('create-btn');

    if (isLoading) {
      form.classList.add('loading');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="spinner"></i> Creating...';
    } else {
      form.classList.remove('loading');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-cog"></i> Create Plugin';
    }
  }

  /**
   * Mark all phases as completed
   */
  markAllPhasesCompleted() {
    const phases = [
      'analysis',
      'optimization',
      'generation',
      'quality',
      'compilation',
      'assessment',
    ];
    phases.forEach((phase) => {
      this.updatePhaseProgress(phase, 100, 'completed');
    });
  }

  /**
   * Download plugin (placeholder)
   */
  downloadPlugin() {
    if (!this.currentSessionId) {
      this.showErrorToast('No active session to download');
      return;
    }

    // This would trigger a download from the server
    this.addLogEntry('info', 'Initiating plugin download...');
    this.showSuccessToast('Download started!');
  }

  /**
   * Reset for new plugin creation
   */
  resetForNewPlugin() {
    // Reset state
    this.currentSessionId = null;

    // Hide panels
    this.hideProgressPanel();
    document.getElementById('results-panel').style.display = 'none';

    // Reset form
    document.getElementById('plugin-form').reset();
    this.setFormLoading(false);

    // Reset progress
    this.updateOverallProgress(0, 0);

    // Reset phases
    const phases = [
      'analysis',
      'optimization',
      'generation',
      'quality',
      'compilation',
      'assessment',
    ];
    phases.forEach((phase) => {
      this.updatePhaseProgress(phase, 0, 'pending');
      const phaseElement = document.querySelector(`[data-phase="${phase}"]`);
      if (phaseElement) {
        phaseElement.querySelector('.phase-tasks').innerHTML = '';
      }
    });

    // Clear activity
    this.updateCurrentActivity('Waiting for activity...');
    this.clearActivityLog();

    this.addLogEntry('info', 'Ready for new plugin creation');
  }

  /**
   * Show error toast
   */
  showErrorToast(message) {
    const toast = document.getElementById('error-toast');
    const messageElement = document.getElementById('error-message');

    messageElement.textContent = message;
    toast.style.display = 'flex';

    // Auto-hide after 5 seconds
    setTimeout(() => {
      this.hideErrorToast();
    }, 5000);
  }

  /**
   * Hide error toast
   */
  hideErrorToast() {
    document.getElementById('error-toast').style.display = 'none';
  }

  /**
   * Show success toast
   */
  showSuccessToast(message) {
    const toast = document.getElementById('success-toast');
    const messageElement = document.getElementById('success-message');

    messageElement.textContent = message;
    toast.style.display = 'flex';

    // Auto-hide after 3 seconds
    setTimeout(() => {
      this.hideSuccessToast();
    }, 3000);
  }

  /**
   * Hide success toast
   */
  hideSuccessToast() {
    document.getElementById('success-toast').style.display = 'none';
  }

  /**
   * Get status icon for task states
   */
  getStatusIcon(status) {
    const icons = {
      pending: 'fas fa-clock',
      active: 'fas fa-spinner',
      completed: 'fas fa-check',
      failed: 'fas fa-times',
    };
    return icons[status] || 'fas fa-circle';
  }

  /**
   * Get CSS class for metric values
   */
  getMetricClass(key, value) {
    if (key.includes('error') && value > 0) return 'error';
    if (key.includes('success') || key.includes('quality')) {
      if (typeof value === 'number' && value >= 80) return 'success';
      if (typeof value === 'number' && value >= 60) return 'warning';
    }
    return '';
  }

  /**
   * Format metric labels for display
   */
  formatMetricLabel(key) {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .replace(/_/g, ' ');
  }

  /**
   * Format metric values for display
   */
  formatMetricValue(value) {
    if (typeof value === 'number') {
      if (value < 1) return `${(value * 100).toFixed(1)}%`;
      return value.toFixed(2);
    }
    return String(value);
  }

  /**
   * Generate a session ID if not provided by server
   */
  generateSessionId() {
    return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}

// Global functions for toast management
window.hideErrorToast = function () {
  document.getElementById('error-toast').style.display = 'none';
};

window.hideSuccessToast = function () {
  document.getElementById('success-toast').style.display = 'none';
};

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.agentClient = new AgentFeedbackClient();
});

// Export for module systems (if needed)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AgentFeedbackClient;
}
