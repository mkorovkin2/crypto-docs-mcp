---
name: polymarket-fee-knowledge
description: Deep knowledge about Polymarket maker/taker fee structure for 15-minute crypto markets, fee calculations, and maker rebate optimization. Invoke when building trading bots that need fee awareness.
allowed-tools: Read, Write, Grep, Glob
---

# Polymarket Fee Knowledge

Comprehensive knowledge base for Polymarket fees on 15-minute crypto markets (BTC, ETH, SOL, XRP).

## When This Skill Activates

- Building a Polymarket trading bot for 15-minute crypto markets
- Calculating fees or break-even prices
- Optimizing for maker rebates vs taker fees
- Questions about fee formulas or asymmetric fee effects

---

## Fee Structure Overview

### Which Markets Have Fees?

| Market Type | Maker Fee | Taker Fee |
|-------------|-----------|-----------|
| **Most Markets** | 0% | 0% |
| **15-Minute Crypto** | 0% + rebates | Variable (see below) |
| **US DCM (Future)** | 0% | 0.01% flat |

**Only 15-minute crypto markets (BTC, ETH, SOL, XRP up/down predictions) have fees.**

---

## Official Fee Formulas

From the [CTF Exchange documentation](https://github.com/Polymarket/ctf-exchange/blob/main/docs/Overview.md):

### Case 1: Selling Tokens for USDC

```
feeQuote = baseRate × min(price, 1-price) × size
```

Fee is denominated in **USDC** and deducted from proceeds.

### Case 2: Buying Tokens with USDC

```
feeBase = baseRate × min(price, 1-price) × (size / price)
```

Fee is denominated in **tokens** and deducted from tokens received.

### The baseRate

- Query via API: `GET https://clob.polymarket.com/fee-rate?token_id={token_id}`
- Returns `fee_rate_bps`: 0 for fee-free, 1000 for 15-min crypto markets
- baseRate = fee_rate_bps / 10000 (e.g., 1000 bps → 0.10)

---

## Concrete Fee Examples

From [Polymarket Maker Rebates docs](https://docs.polymarket.com/developers/market-makers/maker-rebates-program):

### At Price = $0.50 (100 shares)

| Action | Fee Amount | Fee Denomination | Effective Rate |
|--------|------------|------------------|----------------|
| **Buy** | 1.56 tokens | Tokens | ~1.6% of cost |
| **Sell** | $1.56 | USDC | ~3.1% of proceeds |

### Key Insight: Asymmetric Effective Rates

The fee **value** differs between buying and selling due to denomination:
- **Buying**: Fee in tokens → lower effective rate on USDC spent
- **Selling**: Fee in USDC → higher effective rate on USDC received

### Peak Effective Rates

From the docs:
- **Buying at extreme prices**: Up to ~50% effective rate
- **Selling at extreme prices**: Up to ~30% effective rate

---

## Fee Calculator Implementation

```python
class PolymarketFeeCalculator:
    """
    Calculate fees for Polymarket 15-minute crypto markets.

    IMPORTANT: These formulas match official docs but should be
    verified with small test orders before production use.
    """

    MIN_FEE_PRECISION = 0.0001  # Fees below this round to zero

    def __init__(self, client=None):
        self.client = client
        self._fee_cache = {}

    def get_fee_rate_bps(self, token_id: str) -> int:
        """
        Get fee rate for a market.

        Returns:
            0 for fee-free markets (most markets)
            1000 for 15-minute crypto markets
        """
        if self.client and token_id not in self._fee_cache:
            self._fee_cache[token_id] = self.client.get_fee_rate_bps(token_id)
        return self._fee_cache.get(token_id, 0)

    def calculate_sell_fee(
        self,
        price: float,
        size: float,
        fee_rate_bps: int
    ) -> float:
        """
        Calculate fee when SELLING tokens for USDC.

        Formula: feeQuote = baseRate × min(price, 1-price) × size
        Fee denominated in USDC, deducted from proceeds.

        Args:
            price: Order price (0 to 1)
            size: Number of tokens to sell
            fee_rate_bps: Fee rate (0 or 1000)

        Returns:
            Fee in USDC
        """
        if fee_rate_bps == 0:
            return 0.0

        base_rate = fee_rate_bps / 10000
        min_price = min(price, 1 - price)
        fee = base_rate * min_price * size

        return 0.0 if fee < self.MIN_FEE_PRECISION else round(fee, 4)

    def calculate_buy_fee(
        self,
        price: float,
        size: float,
        fee_rate_bps: int
    ) -> dict:
        """
        Calculate fee when BUYING tokens with USDC.

        Formula: feeBase = baseRate × min(price, 1-price) × (size/price)
        Fee denominated in TOKENS, deducted from tokens received.

        Args:
            price: Order price (0 to 1)
            size: Number of tokens to buy
            fee_rate_bps: Fee rate (0 or 1000)

        Returns:
            dict with fee_tokens and fee_usdc_value
        """
        if fee_rate_bps == 0:
            return {'fee_tokens': 0.0, 'fee_usdc_value': 0.0}

        base_rate = fee_rate_bps / 10000
        min_price = min(price, 1 - price)
        fee_tokens = base_rate * min_price * (size / price)
        fee_usdc = fee_tokens * price

        if fee_usdc < self.MIN_FEE_PRECISION:
            return {'fee_tokens': 0.0, 'fee_usdc_value': 0.0}

        return {
            'fee_tokens': round(fee_tokens, 4),
            'fee_usdc_value': round(fee_usdc, 4)
        }

    def calculate_net_proceeds_sell(
        self,
        price: float,
        size: float,
        fee_rate_bps: int
    ) -> dict:
        """Calculate net USDC after selling tokens."""
        gross = price * size
        fee = self.calculate_sell_fee(price, size, fee_rate_bps)
        net = gross - fee

        return {
            'gross_proceeds': round(gross, 4),
            'fee_usdc': fee,
            'net_proceeds': round(net, 4),
            'effective_price': round(net / size, 6) if size > 0 else 0
        }

    def calculate_tokens_received_buy(
        self,
        price: float,
        size: float,
        fee_rate_bps: int
    ) -> dict:
        """Calculate tokens received after buying (minus fee)."""
        cost = price * size
        fee_info = self.calculate_buy_fee(price, size, fee_rate_bps)
        tokens_received = size - fee_info['fee_tokens']

        return {
            'cost_usdc': round(cost, 4),
            'fee_tokens': fee_info['fee_tokens'],
            'fee_usdc_value': fee_info['fee_usdc_value'],
            'tokens_received': round(tokens_received, 4),
            'effective_price': round(cost / tokens_received, 6) if tokens_received > 0 else 0
        }
```

---

## Fee Symmetry Explained

The formulas ensure **complementary position symmetry**:

> "Someone selling 100 shares of A @ $0.99 should pay the same fee VALUE as someone buying 100 A' @ $0.01"

### Example: Complementary Trades

| Trade | Fee Formula | Fee Amount | Fee Value |
|-------|-------------|------------|-----------|
| Sell 100 YES @ $0.99 | 0.10 × 0.01 × 100 | $0.10 USDC | $0.10 |
| Buy 100 NO @ $0.01 | 0.10 × 0.01 × 100 / 0.01 | 10 tokens | $0.10 |

Both have **equal USDC value** despite different denominations.

---

## Maker Rebates Program

For 15-minute crypto markets:

### How It Works

1. **100% of taker fees** redistributed to makers
2. **Daily distribution** at midnight UTC
3. **Proportional** to your executed maker volume
4. **Direct USDC payment** to your wallet

### Maker vs Taker Classification

| Order Behavior | Classification |
|----------------|----------------|
| Rests on book (adds liquidity) | **Maker** → earns rebates |
| Immediately matches (removes liquidity) | **Taker** → pays fees |
| GTC that partially fills then rests | Taker for matched portion, Maker for rest |
| FOK/IOC orders | Always **Taker** |

### Strategy Implication

**On 15-minute crypto markets:**
- Taker orders: Pay fees (up to ~3% at 50% price)
- Maker orders: **Earn rebates** (negative effective fees)

```python
def should_use_maker_strategy(fee_rate_bps: int) -> bool:
    """
    Returns True if maker strategy earns rebates.
    Only applies to fee-enabled markets (15-min crypto).
    """
    return fee_rate_bps > 0
```

---

## Fee Impact by Price

The `min(price, 1-price)` factor means fees vary with price:

| Price | min(p, 1-p) | Relative Fee |
|-------|-------------|--------------|
| $0.50 | 0.50 | **Maximum** |
| $0.30 / $0.70 | 0.30 | 60% of max |
| $0.10 / $0.90 | 0.10 | 20% of max |
| $0.01 / $0.99 | 0.01 | 2% of max |

**Strategy**: Trading at extreme prices (near 0 or 1) minimizes fees.

---

## API Integration

### Fetching Fee Rate

```python
# Check if market has fees
fee_rate = client.get_fee_rate_bps(token_id)

if fee_rate == 0:
    print("Fee-free market")
elif fee_rate == 1000:
    print("15-minute crypto market - fees apply")
```

### Creating Orders with Fee Rate

```python
from py_clob_client.clob_types import OrderArgs

# Always include fee_rate_bps in order
order_args = OrderArgs(
    token_id=token_id,
    price=0.50,
    size=100.0,
    side=BUY,
    fee_rate_bps=client.get_fee_rate_bps(token_id)
)

signed_order = client.create_order(order_args)
```

---

## Bot Implementation Checklist

- [ ] Query `fee_rate_bps` for each market before trading
- [ ] Use 0 for most markets, expect 1000 for 15-min crypto
- [ ] Apply correct formula based on BUY vs SELL
- [ ] Account for fee denomination (tokens vs USDC)
- [ ] Consider maker-only strategy on fee-enabled markets
- [ ] Test with small orders to verify fee calculations
- [ ] Track maker rebates if using liquidity provision strategy

---

## Important Notes

1. **Most markets are fee-free** - only 15-min crypto has fees
2. **Fees are asymmetric** in effective rate due to denomination
3. **Maker rebates** can make providing liquidity profitable
4. **Verify with test orders** - exact fee behavior may have undocumented nuances

---

## Sources

- [Trading Fees - Polymarket Docs](https://docs.polymarket.com/polymarket-learn/trading/fees)
- [Maker Rebates Program](https://docs.polymarket.com/developers/market-makers/maker-rebates-program)
- [CTF Exchange Overview](https://github.com/Polymarket/ctf-exchange/blob/main/docs/Overview.md)
- [py-clob-client GitHub](https://github.com/Polymarket/py-clob-client)
