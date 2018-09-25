# Azure SAS Url Service

A simple service for creating [Azure SAS
urls](https://docs.microsoft.com/en-us/azure/storage/common/storage-dotnet-shared-access-signature-part-1#what-is-a-shared-access-signature).

## Installing

- Install npm dependencies

  ```sh
    npm install
  ```

## Configuration

Following environment variables shall be present in order to connect to Azure storage service:

- `AZURE_STORAGE_ACCOUNT`
- `AZURE_STORAGE_ACCESS_KEY`

## Usage for client (end-user)

- For uploading a file
    - Client makes a request to a (web) micro-service requesting the number of SAS URLs it need.
    - This service creates UUID based names for the files, and give SAS URLs with write permission.
      This permission is granted for a limited period only.
    - Client shall store the UUID given, which will be needed for downloading the said file

- For downloading a file
    - The microservice is responsible to provide resolve-able URLs to read uploaded files for
      client. So, client shall simply use the URLs provided by microservice in its response for a
      document e.g `user.images` in case of a `User`

## Usage for server (microservice)

- `SasUrlCreator` class shall be instantiated per Azure Storage container.
```
const sasUrlService = new SasUrlCreator({
  container: 'leads-uploads',   // Name of the container. Must be already present on process.env.AZURE_STORAGE_ACCOUNT
  readTtl: '2d',                // Time after which read SAS URLs shall expire
  writeTtl: '15m',              // Time after which write SAS URLs shall expire
  expressRouterPath: '/static'  // [Optional] Path at which GET redirect express-router shall serve.
                                // This will redirect /static/:uuid to SAS URL it'll be accessible at.
                                // It can also be configured at the time when express-router is created
});
```

- **Before uploading an asset**, client will request the microservice to provide SAS URL to upload
  to, and the name (`UUID`) to be used in to-be-created document which need the uploaded asset

    - Microservice shall provide an endpoint for client to obtain `X` number of SAS URLs along with
      `UUID`s to be used. `sasUrlService.getWriteSasUrls(count: number)` shall be used for the
      response.

- **When creating a document** that has a field representing an uploaded asset, the client will provide
  `UUID` (can also be thought of as name) of the asset that has been successfully uploaded to Azure.

  > **QUESTION**: Do the microservice ensure on its end that the document has actually been uploaded?

    - The given `UUID`s shall be saved in database as-is, so as to allow us to change the storage of
      assets later.

- **When reading a document** from a microservice, client shall be given a local URL that allows
  reading the asset. To achieve this, following utilities provided by this utility shall be used:

    - **Express Router**: `sasUrlService.createExpressRouter(path): express.Router` shall be used.
      Note that a single instance of `SasUrlCreator` shall create a single such router
    - `sasUrlService.getLocalReadUrl(uuid)` shall be used to provide local URL to client for given
      `UUID`

### Run Tests

Execute

  ```sh
  AZURE_STORAGE_ACCOUNT=XXX AZURE_STORAGE_ACCESS_KEY=XXX npm run test
  ```

### Lint

Execute

  ```sh
  npm run lint
  ```
