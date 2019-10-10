const azure = require('azure-storage');
const { Router } = require('express');
const uuid = require('uuid/v4');
const ms = require('ms');

class SasUrlService {
  constructor({
    container,
    readTtl,
    writeTtl,
    expressRouterPath = '/static',
    credentials,
    cdnEndpointName,
    expressRouter = {
      path: expressRouterPath,
      cacheControlHeader: `max-age=${ms(readTtl) / 1000}`
    }
  }) {
    if (!credentials) {
      throw new Error('Azure Storage credentials must be provided');
    }

    if (!credentials.accountName || !credentials.accountKey) {
      throw new Error('InvalidArgument: credentials must have `accountName` and `accountKey` attributes');
    }

    this.cdnEndpointName = cdnEndpointName;
    this.blobService = azure.createBlobService(credentials.accountName, credentials.accountKey);
    this.config = {};
    this.expressRouter = expressRouter;

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
    let urlStr = name
      ? this.getSasUrlForBlob({
        permission: 'read',
        name
      })
      : null;

    if (this.cdnEndpointName && urlStr) {
      const url = new URL(urlStr);
      url.hostname = `${this.cdnEndpointName}.azureedge.net`;

      urlStr = url.href;
    }

    return urlStr;
  }

  getWriteSasUrls(count, ext) {
    return Array.from({
      length: count
    }).map(() => {
      const name = ext ? `${uuid()}.${ext}` : uuid();

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
    return name ? `${this.expressRouterPath}/${encodeURIComponent(name)}` : null;
  }

  // TODO: A better name. Perhaps createLocalRedirectRouter or createLocalReadRouter ?
  createExpressRouter(path = this.expressRouter.path) {
    this.expressRouter.path = path;
    const routePath = `${this.expressRouter.path}/:uuid`;

    const router = new Router();

    router.use((req, res, next) => {
      if (
        req.originalUrl.indexOf(this.expressRouter.path) >= 0
        && this.expressRouter.cacheControlHeader
      ) {
        res.setHeader('Cache-Control', this.expressRouter.cacheControlHeader);
      }

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
