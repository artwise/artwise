var Q = require('q');

describe('Miro Go CD Mapper', function () {

  var fakePipelineHistory, fakeActivity;
  var miroGocdMapper;

  var notSuccessfulFn = function () {
    return false;
  };
  var successfulFn = function () {
    return true;
  };

  beforeEach(function() {
    var mockery = require('mockery');
    var mockGocdApi = {
      readData: function () {
        var defer = Q.defer();
        defer.resolve({
          activity: {jobs: fakeActivity},
          history: fakePipelineHistory
        });
        return defer.promise;
      },
      readActivity: function () {
        var defer = Q.defer();
        defer.resolve({jobs: fakeActivity});
        return defer.promise;
      }
    };

    mockery.enable({
      warnOnUnregistered: false,
      warnOnReplace: false
    });
    mockery.registerMock('gocd-api', { getInstance: function() { return mockGocdApi; }});

    miroGocdMapper = require('../server/miro/gocdMapper');

  });

  describe('mapPipelineData()', function () {

    beforeEach(function () {
      fakeActivity = [];
      fakePipelineHistory = {};
    });

    it('should set the stroke color to red if last build was unsuccessful', function (done) {
      fakePipelineHistory = {
        '125': { wasSuccessful: notSuccessfulFn },
        '124': { wasSuccessful: successfulFn }
      };
      miroGocdMapper.readHistoryAndActivity().then(function (result) {
        expect(result.stroke.color).toBe('red');
        done();
      });

    });

    it('should set the stroke color to black if last build was successful', function (done) {
      fakePipelineHistory = {
        '125': { wasSuccessful: successfulFn },
        '124': { wasSuccessful: notSuccessfulFn }
      };
      miroGocdMapper.readHistoryAndActivity().then(function (result) {
        expect(result.stroke.color).toBe('black');
        done();
      });

    });

    iit('should set the size of stones according to the size of changes', function (done) {

      fakePipelineHistory = {
        '125': {
          wasSuccessful: notSuccessfulFn
        },
        '124': {
          wasSuccessful: notSuccessfulFn,
          "build_cause": {
            "files": [
              { "name":"aFile.txt", action: "modified" }
            ]
          }
        },
        '123': {
          wasSuccessful: notSuccessfulFn,
          "build_cause": {
            "files": [
              { "name":"aFile.txt", action: "modified" },
              { "name":"aFile.txt", action: "modified" },
              { "name":"aFile.txt", action: "created" },
              { "name":"aFile.txt", action: "modified" }
            ]
          }
        }
      };
      miroGocdMapper.readHistoryAndActivity().then(function (result) {
        expect(result.stones[0].size).toBe('small'); // 1 modification
        expect(result.stones[1].size).toBe('medium'); // 2 modifications
        done();
      });

    });

  });

});
