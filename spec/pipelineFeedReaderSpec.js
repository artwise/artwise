
var fs = require('fs');
var xml2json = require('xml2json');

var mockGocdRequestor = {
  get: function(next, callback) {
    var source = next ? next : 'spec/fixtures/pipeline-stages.xml';
    var xml = fs.readFileSync(source);
    var json = xml2json.toJson(xml, { object: true, sanitize: false });
    callback(json);

  }
};

var mocks = {
  'server/sources/gocd/gocdRequestor': mockGocdRequestor
};

var context = createContext(mocks);


context(['lodash', 'moment', 'server/sources/gocd/pipelineFeedReader'], function(_, moment, thePipelineFeedReader) {

  describe('pipelineFeedReader', function () {
    describe('readHistory()', function () {

      it('should initialise a set of pipeline runs', function () {
        thePipelineFeedReader.readHistory(function (results) {
          expect(_.keys(results).length).toBe(12); //1200 - 1189
          expect(results['1199']).toBeDefined();
        });
      });

      it('should pass through a parameter for the callback', function () {
        thePipelineFeedReader.readHistory(function (results, parameter) {
          expect(parameter).toBe('aParameter');
        }, { callbackParameter: 'aParameter' });
      });

      it('should exclude pipelines if specified', function () {
        thePipelineFeedReader.readHistory(function (results) {
          expect(_.keys(results).length).toBe(10); //1200 - 1189
        }, { exclude: ['1199', '1198'] });
      });

      it('should pass no url to the requestor in initial call', function () {
        spyOn(mockGocdRequestor, 'get');
        thePipelineFeedReader.readHistory(function (results, parameter) {
        });
        expect(mockGocdRequestor.get.mostRecentCall.args[0]).toBeUndefined();
      });

      it('should pass a next url to the requestor', function () {
        spyOn(mockGocdRequestor, 'get');
        thePipelineFeedReader.readHistory(function (results, parameter) {
        }, {
          callbackParameter: 'aParameter',
          nextUrl: 'nextUrl'
        });
        expect(mockGocdRequestor.get.mostRecentCall.args[0]).toBe('nextUrl');
      });

      it('should determine the time the last stage finished', function () {
        thePipelineFeedReader.readHistory(function (results) {
          var expectedTime = moment('2014-07-18T16:08:39+00:00');
          var actualTime = moment(results['1199'].time);
          expect(actualTime.hours()).toBe(expectedTime.hours());
          expect(actualTime.minutes()).toBe(expectedTime.minutes());
          expect(actualTime.seconds()).toBe(expectedTime.seconds());
        });
      });

      it('should determine the result of the pipeline', function () {
        thePipelineFeedReader.readHistory(function (results) {
          expect(results['1199'].result).toBe('passed');
          expect(results['1195'].result).toBe('failed');
        });
      });

      it('should say a pipeline passed when a job was rerun and passed the second time', function () {
        thePipelineFeedReader.readHistory(function (results) {
          expect(results['1198'].result).toBe('passed');
        });
      });

      it('should determine the author of a job', function () {
        thePipelineFeedReader.readHistory(function (results) {
          expect(results['1199'].result).toBe('passed');
          expect(results['1199'].author).toBeDefined();
          expect(results['1199'].author.name).toContain('Max Mustermann');
          expect(results['1195'].result).toBe('failed');
          expect(results['1195'].author.name).toContain('Max Mustermann');
        });
      });

      xit('should not add the same entries again when called twice', function () {
        thePipelineFeedReader.readHistory(function (results) {
          expect(_.keys(results).length).toBe(11);
          expect(results['1199'].stages.length).toBe(5);

          thePipelineFeedReader.readHistory(function (results) {
            expect(_.keys(results).length).toBe(11);
            expect(results['1199'].stages.length).toBe(5);
          });

        });
      });

    });
  });
});