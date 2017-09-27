const expect = require('chai').expect;
const config = require('../configs/config');

const build = config.build;

describe('Configuration Test Suite', () => {
	it('Should strip the url of trailing backslash', done => {
		const _normalizeUrl = config._normalizeUrl;
		const testUrl = 'http://example.com/';

		expect(_normalizeUrl(testUrl)).to.equal('http://example.com');
		// eslint-disable-next-line no-unused-expressions
		expect(() => _normalizeUrl(null)).to.throw;
		done();
	});

	it('Should throw errors for undefined values in the config', done => {
		// eslint-disable-next-line no-unused-expressions
		expect(() => build({
			test: undefined
		})).to.throw;
		done();
	});

	it('should contain default build the config', done => {
		const testEnv = {
			ADMIN: 'test@apidevdemo.com',
			DOMAIN: 'apidevdemo.com',
			CUSTOMER: 'customerId',
			RECEIVING_URL: 'https://test.ngrok.io/',
			DB_URL: 'mongodb://localhost/webex',
			DB_URL_TEST: 'mongodb://localhost/test',
			GOOGLE_APPLICATION_CREDENTIALS: './secret/webex-secret.json'
		};

		expect(build(testEnv)).to.deep.equal({
			port: 5000,
			authorizeAdmin: 'test@apidevdemo.com',
			receivingUrl: {
				base: 'https://test.ngrok.io',
				events: 'https://test.ngrok.io/watch/events',
				users: 'https://test.ngrok.io/watch/users'
			},
			domain: 'apidevdemo.com',
			customer: 'customerId'
		});
		done();
	});

	it('should export a build app config', () => expect(config.APP).to.be.deep.equal({
		authorizeAdmin: 'admin@company.com',
		domain: 'companydomain.com',
		port: 5000,
		receivingUrl: {
			base: 'https://example.ngrok.io',
			events: 'https://example.ngrok.io/watch/events',
			users: 'https://example.ngrok.io/watch/users'
		}
	}));
});
