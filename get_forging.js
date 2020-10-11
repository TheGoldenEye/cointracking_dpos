// Copyright © 2018-20 GoldenEye
// Removal or modification of this copyright notice is prohibited.

const https = require('https');
const querystring = require('querystring');
const format = require('string-format');
const fs = require('fs');
const async = require('async');
const getPackageVersion = require('@jsbits/get-package-version');
const program = require('commander');

//------------------------------------------------------------------------------------
function LoadConfigFile(cfgFile) {
  const cfgFile_tpl = './config/get_forging_config_tpl.json';

  // first copy config from template, if not there
  if (!fs.existsSync(cfgFile))
    fs.copyFileSync(cfgFile_tpl, cfgFile);
  return JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
}

//------------------------------------------------------------------------------------
function accountData(account) {
  const data = cfg.accounts[account];
  if (data)
    data.node = cfg.nodes[account];
  return data;
}

//------------------------------------------------------------------------------------
function apiGet(path, params, cb) {

  const options = {
    host: data.node.host,
    port: data.node.port,
    path: path + '?' + querystring.stringify(params),
    method: 'GET',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  };

  const req = https.request(options, function (response) {
    let body = '';
    response.on('data', function (d) {
      body += d;
    });

    response.on('end', function () {
      const parsed = ParseJsonString(body);
      if (parsed)
        cb(parsed);
      else
        data.cb(red(body));
    });
  });

  req.end();

  req.on('error', function (e) {
    data.cb(red(e.toString()));
  });
}

//------------------------------------------------------------------------------------
// two-digit number format
function pad(number) {
  return (number < 10) ? '0' + number : number;
}

//------------------------------------------------------------------------------------
// timestamp as string
function TimeStr(timestamp, date, time) {
  const d = new Date(timestamp);

  let s = '';
  if (date)
    s = s + d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  if (time) {
    if (s != '')
      s = s + ' ';
    s = s + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds());
  }

  return s;
}

//---------------------------------------
function ParseJsonString(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return undefined;
  }
}

//---------------------------------------
// callback
function forgeCallback(result) {
  const ok = data.node.newApi ? result.data : result.success;
  if (ok) {
    processForged(data.node.newApi ? result.data : result);
    data.cb(null);
  } else {
    data.cb(red(data.node.newApi ? result.message : result.error));
  }
}

//---------------------------------------
// processing
function processForged(result) {
  const date = TimeStr(data.end, true, false);
  const sForged = Number(result.forged / 1e8).toFixed(8);
  const rewardBl = Number(result.rewards / 1e8) / Number(result.count);

  totalForged[data.coin] += Number(result.forged / 1e8);
  process.stdout.write(format('Forging {0} : {1} {2}    \r', date, sForged, data.coin));
  if (sForged != 0) {
    let exch = data.exch;
    if (exch.includes('%y')) // replace '%y' with the current year
      exch = exch.replace('%y', date.substr(0, 4));
    fs.appendFileSync(data.fileName, format(cfg.csv.line, 'Mining', sForged, data.coin, data.id, result.count, precisionRound(rewardBl, 4), date, exch, cfg.zeroCostBase ? "0.00000001" : ""));
  }
}

//------------------------------------------------------------------------------------
const colReset = "\x1b[0m";
const colFgGreen = "\x1b[32m";
const colFgYellow = "\x1b[33m";

//------------------------------------------------------------------------------------
function green(txt) {
  return colFgGreen + txt + colReset;
}

//------------------------------------------------------------------------------------
function red(txt) {
  return colFgYellow + txt + colReset;
}

//---------------------------------------
// exact round
function precisionRound(number, precision) {
  const factor = Math.pow(10, precision);
  return Math.round(number * factor) / factor;
}

//---------------------------------------
function mkdir(dirPath) {
  try {
    fs.mkdirSync(dirPath);
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

//---------------------------------------
//---------------------------------------
// main

function main(account, intervall, idx, cb) {
  data = accountData(account);
  data = cfg.accounts[account];

  if (!data || !data.use || !data.node)
    return cb("disabled");

  totalForged[data.coin] = totalForged[data.coin] || 0;

  data.start = intervall.start;
  data.end = intervall.end;
  data.fileName = cfg.outputDir + TimeStr(endTime, true, false) + '_' + data.coin + '_' + data.name + '_FORGING.csv';

  data.cb = cb;

  if (idx == 0) {
    if (cfg.outputDir)
      mkdir(cfg.outputDir);

    if (fs.existsSync(data.fileName))
      fs.unlinkSync(data.fileName);

    fs.writeFileSync(data.fileName, cfg.csv.header);
  }

  let path = '';
  let params = {};
  if (data.node.newApi) {
    path = '/api/delegates/' + data.id + '/forging_statistics/';
    params = {
      fromTimestamp: data.start,
      toTimestamp: data.end
    };
  } else {
    path = '/api/delegates/forging/getForgedByAccount/';
    params = {
      generatorPublicKey: data.pk,
      start: Math.floor(data.start / 1000),
      end: Math.floor(data.end / 1000)
    };
  }
  apiGet(path, params, forgeCallback);
}

//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// start:

program
  .version(getPackageVersion())
  //  .option('-d, --debug', 'output extra debugging')
  .option('-c, --config <configFile>', 'configFile to use', './config/get_forging_config.json')
  .option('-y, --year <year>', 'the year to use (overwrites the values from config file)')
  .parse(process.argv);

const cfg = LoadConfigFile(program.opts().config);

// Lisk
// 1st Block with rewards: https://explorer.lisk.io/block/14795541625652526135
// 2016/11/30 17:38:00

// Shift
// 1st Block: https://explorer.shiftnrg.org/block/1712584016489587075
// 2016/05/24 19:00:00
// rewards from Block 10

let beginTime;
let endTime;
if (program.opts().year) {
  const y = Number(program.opts().year);
  beginTime = new Date(Date.UTC(y, 0, 1)).getTime();
  endTime = new Date(Date.UTC(y, 11, 31)).getTime();
} else {
  // ISO 8601 date strings are treated as UTC
  beginTime = new Date(cfg.start).getTime();
  endTime = new Date(cfg.end).getTime();
}

const nowTime = new Date().getTime();
const vctLisk = [];
const vctShift = [];
const vctOxy = [];
const vctRise = [];
const totalForged = {};
let t;
let data;

//correct endTime, if in the future
if (endTime > nowTime)
  endTime = nowTime - 86400000; // only use complete days

// collect time slices (days)
for (t = beginTime; t <= endTime; t += 86400000)
  vctLisk.push({
    start: t,
    end: t + 86399999
  });

for (t = beginTime; t <= endTime; t += 86400000)
  vctShift.push({
    start: t,
    end: t + 86399999
  });

for (t = beginTime; t <= endTime; t += 86400000)
  vctOxy.push({
    start: t,
    end: t + 86399999
  });

for (t = beginTime; t <= endTime; t += 86400000)
  vctRise.push({
    start: t,
    end: t + 86399999
  });

// lisk
async.eachOfSeries(vctLisk,
  function (item, idx, cb) {
    main('lisk', item, idx, cb);
  },
  function (err) {
    if (err)
      console.log('Lisk:', err, '            ');
    else
      console.log('Lisk  total forged: %s %s     ', totalForged[data.coin], data.coin);

    // shift
    async.eachOfSeries(vctShift,
      function (item, idx, cb) {
        main('shift', item, idx, cb);
      },
      function (err) {
        if (err)
          console.log('Shift:', err, '            ');
        else
          console.log('Shift total forged: %s %s     ', totalForged[data.coin], data.coin);

        // oxy
        async.eachOfSeries(vctOxy,
          function (item, idx, cb) {
            main('oxy', item, idx, cb);
          },
          function (err) {
            if (err)
              console.log('Oxy:', err, '            ');
            else
              console.log('Oxy   total forged: %s %s     ', totalForged[data.coin], data.coin);

            // rise
            async.eachOfSeries(vctRise,
              function (item, idx, cb) {
                main('rise', item, idx, cb);
              },
              function (err) {
                if (err)
                  console.log('Rise:', err, '            ');
                else
                  console.log('Rise  total forged: %s %s     ', totalForged[data.coin], data.coin);
              });
          });
      });
  });