const { ethers } = require("hardhat");
const factoryAbi = require("./abis/campaignV0FactoryAbi");
const transferrerAbi = require("./abis/transferrerV0Abi");
const erc20Abi = require("./abis/Erc20Abi");
const campaignAbi = require("./abis/campaignV0Abi");

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
const factoryAddress = "0x929F6E897D42eedB055D56B2b0b510CF8403D2Cc";

//spent
const deployCore = async () => {
  const CampaignV0Factory = await ethers.getContractFactory("CampaignV0");
  const CampaignV0FactoryFactory = await ethers.getContractFactory("CampaignV0Factory");
  const campaignV0 = await CampaignV0Factory.deploy();
  await CampaignV0FactoryFactory.deploy(campaignV0.address);
}

const createMocks = async () => {
  const evmTime = Math.floor((new Date().getTime() / 1000)) + 100;
  const weeks = 7 * 24 * 60 * 60;
  const accounts = await ethers.getSigners();
  const campaignV0Factory = new ethers.Contract(factoryAddress, factoryAbi, accounts[0]);
  const transferrer = new ethers.Contract(transferrerAddress, transferrerAbi, accounts[0]);
  const mockDai = new ethers.Contract(mockDaiAddress, erc20Abi, accounts[0])

  let receipt = await mockDai.approve(transferrerAddress, "10000000000000000000000000000000000000000000")
  await receipt.wait();

  receipt = await campaignV0Factory.createCampaign(
    evmTime + (1 * weeks) + 10000,
    "1000000000000000000000", 
    "2000000000000000000000", 
    "Hillary Clinton's special fund to exterminate the deplorables",
    "The fatherland can never reach it's full potential with all these deplorables, I say we ship them off to Madigascar.",
  );
  receipt = await receipt.wait();
  campaignAddress = receipt.events[0].args.campaign;
  await transferrer.donate(campaignAddress, "420000000000000000000");
}

createMocks();