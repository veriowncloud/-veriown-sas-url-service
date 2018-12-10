const azure = require('azure-storage');
const { Router } = require('express');
const uuid = require('uuid/v4');
const ms = require('ms');

class SasUrlService {
  constructor({
    container, readTtl, writeTtl, expressRouterPath
  }) {
    this.blobService = azure.createBlobService();
    this.config = {};
    this.expressRouterPath = expressRouterPath || '/static'; // eslint-disable-line no-underscore-dangle

    this.config = {
      container,
      read: {
        ttl: readTtl
      },
      write: {
        ttl: writeTtl
      }
    };
  }

  get expressRouterPath() {
    return this._expressRouterPath; // eslint-disable-line no-underscore-dangle
  }

  set expressRouterPath(val) {
    // remove trailing / if it's present
    this._expressRouterPath = val.replace(/\/$/, ''); // eslint-disable-line no-underscore-dangle
  }

  getSasUrlForBlob({ permission, name }) {
    if (!(permission === 'read' || permission === 'write')) {
      throw new Error('Invalid permission');
    }

    if (!name) {
      throw new Error('Name must be provided');
    }

    const containerName = this.config.container;
    const blobName = name;
    const expiryDate = new Date(new Date().getTime() + ms(this.config[permission].ttl));

    const sharedAccessPolicy = {
      AccessPolicy: {
        Permissions: azure.BlobUtilities.SharedAccessPermissions[permission.toUpperCase()],
        Expiry: expiryDate
      }
    };

    const token = this.blobService.generateSharedAccessSignature(
      containerName,
      blobName,
      sharedAccessPolicy
    );

    return this.blobService.getUrl(containerName, blobName, token);
  }

  getReadSasUrl(name) {
    return this.getSasUrlForBlob({
      permission: 'read',
      name
    });
  }

  getWriteSasUrls(count) {
    return Array.from({
      length: count
    }).map(() => {
      const name = uuid();

      return {
        name,
        url: this.getSasUrlForBlob({
          permission: 'write',
          name
        })
      };
    });
  }

  getLocalReadUrl(name) {
    return name ? `${this.expressRouterPath}/${name}` : null;
  }

  // TODO: A better name. Perhaps createLocalRedirectRouter or createLocalReadRouter ?
  createExpressRouter(path = this.expressRouterPath) {
    this.expressRouterPath = path;
    const routePath = `${this.expressRouterPath}/:uuid`;

    const router = new Router();

    router.use((req, res, next) => {
      const readTtlSeconds = ms(this.config.read.ttl) / 1000;
      res.setHeader('Cache-Control', `public, max-age=${readTtlSeconds}`);

      return next();
    });

    router.get(routePath, (req, res) => {
      const name = req.params.uuid;
      const sasUrl = this.getReadSasUrl(name);

      res.redirect(sasUrl);
    });

    return router;
  }
}

module.exports = SasUrlService;
