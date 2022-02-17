require("@nomiclabs/hardhat-waffle");
const keys = require("./keys");
/**
 * @type import('hardhat/config').HardhatUserConfig
 */


module.exports = {
  solidity: "0.8.11",
  networks: {
    ropsten: {
      url: `https://ropsten.infura.io/v3/3545cbae9d6e43059d24ed854e4ba973`,
      accounts: [`${keys.ROPSTEN_PRIVATE_KEY}`]
    }
  },
};
