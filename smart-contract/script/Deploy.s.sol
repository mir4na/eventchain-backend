// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {EventTicketNFT} from "../EventTicketNFT.sol";

contract DeployScript is Script {
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address platformWallet = vm.envAddress("PLATFORM_WALLET");
        
        vm.startBroadcast(deployerPrivateKey);

        EventTicketNFT nft = new EventTicketNFT(platformWallet);
        
        // Set the deployer as authorized minter
        nft.setAuthorizedMinter(vm.addr(deployerPrivateKey), true);

        console.log("EventTicketNFT deployed to:", address(nft));
        console.log("Platform wallet:", platformWallet);

        vm.stopBroadcast();
    }
}