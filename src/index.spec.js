const { describe, it, beforeEach } = require('mocha');
const express = require('express');
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
      writeTtl: '1m'
    });
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

    it('should return null if given uuid is null', () => {
      service.createExpressRouter('/uploads');
      expect(service.getLocalReadUrl(null)).to.be.equal(null);
      expect(service.getLocalReadUrl()).to.be.equal(null);
      expect(service.getLocalReadUrl('')).to.be.equal(null);
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

      return expect(res.redirects[0].split('?')[0]).to.be.equal(redirectUrl);
    });
  });
});
