// Copyright © 2018-20 GoldenEye
// Removal or modification of this copyright notice is prohibited.

const https = require('https');
const querystring = require('querystring');
const format = require('string-format');
const fs = require('fs');
const extend = require('extend');
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
function apiGet(path, params, cb) {

  params.limit = params.limit || 100;
  params.offset = params.offset || 0;

  var options = {
    host: data.node.host,
    port: data.node.port,
    path: path + '?' + querystring.stringify(params),
    method: 'GET',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  };

  var req = https.request(options, function (response) {
    var body = '';
    response.on('data', function (d) {
      body += d;
    });

    response.on('end', function () {
      var parsed = ParseJsonString(body);
      if (parsed)
        cb(parsed);
      else
        data.cb(yellow(body));
    });
  });

  req.end();

  req.on('error', function (e) {
    data.async_cb(e.toString());
  });


}

//------------------------------------------------------------------------------------
const colReset = "\x1b[0m";
const colBright = "\x1b[1m";
const colDim = "\x1b[2m";
const colUnderscore = "\x1b[4m";
const colBlink = "\x1b[5m";
const colReverse = "\x1b[7m";
const colHidden = "\x1b[8m";

const colFgBlack = "\x1b[30m";
const colFgRed = "\x1b[31m";
const colFgGreen = "\x1b[32m";
const colFgYellow = "\x1b[33m";
const colFgBlue = "\x1b[34m";
const colFgMagenta = "\x1b[35m";
const colFgCyan = "\x1b[36m";
const colFgWhite = "\x1b[37m";

const colBgBlack = "\x1b[40m";
const colBgRed = "\x1b[41m";
const colBgGreen = "\x1b[42m";
const colBgYellow = "\x1b[43m";
const colBgBlue = "\x1b[44m";
const colBgMagenta = "\x1b[45m";
const colBgCyan = "\x1b[46m";
const colBgWhite = "\x1b[47m";

//------------------------------------------------------------------------------------
function green(txt) {
  return colFgGreen + txt + colReset;
}

//------------------------------------------------------------------------------------
function yellow(txt) {
  return colFgYellow + txt + colReset;
}

//------------------------------------------------------------------------------------
function accountData(account, d) {
  var ign = cfg.accountDatas.ignore[account];
  var intern = cfg.accountDatas.internal[account];
  var ext = cfg.accountDatas.external[account];
  var res = cfg.accountDatas.names[account];

  d.id = account;
  d.name = res ? res.name : ign ? ign.name : intern ? intern.name : ext ? ext.name : account;
  d.ign = ign ? (!(cfg.createInternalTx && intern) && !ext) : false; // do not ignore tx, if internal/external tx should be created
  d.intern = intern;
  d.extern = ext;

  if (d.name == account && !data.notFound.includes(account)) {
    console.warn(yellow("  => Please add account %s to accountDatas.names or .ignore or .external section in get_tx_config.json"), account);
    data.notFound.push(account);
  }
  return d.name;
}

//------------------------------------------------------------------------------------
function pad(number) {
  return (number < 10) ? '0' + number : number;
}

//------------------------------------------------------------------------------------
function TimeStr(timestamp) {
  var beginEpochTime = new Date(Date.UTC(2016, 4, 24, 17, 0, 0, 0)).getTime();
  var d = new Date(timestamp * 1000 + beginEpochTime);

  return d.getFullYear() +
    '-' + pad(d.getMonth() + 1) +
    '-' + pad(d.getDate()) +
    ' ' + pad(d.getHours()) +
    ':' + pad(d.getMinutes()) +
    ':' + pad(d.getSeconds());
}

//------------------------------------------------------------------------------------
function CurrentTimeStr() {
  var d = new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
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
// tx callback
function txCallback(result) {
  var ok = data.newApi ? result.data : result.success;
  if (ok) {
    var count = data.newApi ? result.meta.count : result.count;
    var arr = data.newApi ? result.data : result.transactions;
    arr.forEach(function (tx) {
      if (tx.type == 0) // send
      {
        var tx1 = {};
        var tx2 = {};
        var isOut = tx.senderId == data.account;
        var res = isIndirectTx(isOut, tx);
        // jshint expr: true
        if (res.tx1) {
          isOut ? outTx(res.tx1) : inTx(res.tx1);
          if (res.tx2)
            isOut ? outTx(res.tx2) : inTx(res.tx2);
        } else
          isOut ? outTx(tx) : inTx(tx);
      } else if (tx.type == 1) // second signature creation
        secondsigTx(tx);
      else if (tx.type == 2) // delegate registration
        delegateTx(tx);
      else if (tx.type == 3) // vote
        voteTx(tx);
      else if (tx.type == 4) // multisignature creation
        multisigTx(tx);
      else
        console.warn(yellow("  => Unknown Transaction Type: %d"), tx.type);
    });

    if (count > data.ofs + arr.length) {
      data.ofs += arr.length;
      apiGet('/api/transactions/', data.newApi ? {
        senderIdOrRecipientId: data.account,
        offset: data.ofs,
        sort: 'timestamp:asc'
      } : {
        senderId: data.account,
        recipientId: data.account,
        offset: data.ofs,
        orderBy: 'timestamp:asc'
      }, txCallback);
    } else
      data.async_cb(null, data.account);
  } else
    data.async_cb(data.newApi ? result.message : result.error);
}

//---------------------------------------
function isIndirectTx(isOut, tx) {
  var res = {};
  var d = cfg.indirectTx[tx.id];
  if (!d)
    return res;

  var account2 = d.account;
  var amount2 = d.amount || '0';
  if (!account2 || !amount2)
    return res;

  var remaining = Number(tx.amount) - Number(amount2);
  if (remaining > 0) // we need a 2nd tx
    remaining -= Number(tx.fee);

  if (remaining < 0)
    return res;

  res.tx1 = extend(true, {}, tx); // create a real copy

  // the redirected tx:
  // jshint expr: true
  isOut ? res.tx1.recipientId = account2 : res.tx1.senderId = account2;
  res.tx1.amount = amount2;
  res.tx1.asset.data = 'indirect tx';

  // the rest goes to the original destination
  if (remaining) {
    res.tx2 = extend(true, {}, tx); // create a real copy
    res.tx2.id += '#2';
    res.tx2.amount = remaining.toString();
  }

  return res;
}

//---------------------------------------
// send outgoing
function outTx(tx) {
  var d = {};
  var accID = accountData(tx.recipientId, d);

  tx.amount = Number(tx.amount);
  tx.amount2 = Number(tx.amount / 1e8).toFixed(8);
  tx.fee = Number(tx.fee);
  tx.fee2 = Number(tx.fee / 1e8).toFixed(8);
  tx.amountFee2 = Number((tx.amount + tx.fee) / 1e8).toFixed(8);

  if (d.ign) // ignore tx
  {
    console.warn('  >> out: tx %s (%s %s) to %s ignored', tx.id, tx.amount2, data.coin, accID);
    return;
  }

  var ref = '';
  if (tx.asset && tx.asset.data)
    ref = ' [' + tx.asset.data + ']';

  if (d.extern) {
    fs.appendFileSync(data.fileName, format(cfg.csv.outTx, 'Spend', tx.amountFee2, data.coin, tx.fee2, tx.id, data.account, TimeStr(tx.timestamp), accID, ref, ""));
    fs.appendFileSync(data.fileNameExt, format(cfg.csv.inTx, 'Income', tx.amount2, data.coin, 0, tx.id, d.id, TimeStr(tx.timestamp), data.accountName, ref, ""));
  } else if (d.intern) {
    if (cfg.createInternalTx)
      fs.appendFileSync(data.fileName, format(cfg.csv.outTx, 'Withdrawal', tx.amountFee2, data.coin, tx.fee2, tx.id, data.account, TimeStr(tx.timestamp), accID, ref, ""));
    fs.appendFileSync(data.fileName, format(cfg.csv.fee, Number(tx.fee / 1e8).toFixed(8), data.coin, tx.id, data.account, TimeStr(tx.timestamp), cfg.fiat_currency, "Withdrawal Fee"));
  } else
    fs.appendFileSync(data.fileName, format(cfg.csv.outTx, 'Donation', tx.amountFee2, data.coin, tx.fee2, tx.id, data.account, TimeStr(tx.timestamp), accID, ref, "0.00000001"));
}

//---------------------------------------
// send incoming
function inTx(tx) {
  var d = {};
  var accID = accountData(tx.senderId, d);

  tx.amount = Number(tx.amount);
  tx.amount2 = Number(tx.amount / 1e8).toFixed(8);
  tx.fee = Number(tx.fee);
  tx.fee2 = Number(tx.fee / 1e8).toFixed(8);
  tx.amountFee2 = Number((tx.amount + tx.fee) / 1e8).toFixed(8);


  if (d.ign) // ignore tx
  {
    console.warn('  << in: tx %s (%s %s) from %s ignored', tx.id, tx.amount2, data.coin, accID);
    return;
  }

  var ref = '';
  if (tx.asset && tx.asset.data)
    ref = ' [' + tx.asset.data + ']';

  if (d.extern) {
    fs.appendFileSync(data.fileName, format(cfg.csv.inTx, 'Income', tx.amount2, data.coin, 0, tx.id, data.account, TimeStr(tx.timestamp), accID, ref, ""));
    fs.appendFileSync(data.fileNameExt, format(cfg.csv.outTx, 'Spend', tx.amountFee2, data.coin, tx.fee2, tx.id, d.id, TimeStr(tx.timestamp), data.accountName, ref, ""));
    return;
  } else if (d.intern) {
    if (cfg.createInternalTx)
      fs.appendFileSync(data.fileName, format(cfg.csv.inTx, 'Deposit', tx.amount2, data.coin, 0, tx.id, data.account, TimeStr(tx.timestamp), accID, ref, ""));
  } else
    fs.appendFileSync(data.fileName, format(cfg.csv.inTx, 'Gift/Tip', tx.amount2, data.coin, 0, tx.id, data.account, TimeStr(tx.timestamp), accID, ref, cfg.zeroCostBase ? "0.00000001" : ""));
}

//---------------------------------------
// second signature creation
function secondsigTx(tx) {
  fs.appendFileSync(data.fileName, format(cfg.csv.fee, Number(tx.fee / 1e8).toFixed(8), data.coin, tx.id, data.account, TimeStr(tx.timestamp), cfg.fiat_currency, "Second Signature Creation Fee"));
}

//---------------------------------------
// delegate registration
function delegateTx(tx) {
  fs.appendFileSync(data.fileName, format(cfg.csv.fee, Number(tx.fee / 1e8).toFixed(8), data.coin, tx.id, data.account, TimeStr(tx.timestamp), cfg.fiat_currency, "Delegate Registration Fee"));
}

//---------------------------------------
// vote
function voteTx(tx) {
  fs.appendFileSync(data.fileName, format(cfg.csv.fee, Number(tx.fee / 1e8).toFixed(8), data.coin, tx.id, data.account, TimeStr(tx.timestamp), cfg.fiat_currency, "Voting Fee"));
}

//---------------------------------------
// multisignature creation
function multisigTx(tx) {
  fs.appendFileSync(data.fileName, format(cfg.csv.fee, Number(tx.fee / 1e8).toFixed(8), data.coin, tx.id, data.account, TimeStr(tx.timestamp), cfg.fiat_currency, "Multisig Creation Fee"));
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

function main(coin, node, account, idx, async_cb) {
  data.ofs = 0;
  data.coin = coin;
  data.node = node;
  data.account = account.id;
  data.accountName = account.name || account.comment;
  data.async_cb = async_cb;
  data.fileName = cfg.outputDir + CurrentTimeStr() + '_' + coin + '_WALLETS.csv';
  data.fileNameExt = cfg.outputDir + CurrentTimeStr() + '_' + coin + '_WALLETS_ext.csv';
  data.newApi = node.newApi;
  data.notFound = []; // accountID not found in accountData

  console.log('Importing account %s (%s) ...', data.account, data.accountName);

  if (idx == 0) {
    if (cfg.outputDir)
      mkdir(cfg.outputDir);

    if (fs.existsSync(data.fileName))
      fs.unlinkSync(data.fileName);
    fs.writeFileSync(data.fileName, cfg.csv.header);

    // create csv for external accounts only if needed
    if (Object.keys(cfg.accountDatas.external).length) {
      if (fs.existsSync(data.fileNameExt))
        fs.unlinkSync(data.fileNameExt);
      fs.writeFileSync(data.fileNameExt, cfg.csv.header);
    }
  }


  apiGet('/api/transactions/', data.newApi ? {
    senderIdOrRecipientId: data.account,
    sort: 'timestamp:asc'
  } : {
    senderId: data.account,
    recipientId: data.account,
    orderBy: 'timestamp:asc'
  }, txCallback);
}

//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------
//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// start:

program
  .version(getPackageVersion())
  //  .option('-d, --debug', 'output extra debugging')
  .option('-c, --config <configFile>', 'configFile to use', './config/get_tx_config.json')
  .parse(process.argv);

const cfg = LoadConfigFile(program.opts().config);

let data = {};

// remember the accounts to analyse
cfg.accountDatas.internal = {};
for (let coin in cfg.accounts) {
  cfg.accounts[coin].forEach(element => {
    if (!element.name)
      element.name = element.comment || element.id;
    cfg.accountDatas.internal[element.id] = element;
  });
}

async.eachOfSeries(cfg.accounts.lisk,
  function (account, idx, cb) {
    main('LSK', cfg.nodes.lisk, account, idx, cb);
  },
  function (err) {
    if (err)
      console.log(yellow(err));

    async.eachOfSeries(cfg.accounts.shift,
      function (account, idx, cb) {
        main('SHIFT', cfg.nodes.shift, account, idx, cb);
      },
      function (err) {
        if (err)
          console.log(yellow(err));

        async.eachOfSeries(cfg.accounts.rise,
          function (account, idx, cb) {
            main('RISE', cfg.nodes.rise, account, idx, cb);
          },
          function (err) {
            if (err)
              console.log(yellow(err));

            async.eachOfSeries(cfg.accounts.oxy,
              function (account, idx, cb) {
                main('OXY', cfg.nodes.oxy, account, idx, cb);
              },
              function (err) {
                if (err)
                  console.log(yellow(err));

              });
          });
      });
  });