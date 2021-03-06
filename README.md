# cointracking_dpos

Forging reports for <https://cointracking.info>

**cointracking_dpos** is a script collection to create forging reports usable with
<https://cointracking.info>.

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

``` bash
sudo apt install nodejs npm git
```

Clone the git repository:

``` bash
git clone https://github.com/TheGoldenEye/cointracking_dpos
```

## 2 Install

This repo uses yarn packet manager to organise the code. As such, after cloning,
its dependencies should be installed via yarn package manager, not via npm,
the latter will result in broken dependencies.  
Install yarn, if you haven't already:

``` bash
sudo npm install -g yarn
```

Use yarn to install the dependencies:

``` bash
cd cointracking_dpos
yarn
```

## 3 get_forging.js script

The script creates a detailed report of forged coins in a given timeframe on a daily basis.  
After the import the data is considered in the "Tax Report", section "Income Report"

### 3.1 Configuration

Configuration is done with `config/get_forging_config.json` file. Please save the config
template file `config/get_forging_config_tpl.json` as `config/get_forging_config.json`.
(This is also done automatically at first start.)

`start` and `end` defines the time intervall

`outputDir` is the directory where the csv files will be created

If `zeroCostBase` is set to true (default: false), all forged coins are valued
at zero cost (in fiat currency), otherwise they are valued at market prices.

In the `accounts` section you can define the delegate data and which coins you want to use.

* If `use` is set to true, then the data for this coin are queried
* `exch` defines the 'exchange' shown in cointracking, any value is possible
* `id`, `name` and `pk` are the accountID, name and public key of a **delegate** account

In the `nodes` section you can change the defaults and define your own nodes to
use (**node must allow API access**)

* `newApi`: the core 1.0 API should be used or not
* `host`: the hostname or IP address of the node to query
* `port`: the port number

In the `csv` section you can overwrite the templates for the header and the data
lines in the csv file (e.g. adaptation to other languages)

### 3.2 Start

``` bash
node get_forging.js [-c <configFile>] [-y <year>]
```

With the option -c you can define another config file.  
The option -y forces the output to the given year (overwrites the start/end settings in the configuration).  
The output files are written to the configured `outputDir` directory.

## 4 get_tx.js script

The script analyses the given accounts and creates a detailed report of all
transactions (sharing rewards, donations, deposit/withdrawal, ...).

You can classify accounts in 4 categories:

1. your own accounts (the accounts to be analyzed are automatically in this category)  
If `createInternalTx` is enabled, the script creates deposit/withdrawal
transactions between the accounts (no tax relevance)
2. external accounts  
Transactions *from* or *to* external accounts have tax relevance, they are
declared as *Income* or *Spent* transactions in Cointracking. You can use this
account type, if you have to differentiate between commercial and private
earnings. If external accounts exist, the script creates matching
*Income*/*Spent* transactions in two csv files. The 2nd one is for import in
another Cointracking Instance (of the external accounts).
3. accounts to ignore  
Transactions from or to these accounts are ignored. You can use this for own accounts,
which are not in the list of accounts to analyze or for other reasons.  
**Handle these transactions with caution, especially on the tax relevance.**
4. all other accounts  
The remaining accounts are considered as accounts from which you received
sharing rewards or to whom you donated. After the import you can find the
the data in the "Tax Report", sections "Income Report" (Gift) and Donation Report.

### 4.1 Configuration

Configuration is done with `config/get_tx_config.json` file.
Please save the config template file `config/get_tx_config_tpl.json` as `config/get_tx_config.json`.
(This is also done automatically at first start.)

`outputDir` is the directory where the csv files will be created

If `createInternalTx` is set to true (default: false), internal transactions between the analysed accounts are considered (creates Deposit/Withdrawal transaction pairs for account transfers).
This setting overwrites the ignore list (see later) for internal transactions.

If `zeroCostBase` is set to true (default: false), all transactions are valued at zero cost (in fiat currency), otherwise they are valued at market prices.

The `fiat_currency` is only used for fee transactions and transactiions with zero cost base.

In the `accounts` section you have to define the accounts to analyse. You should delete the dummy entries here.
You can use the comment field for your own purposes.

For each account all transactions will be checked:

* Outgoing transactions to
  * own account: Create "Withdrawal" (if `createInternalTx` is set)
  * external account: Create a "Spent" and a corresponding "Income" record in the 2nd *_ext.csv
  * ignored account: -
  * all other accounts: Create a "Donation" to the account (user)
* Incoming transactions from
  * own account: Create "Deposit" (if `createInternalTx` is set)
  * external account: Create "Income" and a corresponding "Spend" record in the 2nd *_ext.csv
  * ignored account: -
  * all other accounts: Create a "Gift" from the account (user)

In the `nodes` section you can change the defaults and define your own nodes to use (**node must allow API access**)

* `newApi`: the core 1.0 API should be used or not
* `host`: the hostname or IP address of the node to query
* `port`: the port number

In the `csv` section you can overwrite the templates for the header and the different data lines in the csv file (e.g. adaptation to other languages)

Additionally you can add indirect transfers (who went through an exchange, for example) as normal deposit/withdrawals between your accounts.
In the `indirectTx` section you can configure such detours:
Lets say the tx 12345678901234567890 sends 60 LSK to bittrex, a 2nd tx sends 50 LSK back to account 11111111111111111111L.
With the following configuration you will get:

* one tx over 50 LSK from your account directly to 11111111111111111111L
* one tx with the remaining 10 LSK from your account to the original destination of tx 12345678901234567890 (e.g. bittrex).

``` text
"indirectTx": {
    "12345678901234567890": { "account": "11111111111111111111L", "amount": "5000000000", "comment": "over bittrex" }
  },
```

The `accountDatas` section consists of three lists, the `ignore` and the `external` list where described above.
The 3rd list, the `accountDatas.names` list, implements an accounID->Name Mapping. If the script find an account in this list, the name is used in the csv file instead of the account address.

### 4.2 Start

``` bash
node get_tx.js [-c <configFile>]
```

With the option -c you can define another config file.  
The output files are written to the configured `outputDir` directory.

## 5 Authors

* Goldeneye

## 6 License

Apache-2.0

Copyright (c) 2018 GoldenEye

**Disclaimer:
The scripts are provided as-is. I cannot give a guarantee for accuracy and I assume NO LIABILITY.
The tool can only support you in the data preparation for the tax return, in the end you are responsible yourself for your data.**
