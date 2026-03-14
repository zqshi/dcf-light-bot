const fs = require('fs');

class FileStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.inFlight = Promise.resolve();
  }

  async init() {
    if (!fs.existsSync(this.filePath)) {
      const initial = {
        instances: [],
        provisioningJobs: [],
        identityMappings: [],
        skillReports: [],
        skills: [],
        skillBindings: [],
        audits: []
      };
      fs.writeFileSync(this.filePath, JSON.stringify(initial, null, 2), 'utf8');
    }
  }

  async read() {
    await this.init();
    const raw = fs.readFileSync(this.filePath, 'utf8');
    return JSON.parse(raw || '{}');
  }

  async update(mutator) {
    this.inFlight = this.inFlight.then(async () => {
      const doc = await this.read();
      const next = await mutator(doc);
      fs.writeFileSync(this.filePath, JSON.stringify(next, null, 2), 'utf8');
      return next;
    });
    return this.inFlight;
  }
}

module.exports = { FileStore };
