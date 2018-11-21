# cointracking_dpos
Forging reports for https://cointracking.info

**cointracking_dpos** is a script collection to create forging reports usable with
https://cointracking.info.

Cointracking service helps you with tax return.
The created csv files can be imported in the cointracking database using the menu:

*Enter Coins | Bulk Imports | CSV Import*

The following coins are supported:
* Lisk
* Shift
* Oxycoin
* Rise


## 1 Prerequisites

Install nodejs, npm and git
```
sudo apt install nodejs npm git
```

Clone the git repository:
```
git clone https://github.com/TheGoldenEye/cointracking_dpos
```

## 2 Install
```
cd cointracking_dpos
npm install
```

## 3 get_forging.js script

The script creates a detailed report of forged coins in a given timeframe on a daily basis.
After the import the data is considered in the "Tax Report", section "Income Report"

### 3.1 Configuration
Configuration is done with `get_forging_config.json` file. Please save the `get_forging_config_tpl.json` file as `get_forging_config.json`.

`start` and `end` defines the time intervall

`outputDir` is the directory where the csv files will be created

In the `accounts` section you can define the delegate data and which coins you want to use.
* If `use` is set to true, then the data for this coin are queried
* `exch` defines the 'exchange' shown in cointracking, any value is possible
* `id`, `name` and `pk` are the accountID, name and public key of a **delegate** account

In the `nodes` section you can change the defaults and define your own nodes to use (**node must allow API access**)
* `newApi`: the core 1.0 API should be used or not
* `host`: the hostname or IP address of the node to query
* `port`: the port number

In the `csv` section you can overwrite the templates for the header and the data lines in the csv file (e.g. adaptation to other languages)

### 3.2 Start
```
node get_forging.js
```
The output files are written to the configured `outputDir` directory.

## 4 get_tx.js script

The script creates a detailed report of sharing rewards and donations for the given accounts.
After the import the data is considered in the "Tax Report", sections "Income Report" and Donation Report

### 4.1 Configuration
Configuration is done with `get_tx_config.json` file. Please save the `get_tx_config_tpl.json` file as `get_tx_config.json`.

`outputDir` is the directory where the csv files will be created

If `createInternalTx` is set to true, internal transactions between the analysed accounts are considered (creates Deposit/Withdrawal pairs for account transfers).
This setting overwrites the ignore list (see later) for internal transactions.

In the `accounts` section you have to define the accounts to analyse. You should delete the dummy entries here.
You can use the comment field for your own purposes.

For each account all transactions will be checked:
* Outgoing transactions are considered as donations to other (foreign) accounts / users etc.
* Incoming transactions are considered as gift from other accounts / users etc.

To filter out tx to/from own accounts, exchange accounts or other accounts to ignore, please use the `accountDatas.ignore` list

In the `nodes` section you can change the defaults and define your own nodes to use (**node must allow API access**)
* `newApi`: the core 1.0 API should be used or not
* `host`: the hostname or IP address of the node to query
* `port`: the port number

In the `csv` section you can overwrite the templates for the header and the different data lines in the csv file (e.g. adaptation to other languages)

The `accountDatas` section consists of two lists, an ignore and a names list. Each entry defines an accountID, the associated account name and an optional comment field (not used by the script).
* `accountDatas.ignore`: Outgoing tx to and incoming tx from these accounts will be ignored.
Here you should define all accounts of yourself, your exchange deposit addresses and all the accounts you want not consider for other reasons.
* `accountDatas.names`: This list implements a accounID->Name Mapping. If the script find an account in this list, the name is used in the csv file instead of the account address.


### 4.2 Start
```
node get_tx.js
```
The output files are written to the configured `outputDir` directory.

## 5 Authors
- Goldeneye

## 6 License
Apache-2.0

Copyright (c) 2018 GoldenEye
