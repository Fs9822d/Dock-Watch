import http from 'node:http';

/**
 * Native Docker Engine HTTP Client communicating over a UNIX domain socket.
 * Zero external dependencies.
 */
export class DockerClient {
  /**
   * @param {string} socketPath Absolute path to the UNIX domain socket
   * @param {object} [options]
   * @param {number} [options.timeout=5000] Request timeout in milliseconds
   */
  constructor(socketPath, options = {}) {
    if (!socketPath) {
      throw new Error('DockerClient requires a valid socketPath');
    }
    this.socketPath = socketPath;
    this.timeout = options.timeout ?? 5000;
  }

  /**
   * Perform an HTTP request over the Docker UNIX socket.
   *
   * @param {string} endpoint e.g. '/containers/json'
   * @param {object} [reqOptions={}]
   * @param {string} [reqOptions.method='GET']
   * @param {object} [reqOptions.headers]
   * @param {any} [reqOptions.body]
   * @returns {Promise<any>} Parsed JSON or raw string if not JSON
   */
  request(endpoint, reqOptions = {}) {
    return new Promise((resolve, reject) => {
      const { method = 'GET', headers = {}, body = null } = reqOptions;

      const options = {
        socketPath: this.socketPath,
        path: endpoint,
        method,
        headers: {
          Host: 'localhost',
          Accept: 'application/json',
          ...headers,
        },
        timeout: this.timeout,
      };

      const req = http.request(options, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          const statusCode = res.statusCode ?? 500;

          if (statusCode >= 400) {
            let errorMsg = `HTTP ${statusCode}`;
            try {
              const parsed = JSON.parse(raw);
              if (parsed.message) errorMsg += `: ${parsed.message}`;
            } catch {
              if (raw.trim()) errorMsg += `: ${raw.trim()}`;
            }
            const err = new Error(errorMsg);
            err.statusCode = statusCode;
            return reject(err);
          }

          if (res.headers['content-type']?.includes('application/json')) {
            try {
              return resolve(JSON.parse(raw));
            } catch (jsonErr) {
              return reject(new Error(`Failed to parse Docker response JSON: ${jsonErr.message}`));
            }
          }

          // Fallback if not marked application/json (e.g. /_ping returns text/plain "OK")
          try {
            return resolve(JSON.parse(raw));
          } catch {
            return resolve(raw.trim());
          }
        });
      });

      req.on('timeout', () => {
        req.destroy(new Error(`Docker socket request timed out after ${this.timeout}ms`));
      });

      req.on('error', (err) => {
        reject(err);
      });

      if (body) {
        if (typeof body === 'string' || Buffer.isBuffer(body)) {
          req.write(body);
        } else {
          req.setHeader('Content-Type', 'application/json');
          req.write(JSON.stringify(body));
        }
      }

      req.end();
    });
  }

  /**
   * Ping daemon to test connectivity.
   * @returns {Promise<boolean>}
   */
  async ping() {
    try {
      const res = await this.request('/_ping');
      return res === 'OK' || res === true || typeof res === 'object';
    } catch {
      return false;
    }
  }

  /**
   * List containers.
   * @param {object} [options]
   * @param {boolean} [options.all=false]
   * @param {boolean} [options.size=false]
   * @returns {Promise<Array<object>>}
   */
  async listContainers({ all = false, size = false } = {}) {
    const query = new URLSearchParams();
    if (all) query.set('all', '1');
    if (size) query.set('size', '1');

    const qs = query.toString();
    const endpoint = `/containers/json${qs ? `?${qs}` : ''}`;
    return await this.request(endpoint);
  }

  /**
   * Inspect a container.
   * @param {string} id Container ID or name
   * @param {boolean} [size=false] Compute container disk size (SizeRw, SizeRootFs)
   * @returns {Promise<object>}
   */
  async getContainerDetails(id, size = false) {
    const endpoint = `/containers/${encodeURIComponent(id)}/json${size ? '?size=true' : ''}`;
    return await this.request(endpoint);
  }

  /**
   * Fetch single-shot telemetry stats for a container.
   * @param {string} id Container ID or name
   * @returns {Promise<object>}
   */
  async getContainerStats(id) {
    const endpoint = `/containers/${encodeURIComponent(id)}/stats?stream=0`;
    return await this.request(endpoint);
  }
}
