// require("@uniswap/hardhat-v3-deploy");
require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-toolbox");
require("hardhat-tracer");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: "0.8.24",
    networks: {
        hardhat: {
            chainId: 1,
            loggingEnabled: true,
            // gasPrice: 1,
        }
    }
};
