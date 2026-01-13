# Getting Started with Litecoin Core

> Complete installation and setup guide for Litecoin Core v0.21.4.0

## Overview

Litecoin Core is the official reference implementation of the Litecoin protocol. This guide will help you install, configure, and run your own Litecoin node.

## System Requirements

### Minimum Hardware

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 1 GHz | 2+ GHz multi-core |
| RAM | 1 GB | 2 GB+ |
| Disk | 50 GB | 250 GB+ SSD |
| Network | Broadband | Unmetered |

### Software Requirements

- **Linux**: Ubuntu 18.04+ or equivalent
- **macOS**: 10.14 Mojave or later
- **Windows**: Windows 10 64-bit or later

## Installation Methods

### Method 1: Pre-built Binaries (Recommended)

Download from [litecoin.org](https://litecoin.org) or [GitHub Releases](https://github.com/litecoin-project/litecoin/releases).

```bash
# Linux
tar -xzf litecoin-0.21.4-x86_64-linux-gnu.tar.gz
sudo install -m 0755 -t /usr/local/bin litecoin-0.21.4/bin/*

# Verify
litecoind --version
```

### Method 2: Build from Source

```bash
# Install dependencies (Ubuntu/Debian)
sudo apt-get install build-essential libtool autotools-dev automake \
  pkg-config bsdmainutils python3 libssl-dev libevent-dev \
  libboost-system-dev libboost-filesystem-dev libboost-test-dev \
  libboost-thread-dev libfmt-dev

# Clone and build
git clone https://github.com/litecoin-project/litecoin.git
cd litecoin
./autogen.sh
./configure
make -j$(nproc)
sudo make install
```

See [Building from Source](building-from-source.md) for detailed instructions.

## Configuration

### Data Directory Locations

| Platform | Default Location |
|----------|------------------|
| Linux | `~/.litecoin/` |
| macOS | `~/Library/Application Support/Litecoin/` |
| Windows | `%APPDATA%\Litecoin\` |

### Basic Configuration

Create `litecoin.conf` in your data directory:

```ini
# Run as daemon
daemon=1

# Enable RPC server
server=1

# Network settings
listen=1
maxconnections=125

# Performance (adjust based on RAM)
dbcache=2000

# Optional: Enable pruning to save disk space
# prune=550
```

### Security Configuration

```ini
# RPC authentication (use rpcauth for production)
rpcuser=yourusername
rpcpassword=strongpassword
rpcallowip=127.0.0.1

# Or use cookie authentication (default, more secure)
# RPC credentials stored in .cookie file
```

## First Run

### Starting the Node

```bash
# GUI mode
litecoin-qt

# Daemon mode (background)
litecoind -daemon

# Check if running
litecoin-cli getblockchaininfo
```

### Initial Block Download (IBD)

When first running, Litecoin Core must download and verify the entire blockchain:

- **Duration**: 4-24 hours depending on hardware
- **Data**: ~50 GB (unpruned)
- **CPU/Disk intensive**: Normal during sync

**Monitor progress:**

```bash
litecoin-cli getblockchaininfo | grep -E "blocks|headers|verificationprogress"
```

### Speed Up Sync

```bash
# Use more RAM for database cache
litecoind -daemon -dbcache=4096

# Use SSD storage
# Enable assumevalid (default, skips old signature checks)
```

## Wallet Setup

### Create a Wallet

```bash
# Create new wallet
litecoin-cli createwallet "mywallet"

# List wallets
litecoin-cli listwallets

# Get new receiving address
litecoin-cli -rpcwallet=mywallet getnewaddress
```

### Generate Different Address Types

```bash
# Legacy (L... prefix)
litecoin-cli getnewaddress "" legacy

# P2SH-SegWit (M... prefix)
litecoin-cli getnewaddress "" p2sh-segwit

# Native SegWit (ltc1... prefix) - recommended
litecoin-cli getnewaddress "" bech32

# MWEB (privacy)
litecoin-cli getnewaddress "" mweb
```

### Encrypt Your Wallet

```bash
litecoin-cli -rpcwallet=mywallet encryptwallet "your-strong-passphrase"
# Node will restart
```

### Backup Your Wallet

```bash
litecoin-cli -rpcwallet=mywallet backupwallet "/path/to/backup/wallet.dat"
```

## Basic Operations

### Check Balance

```bash
litecoin-cli -rpcwallet=mywallet getbalance
```

### Send Transaction

```bash
# Unlock wallet (if encrypted)
litecoin-cli -rpcwallet=mywallet walletpassphrase "passphrase" 300

# Send
litecoin-cli -rpcwallet=mywallet sendtoaddress "ltc1recipient..." 1.5

# Lock wallet
litecoin-cli -rpcwallet=mywallet walletlock
```

### Check Transaction

```bash
litecoin-cli -rpcwallet=mywallet gettransaction "txid"
```

## Stopping the Node

```bash
litecoin-cli stop
```

Wait for graceful shutdown before restarting.

## Network Ports

| Network | P2P Port | RPC Port |
|---------|----------|----------|
| Mainnet | 9333 | 9332 |
| Testnet | 19335 | 19332 |
| Regtest | 19444 | 19443 |

## Next Steps

- [Quick Start Guide](quick-start-guide.md) - Common operations
- [Configuration Reference](configuration.md) - All options
- [RPC API Reference](api-reference.md) - Full command list
- [MWEB Guide](modules/mweb/) - Privacy features

## Troubleshooting

### "Cannot obtain a lock on data directory"

Another instance is running. Stop it first:
```bash
litecoin-cli stop
# or
pkill litecoind
```

### Sync stuck

- Check disk space
- Increase `-dbcache`
- Check `debug.log` for errors
- Try `-reindex` if database corrupted

### Connection issues

- Forward port 9333 on router
- Check firewall settings
- Use `-addnode=<ip>` to add peers manually

## Resources

- **Website**: [litecoin.org](https://litecoin.org)
- **GitHub**: [litecoin-project/litecoin](https://github.com/litecoin-project/litecoin)
- **Documentation**: [/doc](https://github.com/litecoin-project/litecoin/tree/master/doc)

---

**License**: MIT
**Documentation Version**: 1.0.0
