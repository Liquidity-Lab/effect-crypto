// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { aeWETH } from "@arbitrum/token-bridge-contracts/contracts/tokenbridge/libraries/aeWETH.sol";
import { L2GatewayToken } from "@arbitrum/token-bridge-contracts/contracts/tokenbridge/libraries/L2GatewayToken.sol";

contract ETHLabs is aeWETH {
    // Define the supply of ETHLabs: 1,000,000
    uint256 public constant initialSupply = 1000000 * (10**18);


    // Constructor will be called on contract creation
    constructor() {
        L2GatewayToken._initialize("ETHLabs", "WETH", 18, address(this), address(0));
    }
}
