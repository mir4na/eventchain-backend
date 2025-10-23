// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract EventTicketNFT is ERC721, Ownable, ReentrancyGuard {
    struct Ticket {
        uint256 ticketId;
        uint256 eventId;
        uint256 typeId;
        address currentOwner;
        bool isUsed;
        uint256 mintedAt;
        uint256 usedAt;
        bool isForResale;
        uint256 resalePrice;
        uint256 resaleDeadline;
        uint8 resaleCount;
    }

    // Constants
    uint256 public constant MAX_RESALE_COUNT = 1;
    uint256 public constant MAX_RESALE_PERCENTAGE = 120; // 120%
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant PLATFORM_FEE = 250; // 2.5%
    uint256 public constant CREATOR_ROYALTY = 500; // 5%

    // State variables
    uint256 private _currentTicketId;
    address public platformWallet;
    
    mapping(uint256 => Ticket) public tickets;
    mapping(uint256 => uint256) public originalPrices; // eventId => typeId => price
    mapping(address => uint256[]) public userTickets;
    uint256[] public resaleTicketIds;
    mapping(uint256 => uint256) public resaleTicketIndex;

    // Events
    event TicketMinted(uint256 indexed ticketId, uint256 indexed eventId, uint256 indexed typeId, address buyer);
    event TicketTransferred(uint256 indexed ticketId, address from, address to);
    event TicketUsed(uint256 indexed ticketId, uint256 indexed eventId, address user);
    event TicketListedForResale(uint256 indexed ticketId, uint256 resalePrice, uint256 deadline);
    event TicketResold(uint256 indexed ticketId, address from, address to, uint256 price);
    event ResaleListingCancelled(uint256 indexed ticketId);
    event PlatformWalletUpdated(address newWallet);

    constructor() ERC721("EventTicket", "EVT") {
        platformWallet = msg.sender;
    }

    modifier onlyTicketOwner(uint256 ticketId) {
        require(ownerOf(ticketId) == msg.sender, "Not ticket owner");
        _;
    }

    modifier ticketExists(uint256 ticketId) {
        require(tickets[ticketId].ticketId != 0, "Ticket does not exist");
        _;
    }

    function setPlatformWallet(address _platformWallet) external onlyOwner {
        require(_platformWallet != address(0), "Invalid address");
        platformWallet = _platformWallet;
        emit PlatformWalletUpdated(_platformWallet);
    }

    function mintTicket(
        address to,
        uint256 eventId,
        uint256 typeId,
        uint256 originalPrice
    ) external onlyOwner returns (uint256) {
        _currentTicketId++;
        uint256 ticketId = _currentTicketId;

        tickets[ticketId] = Ticket({
            ticketId: ticketId,
            eventId: eventId,
            typeId: typeId,
            currentOwner: to,
            isUsed: false,
            mintedAt: block.timestamp,
            usedAt: 0,
            isForResale: false,
            resalePrice: 0,
            resaleDeadline: 0,
            resaleCount: 0
        });

        // Store original price for resale validation
        originalPrices[eventId] = originalPrice;

        _safeMint(to, ticketId);
        userTickets[to].push(ticketId);

        emit TicketMinted(ticketId, eventId, typeId, to);
        return ticketId;
    }

    function listTicketForResale(
        uint256 ticketId,
        uint256 resalePrice,
        uint256 resaleDeadline
    ) external onlyTicketOwner(ticketId) ticketExists(ticketId) {
        Ticket storage ticket = tickets[ticketId];

        require(!ticket.isUsed, "Ticket already used");
        require(!ticket.isForResale, "Ticket already listed");
        require(ticket.resaleCount < MAX_RESALE_COUNT, "Max resale count reached");
        require(resaleDeadline > block.timestamp, "Invalid deadline");

        uint256 maxPrice = (originalPrices[ticket.eventId] * MAX_RESALE_PERCENTAGE) / 100;
        require(resalePrice > 0 && resalePrice <= maxPrice, "Invalid resale price");

        ticket.isForResale = true;
        ticket.resalePrice = resalePrice;
        ticket.resaleDeadline = resaleDeadline;

        resaleTicketIds.push(ticketId);
        resaleTicketIndex[ticketId] = resaleTicketIds.length - 1;

        emit TicketListedForResale(ticketId, resalePrice, resaleDeadline);
    }

    function buyResaleTicket(uint256 ticketId) external payable ticketExists(ticketId) nonReentrant {
        Ticket storage ticket = tickets[ticketId];

        require(ticket.isForResale, "Ticket not for resale");
        require(msg.value == ticket.resalePrice, "Incorrect payment amount");
        require(!ticket.isUsed, "Ticket already used");
        require(block.timestamp <= ticket.resaleDeadline, "Resale deadline passed");

        address previousOwner = ticket.currentOwner;
        uint256 eventId = ticket.eventId;

        // Process payment with fees
        _processResalePayment(eventId, previousOwner, msg.value);

        // Transfer ticket
        _transfer(previousOwner, msg.sender, ticketId);
        _removeFromUserTickets(previousOwner, ticketId);
        userTickets[msg.sender].push(ticketId);

        // Update ticket state
        ticket.currentOwner = msg.sender;
        ticket.isForResale = false;
        ticket.resalePrice = 0;
        ticket.resaleDeadline = 0;
        ticket.resaleCount++;

        _removeFromResaleList(ticketId);

        emit TicketResold(ticketId, previousOwner, msg.sender, msg.value);
    }

    function cancelResaleListing(uint256 ticketId) external onlyTicketOwner(ticketId) ticketExists(ticketId) {
        Ticket storage ticket = tickets[ticketId];
        require(ticket.isForResale, "Ticket not for resale");

        ticket.isForResale = false;
        ticket.resalePrice = 0;
        ticket.resaleDeadline = 0;

        _removeFromResaleList(ticketId);
        emit ResaleListingCancelled(ticketId);
    }

    function useTicket(uint256 ticketId) external onlyOwner ticketExists(ticketId) {
        Ticket storage ticket = tickets[ticketId];
        require(!ticket.isUsed, "Ticket already used");

        ticket.isUsed = true;
        ticket.usedAt = block.timestamp;

        emit TicketUsed(ticketId, ticket.eventId, ticket.currentOwner);
    }

    function getTicketDetails(uint256 ticketId) external view ticketExists(ticketId) returns (Ticket memory) {
        return tickets[ticketId];
    }

    function getUserTickets(address user) external view returns (uint256[] memory) {
        return userTickets[user];
    }

    function getResaleTickets() external view returns (uint256[] memory) {
        return resaleTicketIds;
    }

    function canResell(uint256 ticketId) external view ticketExists(ticketId) returns (bool) {
        return tickets[ticketId].resaleCount < MAX_RESALE_COUNT;
    }

    function getMaxResalePrice(uint256 ticketId) external view ticketExists(ticketId) returns (uint256) {
        uint256 eventId = tickets[ticketId].eventId;
        uint256 originalPrice = originalPrices[eventId];
        return (originalPrice * MAX_RESALE_PERCENTAGE) / 100;
    }

    function _processResalePayment(uint256 eventId, address seller, uint256 amount) internal {
        uint256 creatorFee = (amount * CREATOR_ROYALTY) / BASIS_POINTS;
        uint256 platformFee = (amount * PLATFORM_FEE) / BASIS_POINTS;
        uint256 sellerProceeds = amount - creatorFee - platformFee;

        // Transfer creator fee (would need event creator address from backend)
        // Transfer platform fee
        if (platformWallet != address(0)) {
            (bool success, ) = payable(platformWallet).call{value: platformFee}("");
            require(success, "Platform fee transfer failed");
        }

        // Transfer seller proceeds
        (bool success2, ) = payable(seller).call{value: sellerProceeds}("");
        require(success2, "Seller proceeds transfer failed");
    }

    function _removeFromResaleList(uint256 ticketId) internal {
        uint256 index = resaleTicketIndex[ticketId];
        uint256 lastIndex = resaleTicketIds.length - 1;

        if (index != lastIndex) {
            uint256 lastTicketId = resaleTicketIds[lastIndex];
            resaleTicketIds[index] = lastTicketId;
            resaleTicketIndex[lastTicketId] = index;
        }

        resaleTicketIds.pop();
        delete resaleTicketIndex[ticketId];
    }

    function _removeFromUserTickets(address user, uint256 ticketId) internal {
        uint256[] storage userTicketsList = userTickets[user];
        uint256 length = userTicketsList.length;

        for (uint256 i = 0; i < length; i++) {
            if (userTicketsList[i] == ticketId) {
                userTicketsList[i] = userTicketsList[length - 1];
                userTicketsList.pop();
                break;
            }
        }
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "Token does not exist");
        // Return metadata URI - this would be set by the backend
        return string(abi.encodePacked("https://api.yourapp.com/tickets/", _toString(tokenId)));
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
}