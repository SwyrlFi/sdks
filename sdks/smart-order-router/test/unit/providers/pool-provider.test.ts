import { Token } from '@swyrlfi/sdk-core';

import {
  computePoolAddress,
  USDC_SONIC,
} from '../../../src/providers';
import { computeV2PoolAddress } from '../../../src/providers/v2/pool-provider';
import {
  ChainId,
  V3_CORE_FACTORY_ADDRESSES,
  WRAPPED_NATIVE_CURRENCY,
} from '../../../src/util';
import { SONIC_V2_PAIR_FACTORY_ADDRESS } from '../../../src/util/addresses';

describe('computePoolAddress', () => {
  // 测试用的代币
  const USDC = USDC_SONIC;

  const WS = WRAPPED_NATIVE_CURRENCY[ChainId.SONIC]!;

  // 已知的池子地址（需要替换为实际部署的地址）
  const KNOWN_POOL_ADDRESSES = {
    'USDC-WS-50': '0x324963c267C354c7660Ce8CA3F5f167E05649970', // 替换为实际地址
  };

  test('computes pool address correctly for USDC-WS with different tickSpacing', () => {
    // 测试不同的 tickSpacing
    const tickSpacings = [50];

    tickSpacings.forEach((tickSpacing) => {
      const computedAddress = computePoolAddress({
        factoryAddress: V3_CORE_FACTORY_ADDRESSES[ChainId.SONIC]!,
        tokenA: USDC,
        tokenB: WS,
        tickSpacing,
      });

      // 验证计算出的地址与已知地址匹配
      expect(computedAddress.toLowerCase()).toBe(
        KNOWN_POOL_ADDRESSES[`USDC-WS-50`].toLowerCase()
      );
    });
  });

  test('computes same address regardless of token order', () => {
    const tickSpacing = 10;

    // 先 USDC 后 WS
    const address1 = computePoolAddress({
      factoryAddress: V3_CORE_FACTORY_ADDRESSES[ChainId.SONIC]!,
      tokenA: USDC,
      tokenB: WS,
      tickSpacing,
    });

    // 先 WS 后 USDC
    const address2 = computePoolAddress({
      factoryAddress: V3_CORE_FACTORY_ADDRESSES[ChainId.SONIC]!,
      tokenA: WS,
      tokenB: USDC,
      tickSpacing,
    });

    expect(address1.toLowerCase()).toBe(address2.toLowerCase());
  });

  test('computes different addresses for different tickSpacing', () => {
    // USDC-WS with different tickSpacing
    const address1 = computePoolAddress({
      factoryAddress: V3_CORE_FACTORY_ADDRESSES[ChainId.SONIC]!,
      tokenA: USDC,
      tokenB: WS,
      tickSpacing: 10,
    });

    const address2 = computePoolAddress({
      factoryAddress: V3_CORE_FACTORY_ADDRESSES[ChainId.SONIC]!,
      tokenA: USDC,
      tokenB: WS,
      tickSpacing: 50,
    });

    expect(address1.toLowerCase()).not.toBe(address2.toLowerCase());
  });
});

describe('computeV2PoolAddress', () => {
  // 测试用的代币
  const USDC = USDC_SONIC;
  const WS = WRAPPED_NATIVE_CURRENCY[ChainId.SONIC]!;
  const SHADOW = new Token(
    ChainId.SONIC,
    '0x3333b97138D4b086720b5aE8A7844b1345a33333',
    18,
    'SHADOW',
    'Shadow Token'
  );

  // 已知的池子地址（需要替换为实际部署的地址）
  const KNOWN_V2_POOL_ADDRESSES = {
    'WS-SHADOW-Volatile': '0xF19748a0E269c6965a84f8C98ca8C47A064D4dd0', // 替换为实际的稳定池地址
  };

  test('computes V2 pool address correctly for WS-SHADOW with stable flags', () => {
    const computedAddress = computeV2PoolAddress({
      factoryAddress: SONIC_V2_PAIR_FACTORY_ADDRESS,
      tokenA: WS,
      tokenB: SHADOW,
      stable: false,
    });

    console.log('computedAddress', computedAddress);

    // 验证计算出的地址与已知地址匹配
    const expectedAddress = KNOWN_V2_POOL_ADDRESSES['WS-SHADOW-Volatile'];
    expect(computedAddress.toLowerCase()).toBe(expectedAddress.toLowerCase());
  });

  test('computes same V2 address regardless of token order', () => {
    // 测试稳定池
    const stableAddress1 = computeV2PoolAddress({
      factoryAddress: SONIC_V2_PAIR_FACTORY_ADDRESS,
      tokenA: USDC,
      tokenB: WS,
      stable: true,
    });

    const stableAddress2 = computeV2PoolAddress({
      factoryAddress: SONIC_V2_PAIR_FACTORY_ADDRESS,
      tokenA: WS,
      tokenB: USDC,
      stable: true,
    });

    expect(stableAddress1.toLowerCase()).toBe(stableAddress2.toLowerCase());

    // 测试不稳定池
    const volatileAddress1 = computeV2PoolAddress({
      factoryAddress: SONIC_V2_PAIR_FACTORY_ADDRESS,
      tokenA: USDC,
      tokenB: WS,
      stable: false,
    });

    const volatileAddress2 = computeV2PoolAddress({
      factoryAddress: SONIC_V2_PAIR_FACTORY_ADDRESS,
      tokenA: WS,
      tokenB: USDC,
      stable: false,
    });

    expect(volatileAddress1.toLowerCase()).toBe(volatileAddress2.toLowerCase());
  });

  test('computes different V2 addresses for stable vs volatile pools', () => {
    const stableAddress = computeV2PoolAddress({
      factoryAddress: SONIC_V2_PAIR_FACTORY_ADDRESS,
      tokenA: USDC,
      tokenB: WS,
      stable: true,
    });

    const volatileAddress = computeV2PoolAddress({
      factoryAddress: SONIC_V2_PAIR_FACTORY_ADDRESS,
      tokenA: USDC,
      tokenB: WS,
      stable: false,
    });

    expect(stableAddress.toLowerCase()).not.toBe(volatileAddress.toLowerCase());
  });

  test('computes different V2 addresses for different token pairs', () => {
    // 创建一个测试用的第三个代币
    const THIRD_TOKEN = new Token(
      ChainId.SONIC,
      '0x1234567890123456789012345678901234567890',
      18,
      'TEST',
      'Test Token'
    );

    const address1 = computeV2PoolAddress({
      factoryAddress: SONIC_V2_PAIR_FACTORY_ADDRESS,
      tokenA: USDC,
      tokenB: WS,
      stable: false,
    });

    const address2 = computeV2PoolAddress({
      factoryAddress: SONIC_V2_PAIR_FACTORY_ADDRESS,
      tokenA: USDC,
      tokenB: THIRD_TOKEN,
      stable: false,
    });

    expect(address1.toLowerCase()).not.toBe(address2.toLowerCase());

    // 测试稳定池
    const stableAddress1 = computeV2PoolAddress({
      factoryAddress: SONIC_V2_PAIR_FACTORY_ADDRESS,
      tokenA: USDC,
      tokenB: WS,
      stable: true,
    });

    const stableAddress2 = computeV2PoolAddress({
      factoryAddress: SONIC_V2_PAIR_FACTORY_ADDRESS,
      tokenA: USDC,
      tokenB: THIRD_TOKEN,
      stable: true,
    });

    expect(stableAddress1.toLowerCase()).not.toBe(stableAddress2.toLowerCase());
  });

  test('computes consistent addresses across multiple calls', () => {
    const address1 = computeV2PoolAddress({
      factoryAddress: SONIC_V2_PAIR_FACTORY_ADDRESS,
      tokenA: USDC,
      tokenB: WS,
      stable: false,
    });

    const address2 = computeV2PoolAddress({
      factoryAddress: SONIC_V2_PAIR_FACTORY_ADDRESS,
      tokenA: USDC,
      tokenB: WS,
      stable: false,
    });

    expect(address1).toBe(address2);

    const stableAddress1 = computeV2PoolAddress({
      factoryAddress: SONIC_V2_PAIR_FACTORY_ADDRESS,
      tokenA: USDC,
      tokenB: WS,
      stable: true,
    });

    const stableAddress2 = computeV2PoolAddress({
      factoryAddress: SONIC_V2_PAIR_FACTORY_ADDRESS,
      tokenA: USDC,
      tokenB: WS,
      stable: true,
    });

    expect(stableAddress1).toBe(stableAddress2);
  });
});
