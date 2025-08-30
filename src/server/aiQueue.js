const { spawn } = require('child_process');
const path = require('path');
const EventEmitter = require('events');

class LiteLLMBridge extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.activeRequests = 0;
    this.requestQueue = [];
    this.maxConcurrent = config.server?.aiRequestQueue?.maxConcurrent || 10;
    this.timeout = config.server?.aiRequestQueue?.timeout || 30000;
  }

  async executeTemplate(templateName, variables) {
    return new Promise((resolve, reject) => {
      // Add to queue if at max capacity
      if (this.activeRequests >= this.maxConcurrent) {
        this.requestQueue.push(() => this._executeNow(templateName, variables, resolve, reject));
        return;
      }

      this._executeNow(templateName, variables, resolve, reject);
    });
  }

  _executeNow(templateName, variables, resolve, reject) {
    this.activeRequests++;
    this.emit('request_started', { templateName, activeRequests: this.activeRequests });

    const pythonPath = process.env.PYTHON_PATH || 'python3.11';
    const bridgeScript = path.join(__dirname, 'litellm_bridge.py');
    
    const python = spawn(pythonPath, [bridgeScript], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const inputData = {
      pdl_file: this.config.prompts.configFile,
      template: templateName,
      variables: variables
    };

    let output = '';
    let errorOutput = '';

    // Set timeout for the request
    const timeoutId = setTimeout(() => {
      python.kill('SIGTERM');
      this._handleRequestComplete();
      reject(new Error(`AI request timeout after ${this.timeout}ms`));
    }, this.timeout);

    python.stdout.on('data', (data) => {
      output += data.toString();
    });

    python.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    python.on('close', (code) => {
      clearTimeout(timeoutId);
      this._handleRequestComplete();

      if (code === 0) {
        try {
          const result = JSON.parse(output);
          if (result.success) {
            this.emit('request_completed', { 
              templateName, 
              success: true, 
              activeRequests: this.activeRequests 
            });
            resolve(result);
          } else {
            this.emit('request_failed', { 
              templateName, 
              error: result.error, 
              activeRequests: this.activeRequests 
            });
            reject(new Error(`AI Error: ${result.error}`));
          }
        } catch (parseError) {
          this.emit('request_failed', { 
            templateName, 
            error: 'Invalid JSON response', 
            activeRequests: this.activeRequests 
          });
          reject(new Error(`Failed to parse AI response: ${parseError.message}`));
        }
      } else {
        this.emit('request_failed', { 
          templateName, 
          error: `Process exited with code ${code}`, 
          activeRequests: this.activeRequests 
        });
        reject(new Error(`Python process exited with code ${code}. Error: ${errorOutput}`));
      }
    });

    python.on('error', (error) => {
      clearTimeout(timeoutId);
      this._handleRequestComplete();
      this.emit('request_failed', { 
        templateName, 
        error: error.message, 
        activeRequests: this.activeRequests 
      });
      reject(new Error(`Failed to start Python process: ${error.message}`));
    });

    // Send input data to Python script
    try {
      python.stdin.write(JSON.stringify(inputData));
      python.stdin.end();
    } catch (writeError) {
      clearTimeout(timeoutId);
      this._handleRequestComplete();
      reject(new Error(`Failed to write to Python process: ${writeError.message}`));
    }
  }

  _handleRequestComplete() {
    this.activeRequests--;
    
    // Process next request in queue if available
    if (this.requestQueue.length > 0 && this.activeRequests < this.maxConcurrent) {
      const nextRequest = this.requestQueue.shift();
      nextRequest();
    }
  }

  getStats() {
    return {
      activeRequests: this.activeRequests,
      queuedRequests: this.requestQueue.length,
      maxConcurrent: this.maxConcurrent
    };
  }

  // Test the bridge connection
  async testConnection() {
    try {
      const testVariables = {
        model_provider: this.config.aiModel.provider,
        model_name: this.config.aiModel.model,
        temperature: 0.1,
        max_tokens: 50,
        story_context: "This is a test story context.",
        player_influences: "Test influence."
      };

      const result = await this.executeTemplate('story_segment_generation', testVariables);
      return { success: true, message: 'LiteLLM bridge connection successful' };
    } catch (error) {
      return { success: false, message: `LiteLLM bridge test failed: ${error.message}` };
    }
  }
}

module.exports = LiteLLMBridge;