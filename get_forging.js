// Copyright © 2018 GoldenEye
// Removal or modification of this copyright notice is prohibited.

var https = require('https');
var querystring = require('querystring');
var format = require('string-format');
var fs = require('fs');
var async = require('async');
var cfg = require('./get_forging_config.json');

//------------------------------------------------------------------------------------
function accountData(account) {
  var data = cfg.accounts[account];
  if (data)
    data.node = cfg.nodes[account];
  return data;
}

//------------------------------------------------------------------------------------
function apiGet(coin, path, params, cb) {

  var options = {
    host: data.node.host,
    port: data.node.port,
    path: path+'?'+querystring.stringify(params),
    method: 'GET',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  };

  var req = https.request(options, function(response) {
    var body = '';
    response.on('data', function(d) {
      body += d;
    });

    response.on('end', function() {
      var parsed = JSON.parse(body);
      cb( parsed );
    });
  });
  
  req.end();
  
  req.on('error', function(e) {
    console.error(e);
  });
};

//------------------------------------------------------------------------------------
// two-digit number format
function pad(number)
  { 
  return (number < 10) ? '0' + number : number; 
  }

//------------------------------------------------------------------------------------
// timestamp as string
function TimeStr(timestamp, date, time)
  {
  var d = new Date(timestamp);

  var s = '';
  if (date)
    s = s+ d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  if (time)
    {
    if (s!='')
      s = s + ' ';
    s = s + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds());
    }

  return s;
  }

//---------------------------------------
// callback
function forgeCallback(result) 
  {
  var ok = data.node.newApi ? result.data : result.success;
  if (ok)
    {
    processForged(data.node.newApi ? result.data : result);
    data.cb(null);
    }
  else
    {
    data.cb(data.node.newApi ? result.description : result.error);
    }
  };
  
//---------------------------------------
// processing
function processForged(result)
  {
  var date      = TimeStr(data.end, true, false)
  var sForged   = Number(result.forged/1e8).toFixed(8);
  var rewardBl  = Number(result.rewards/1e8) / Number(result.count);

  totalForged[data.coin] += Number(result.forged/1e8);
  process.stdout.write(format('Forging {0} : {1} {2}    \r', date, sForged, data.coin));
  if (sForged!=0)
    fs.appendFileSync(data.fileName, format(cfg.csv.line, 'Mining', sForged, data.coin, data.id, result.count, precisionRound(rewardBl, 4), date, data.exch));
  }

//---------------------------------------
// exact round
function precisionRound(number, precision)
  {
  var factor = Math.pow(10, precision);
  return Math.round(number * factor) / factor;
  }

//---------------------------------------
//---------------------------------------
// main

function main(account, intervall, idx, cb)
  {
  data = accountData(account);
  data = cfg.accounts[account];

  if (!data || !data.use || !data.node)
    return cb("disabled");

  totalForged[data.coin] = totalForged[data.coin] || 0;

  data.start    = intervall.start;
  data.end      = intervall.end;
  data.fileName = TimeStr(endTime, true, false) + '_' + data.coin + '_' + data.name + '_FORGING.csv';

  data.cb       = cb;

  if (idx==0)
    {
    if (fs.existsSync(data.fileName))
      fs.unlinkSync(data.fileName);

    fs.writeFileSync(data.fileName, cfg.csv.header);
    }

  var path = '';
  var params = {};
  if (data.node.newApi)
    {
    path   = '/api/delegates/' + data.id + '/forging_statistics/';
    params = { fromTimestamp: data.start, toTimestamp: data.end};
    }
  else
    {
    path   = '/api/delegates/forging/getForgedByAccount/';
    params = { generatorPublicKey: data.pk, start: Math.floor(data.start/1000), end: Math.floor(data.end/1000)};
    }
  apiGet(data.coin, path, params, forgeCallback);
  }

//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// Lisk
// 1st Block with rewards: https://explorer.lisk.io/block/14795541625652526135
// 2016/11/30 17:38:00

// Shift
// 1st Block: https://explorer.shiftnrg.org/block/1712584016489587075
// 2016/05/24 19:00:00
// rewards from Block 10

var beginTime   = new Date(cfg.start).getTime();
var endTime     = new Date(cfg.end).getTime()-1;   // last ms of day before
var vctLisk     = [];
var vctShift    = [];
var vctOxy      = [];
var vctRise     = [];
var totalForged = {};
var t;
var data;

// collect time slices (days)
for (t=beginTime; t<endTime; t+=86400000)
  vctLisk.push( {start: t, end: t+86399999} );

for (t=beginTime; t<endTime; t+=86400000) 
  vctShift.push( {start: t, end: t+86399999} );

for (t=beginTime; t<endTime; t+=86400000)
  vctOxy.push( {start: t, end: t+86399999} );

for (t=beginTime; t<endTime; t+=86400000)
  vctRise.push( {start: t, end: t+86399999} );

// lisk
async.eachOfSeries(vctLisk, 
  function(item, idx, cb) {
    main('lisk', item, idx, cb);
  },  
  function(err) {
    if ( err )
      console.log('Lisk:', err);
    else
      console.log('Lisk  total forged: %s %s     ', totalForged[data.coin], data.coin);

  // shift
  async.eachOfSeries(vctShift, 
    function(item, idx, cb) {
      main('shift', item, idx, cb);
    },
    function(err) {
      if ( err )
        console.log('Shift:', err);
      else
        console.log('Shift total forged: %s %s     ', totalForged[data.coin], data.coin);

    // oxy
    async.eachOfSeries(vctOxy, 
      function(item, idx, cb) {
        main('oxy', item, idx, cb);
      },  
      function(err) {
        if ( err )
          console.log('Oxy:', err);
        else
          console.log('Oxy   total forged: %s %s     ', totalForged[data.coin], data.coin);

      // rise
      async.eachOfSeries(vctRise, 
        function(item, idx, cb) {
          main('rise', item, idx, cb);
        },  
        function(err) {
          if ( err )
            console.log('Rise:', err);
          else
            console.log('Rise  total forged: %s %s     ', totalForged[data.coin], data.coin);
        });
      });
    });
  });