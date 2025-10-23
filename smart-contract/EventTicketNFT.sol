// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract EventTicketNFT is ERC721, Ownable, ReentrancyGuard {
    // Constants
    uint256 public constant MAX_RESALE_PERCENTAGE = 120; // 120% of original price
    uint256 public constant MAX_RESALE_COUNT = 1; // Can only be resold once
    uint256 public constant PLATFORM_FEE = 250; // 2.5%
    uint256 public constant CREATOR_ROYALTY = 500; // 5%
    uint256 public constant BASIS_POINTS = 10000;

    // State variables
    uint256 private _nextTokenId = 1;
    address public platformWallet;
    
    // Structs
    struct TicketInfo {
        uint256 eventId;
        uint256 typeId;
        uint256 originalPrice;
        uint256 mintedAt;
        bool isUsed;
        uint256 usedAt;
        bool isForResale;
        uint256 resalePrice;
        uint256 resaleDeadline;
        uint256 resaleCount;
        address eventCreator;
    }

    // Mappings
    mapping(uint256 => TicketInfo) public tickets;
    mapping(uint256 => bool) public usedTickets;
    mapping(address => bool) public authorizedMinters;

    // Events
    event TicketMinted(
        uint256 indexed tokenId,
        uint256 indexed eventId,
        uint256 indexed typeId,
        address to,
        uint256 originalPrice
    );
    
    event TicketResold(
        uint256 indexed tokenId,
        address indexed from,
        address indexed to,
        uint256 price
    );
    
    event TicketUsed(uint256 indexed tokenId, uint256 indexed eventId);
    
    event TicketListedForResale(
        uint256 indexed tokenId,
        uint256 resalePrice,
        uint256 deadline
    );
    
    event ResaleListingCancelled(uint256 indexed tokenId);

    // Modifiers
    modifier onlyAuthorizedMinter() {
        require(authorizedMinters[msg.sender] || msg.sender == owner(), "Not authorized to mint");
        _;
    }

    constructor(address _platformWallet) ERC721("EventTicket", "EVT") {
        platformWallet = _platformWallet;
    }

    // Owner functions
    function setPlatformWallet(address _platformWallet) external onlyOwner {
        platformWallet = _platformWallet;
    }

    function setAuthorizedMinter(address minter, bool authorized) external onlyOwner {
        authorizedMinters[minter] = authorized;
    }

    // Minting function (called by backend)
    function mintTicket(
        address to,
        uint256 eventId,
        uint256 typeId,
        uint256 originalPrice,
        address eventCreator
    ) external onlyAuthorizedMinter returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        
        tickets[tokenId] = TicketInfo({
            eventId: eventId,
            typeId: typeId,
            originalPrice: originalPrice,
            mintedAt: block.timestamp,
            isUsed: false,
            usedAt: 0,
            isForResale: false,
            resalePrice: 0,
            resaleDeadline: 0,
            resaleCount: 0,
            eventCreator: eventCreator
        });

        _safeMint(to, tokenId);
        
        emit TicketMinted(tokenId, eventId, typeId, to, originalPrice);
        return tokenId;
    }

    // Resale functions
    function listForResale(
        uint256 tokenId,
        uint256 resalePrice,
        uint256 resaleDeadline
    ) external {
        require(ownerOf(tokenId) == msg.sender, "Not ticket owner");
        require(!tickets[tokenId].isUsed, "Ticket already used");
        require(!tickets[tokenId].isForResale, "Already listed for resale");
        require(tickets[tokenId].resaleCount < MAX_RESALE_COUNT, "Max resale count reached");
        require(resaleDeadline > block.timestamp, "Invalid deadline");
        
        uint256 maxPrice = (tickets[tokenId].originalPrice * MAX_RESALE_PERCENTAGE) / 100;
        require(resalePrice > 0 && resalePrice <= maxPrice, "Invalid resale price");

        tickets[tokenId].isForResale = true;
        tickets[tokenId].resalePrice = resalePrice;
        tickets[tokenId].resaleDeadline = resaleDeadline;

        emit TicketListedForResale(tokenId, resalePrice, resaleDeadline);
    }

    function buyResaleTicket(uint256 tokenId) external payable nonReentrant {
        TicketInfo storage ticket = tickets[tokenId];
        require(ticket.isForResale, "Not for resale");
        require(msg.value == ticket.resalePrice, "Incorrect payment amount");
        require(!ticket.isUsed, "Ticket already used");
        require(block.timestamp <= ticket.resaleDeadline, "Resale deadline passed");

        address seller = ownerOf(tokenId);
        address buyer = msg.sender;

        // Process payment with fees
        _processResalePayment(ticket.eventCreator, seller, msg.value);

        // Transfer ownership
        _transfer(seller, buyer, tokenId);

        // Update ticket info
        ticket.currentOwner = buyer;
        ticket.isForResale = false;
        ticket.resalePrice = 0;
        ticket.resaleDeadline = 0;
        ticket.resaleCount++;

        emit TicketResold(tokenId, seller, buyer, msg.value);
    }

    function cancelResaleListing(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "Not ticket owner");
        require(tickets[tokenId].isForResale, "Not listed for resale");

        tickets[tokenId].isForResale = false;
        tickets[tokenId].resalePrice = 0;
        tickets[tokenId].resaleDeadline = 0;

        emit ResaleListingCancelled(tokenId);
    }

    // Ticket usage (called by event organizers)
    function useTicket(uint256 tokenId) external {
        require(tickets[tokenId].eventCreator == msg.sender, "Not event creator");
        require(!tickets[tokenId].isUsed, "Ticket already used");

        tickets[tokenId].isUsed = true;
        tickets[tokenId].usedAt = block.timestamp;
        usedTickets[tokenId] = true;

        emit TicketUsed(tokenId, tickets[tokenId].eventId);
    }

    // View functions
    function getTicketInfo(uint256 tokenId) external view returns (TicketInfo memory) {
        return tickets[tokenId];
    }

    function isTicketUsed(uint256 tokenId) external view returns (bool) {
        return usedTickets[tokenId];
    }

    function canResell(uint256 tokenId) external view returns (bool) {
        return tickets[tokenId].resaleCount < MAX_RESALE_COUNT;
    }

    function getMaxResalePrice(uint256 tokenId) external view returns (uint256) {
        return (tickets[tokenId].originalPrice * MAX_RESALE_PERCENTAGE) / 100;
    }

    // Internal functions
    function _processResalePayment(
        address eventCreator,
        address seller,
        uint256 amount
    ) internal {
        uint256 creatorFee = (amount * CREATOR_ROYALTY) / BASIS_POINTS;
        uint256 platformFee = (amount * PLATFORM_FEE) / BASIS_POINTS;
        uint256 sellerProceeds = amount - creatorFee - platformFee;

        // Transfer fees
        if (eventCreator != address(0)) {
            payable(eventCreator).transfer(creatorFee);
        }
        
        if (platformWallet != address(0)) {
            payable(platformWallet).transfer(platformFee);
        }

        // Transfer proceeds to seller
        payable(seller).transfer(sellerProceeds);
    }

    // Override tokenURI to return event-specific metadata
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "Token does not exist");
        // This would typically return IPFS metadata URL
        // For now, return a placeholder
        return string(abi.encodePacked("https://api.mymineticketku.com/metadata/", _toString(tokenId)));
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    // Emergency functions
    function emergencyWithdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}