// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {EventTicketNFT} from "../contracts/EventTicketNFT.sol";

contract DeployScript is Script {
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        EventTicketNFT eventTicketNFT = new EventTicketNFT();

        address platformWallet = vm.envOr("PLATFORM_WALLET", deployer);
        eventTicketNFT.setPlatformWallet(platformWallet);

        vm.stopBroadcast();

        console.log("EventTicketNFT deployed to:", address(eventTicketNFT));
        console.log("Platform wallet set to:", platformWallet);
    }
}