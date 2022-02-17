const { ethers } = require("hardhat");

//spent
const deploySupport = async () => {
  const accounts = await ethers.getSigners();
  const MockDaiFactory = await ethers.getContractFactory("ERC20");
  const TransferrerFactory = await ethers.getContractFactory("Transferrer");
  const mockDai = await MockDaiFactory.deploy("DAI", "DAI", accounts[0].address);
  const transferrer = await TransferrerFactory.deploy(mockDai.address);
  console.log(mockDai);
  console.log(transferrer);
}

const mockDaiAddress = "0x694f34b3C2C05224fe070673976Be1396d4f91F4";
const transferrerAddress = "0xc3563cb3fE399319Bc34E6E327AdBbB858c4327E";

const deployCore = async () => {
  const accounts = await ethers.getSigners();
  const CampaignV0Factory = await ethers.getContractFactory("CampaignV0");
  const CampaignV0FactoryFactory = await ethers.getContractFactory("CampaignV0Factory");
  const campaignV0 = await CampaignV0Factory.deploy();
  await CampaignV0FactoryFactory.deploy(campaignV0.address);
}

deployCore()