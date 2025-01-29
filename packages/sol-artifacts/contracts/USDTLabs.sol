// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract USDTLabs is ERC20 {

    // Define the supply of USDTLabs: 4,000,000
    uint256 public constant initialSupply = 4000000 * (10**6);


    // Constructor will be called on contract creation
    constructor() ERC20("USDTLabs", "LUSDT") {
        _mint(msg.sender, initialSupply);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}