'use strict';

var app = require('express')();
var Promise = require('bluebird');
var _ = require('lodash');
var AdministerUsers = require('./services/AdministerUsers');
var AdministerChannels = require('./services/AdministerChannels');
var AdministerCalendars = require('./services/AdministerCalendars');
var createJWT = require('./services/AdministerJWT').createJWT;
var config = require('./configs/config');
var scope = require('./constants/GoogleScopes');
var logError = require('./libs/errorHandlers').logError;
var db = require('./data/db/connection');
var mongoose = require('mongoose');
var Channel = mongoose.model('Channel', require('./data/schema/channel'));
var getDateMsDifference = require('./libs/timeUtils').getDateMsDifference;

app.get('/', function getResponse(req, res) {
  res.send('Google integration is running.');
});

var serverAPI = {
  events: '/watch/events',
  users: '/watch/users'
};

app.use(serverAPI.events, require('./routes/eventsRoute'));
app.use(serverAPI.users, require('./routes/usersRoute'));

initServer();

function initServer() {
  setUpChannels();
  app.listen(config.port, console.log('Running on port 5000'));
}

function setUpChannels() {
  getUsers()
    .then(createChannelsAndExtractIds)
    .catch(logError);
}

/**
 * Create User Directory Channel and extract User ids
 * @param  {Object} userResponse JSON response for user directory response
 * @return {Void}
 */
function createChannelsAndExtractIds(userDirResponse) {
  // @TODO:
  // retry creating channel and have a timeout associated with it
  findDirectoryChannel()
    .then(function findDirCb(currentDirectoryChannel) {
      if (currentDirectoryChannel)
        return setChannelRenewal(currentDirectoryChannel);

      createDirChannelAndSave()
        .then(setChannelRenewal);
    });

  extractUserIds(userDirResponse.users)
    // This a series of request per each id
    .each(createEventChannelsAndSave)
    .catch(logError);
}

function setChannelRenewal (directoryChannel) {
  var timeoutMs = getDateMsDifference(directoryChannel.expiration);
  if (timeoutMs < 0) {
    timeoutMs = 0;
  }

  function createAndDeleteChannel () {
    createDirChannelAndSave()
      .then(function(newChannel) {
        // Will need to be address,
        // as response is passed when created
        // and query lookup is passed during existing renewal
        var id = directoryChannel.id || directoryChannel.calendarId;
        Channel.remove({ channelId: id }).exec();
        // recall to reset up renewal
        setChannelRenewal(newChannel);
      });
  }

  setTimeout(createAndDeleteChannel, timeoutMs);
}

function createDirChannelAndSave() {
  return createDirectoryChannel()
    .then(saveDirectoryChannel)
    .then(Promise.resolve)
    .catch(logError);
}

/**
 * Get list of users
 * @return {Object} A promise when fulfilled is
 */
function getUsers() {
  return new Promise(function userPromise(resolve, reject) {
    createJWT(scope.userDirectory)
      .then(function authorizeJwtResponse(jwtClient) {
        var listUsers = Promise.promisify(AdministerUsers.list);
        listUsers(jwtClient, null)
          .then(resolve)
          .catch(reject);
      })
      .catch(logError);
  });
}

/**
* Get list of user ids from user records
* @param  {Array} users an array of users from the Google directory response
* @return {Object}       returns an extracted list of Google user ids
*/
function extractUserIds(users) {
  var userIds = _.map(users, function extractEmail(user) {
    return user.primaryEmail;
  });
  return Promise.resolve(userIds);
}

/**
 * Performs a channel request and saves after successful
 * @param  {String} userId UserId of the eventList to create a watch for
 * @return {String}
 */
function createEventChannelsAndSave(userId) {
  var eventChannelPromise = createEventChannel(userId);
  var syncTokenPromise = AdministerCalendars.getSyncToken(userId);

  Promise.all([
    syncTokenPromise,
    eventChannelPromise,
  ])
  .spread(function(syncToken, channelInfo) {
    channelInfo.syncToken = syncToken;
    channelInfo.calendarId = userId;
    channelInfo.type = 'event'
    AdministerChannels.save(channelInfo);
    // @TODO: this could be abstracted within the service
  })
  .catch(logError);
}

/**
 * Create an events watch channel per each userId
 * @param  {String} userIds <userId>@<domain>
 * @return {Void}
 */
function createEventChannel(userId) {
  var channelInfo = {
    type: 'event',
    id: userId
  };
  return AdministerChannels.create(channelInfo);
}

function createDirectoryChannel() {
  var channelInfo = {
    type: 'directory'
  };
  return AdministerChannels.create(channelInfo);
}

function saveDirectoryChannel(channelInfo) {
  channelInfo.type = 'directory';
  AdministerChannels.save(channelInfo);
  return Promise.resolve(channelInfo);
}

function findCalendarChannel(calendarId) {
  Channel.findOne({calendarId: calendarId})
    .then(function(response) {
      console.log(response);
    });
}

function findDirectoryChannel() {
  return Channel.findOne({resourceType: 'directory'});
}


