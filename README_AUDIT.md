# CoinRaise Brief

CoinRaise is a non-custodial fundraising platform. Users may create fundraising campaigns for
anything they want without using a 3rd party custodian to hold funds. Currently all campaigns 
must use the DAI stablecoin. Users may also donate to campaigns. Campaigns have a funding goal, 
a funding max, and a deadline. The campaign creator can only withdraw the funds if the funding goal is 
reached before the deadline. Otherwise the donors are able to withdraw funds. Donors may also
withdraw funds if the owner doesn't withdraw them for a month

# contracts overview

Transferrer.sol - Transferes donations to campaigns, so users only have to approve one contract to donate to any campaign.

CampaignV0Factory.sol - Creates and tracks new campaigns, also sets the CoinRaise fee rate and admin/fee benefactor accounts.

CampaignV0.sol - The individual campaign contract that is created by the factory. Once the campaign is created, only the
variables marked "State Data" should be able to change.

You should be able to find more info about intended behavior in our test folder