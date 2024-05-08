// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract USDCLabs is ERC20 {

    // Define the supply of USDCLabs: 4,000,000
    uint256 public constant initialSupply = 4000000 * (10**6);


    // Constructor will be called on contract creation
    constructor() ERC20("USDCLabs", "LUSDC") {
        _mint(msg.sender, initialSupply);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}