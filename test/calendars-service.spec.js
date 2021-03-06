const expect = require('chai').expect;
const rewire = require('rewire');
const sinon = require('sinon');
const Promise = require('bluebird');
const mockEventList = require('./mocks/eventList.json');

const CalendarService = rewire('../services/calendar-service');

describe('Calendar Test', () => {
	const calendar = CalendarService.__get__('calendar');
	let jwtRevert;

	beforeEach(done => {
		const stub = sinon.stub().returns(Promise.resolve('a secured client'));
		jwtRevert = CalendarService.__set__('createJWT', stub);
		done();
	});

	afterEach(() => jwtRevert());

	it('should send an update to Google Calendar', done => {
		const updateEvent = CalendarService.__get__('updateEvent');
		const updateSpy = sinon.spy(calendar.events, 'update');
		const fakeResourceBody = {
			summary: 'testing',
			foo: 'bar'
		};

		// Since it will fail as this isn't an actual event
		updateEvent({eventId: 'event1', calendarId: 'calendar1'}, fakeResourceBody)
			.catch(() => {
				const expectedParams = {
					eventId: 'event1',
					calendarId: 'calendar1',
					resource: fakeResourceBody,
					auth: 'a secured client'
				};

				// eslint-disable-next-line no-unused-expressions
				expect(updateSpy.calledWith(expectedParams)).to.be.true;
				done();
			});
	});

	it('should return a sync token', done => {
		const mockFullSync = () => Promise.resolve(mockEventList);
		const revert = CalendarService.__set__('getFullSync', mockFullSync);
		const getSyncToken = CalendarService.__get__('getSyncToken');

		getSyncToken()
			.then(syncToken => {
				expect(syncToken).to.equal('CPiw4dWUu84CEPiw4dWUu84CGAU=');
				revert();
				done();
			});
	});

	it('should perform a full sync', done => {
		const getFullSync = CalendarService.__get__('getFullSync');
		const mock1 = {
			events: [1, 2],
			nextPageToken: 2
		};
		const mock2 = {
			events: [3, 4],
			syncToken: 'token'
		};
		// Override eventList to check integrity of callback
		const eventListMock = params => {
			if (params.nextPageToken) {
				return Promise.resolve(mock2);
			}
			return Promise.resolve(mock1);
		};
		const revert = CalendarService.__set__('listEvents', eventListMock);
		getFullSync('brhim@apidevdemo.com').then(lastPageResponse => {
			expect(lastPageResponse.syncToken).to.equal('token');
			revert();
			done();
		});
	});

	it('should perform an incremental sync', done => {
		const listStub = sinon.stub().returns(Promise.resolve([]));
		const listRevert = CalendarService.__set__('listEvents', listStub);
		const getIncrementalSync = CalendarService.__get__('getIncrementalSync');
		const mockCalendarInfo = {
			syncToken: '12345abcefg',
			calendarId: 'calendarId1'
		};

		getIncrementalSync(mockCalendarInfo)
			.then(() => {
				const expectedParams = {
					auth: 'a secured client',
					calendarId: 'calendarId1',
					singleEvents: false,
					syncToken: '12345abcefg',
					showDeleted: true
				};
				// eslint-disable-next-line no-unused-expressions
				expect(listStub.calledWith(expectedParams)).to.be.true;
				listRevert();
				done();
			});
	});
});
