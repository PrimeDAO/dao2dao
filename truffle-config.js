require('dotenv').config();
let HDWalletProvider = require("@truffle/hdwallet-provider");

module.exports = {
    networks: {
        mainnet: {
            provider: () => new HDWalletProvider(process.env.KEY, process.env.PROVIDER),
            network_id: 1,       // mainnet
            gas: 2000000,
            gasPrice: 65000000000,  // check https://ethgasstation.info/
            confirmations: 2,    // # of confs to wait between deployments. (default: 0)
            timeoutBlocks: 200,  // # of blocks before a deployment times out  (minimum/default: 50)
            skipDryRun: false     // Skip dry run before migrations? (default: false for public nets )
        },
        kovan: {
            provider: function() {
                return new HDWalletProvider(process.env.KEY, process.env.PROVIDER);
            },
            network_id: 42,
            networkCheckTimeout: 100000000
        },
        rinkeby: {
            provider: function() {
                return new HDWalletProvider(process.env.KEY, process.env.PROVIDER);
            },
            network_id: 4,
            networkCheckTimeout: 100000000
        },
    },
    plugins: ["solidity-coverage"],
    compilers: {
        solc: {
            version: "0.5.13",
            settings: {
                optimizer: {
                    enabled: true,
                    runs: 200
                },
            }
        }
    }
};
