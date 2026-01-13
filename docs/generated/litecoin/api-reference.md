# Litecoin Core RPC API Reference

> Complete reference for all JSON-RPC commands in Litecoin Core v0.21.4

## Overview

Litecoin Core provides a JSON-RPC interface for programmatic access. Commands can be executed via `litecoin-cli` or HTTP requests.

**Default Ports:**
- Mainnet: 9332
- Testnet: 19332
- Regtest: 19443

## Authentication

```bash
# Using litecoin-cli (reads credentials from cookie/config)
litecoin-cli <command>

# Using curl with credentials
curl --user user:password --data-binary '{"jsonrpc":"1.0","method":"getblockcount","params":[]}' \
  -H 'content-type: text/plain;' http://127.0.0.1:9332/
```

---

## Blockchain Commands

### getbestblockhash
Returns the hash of the best (tip) block.

```bash
litecoin-cli getbestblockhash
```

### getblock
Returns block data for given hash.

```bash
litecoin-cli getblock "blockhash" [verbosity]
# verbosity: 0=hex, 1=json, 2=json with tx details
```

### getblockchaininfo
Returns blockchain state information.

```bash
litecoin-cli getblockchaininfo
```

**Response includes:** chain, blocks, headers, bestblockhash, difficulty, verificationprogress, pruned

### getblockcount
Returns current block height.

```bash
litecoin-cli getblockcount
```

### getblockhash
Returns block hash at given height.

```bash
litecoin-cli getblockhash <height>
```

### getblockheader
Returns block header for given hash.

```bash
litecoin-cli getblockheader "blockhash" [verbose]
```

### getchaintips
Returns information about all known chain tips.

```bash
litecoin-cli getchaintips
```

### getdifficulty
Returns current mining difficulty.

```bash
litecoin-cli getdifficulty
```

### getmempoolinfo
Returns mempool statistics.

```bash
litecoin-cli getmempoolinfo
```

### getrawmempool
Returns mempool transaction IDs.

```bash
litecoin-cli getrawmempool [verbose]
```

### gettxout
Returns details about an unspent transaction output.

```bash
litecoin-cli gettxout "txid" n [include_mempool]
```

### gettxoutsetinfo
Returns UTXO set statistics.

```bash
litecoin-cli gettxoutsetinfo
```

### verifychain
Verifies blockchain database.

```bash
litecoin-cli verifychain [checklevel] [nblocks]
```

---

## Control Commands

### getmemoryinfo
Returns memory usage information.

```bash
litecoin-cli getmemoryinfo
```

### getrpcinfo
Returns RPC server information.

```bash
litecoin-cli getrpcinfo
```

### help
Lists all commands or gets help for specific command.

```bash
litecoin-cli help [command]
```

### stop
Stops the Litecoin Core server.

```bash
litecoin-cli stop
```

### uptime
Returns server uptime in seconds.

```bash
litecoin-cli uptime
```

---

## Mining Commands

### getblocktemplate
Returns block template for mining.

```bash
litecoin-cli getblocktemplate '{"rules": ["segwit", "mweb"]}'
```

### getmininginfo
Returns mining-related information.

```bash
litecoin-cli getmininginfo
```

### getnetworkhashps
Returns estimated network hash rate.

```bash
litecoin-cli getnetworkhashps [nblocks] [height]
```

### submitblock
Submits a new block to the network.

```bash
litecoin-cli submitblock "hexdata"
```

---

## Network Commands

### addnode
Adds, removes, or tries a node connection.

```bash
litecoin-cli addnode "node" "add|remove|onetry"
```

### getaddednodeinfo
Returns info about added nodes.

```bash
litecoin-cli getaddednodeinfo ["node"]
```

### getconnectioncount
Returns number of peer connections.

```bash
litecoin-cli getconnectioncount
```

### getnettotals
Returns network traffic statistics.

```bash
litecoin-cli getnettotals
```

### getnetworkinfo
Returns network state information.

```bash
litecoin-cli getnetworkinfo
```

### getpeerinfo
Returns data about each connected peer.

```bash
litecoin-cli getpeerinfo
```

### listbanned
Returns list of banned peers.

```bash
litecoin-cli listbanned
```

### ping
Requests ping from all peers.

```bash
litecoin-cli ping
```

### setban
Adds or removes IP from banlist.

```bash
litecoin-cli setban "subnet" "add|remove" [bantime] [absolute]
```

---

## Raw Transaction Commands

### createrawtransaction
Creates an unsigned raw transaction.

```bash
litecoin-cli createrawtransaction '[{"txid":"id","vout":n}]' '{"address":amount}'
```

### decoderawtransaction
Decodes raw transaction hex.

```bash
litecoin-cli decoderawtransaction "hexstring"
```

### decodescript
Decodes a hex-encoded script.

```bash
litecoin-cli decodescript "hexstring"
```

### getrawtransaction
Returns raw transaction data.

```bash
litecoin-cli getrawtransaction "txid" [verbose] ["blockhash"]
```

### sendrawtransaction
Broadcasts a raw transaction.

```bash
litecoin-cli sendrawtransaction "hexstring" [maxfeerate]
```

### signrawtransactionwithkey
Signs raw transaction with provided keys.

```bash
litecoin-cli signrawtransactionwithkey "hexstring" '["privkey1",...]' '[{"txid":"id","vout":n,"scriptPubKey":"hex"}]'
```

### testmempoolaccept
Tests if transaction would be accepted.

```bash
litecoin-cli testmempoolaccept '["rawtx"]'
```

---

## Utility Commands

### createmultisig
Creates multisig address.

```bash
litecoin-cli createmultisig nrequired '["key1","key2",...]'
```

### deriveaddresses
Derives addresses from descriptor.

```bash
litecoin-cli deriveaddresses "descriptor" [range]
```

### estimatesmartfee
Estimates fee for confirmation in n blocks.

```bash
litecoin-cli estimatesmartfee conf_target ["estimate_mode"]
```

### getdescriptorinfo
Analyzes a descriptor.

```bash
litecoin-cli getdescriptorinfo "descriptor"
```

### signmessagewithprivkey
Signs message with private key.

```bash
litecoin-cli signmessagewithprivkey "privkey" "message"
```

### validateaddress
Validates Litecoin address.

```bash
litecoin-cli validateaddress "address"
```

### verifymessage
Verifies signed message.

```bash
litecoin-cli verifymessage "address" "signature" "message"
```

---

## Wallet Commands

### abandontransaction
Marks in-wallet transaction as abandoned.

```bash
litecoin-cli abandontransaction "txid"
```

### addmultisigaddress
Adds multisig address to wallet.

```bash
litecoin-cli addmultisigaddress nrequired '["key1",...]' ["label"] ["address_type"]
```

### backupwallet
Backs up wallet to file.

```bash
litecoin-cli backupwallet "destination"
```

### bumpfee
Bumps fee of wallet transaction (RBF).

```bash
litecoin-cli bumpfee "txid" [options]
```

### createwallet
Creates new wallet.

```bash
litecoin-cli createwallet "wallet_name" [disable_private_keys] [blank] [passphrase] [avoid_reuse] [descriptors]
```

### dumpprivkey
Reveals private key for address.

```bash
litecoin-cli dumpprivkey "address"
```

### dumpwallet
Dumps all wallet keys to file.

```bash
litecoin-cli dumpwallet "filename"
```

### encryptwallet
Encrypts wallet with passphrase.

```bash
litecoin-cli encryptwallet "passphrase"
```

### getaddressinfo
Returns information about address.

```bash
litecoin-cli getaddressinfo "address"
```

### getbalance
Returns wallet balance.

```bash
litecoin-cli getbalance ["dummy"] [minconf] [include_watchonly] [avoid_reuse]
```

### getbalances
Returns all balance types.

```bash
litecoin-cli getbalances
```

### getnewaddress
Generates new address.

```bash
litecoin-cli getnewaddress ["label"] ["address_type"]
# address_type: legacy, p2sh-segwit, bech32, mweb
```

### getrawchangeaddress
Returns new change address.

```bash
litecoin-cli getrawchangeaddress ["address_type"]
```

### getreceivedbyaddress
Returns amount received by address.

```bash
litecoin-cli getreceivedbyaddress "address" [minconf]
```

### gettransaction
Returns wallet transaction details.

```bash
litecoin-cli gettransaction "txid" [include_watchonly] [verbose]
```

### getunconfirmedbalance
Returns unconfirmed balance.

```bash
litecoin-cli getunconfirmedbalance
```

### getwalletinfo
Returns wallet state information.

```bash
litecoin-cli getwalletinfo
```

### importaddress
Imports address for watching.

```bash
litecoin-cli importaddress "address" ["label"] [rescan] [p2sh]
```

### importdescriptors
Imports descriptors.

```bash
litecoin-cli importdescriptors '[{"desc":"...","timestamp":...}]'
```

### importprivkey
Imports private key.

```bash
litecoin-cli importprivkey "privkey" ["label"] [rescan]
```

### importpubkey
Imports public key.

```bash
litecoin-cli importpubkey "pubkey" ["label"] [rescan]
```

### importwallet
Imports keys from dump file.

```bash
litecoin-cli importwallet "filename"
```

### keypoolrefill
Refills keypool.

```bash
litecoin-cli keypoolrefill [newsize]
```

### listaddressgroupings
Lists address groupings.

```bash
litecoin-cli listaddressgroupings
```

### listreceivedbyaddress
Lists amounts received by address.

```bash
litecoin-cli listreceivedbyaddress [minconf] [include_empty] [include_watchonly] ["address_filter"]
```

### listtransactions
Lists recent transactions.

```bash
litecoin-cli listtransactions ["label"] [count] [skip] [include_watchonly]
```

### listunspent
Lists unspent outputs.

```bash
litecoin-cli listunspent [minconf] [maxconf] ["addresses",...] [include_unsafe] [query_options]
```

### listwalletdir
Lists wallets in wallet directory.

```bash
litecoin-cli listwalletdir
```

### listwallets
Lists loaded wallets.

```bash
litecoin-cli listwallets
```

### loadwallet
Loads wallet from file.

```bash
litecoin-cli loadwallet "filename"
```

### lockunspent
Locks/unlocks unspent outputs.

```bash
litecoin-cli lockunspent unlock [{"txid":"id","vout":n},...]
```

### rescanblockchain
Rescans blockchain for wallet transactions.

```bash
litecoin-cli rescanblockchain [start_height] [stop_height]
```

### send
Sends transaction (simplified).

```bash
litecoin-cli send '{"address":amount}' [conf_target] ["estimate_mode"] [fee_rate] [options]
```

### sendmany
Sends to multiple addresses.

```bash
litecoin-cli sendmany "" '{"address":amount,...}' [minconf] ["comment"] ["subtractfeefrom",...] [replaceable] [conf_target] ["estimate_mode"]
```

### sendtoaddress
Sends to single address.

```bash
litecoin-cli sendtoaddress "address" amount ["comment"] ["comment_to"] [subtractfeefromamount] [replaceable] [conf_target] ["estimate_mode"] [avoid_reuse]
```

### sethdseed
Sets HD wallet seed.

```bash
litecoin-cli sethdseed [newkeypool] ["seed"]
```

### settxfee
Sets transaction fee rate.

```bash
litecoin-cli settxfee amount
```

### signmessage
Signs message with address key.

```bash
litecoin-cli signmessage "address" "message"
```

### signrawtransactionwithwallet
Signs raw transaction with wallet keys.

```bash
litecoin-cli signrawtransactionwithwallet "hexstring" [{"txid":"id","vout":n,"scriptPubKey":"hex"}] ["sighashtype"]
```

### unloadwallet
Unloads wallet.

```bash
litecoin-cli unloadwallet ["wallet_name"]
```

### walletcreatefundedpsbt
Creates funded PSBT.

```bash
litecoin-cli walletcreatefundedpsbt '[{"txid":"id","vout":n}]' '{"address":amount}' [locktime] [options] [bip32derivs]
```

### walletlock
Locks encrypted wallet.

```bash
litecoin-cli walletlock
```

### walletpassphrase
Unlocks encrypted wallet.

```bash
litecoin-cli walletpassphrase "passphrase" timeout
```

### walletpassphrasechange
Changes wallet passphrase.

```bash
litecoin-cli walletpassphrasechange "oldpassphrase" "newpassphrase"
```

### walletprocesspsbt
Updates PSBT with wallet data.

```bash
litecoin-cli walletprocesspsbt "psbt" [sign] ["sighashtype"] [bip32derivs]
```

---

## ZMQ Notifications

Configure ZMQ endpoints for real-time notifications:

```ini
# litecoin.conf
zmqpubhashblock=tcp://127.0.0.1:28332
zmqpubhashtx=tcp://127.0.0.1:28332
zmqpubrawblock=tcp://127.0.0.1:28332
zmqpubrawtx=tcp://127.0.0.1:28332
```

---

## Error Codes

| Code | Description |
|------|-------------|
| -1 | RPC_MISC_ERROR |
| -3 | RPC_TYPE_ERROR |
| -4 | RPC_INVALID_ADDRESS_OR_KEY |
| -5 | RPC_INVALID_PARAMETER |
| -8 | RPC_WALLET_ERROR |
| -25 | RPC_WALLET_UNLOCK_NEEDED |
| -26 | RPC_WALLET_PASSPHRASE_INCORRECT |

---

## See Also

- [C++ API Reference](cpp-api-reference.md)
- [Examples](examples/)
- [Configuration](configuration.md)

---

**Documentation Version**: 1.0.0
**Litecoin Core Version**: 0.21.4
