const expect = require('chai').expect;
const rewire = require('rewire');
const Promise = require('bluebird');
const sinon = require('sinon');

const JWTService = rewire('../services/jwt-service');

describe('JWT Service Test', () => {
	it('Should validate auths and return a valid client' , done => {
        const createScopeStub = sinon.stub().returns(true);
        const mockScopedClient = {
            name: 'scoped client test',
            authorize: sinon.stub().yields(false)
        };
        const mockClient = {
            createScopedRequired: () => true,
            createScoped: () => mockScopedClient
        };
        const getAppDefaultStub = sinon.stub().yields('', mockClient);
        const revert = JWTService.__set__('google.auth.getApplicationDefault', getAppDefaultStub);
        JWTService.createJWT('test')
            .then(secureClient => {
                expect(secureClient.name).to.equal('scoped client test');
                done();
            })
            .catch(console.log);
	});
});
