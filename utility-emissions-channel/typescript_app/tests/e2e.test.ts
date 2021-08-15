'use-strict';

import chai, { assert } from 'chai';
import chaiHTTP from 'chai-http';
import { randomBytes } from 'crypto';
import { PluginKeychainVault } from '@hyperledger/cactus-plugin-keychain-vault';
import {
  FabricContractInvocationType,
  FabricSigningCredential,
  PluginLedgerConnectorFabric,
} from '@hyperledger/cactus-plugin-ledger-connector-fabric';
import { readUtilityEmissionChaincodeCfg } from '../src/config/ledger-config';
import { PluginRegistry } from '@hyperledger/cactus-core';
import { createHash } from 'crypto';
import { join } from 'path';
chai.use(chaiHTTP);

const testVaultEndpoint = 'http://localhost:8200';
const testVaultToken = 'tokenId';

const keychainId = 'test-key-chain-id';
const testUtilityId = 'USA_EIA_252522444142552441242521';

const v1Base = `http://localhost:9000/api/v1/utilityemissionchannel`;
const v2Base = `http://localhost:9000/api/v2/utilityemissionchannel`;
const apiEndpoint: { [key: string]: string } = {
  registerAdmin: '/registerEnroll/admin',
  enrollUser: '/registerEnroll/user',
  recordEmissions: '/emissionscontract/recordEmissions',
  getEmissionsData: '/emissionscontract/getEmissionsData/',
  recordAuditedEmissionToken: '/emissionscontract/recordAuditedEmissionsToken',
  newRequestId: '/requestmanager/request/newId',
  recordAuditedEmissionsTokenV2: '/requestmanager/recordAuditedEmissionsToken',
  requestProcessingState: '/requestmanager/request/state/',
  getRequest: '/requestmanager/request/',
};

describe('E2E', () => {
  // random userId
  let testUserId: string;
  let vault: PluginKeychainVault;
  let registry: PluginRegistry;
  // keep this random
  let mockPartyId: string;
  before(async () => {
    testUserId = randomBytes(10).toString('hex');
    mockPartyId = randomBytes(10).toString('hex');
    // remove admin and user's certs from vault
    vault = new PluginKeychainVault({
      endpoint: testVaultEndpoint,
      apiVersion: 'v1',
      token: testVaultToken,
      keychainId: keychainId,
      kvSecretsMountPath: 'secret/data/',
      instanceId: 'anything',
    });
    await vault.delete('auditor1_admin');
    // insert UtilityLookupItem ,
    // query lookitem and thru date
    // add emissions factor with year - 1
    registry = new PluginRegistry({ plugins: [vault] });
  });

  it('registerAdmin should pass', (done) => {
    chai
      .request(v1Base)
      .post(apiEndpoint['registerAdmin'])
      .set('content-type', 'application/x-www-form-urlencoded')
      .send({ orgName: 'auditor1' })
      .end(async (error, response) => {
        assert.isNull(error);
        assert.equal(response.status, 201);
        assert.equal(response.body.orgName, 'auditor1');
        assert.equal(response.body.msp, 'auditor1');
        assert.equal(response.body.caName, 'auditor1.carbonAccounting.com');
        await insertMockData(registry);

        done();
      });
  });

  it('registerAdmin should fail::cert already exists', (done) => {
    chai
      .request(v1Base)
      .post(apiEndpoint['registerAdmin'])
      .set('content-type', 'application/x-www-form-urlencoded')
      .send({ orgName: 'auditor1' })
      .end((error, response) => {
        try {
          assert.isNull(error, null);
          assert.equal(response.status, 409);
          assert.equal(
            response.body.msg,
            'admin of organizations auditor1 is already enrolled',
          );
          done();
        } catch (error) {
          done(error);
        }
      });
  });

  it('enrollUser should pass', (done) => {
    chai
      .request(v1Base)
      .post(apiEndpoint['enrollUser'])
      .set('content-type', 'application/x-www-form-urlencoded')
      .send({
        userId: testUserId,
        orgName: 'auditor1',
        affiliation: 'auditor1.department1',
      })
      .end(async (error, response) => {
        try {
          assert.isNull(error);
          assert.equal(response.status, 201);
          // check if test user's certs exists in vault or not
          const cert = await vault.has(`auditor1_${testUserId}`);
          assert.isObject(cert);
          done();
        } catch (error) {
          done(error);
        }
      });
  });
  it('enrollUser should fail::already registered', (done) => {
    chai
      .request(v1Base)
      .post(apiEndpoint['enrollUser'])
      .set('content-type', 'application/x-www-form-urlencoded')
      .send({
        userId: testUserId,
        orgName: 'auditor1',
        affiliation: 'auditor1.department1',
      })
      .end(async (error, response) => {
        try {
          assert.isNull(error);
          assert.equal(response.status, 409);
          // check if test user's certs exists in vault or not
          assert.equal(
            response.body.msg,
            `${testUserId} of organizations auditor1 is already enrolled`,
          );
          done();
        } catch (error) {
          done(error);
        }
      });
  });

  let emissionsId: string;
  it('record emissions should pass', (done) => {
    chai
      .request(v1Base)
      .post(apiEndpoint['recordEmissions'])
      .set('content-type', 'application/x-www-form-urlencoded')
      .send({
        userId: testUserId,
        orgName: 'auditor1',
        utilityId: testUtilityId,
        partyId: mockPartyId,
        fromDate: '2020-05-07T10:10:09Z',
        thruDate: '2021-05-07T10:10:09Z',
        energyUseAmount: 100,
        energyUseUom: 'kWh',
      })
      .end((error, response) => {
        try {
          assert.isNull(error);
          //   console.log(response.body);
          assert.equal(response.status, 201);
          emissionsId = response.body.uuid;
          done();
        } catch (error) {
          done(error);
        }
      });
  });

  it('getEmissions should pass', (done) => {
    chai
      .request(v1Base)
      .get(
        apiEndpoint['getEmissionsData'] +
          `${testUserId}/auditor1/${emissionsId}`,
      )
      .set('content-type', 'application/x-www-form-urlencoded')
      .end((err, response) => {
        try {
          assert.equal(response.body.uuid, emissionsId);
          assert.equal(response.body.utilityId, testUtilityId);
          assert.equal(response.body.utilityId, testUtilityId);
          assert.equal(
            response.body.partyId,
            createHash('sha256').update(mockPartyId).digest().toString('hex'),
          );
          assert.equal(response.body.fromDate, '2020-05-07T10:10:09Z');
          assert.equal(response.body.thruDate, '2021-05-07T10:10:09Z');
          assert.equal(
            response.body.factorSource,
            'eGrid 2019 NERC_REGION MRO',
          );
          done();
        } catch (error) {
          done(err);
        }
      });
  });

  it('record audited emissions token should pass', (done) => {
    chai
      .request(v1Base)
      .post(apiEndpoint['recordAuditedEmissionToken'])
      .set('content-type', 'application/x-www-form-urlencoded')
      .send({
        userId: testUserId,
        orgName: 'auditor1',
        partyId: mockPartyId,
        addressToIssue: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
        emissionsRecordsToAudit: emissionsId,
      })
      .end((err, response) => {
        try {
          assert.isNull(err);
          assert.equal(response.status, 201);
          // TODO check if token is created : before starting the test
          // store tokenId in a variable
          // after execution tokenId should be incremented by one
          done();
        } catch (error) {
          done(error);
        }
      });
  });
  var requestId: string;
  it('get new requestId should pass', (done) => {
    chai
      .request(v2Base)
      .get(apiEndpoint['newRequestId'])
      .set('content-type', 'application/x-www-form-urlencoded')
      .end(async (error, response) => {
        try {
          assert.isNull(error);
          assert.equal(response.status, 200);
          // check if test user's certs exists in vault or not
          // assert.(response.body.requestId, '1');
          assert.isString(response.body.requestId);
          requestId = response.body.requestId;
          done();
        } catch (error) {
          done(error);
        }
      });
  });
  it('record emissions should pass for v2', (done) => {
    chai
      .request(v1Base)
      .post(apiEndpoint['recordEmissions'])
      .set('content-type', 'application/x-www-form-urlencoded')
      .send({
        userId: testUserId,
        orgName: 'auditor1',
        utilityId: testUtilityId,
        partyId: mockPartyId + 'v2',
        fromDate: '2020-05-07T10:10:09Z',
        thruDate: '2021-05-07T10:10:09Z',
        energyUseAmount: 100,
        energyUseUom: 'kWh',
      })
      .end((error, response) => {
        try {
          assert.isNull(error);
          assert.equal(response.status, 201);
          //   console.log(response.body);
          emissionsId = response.body.uuid;
          done();
        } catch (error) {
          done(error);
        }
      });
  });
  it('record audited emissions V2 token should pass', (done) => {
    chai
      .request(v2Base)
      .post(apiEndpoint['recordAuditedEmissionsTokenV2'])
      .set('content-type', 'application/x-www-form-urlencoded')
      .send({
        userId: testUserId,
        orgName: 'auditor1',
        partyId: mockPartyId,
        addressToIssue: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
        emissionsRecordsToAudit: emissionsId,
        requestId: requestId,
      })
      .end((err, response) => {
        try {
          assert.isNull(err);
          assert.equal(response.status, 200);
          // poll for checking state of request
          done();
        } catch (error) {
          done(error);
        }
      });
  });

  it('request processing state should be ACTIVE', (done) => {
    chai
      .request(v2Base)
      .get(apiEndpoint['requestProcessingState'] + requestId)
      .set('content-type', 'application/x-www-form-urlencoded')
      .end(async (error, response) => {
        try {
          assert.isNull(error);
          assert.equal(response.status, 200);
          assert.equal(response.body.state, 'ACTIVE');
          done();
        } catch (error) {
          done(error);
        }
      });
  });
  it('state of request should be PROCESSING => FINISHED', async () => {
    const timeout = 10000; // 10 second
    const pollingTime = 1000; // 1 seconds
    const endAt = new Date().getTime() + timeout;
    let success: boolean = false;
    // let trie = 0;
    do {
      // trie++;
      // console.log(`trie == ${trie}`);
      const response = await chai
        .request(v2Base)
        .get(apiEndpoint['getRequest'] + testUserId + '/auditor1/' + requestId)
        .set('content-type', 'application/x-www-form-urlencoded');
      if (response.status === 200 && response.body.state === 'FINISHED') {
        success = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, pollingTime));
    } while (new Date().getTime() <= endAt);
    if (!success) {
      // done('timeout');
      throw new Error('timeout');
    }
  });
});

async function insertMockData(registry: PluginRegistry) {
  const config = readUtilityEmissionChaincodeCfg(
    join(__dirname, '..', 'config.json'),
  );
  const fabricClient = new PluginLedgerConnectorFabric({
    pluginRegistry: registry,
    connectionProfile: config.network,
    cliContainerEnv: {},
    instanceId: 'anything',
    peerBinary: 'anything',
    sshConfig: {},
    discoveryOptions: {
      enabled: true,
      asLocalhost: true,
    },
    logLevel: 'info',
  });
  // import mock UtilityIdentifier
  const caller: FabricSigningCredential = {
    keychainId: keychainId,
    keychainRef: 'auditor1_admin',
  };
  try {
    await fabricClient.transact({
      signingCredential: caller,
      channelName: config.channelName,
      contractName: config.chaincodeName,
      invocationType: FabricContractInvocationType.Call,
      methodName: 'getUtilityIdentifier',
      params: [testUtilityId],
    });
    console.log(`UtilityIdentifier ${testUtilityId} already exists`);
    return;
  } catch (error) {}
  // import UtilityIdentifier
  const p1 = fabricClient.transact({
    signingCredential: caller,
    channelName: config.channelName,
    contractName: config.chaincodeName,
    invocationType: FabricContractInvocationType.Send,
    methodName: 'importUtilityIdentifier',
    params: [
      testUtilityId,
      '2019',
      '252522444142552441242521',
      'test-utility-name',
      'USA',
      '',
      JSON.stringify({
        division_type: 'NERC_REGION',
        division_id: 'MRO',
      }),
    ],
  });
  // import mock UtilityFactor
  const p2 = fabricClient.transact({
    signingCredential: caller,
    channelName: config.channelName,
    contractName: config.chaincodeName,
    invocationType: FabricContractInvocationType.Send,
    methodName: 'importUtilityFactor',
    params: [
      'mock-utility-factor',
      '2019',
      'USA',
      'NERC_REGION',
      'MRO',
      'SERC_Reliability_Corporation',
      '46112136.165',
      'MWH',
      '47582155.875',
      'tons',
      'https://www.epa.gov/sites/production/files/2020-01/egrid2018_all_files.zip',
      '41078452.268',
      '5033683.71',
      '',
    ],
  });

  await Promise.all([p1, p2]);
}
