// contact coinraiseme@protonmail.com for fund recovery (funds may not be recoverable in all circumstances)
pragma solidity ^0.8.11;

contract Campaign {
  //~~~~~~~~~Constants~~~~~~~~~

  address public daiAddress;

  /*
    A peripheral contract that transferrers DAI to the campaign contracts
    Transfers are sent through the transferrer so users don't need to give
    spending permissions to every campaign contract they want to donate to.
  */
  address public transferrer;

  /*
    A coinraise admin account that can claim forgotten/incorrectly sent funds.
    Admin can only claim funds if they have not been claimed from completed campaigns
      ~six months after the deadline (24 weeks). 
    Funds sent without using the donate() function will also be claimable by the admin
      ~six months after the deadline.
    Email coinraiseme@protonmail.com if you have incorrectly sent funds, we may
      be able to recover them for you.
  */
  address public admin;

  /*
    The fee percentage that goes to coinraise, scaled up by 100
    100 = 1% fee
    25 = 0.25% fee
  */
  uint32 public fee = 25;

  /*
    The account that recieves fees
  */
  address public feeBenefactor;


  //~~~~~~~~Campaign Params~~~~~~~~

  /*
    The account with administrative priviledges over this campaign,
    also the account that will recieve funds fromthis campaign
  */
  address public owner;

  /*
    The Unix timestamp (in seconds) of this cmpaign's deadline,
      after this time donations are no longer accepted. 
    If the fundingGoal is reached, the owner can withdraw funds at this time. 
    If the fundingGoal is not reached, donors can reclaim their funds at this time. 
    If the fundingGoal is reached, but funds are not claimed by the owner four weeks 
      after the deadline, donors will be able to reclaim those funds.
    If there are unclaimed funds in the contract 24 weeks (~6 months) after the deadline, those funds
      will be considered forgotten and become claimable by a CoinRaise admin
  */
  uint64 public deadline;

  /*
    The funding goal in atomic units of DAI. 
    If the goal is reached by the deadline, the owner will be able to claim raised funds.
    If the goal is not reached, donors will be able to reclaim funds
  */
  uint256 public fundingGoal;

  /*
    The max funding this campaign can receive in atomic units of DAI
    Donations that cause the campaign to exceed this maximum will be rejected.
    Sending funds directly to this campaign contract without using the donate() function will have 
      no effect on donation tracking and the funds will not be claimable by the owner. 
      A CoinRaise admin may be able to reclaim those funds ~6 months after the deadline.
  */
  uint256 public fundingMax;


  //~~~~~~~~~Dev Params~~~~~~~~~

  /*
    A varaible tracking if this campaign has been initialized, it can only be initialized once.
    init() is like a constructor, we use it because we cannot call a regular constructor when
    spawning new campaign contracts with a CloneFactory.
  */
  bool private initialized = false;


  //~~~~~~~~~~~State Data~~~~~~~~~~~

  /*
    A mapping tracking each individual's donations to this campaign
  */
  mapping (address=>uint256) donations;

  /*
    The total donations to this campaign
  */
  uint256 totalDonations;

  /*
    This variable will be flipped to true when the owner claims funds
  */
  bool claimed; 

  //~~~~~~~~~~Safety~~~~~~~~~~

  modifier onlyOwner() {
    require(msg.sender == owner, "only the owner can call this function");
    _;
  }

  modifier onlyTransferrer() {
    require(msg.sender == transferrer, "only the transferrer can call this function");
    _;
  }

  //~~~~~~~~~~~Core~~~~~~~~~~~~

  function init(address _owner, uint64 _deadline, uint256 _fundingGoal, uint256 _fundingMax) public {
    // safety checks
    require(initialized == false, "Campaign has already been initialized");
    require(_deadline > block.timestamp + 1 weeks, "Deadline must be at least 1 week from current time");
    require(_deadline < block.timestamp + 256 weeks, "Deadline must be within 3 years of the current time");
    
    //set parameters
    initialized = true;
    owner = _owner;
    deadline = _deadline;
    fundingGoal = _fundingGoal;
    fundingMax = _fundingMax;
    claimed = false;
  }

  /*

  */
  function donate(address _donor, uint256 _amount) public onlyTransferrer {
    require(block.timestamp >= deadline, "Cannot donate, campaign is already finished");
    require(_amount + totalDonations < fundingMax, "Donation would exceed the funding maximum");
    //TODO sanity check that dai balance is >= donations require(totalDonations >= );

    donations[_donor] += _amount;
    totalDonations += _amount;
  }

  function withdrawOwner() public onlyOwner {
    require(block.timestamp > deadline, "Cannot withdraw, this campaign is not finished yet");
    require(totalDonations >= fundingGoal, "Cannot withdraw, this campaign did not reach it's goal");
    require(claimed == false, "Cannot withdraw, owner already claimed funds");
    
    claimed = true;
    //TODO transfer DAI to owner

  }

  function withdrawDoner() public {
    require(block.timestamp > deadline, "Cannot withdraw, this campaign isn't over yet");
    // if the funding goal was reached, require a 4 week wait period for owner to claim funds
    if(totalDonations >= fundingGoal) {
      require(block.timestamp > deadline + 4 weeks, "Cannot withdraw, 4 week waiting period has not passed");
    }

    //all checks passed
    uint256 amount = donations[msg.sender];
    totalDonations -= amount;
    donations[msg.sender] = 0;

    //TODO transfer dai to msg.sender
  }

  function withdrawAdmin(address _token, uint256 _amount) public {
    require(msg.sender == admin, "only CoinRaise admin can call this function");
    require(block.timestamp > deadline + 24 weeks, "admin cannot claim forgotten funds before 6 months past the deadline");

    //TODO transfer ERC20 to admin
  }
}