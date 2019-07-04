const { describe, it, beforeEach } = require('mocha');
const express = require('express');
const chance = require('chance').Chance();
const chai = require('chai');
const { isURL } = require('validator');
const chaiHttp = require('chai-http');
const SasUrlService = require('./index');

const { expect } = chai;

chai.use(chaiHttp);

describe('SasUrlService', () => {
  let service;

  beforeEach(() => {
    service = new SasUrlService({
      container: 'sas-url-service-test',
      readTtl: '1m',
      writeTtl: '1m',
      credentials: {
        accountName: 'accountName',
        accountKey: 'a2V5Cg=='
      }
    });
  });

  it('should throw error if azure credentials are not provided', async () => {
    expect(() => new SasUrlService({
      container: 'sas-url-service-test',
      readTtl: '1m',
      writeTtl: '1m'
    })).to.throw('Azure Storage credentials must be provided');

    expect(() => new SasUrlService({
      container: 'sas-url-service-test',
      readTtl: '1m',
      writeTtl: '1m',
      credentials: {
        accountName: chance.string(),
        accountKey: Buffer.from(chance.string()).toString('base64')
      }
    })).to.not.throw('Azure Storage credentials must be provided');
  });

  it('should throw error if incomplete azure credentials are provided', async () => {
    expect(() => new SasUrlService({
      container: 'sas-url-service-test',
      readTtl: '1m',
      writeTtl: '1m',
      credentials: {
        accountName: chance.string()
      }
    })).to.throw('InvalidArgument: credentials must have `accountName` and `accountKey` attributes');

    expect(() => new SasUrlService({
      container: 'sas-url-service-test',
      readTtl: '1m',
      writeTtl: '1m',
      credentials: {
        accountKey: Buffer.from(chance.string()).toString('base64')
      }
    })).to.throw('InvalidArgument: credentials must have `accountName` and `accountKey` attributes');
  });

  describe('.getSasUrlForBlob', () => {
    it('should throw for invalid permission', () => {
      expect(() => service.getSasUrlForBlob({ permission: 'delete', name: 'name' })).to.throw('Invalid permission');
    });

    it('should throw if blob name is not given', () => {
      expect(() => service.getSasUrlForBlob({ permission: 'read' })).to.throw('Name must be provided');
    });

    it('should return SAS url given correct input', () => {
      expect(service.getSasUrlForBlob({ permission: 'read', name: 'name' })).to.have.string('sas-url-service-test/name');
    });
  });

  describe('.getReadSasUrl', () => {
    it('should return valid URL for provided UUID', async () => {
      const result = service.getReadSasUrl('hello-world');

      expect(result).to.have.string('hello-world');
    });
  });

  describe('.getWriteSasUrls', () => {
    it('should return `n` SAS urls given `n` as count argument', async () => {
      const result = service.getWriteSasUrls(4);

      expect(result.length).to.be.equal(4);
    });
  });

  describe('.getLocalReadUrl', () => {
    it('should give absolute URL corresponding to configured route to access asset with given UUID', () => {
      service.createExpressRouter('/uploads');
      expect(isURL(service.getLocalReadUrl('hello-world'), { require_host: false })).to.be.equal(true);
    });
  });

  describe('.createExpressRouter', () => {
    let app;
    beforeEach(() => {
      app = express();
      const router = service.createExpressRouter('/uploads');
      app.use(router);
    });

    it('should set cache-control header', async () => {
      const res = await chai
        .request(app)
        .get('/uploads/name-of-a-blob')
        .redirects(0);

      return expect(res).to.have.header('Cache-Control', 'public, max-age=60');
    });

    it('should redirect to SAS url with appropriate blob path set', async () => {
      const res = await chai.request(app).get('/uploads/name-of-a-blob');
      const redirectUrl = service.getReadSasUrl('name-of-a-blob').split('?')[0];

      await expect(res.redirects[0].split('?')[0]).to.be.equal(redirectUrl);
    });
  });
});
